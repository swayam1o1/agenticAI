import json
import re
from typing import TypedDict, List, Literal, Optional, Dict, Any
from langgraph.graph import StateGraph, END

from .memory import FAISSMemory
from .utils.ollama_client import OllamaClient
from .storage import Storage


class State(TypedDict, total=False):
    task: Literal["tutor", "quiz", "analyze", "roadmap", "questions", "synthesize", "mindmap", "flashcards"]
    input: str
    history: List[Dict[str, Any]]
    retrieved: List[Dict[str, Any]]
    proactive: Dict[str, Any]
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
        query = state.get("input", "").strip()
        retrieved = []
        if query and self.memory:
            try:
                hits = self.memory.similarity_search(query, k=5)
                for _, score, md in hits:
                    retrieved.append({"score": score, **md})
            except Exception as e:
                print(f"Retrieval error: {e}")
        state["retrieved"] = retrieved
        return state

    def _build_proactive_context(self, session_id: Optional[str]) -> Dict[str, Any]:
        proactive: Dict[str, Any] = {"weak_topics": [], "roadmap_tasks": []}
        if not self.storage or not session_id:
            return proactive
        try:
            weak_topics = self.storage.get_weak_topics(session_id)
            roadmap_tasks = self.storage.get_roadmap_tasks(session_id)
            proactive["weak_topics"] = weak_topics[:3]
            proactive["roadmap_tasks"] = [task for task in roadmap_tasks if task.get("status") == "pending"][:3]
        except Exception as exc:
            print(f"Warning: could not build proactive context: {exc}")
        return proactive

    def _tutor(self, state: State) -> State:
        ctx = "\n\n".join([f"[Score {r['score']:.2f}] {r['text']}" for r in state.get("retrieved", [])])

        history = state.get("history", [])
        history_text = ""
        if history:
            recent = history[-10:]
            history_text = "\n".join([f"{m.get('role','').upper()}: {m.get('content','')}" for m in recent])

        proactive = state.get("proactive", {})
        weak_topics = proactive.get("weak_topics", [])
        roadmap_tasks = proactive.get("roadmap_tasks", [])

        prompt = (
            "You are an expert AI tutor. Your teaching style:\n"
            "- Explain concepts step-by-step with clear structure\n"
            "- Use real-world analogies and examples\n"
            "- Format with markdown: ## headers, **bold** key terms, bullet points\n"
            "- Use code blocks for code or pseudocode\n"
            "- Use the learner's saved memory as grounding when it is relevant\n"
            "- Proactively suggest the best next step when you notice confusion or a weak area\n"
            "- Be concise but thorough, ask follow-up questions when helpful\n\n"
        )
        if ctx.strip():
            prompt += f"Reference Material:\n{ctx}\n\n"
        if history_text:
            prompt += f"Conversation so far:\n{history_text}\n\n"
        if weak_topics:
            prompt += "Known weak areas to reinforce:\n"
            prompt += "\n".join([f"- {item.get('title', 'Unknown')}: {item.get('detail', '')}" for item in weak_topics])
            prompt += "\n\n"
        if roadmap_tasks:
            prompt += "Open study tasks:\n"
            prompt += "\n".join([f"- {task.get('title', 'Task')}: {task.get('detail', '')}" for task in roadmap_tasks])
            prompt += "\n\n"
        prompt += f"Student: {state.get('input','')}\nTutor:"

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
            "Create a 5-question multiple choice quiz (A-D) about the topic.\n"
            "CRITICAL: Ensure that all four options (A, B, C, D) are approximately the EXACT SAME character length so the user cannot guess based on formatting!\n"
            "Provide the correct option letter and one-sentence explanation after each question.\n"
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
        # Check what type of analysis to perform based on input
        analysis_input = state.get("input", "").lower()
        session_id = state.get("session_id")
        
        if not self.storage or not session_id:
            state["analysis"] = {"summary": "No data available for analysis."}
            state["output"] = state["analysis"]
            return state
        
        # Determine analysis type
        if "chat" in analysis_input or "conversation" in analysis_input:
            return self._analyze_chat(state, session_id)
        else:
            return self._analyze_quiz(state, session_id)
    
    def _analyze_quiz(self, state: State, session_id: str) -> State:
        """Analyze based on quiz performance"""
        quiz_history = self.storage.get_quiz_history(session_id)
        
        if not quiz_history or len(quiz_history) == 0:
            state["analysis"] = {"summary": "No quiz attempts found. Take a quiz first to identify weak areas."}
            state["output"] = state["analysis"]
            return state
        
        # Build quiz performance summary for LLM
        quiz_summary_parts = []
        for idx, attempt in enumerate(quiz_history[-5:], 1):
            topic = attempt.get('topic', 'Unknown')
            correct = attempt.get('correct_count', 0)
            total = attempt.get('total_questions', 0)
            accuracy = (correct / total * 100) if total > 0 else 0
            
            questions = attempt.get('questions', [])
            incorrect_qs = [q for q in questions if q.get('user_answer', {}).get('is_correct') == False]
            
            quiz_summary_parts.append(
                f"Quiz {idx} - {topic}: {correct}/{total} correct ({accuracy:.0f}%)\n"
                f"Incorrect questions: {len(incorrect_qs)}"
            )
            
            for q in incorrect_qs[:3]:
                quiz_summary_parts.append(f"  ❌ {q.get('question', '')[:80]}...")
        
        quiz_text = "\n".join(quiz_summary_parts)
        
        prompt = (
            "Analyze the quiz performance below and identify the TOP 5 weakest areas.\n"
            "Return ONLY a numbered list with this exact format:\n"
            "1. Topic Name: Brief explanation of the weakness\n"
            "2. Topic Name: Brief explanation of the weakness\n"
            "Do NOT include introductory text or headers.\n\n"
            f"Quiz Performance Data:\n{quiz_text}\n\n"
            "TOP 5 WEAK AREAS:\n"
        )
        
        analysis = self.llm.generate(prompt)
        state["analysis"] = {"summary": analysis}
        state["output"] = state["analysis"]
        return state
    
    def _analyze_chat(self, state: State, session_id: str) -> State:
        """Analyze based on conversation history"""
        history = state.get("history", [])
        
        if not history or len(history) < 1:
            state["analysis"] = {"summary": "Not enough conversation history. Chat more with the tutor first."}
            state["output"] = state["analysis"]
            return state
        
        # Pre-extract topics from "Please teach me about X" / "Explain X" / "What is X" patterns
        import re
        requested_topics = []
        teach_patterns = [
            r"(?:please\s+)?teach\s+me\s+about\s+(.+?)(?:\.|$)",
            r"(?:please\s+)?explain\s+(?:to\s+me\s+)?(.+?)(?:\.|$)",
            r"what\s+is\s+(.+?)(?:\?|$)",
            r"how\s+does\s+(.+?)\s+work",
            r"tell\s+me\s+about\s+(.+?)(?:\.|$)",
        ]
        for msg in history:
            if msg.get("role") == "user":
                content = msg.get("content", "").strip()
                for pattern in teach_patterns:
                    m = re.search(pattern, content, re.IGNORECASE)
                    if m:
                        topic = m.group(1).strip().rstrip("?.,!")
                        if 2 < len(topic) < 80:
                            requested_topics.append(topic)
                        break

        # Build conversation summary (last 30 messages)
        recent_messages = history[-30:]
        conversation_text = "\n".join([
            f"{msg.get('role', 'unknown').upper()}: {msg.get('content', '')[:200]}"
            for msg in recent_messages
        ])
        
        # Include explicitly requested topics in the prompt
        topics_hint = ""
        if requested_topics:
            unique_topics = list(dict.fromkeys(requested_topics))[:5]  # deduplicate, keep order
            topics_hint = (
                "NOTE: The learner explicitly asked to learn about these topics: "
                + ", ".join(f'"{t}"' for t in unique_topics)
                + ". These MUST appear in your output.\n\n"
            )

        prompt = (
            "Analyze the conversation below and produce the TOP 5 study areas.\n"
            "Rules:\n"
            "- If the learner explicitly ASKED to learn something ('teach me about X', 'explain X', 'what is X'), that topic MUST be included.\n"
            "- If the learner shows confusion or repeated questions about a concept, include that.\n"
            "- If the learner seems competent, suggest the next advanced concept to master.\n"
            f"{topics_hint}"
            "Return ONLY a numbered list with this exact format:\n"
            "1. Topic Name: Brief explanation of why this should be studied/reviewed\n"
            "2. Topic Name: Brief explanation of why this should be studied/reviewed\n"
            "Do NOT include introductory text or headers.\n\n"
            f"Conversation History:\n{conversation_text}\n\n"
            "TOP 5 STUDY AREAS:\n"
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

    def _synthesize(self, state: State) -> State:
        ctx = "\n\n".join([r["text"] for r in state.get("retrieved", [])])
        session_id = state.get("session_id")
        
        # Gather all context for synthesis
        history = state.get("history", [])
        history_text = "\n".join([f"{m.get('role','').upper()}: {m.get('content','')}" for m in history[-20:]])
        
        weak_topics = []
        if self.storage and session_id:
            weak_topics = self.storage.get_weak_topics(session_id)
            
        weak_text = "\n".join([f"- {wt.get('title', 'Topic')}: {wt.get('detail', '')}" for wt in weak_topics])
        
        prompt = (
            "You are an AI Study Guide Synthesizer (similar to NotebookLM).\n"
            "Based on the learner's chat history, weak areas, and the retrieved context about the subject,\n"
            "generate a comprehensive 'Study Guide' or 'Briefing Doc'.\n"
            "Include:\n"
            "1. **Core Concept Summary**: Explain the main topics discovered comprehensively but concisely.\n"
            "2. **FAQ Section**: Anticipate 3-5 common questions the learner might have and provide clear answers.\n"
            "3. **Focus Areas to Review**: Review the known weak topics with specific advice.\n"
            "Use Markdown formatting structure with clear headings.\n\n"
        )
        
        if ctx.strip():
            prompt += f"Context Documents:\n{ctx}\n\n"
        if history_text:
            prompt += f"Recent Chat Interactions:\n{history_text}\n\n"
        if weak_text:
            prompt += f"Known Weak Areas:\n{weak_text}\n\n"
            
        prompt += "Generate the Study Guide now:\n"
        
        guide = self.llm.generate(prompt)
        state["output"] = {"guide": guide}
        return state

    def _mindmap(self, state: State) -> State:
        session_id = state.get("session_id")
        weak_topics = []
        if self.storage and session_id:
            weak_topics = self.storage.get_weak_topics(session_id)
        
        history = state.get("history", [])
        history_text = "\n".join([f"{m.get('role','').upper()}: {m.get('content','')}" for m in history[-20:]])
        
        user_input = state.get("input", "")
        focus_prompt = f"The user requested this SPECIFIC topic: '{user_input}'. Prioritize ONLY this topic.\n" if user_input else ""
        
        prompt = (
            "You are an AI that generates valid Mermaid.js Mindmaps.\n"
            f"{focus_prompt}"
            "Create a cohesive mind map covering the topics discussed in the following chat history and known weak topics.\n"
            "Use the strict Mermaid mindmap syntax:\n"
            "mindmap\n"
            "  root((\"Main Topic\"))\n"
            "    [\"ACTUAL CONCEPTUAL SUBTOPIC\"]\n"
            "      [\"ACTUAL CONCEPTUAL DETAIL\"]\n\n"
            "CRITICAL RULES TO PREVENT CRASHES AND HALLUCINATIONS:\n"
            "1. You MUST wrap EVERY single node's text in brackets and quotes like this: [\"Your text here\"]. This ensures colons, commas, and parentheses do not crash the parser.\n"
            "2. Do NOT include any markdown code block backticks (like ```mermaid), JUST the raw mermaid syntax starting with 'mindmap'.\n"
            "3. Keep labels very short and simple (no complex symbols).\n"
            "4. NEVER output the placeholder words 'Main Topic', 'Subtopic1', 'Detail1'. You MUST write ACTUAL deep concepts, algorithms, and definitions based on the user's specific topic!\n\n"
        )
        if weak_topics:
            prompt += "Weak Topics:\n" + "\n".join([f"- {w.get('title')}: {w.get('detail')}" for w in weak_topics]) + "\n\n"
        if history_text:
            prompt += f"Chat History:\n{history_text}\n\n"
            
        mindmap = self.llm.generate(prompt)
        if mindmap.startswith("```mermaid"):
            mindmap = mindmap[10:].strip()
        if mindmap.startswith("```"):
            mindmap = mindmap[3:].strip()
        if mindmap.endswith("```"):
            mindmap = mindmap[:-3].strip()
            
        state["output"] = {"mindmap": mindmap.strip()}
        return state

    def _flashcards(self, state: State) -> State:
        session_id = state.get("session_id")
        weak_topics = []
        if self.storage and session_id:
            weak_topics = self.storage.get_weak_topics(session_id)
        
        prompt = (
            "You are an expert AI tutor.\n"
            "Your ONLY task is to generate exactly 4 highly effective, strictly technical study flashcards.\n"
            "Output the flashcards strictly as a valid JSON array of objects. Do not write anything outside the JSON.\n"
            "Flashcards MUST be purely technical and factual (e.g. definitions, algorithms, mathematical constraints). NO conversational text.\n"
            "CRITICAL: UNDER NO CIRCUMSTANCES should you create flashcards about this application (Do NOT write about 'Chat Analysis', 'Roadmap', 'Weak Areas Engine', or 'Quizzes'). ONLY educational content.\n"
            "Format: [{\"front\": \"string\", \"back\": \"string\"}]\n\n"
        )
        
        user_input = state.get("input", "")
        if user_input:
            prompt += f"Target this Specific Topic requested by user:\n- {user_input}\n\n"
        elif weak_topics:
            prompt += "Target these Weak Topics:\n" + "\n".join([f"- {w.get('title')}: {w.get('detail')}" for w in weak_topics]) + "\n\n"
        else:
            prompt += "Since there are no weak topics yet, generate 4 flashcards covering general programming and data science core concepts (like what is an API, what is a database, what is a neural network, etc).\n\n"
            
        # Add some context if retrieved
        if state.get("retrieved"):
            prompt += "Here is some context from the user's memory bank:\n"
            for doc in state.get("retrieved", []):
                prompt += doc.get("page_content", "") + "\n\n"
                
        flashcards_json = self.llm.generate(prompt)
        
        import json
        import re
        
        cards = []
        # Find all individual JSON objects that look like flashcards
        matches = re.findall(r'\{[^{}]*?\"front\"[^{}]*?\}', flashcards_json, re.DOTALL | re.IGNORECASE)
        
        for m in matches:
            try:
                # Some models escape quotes inside strings, or add rogue quotes
                obj = json.loads(m)
                if "front" in obj and "back" in obj:
                    cards.append(obj)
            except Exception:
                pass
                
        # If the regex matcher failed, try parsing the whole thing as a fallback
        if not cards:
            try:
                match = re.search(r'\[.*\]', flashcards_json, re.DOTALL)
                if match:
                    parsed = json.loads(match.group(0))
                    if isinstance(parsed, list):
                        cards = parsed
            except Exception:
                pass

        if not cards:
            cards = [{"front": "Error generating flashcards", "back": f"Invalid JSON format. Output:\n{flashcards_json[:100]}"}]
            
        state["output"] = {"flashcards": cards[:4]} # strict 4 items as requested
        return state

    def _build_graph(self):
        g = StateGraph(State)
        g.add_node("retrieve", self._retrieve)
        g.add_node("do_tutor", self._tutor)
        g.add_node("do_quiz", self._quiz)
        g.add_node("do_analyze", self._analyze)
        g.add_node("do_roadmap", self._roadmap)
        g.add_node("do_questions", self._questions)
        g.add_node("do_synthesize", self._synthesize)
        g.add_node("do_mindmap", self._mindmap)
        g.add_node("do_flashcards", self._flashcards)
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
                "synthesize": "do_synthesize",
                "mindmap": "do_mindmap",
                "flashcards": "do_flashcards",
            },
        )
        g.add_edge("do_tutor", END)
        g.add_edge("do_quiz", END)
        g.add_edge("do_analyze", END)
        g.add_edge("do_roadmap", END)
        g.add_edge("do_questions", END)
        g.add_edge("do_synthesize", END)
        g.add_edge("do_mindmap", END)
        g.add_edge("do_flashcards", END)
        return g.compile()

    def run(
        self,
        task: str,
        user_input: str,
        history: Optional[List[Dict[str, Any]]] = None,
        session_id: Optional[str] = None,
        silent: bool = False,  # If True, do NOT log the user message (for background workers)
    ) -> Dict[str, Any]:
        if self.storage:
            session_id = self.storage.ensure_session(session_id)
            if not silent:
                self.storage.log_message(session_id, "user", user_input, task=task)

        initial: State = {
            "task": task,  # type: ignore
            "input": user_input,
            "history": history or [],
            "session_id": session_id,
            "proactive": self._build_proactive_context(session_id),
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
        response_meta["proactive"] = final_state.get("proactive", {})
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
            memory_note = self._build_memory_note(task, user_input, assistant_text, final_state.get("retrieved", []))
            if memory_note:
                self.memory.add_texts(
                    [memory_note],
                    [{"session_id": session_id, "task": task, "kind": "interaction-summary"}],
                )
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

    def _build_memory_note(
        self,
        task: str,
        user_input: str,
        assistant_text: str,
        retrieved: Optional[List[Dict[str, Any]]] = None,
    ) -> Optional[str]:
        if task not in {"tutor", "analyze", "roadmap", "questions"}:
            return None
        assistant_text = assistant_text.strip()
        if not assistant_text:
            return None
        compact_answer = assistant_text[:1200]
        reference_count = len(retrieved or [])
        return (
            f"Task: {task}\n"
            f"Learner request: {user_input.strip()}\n"
            f"Tutor response summary: {compact_answer}\n"
            f"Referenced memory chunks: {reference_count}"
        )
