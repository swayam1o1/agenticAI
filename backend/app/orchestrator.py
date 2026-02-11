"""
Agentic Orchestrator - Manages inter-agent communication and workflow orchestration
"""
from typing import Dict, List, Any, Optional
from .agent import StudyAgent
from .storage import Storage
from .memory import FAISSMemory


class AgenticOrchestrator:
    """
    Orchestrates multi-agent workflows with intelligent task routing and context sharing.
    
    Workflow:
    1. User interacts with tutor → learns concepts
    2. User takes quiz → identifies weak areas
    3. System analyzes quiz results → generates weak topics
    4. Weak topics auto-create roadmap tasks
    5. Next quiz automatically focuses on weak areas
    6. Cycle continues until mastery
    """
    
    def __init__(self, agent: StudyAgent, storage: Storage, memory: FAISSMemory):
        self.agent = agent
        self.storage = storage
        self.memory = memory
    
    def analyze_quiz_performance(self, session_id: str) -> Dict[str, Any]:
        """
        Analyze recent quiz performance and identify patterns.
        Returns weak areas and recommendations.
        """
        # Get quiz history
        quiz_history = self.storage.get_quiz_history(session_id)
        if not quiz_history:
            return {"weak_areas": [], "recommendations": []}
        
        # Get recent quiz attempts
        recent_attempts = quiz_history[-3:] if len(quiz_history) > 3 else quiz_history
        
        # Calculate per-topic accuracy
        topic_accuracy = {}
        for attempt in recent_attempts:
            topic = attempt.get("topic", "unknown")
            correct = attempt.get("correct_count", 0)
            total = attempt.get("total_questions", 1)
            accuracy = correct / max(total, 1)
            
            if topic not in topic_accuracy:
                topic_accuracy[topic] = []
            topic_accuracy[topic].append(accuracy)
        
        # Identify weak areas (< 70% accuracy)
        weak_areas = []
        for topic, accuracies in topic_accuracy.items():
            avg_accuracy = sum(accuracies) / len(accuracies)
            if avg_accuracy < 0.7:
                weak_areas.append({
                    "topic": topic,
                    "accuracy": avg_accuracy,
                    "attempts": len(accuracies)
                })
        
        # Generate recommendations
        recommendations = []
        if weak_areas:
            recommendations.append("Take focused quizzes on weak areas")
            recommendations.append("Review study materials for struggling topics")
            recommendations.append("Check roadmap for targeted practice tasks")
        
        return {
            "weak_areas": weak_areas,
            "recommendations": recommendations,
            "overall_accuracy": sum([sum(accs) / len(accs) for accs in topic_accuracy.values()]) / len(topic_accuracy) if topic_accuracy else 0
        }
    
    def should_trigger_analysis(self, session_id: str) -> bool:
        """
        Determine if analysis should be triggered automatically.
        Triggers after:
        - 3+ quiz attempts
        - Low performance on recent quiz (< 60%)
        """
        quiz_history = self.storage.get_quiz_history(session_id)
        if not quiz_history or len(quiz_history) < 3:
            return False
        
        # Check most recent quiz
        last_attempt = quiz_history[-1]
        correct = last_attempt.get("correct_count", 0)
        total = last_attempt.get("total_questions", 1)
        accuracy = correct / max(total, 1)
        
        return accuracy < 0.6  # Trigger if below 60%
    
    def get_next_recommended_action(self, session_id: str) -> Dict[str, Any]:
        """
        Recommend the next action based on user's learning state.
        Uses FAISS memory and weak topics to determine optimal next step.
        """
        # Get weak topics
        weak_topics = self.storage.get_weak_topics(session_id)
        
        # Get quiz history
        quiz_history = self.storage.get_quiz_history(session_id)
        
        # Get conversation history
        history = self.storage.get_history(session_id)
        
        # Decision logic
        if not history or len(history) < 3:
            return {
                "action": "tutor",
                "reason": "Start by learning foundational concepts",
                "suggestion": "Ask questions to understand key topics"
            }
        
        if not quiz_history or len(quiz_history) < 2:
            return {
                "action": "quiz",
                "reason": "Test your understanding with a quiz",
                "suggestion": "Generate a quiz on what you've learned"
            }
        
        if weak_topics and len(weak_topics) > 0:
            return {
                "action": "quiz",
                "reason": "Focus on identified weak areas",
                "suggestion": f"Take a targeted quiz on: {', '.join([wt['title'] for wt in weak_topics[:3]])}",
                "focused": True,
                "weak_topics": weak_topics
            }
        
        # Check if analysis needed
        if len(quiz_history) >= 3:
            last_analysis = None
            for msg in reversed(history):
                if msg.get("task") == "analyze":
                    last_analysis = msg
                    break
            
            if not last_analysis:
                return {
                    "action": "analyze",
                    "reason": "Analyze your learning progress",
                    "suggestion": "Review weak areas and get personalized recommendations"
                }
        
        return {
            "action": "roadmap",
            "reason": "Create a study plan",
            "suggestion": "Generate a personalized learning roadmap"
        }
    
    def orchestrate_learning_cycle(self, session_id: str, current_task: str) -> Dict[str, Any]:
        """
        Orchestrate the complete learning cycle with inter-agent communication.
        Returns context and recommendations for the current task.
        """
        # Get current learning state
        weak_topics = self.storage.get_weak_topics(session_id)
        quiz_history = self.storage.get_quiz_history(session_id)
        
        # Build context for agents
        context = {
            "weak_topics": weak_topics,
            "quiz_history_count": len(quiz_history) if quiz_history else 0,
            "should_focus": len(weak_topics) > 0 if weak_topics else False,
        }
        
        # Task-specific orchestration
        if current_task == "quiz" and weak_topics:
            # Inject weak topics into quiz generation
            context["focus_areas"] = [f"{wt['title']}: {wt['detail']}" for wt in weak_topics[:3]]
        
        elif current_task == "analyze":
            # Trigger roadmap update after analysis
            context["update_roadmap"] = True
        
        # Get next recommended action
        next_action = self.get_next_recommended_action(session_id)
        context["next_recommended_action"] = next_action
        
        return context
