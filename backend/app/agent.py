import json
import re
from typing import TypedDict, List, Literal, Optional, Dict, Any
from langgraph.graph import StateGraph, END

from .memory import FAISSMemory
from .utils.ollama_client import OllamaClient
from .storage import Storage


class State(TypedDict, total=False):
    task: Literal["tutor", "quiz", "analyze", "roadmap", "questions"]
    input: str
    history: List[Dict[str, Any]]
    retrieved: List[Dict[str, Any]]
    quiz: Dict[str, Any]
    analysis: Dict[str, Any]
    roadmap: Dict[str, Any]
    output: Any
    session_id: Optional[str]


class StudyAgent:
    def __init__(self, memory: FAISSMemory, model: str = "llama3", storage: Optional[Storage] = None):
        self.memory = memory
        self.llm = OllamaClient(model=model)
        self.storage = storage
        self.graph = self._build_graph()

    # Nodes
    def _route(self, state: State) -> str:
        return state["task"]

    def _retrieve(self, state: State) -> State:
        query = state.get("input", "")
        hits = self.memory.similarity_search(query, k=5)
        retrieved = []
        for _, score, md in hits:
            retrieved.append({"score": score, **md})
        state["retrieved"] = retrieved
        return state

    def _tutor(self, state: State) -> State:
        ctx = "\n\n".join([f"[Score {r['score']:.2f}] {r['text']}" for r in state.get("retrieved", [])])
        prompt = (
            "You are a helpful tutor. Use the provided context to answer clearly,"
            " step-by-step, with examples when helpful.\n\n"
            f"Context:\n{ctx}\n\n"
            f"Question: {state.get('input','')}\n"
            "Answer:"
        )
        answer = self.llm.generate(prompt)
        state["output"] = {"answer": answer, "citations": [r.get("meta", {}) for r in state.get("retrieved", [])]}
        return state

    def _questions(self, state: State) -> State:
        ctx = "\n\n".join([r["text"] for r in state.get("retrieved", [])])
        prompt = (
            "Generate 5 focused, diverse practice questions (short-answer) for the learner's input.\n"
            "Return as a numbered list only.\n\n"
            f"Context (may be empty):\n{ctx}\n\nTopic or prompt: {state.get('input','')}\n"
        )
        qtext = self.llm.generate(prompt)
        state["output"] = {"questions": qtext}
        return state

    def _quiz(self, state: State) -> State:
        # Check if there are weak topics to focus on
        session_id = state.get("session_id")
        weak_topics_focus = ""
        if self.storage and session_id:
            try:
                weak_topics = self.storage.get_weak_topics(session_id)
                if weak_topics:
                    topics_list = [f"{wt.get('title', wt.get('topic', 'Unknown'))}: {wt.get('detail', '')}" for wt in weak_topics[:3]]
                    weak_topics_focus = f"\n\n**IMPORTANT: Focus heavily on these weak areas:**\n" + "\n".join(f"- {t}" for t in topics_list)
            except Exception as e:
                print(f"Warning: Could not load weak topics: {e}")
        
        ctx = "\n\n".join([r["text"] for r in state.get("retrieved", [])])
        topic_input = state.get('input', '')
        
        # If user hasn't provided topic, suggest they learn something first
        if not topic_input or topic_input.strip() == '':
            state["quiz"] = {"raw": "Please enter a topic for the quiz.", "questions": []}
            state["output"] = state["quiz"]
            return state
        
        prompt = (
            "Create a 5-question multiple choice quiz (A-D) about the topic."
            " Provide the correct option letter and one-sentence explanation after each question.\n"
            f"{weak_topics_focus}\n"
            "Format strictly as: Q:..., A) ..., B) ..., C) ..., D) ..., Answer: <letter>, Explanation: ...\n\n"
            f"Context (may be empty):\n{ctx}\n\nTopic: {topic_input}\n"
        )
        quiz = self.llm.generate(prompt)
        questions = self._parse_quiz_output(quiz)
        state["quiz"] = {"raw": quiz, "questions": questions}
        state["output"] = state["quiz"]
        return state

    def _parse_quiz_output(self, raw: str) -> List[Dict[str, Any]]:
        questions: List[Dict[str, Any]] = []
        option_pattern = re.compile(r"([A-D])\)\s*(.*?)(?=(?:\s+[A-D]\)|\s+Answer:|$))", re.S)
        letter_order = ["A", "B", "C", "D"]
        chunks = [chunk.strip() for chunk in raw.split("Q:") if chunk.strip()]
        for sequence, chunk in enumerate(chunks, start=1):
            question_text = chunk
            if "A)" in chunk:
                question_text = chunk.split("A)", 1)[0].strip()
            question_text = question_text.rstrip("–-:,. ")
            matches = option_pattern.findall(chunk)
            options: List[str] = []
            # keep options in A-D order to preserve consistent indexing
            match_map = {letter: text.strip().rstrip(",") for letter, text in matches}
            for letter in letter_order:
                if letter in match_map:
                    options.append(match_map[letter])
            answer_match = re.search(r"Answer:\s*([A-D])", chunk)
            explanation_match = re.search(r"Explanation:\s*(.*?)(?=\s*Q:|$)", chunk, re.S)
            correct_index: Optional[int] = None
            if answer_match:
                letter = answer_match.group(1)
                if letter in letter_order and letter in match_map:
                    correct_index = letter_order.index(letter)
            explanation = explanation_match.group(1).strip() if explanation_match else ""
            if question_text:
                questions.append(
                    {
                        "sequence": sequence,
                        "question": question_text,
                        "options": options,
                        "correct_index": correct_index,
                        "explanation": explanation,
                    }
                )
        return questions

    def _analyze(self, state: State) -> State:
        # Basic heuristic analysis using retrieval and optional history
        history = state.get("history", [])
        attempted = [m for m in history if m.get("role") == "assistant" and m.get("type") == "quiz_result"]
        summary = {
            "attempts": len(attempted),
            "weak_topics": [],
        }
        # Use LLM to summarize weaknesses from history text
        history_text = "\n".join([str(m.get("content")) for m in history][-20:])
        prompt = (
            "Given the learner's recent interactions and quiz results, identify 3 weakest subtopics,"
            " likely misconceptions, and give 3 targeted next steps. Return compact bullet points.\n\n"
            f"History:\n{history_text}\n"
        )
        analysis = self.llm.generate(prompt)
        state["analysis"] = {"summary": analysis}
        state["output"] = state["analysis"]
        return state

    def _roadmap(self, state: State) -> State:
        ctx = "\n\n".join([r["text"] for r in state.get("retrieved", [])])
        prompt = (
            "Create a 2-week personalized study roadmap broken into daily tasks."
            " Include objectives, recommended resources, and estimated hours per day."
            " Tailor to the learner's weaknesses if present.\n\n"
            f"Context:\n{ctx}\n\nFocus: {state.get('input','')}\n"
        )
        plan = self.llm.generate(prompt)
        state["roadmap"] = {"plan": plan}
        state["output"] = state["roadmap"]
        return state

    def _build_graph(self):
        g = StateGraph(State)
        g.add_node("retrieve", self._retrieve)
        g.add_node("do_tutor", self._tutor)
        g.add_node("do_quiz", self._quiz)
        g.add_node("do_analyze", self._analyze)
        g.add_node("do_roadmap", self._roadmap)
        g.add_node("do_questions", self._questions)
        g.set_entry_point("retrieve")

        # After retrieve, route based on task
        def router(state: State) -> str:
            task = state.get("task", "tutor")
            return task

        g.add_conditional_edges(
            "retrieve",
            router,
            {
                "tutor": "do_tutor",
                "quiz": "do_quiz",
                "analyze": "do_analyze",
                "roadmap": "do_roadmap",
                "questions": "do_questions",
            },
        )
        g.add_edge("do_tutor", END)
        g.add_edge("do_quiz", END)
        g.add_edge("do_analyze", END)
        g.add_edge("do_roadmap", END)
        g.add_edge("do_questions", END)
        return g.compile()

    def run(
        self,
        task: str,
        user_input: str,
        history: Optional[List[Dict[str, Any]]] = None,
        session_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        if self.storage:
            session_id = self.storage.ensure_session(session_id)
            self.storage.log_message(session_id, "user", user_input, task=task)

        initial: State = {
            "task": task,  # type: ignore
            "input": user_input,
            "history": history or [],
            "session_id": session_id,
        }
        try:
            final_state: State = self.graph.invoke(initial)
        except Exception as e:
            print(f"Graph execution error: {e}")
            import traceback
            traceback.print_exc()
            # Return error response
            return {
                "task": task,
                "output": {"error": str(e)},
                "meta": {},
                "session_id": session_id,
            }
        
        if final_state is None:
            return {
                "task": task,
                "output": {"error": "Graph execution returned None"},
                "meta": {},
                "session_id": session_id,
            }
        
        output = final_state.get("output", {})

        response_meta: Dict[str, Any] = dict(final_state.get("meta") or {})
        response_meta["retrieved"] = final_state.get("retrieved", [])
        quiz_data = final_state.get("quiz")
        if self.storage and session_id:
            attempt_id = None
            if quiz_data:
                attempt_questions = quiz_data.get("questions", [])
                attempt_id, question_data = self.storage.log_quiz_attempt(
                    session_id=session_id,
                    topic=final_state.get("input", ""),
                    raw_output=quiz_data.get("raw", ""),
                    questions=attempt_questions,
                    task=task,
                    meta=response_meta,
                )
                # question_data is list of tuples: (id, sequence, question, options, correct_index, explanation)
                for question_dict, q_data in zip(attempt_questions, question_data):
                    question_dict["id"] = q_data[0]  # q_data[0] is the id
                response_meta["quiz_attempt_id"] = attempt_id
            assistant_text = self._format_output(output)
            self.storage.log_message(session_id, "assistant", assistant_text, task=task, meta=response_meta)
            analysis_data = final_state.get("analysis")
            if analysis_data and isinstance(analysis_data, dict):
                analysis_summary = analysis_data.get("summary")
                if analysis_summary:
                    self.storage.log_weak_topics(session_id, analysis_summary)

        return {
            "task": task,
            "output": output,
            "meta": response_meta,
            "session_id": session_id,
        }

    def _format_output(self, output: Any) -> str:
        if isinstance(output, dict):
            if "answer" in output:
                return str(output["answer"])
            if "plan" in output:
                return str(output["plan"])
            return json.dumps(output, ensure_ascii=False)
        return str(output)
