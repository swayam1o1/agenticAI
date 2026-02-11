"""
Learn Orchestrator - Manages the Learn -> Quiz -> Analyze -> Re-quiz flow for concept mastery
"""
from typing import Dict, Any, List, Optional
from .agent import StudyAgent
from .storage import Storage
from .memory import FAISSMemory


class LearnOrchestrator:
    """Orchestrates the complete learning journey for a specific concept"""
    
    def __init__(self, agent: StudyAgent, storage: Storage, memory: FAISSMemory):
        self.agent = agent
        self.storage = storage
        self.memory = memory
    
    def start_learning(self, session_id: str, concept: str) -> Dict[str, Any]:
        """
        Phase 1: Learn
        Automatically prompt the tutor to teach the concept
        """
        # Ensure session exists
        session_id = self.storage.ensure_session(session_id)
        
        # Generate teaching prompt
        teaching_prompt = f"Please teach me about {concept}. Explain it clearly with examples and key points."
        
        # Call tutor agent
        result = self.agent.run(
            task="tutor",
            user_input=teaching_prompt,
            history=[],
            session_id=session_id
        )
        
        return {
            "phase": "learn",
            "concept": concept,
            "session_id": session_id,
            "teaching": result.get("output", {}).get("answer", ""),
            "next_action": "quiz",
            "message": f"✅ Learned about {concept}. Ready to test your knowledge?"
        }
    
    def generate_concept_quiz(self, session_id: str, concept: str, focus_weak_areas: bool = False) -> Dict[str, Any]:
        """
        Phase 2: Quiz
        Generate quiz questions for the concept
        If focus_weak_areas is True, analyze previous attempts and focus on weak sub-topics
        """
        quiz_prompt = concept
        
        if focus_weak_areas:
            # Get weak topics for this concept
            weak_topics = self.storage.get_weak_topics(session_id)
            concept_weak = [wt for wt in weak_topics if concept.lower() in wt.get('title', '').lower()]
            if concept_weak:
                weak_details = ", ".join([wt.get('detail', '') for wt in concept_weak[:3]])
                quiz_prompt = f"{concept} - Focus on: {weak_details}"
        
        # Generate quiz
        result = self.agent.run(
            task="quiz",
            user_input=quiz_prompt,
            history=[],
            session_id=session_id
        )
        
        quiz_output = result.get("output", {})
        attempt_id = result.get("meta", {}).get("quiz_attempt_id")
        
        return {
            "phase": "quiz",
            "concept": concept,
            "session_id": session_id,
            "attempt_id": attempt_id,
            "questions": quiz_output.get("questions", []),
            "raw": quiz_output.get("raw", ""),
            "next_action": "submit_answers",
            "message": f"📝 Quiz generated for {concept}. Answer the questions to assess your understanding."
        }
    
    def analyze_quiz_results(self, session_id: str, attempt_id: int, concept: str) -> Dict[str, Any]:
        """
        Phase 3: Analyze
        Analyze the quiz results, identify weak areas in this concept
        """
        # Get quiz history for this attempt
        quiz_history = self.storage.get_quiz_history(session_id)
        current_attempt = next((q for q in quiz_history if q.get("attempt_id") == attempt_id), None)
        
        if not current_attempt:
            return {"error": "Quiz attempt not found"}
        
        correct_count = current_attempt.get("correct_count", 0)
        total_questions = current_attempt.get("total_questions", 0)
        
        # Update concept mastery
        mastery_data = self.storage.update_concept_mastery(
            session_id=session_id,
            concept=concept,
            correct=correct_count,
            total=total_questions
        )
        
        # Get the questions and analyze wrong answers
        questions = current_attempt.get("questions", [])
        wrong_questions = []
        for q in questions:
            answer = q.get("answer")
            if answer and not answer.get("is_correct"):
                wrong_questions.append({
                    "question": q.get("question"),
                    "correct_answer": q.get("options", [])[q.get("correct_index", 0)] if q.get("correct_index") is not None else "Unknown",
                    "user_answer": answer.get("selected_option", "No answer"),
                })
        
        # Use LLM to analyze weak areas
        if wrong_questions:
            wrong_text = "\n".join([f"- Q: {w['question']}\n  Correct: {w['correct_answer']}\n  User answered: {w['user_answer']}" for w in wrong_questions])
            analysis_prompt = f"""Analyze the learner's quiz performance on "{concept}":
            
Total: {total_questions} questions, Correct: {correct_count}

Wrong answers:
{wrong_text}

Identify 2-3 specific sub-topics or concepts within "{concept}" that need more practice.
Format as bullet points with brief explanations."""

            result = self.agent.run(
                task="analyze",
                user_input=analysis_prompt,
                history=[],
                session_id=session_id
            )
            
            analysis_summary = result.get("output", {}).get("summary", "Review the incorrect answers")
        else:
            analysis_summary = f"🎉 Perfect score! You've mastered {concept}."
        
        # Determine next action based on mastery score
        needs_practice = mastery_data["mastery_score"] < 80.0
        
        return {
            "phase": "analyze",
            "concept": concept,
            "session_id": session_id,
            "mastery": mastery_data,
            "analysis": analysis_summary,
            "wrong_questions": wrong_questions,
            "needs_practice": needs_practice,
            "next_action": "focused_quiz" if needs_practice else "complete",
            "message": f"📊 Analysis complete. Mastery: {mastery_data['mastery_score']:.1f}%"
        }
    
    def get_learning_progress(self, session_id: str, concept: Optional[str] = None) -> Dict[str, Any]:
        """Get complete learning progress for a concept or all concepts"""
        masteries = self.storage.get_concept_mastery(session_id, concept)
        
        if concept:
            # Get detailed progress for specific concept
            mastery = masteries[0] if masteries else None
            if not mastery:
                return {
                    "concept": concept,
                    "status": "not_started",
                    "mastery_score": 0,
                    "message": f"Start learning {concept}"
                }
            
            # Determine status based on mastery score
            score = mastery["mastery_score"]
            if score >= 90:
                status = "mastered"
                message = f"✅ Mastered {concept}"
            elif score >= 70:
                status = "proficient"
                message = f"👍 Proficient in {concept}"
            elif score >= 50:
                status = "learning"
                message = f"📚 Still learning {concept}"
            else:
                status = "needs_practice"
                message = f"⚠️ {concept} needs more practice"
            
            return {
                "concept": concept,
                "status": status,
                "mastery": mastery,
                "message": message
            }
        else:
            # Get overview of all concepts
            return {
                "concepts": masteries,
                "total_concepts": len(masteries),
                "mastered": len([m for m in masteries if m["mastery_score"] >= 90]),
                "in_progress": len([m for m in masteries if 50 <= m["mastery_score"] < 90]),
                "needs_work": len([m for m in masteries if m["mastery_score"] < 50]),
            }
