import json
import os
import re
import uuid
from typing import Any, Dict, List, Optional, Sequence, Tuple

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    create_engine,
)
from sqlalchemy.orm import Session, declarative_base, sessionmaker
from sqlalchemy.sql import func

Base = declarative_base()


def _ensure_dir(db_url: str) -> None:
    path = db_url.replace("sqlite://", "")
    directory = os.path.dirname(path)
    if directory:
        os.makedirs(directory, exist_ok=True)


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(String, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String, ForeignKey("chat_sessions.id"), index=True)
    role = Column(String)
    content = Column(Text)
    task = Column(String, nullable=True)
    meta = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class WeakTopic(Base):
    __tablename__ = "weak_topics"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String, ForeignKey("chat_sessions.id"), index=True)
    topic = Column(String)
    detail = Column(Text)
    severity = Column(String, nullable=True)
    source = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String, ForeignKey("chat_sessions.id"), index=True)
    task = Column(String, nullable=True)
    topic = Column(String, nullable=True)
    raw_output = Column(Text)
    total_questions = Column(Integer, default=0)
    correct_count = Column(Integer, default=0)
    meta = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class QuizQuestion(Base):
    __tablename__ = "quiz_questions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    attempt_id = Column(Integer, ForeignKey("quiz_attempts.id", ondelete="CASCADE"))
    sequence = Column(Integer)
    question = Column(Text)
    options = Column(Text)
    correct_index = Column(Integer, nullable=True)
    explanation = Column(Text, nullable=True)


class QuizAnswer(Base):
    __tablename__ = "quiz_answers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    attempt_id = Column(Integer, ForeignKey("quiz_attempts.id", ondelete="CASCADE"))
    question_id = Column(Integer, ForeignKey("quiz_questions.id", ondelete="SET NULL"), nullable=True)
    selected_index = Column(Integer, nullable=True)
    selected_option = Column(Text, nullable=True)
    is_correct = Column(Boolean, default=False)
    note = Column(Text, nullable=True)
    confidence = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class RoadmapTask(Base):
    __tablename__ = "roadmap_tasks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String, ForeignKey("chat_sessions.id"), index=True)
    title = Column(String)
    detail = Column(Text)
    status = Column(String, default="pending")
    priority = Column(Integer, default=3)
    weak_topic_id = Column(Integer, ForeignKey("weak_topics.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ConceptMastery(Base):
    __tablename__ = "concept_mastery"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String, ForeignKey("chat_sessions.id"), index=True)
    concept = Column(String, index=True)
    mastery_score = Column(Float, default=0.0)
    total_questions = Column(Integer, default=0)
    correct_answers = Column(Integer, default=0)
    quiz_attempts = Column(Integer, default=0)
    last_practiced = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class FlashcardGen(Base):
    __tablename__ = "flashcard_gens"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String, ForeignKey("chat_sessions.id"), index=True)
    topic = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class FlashcardItem(Base):
    __tablename__ = "flashcard_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    gen_id = Column(Integer, ForeignKey("flashcard_gens.id", ondelete="CASCADE"))
    front = Column(Text)
    back = Column(Text)

class MindmapGen(Base):
    __tablename__ = "mindmap_gens"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String, ForeignKey("chat_sessions.id"), index=True)
    topic = Column(String, nullable=True)
    mindmap = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

TASK_STATUS_PENDING = "pending"
TASK_STATUS_COMPLETE = "complete"


class Storage:
    def __init__(self, db_url: str):
        _ensure_dir(db_url)
        self.engine = create_engine(db_url, connect_args={"check_same_thread": False})
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)

    def ensure_session(self, session_id: Optional[str]) -> str:
        with self.Session() as session:
            if session_id:
                existing = session.get(ChatSession, session_id)
                if existing:
                    return session_id
            new_id = str(uuid.uuid4())
            session.add(ChatSession(id=new_id))
            session.commit()
            return new_id

    def log_message(
        self,
        session_id: str,
        role: str,
        content: str,
        task: Optional[str] = None,
        meta: Optional[Dict[str, Any]] = None,
    ) -> None:
        payload = json.dumps(meta or {})
        with self.Session() as session:
            session.add(
                Message(
                    session_id=session_id,
                    role=role,
                    content=content,
                    task=task,
                    meta=payload,
                )
            )
            session.commit()

    def log_quiz_attempt(
        self,
        session_id: str,
        topic: str,
        raw_output: str,
        questions: Optional[List[Dict[str, Any]]] = None,
        task: Optional[str] = None,
        meta: Optional[Dict[str, Any]] = None,
    ) -> Tuple[int, List[QuizQuestion]]:
        with self.Session() as session:
            attempt = QuizAttempt(
                session_id=session_id,
                task=task,
                topic=topic,
                raw_output=raw_output,
                total_questions=len(questions or []),
                meta=json.dumps(meta or {}),
            )
            session.add(attempt)
            session.flush()
            created_questions: List[QuizQuestion] = []
            if questions:
                for sequence, payload in enumerate(questions, start=1):
                    question = QuizQuestion(
                        attempt_id=attempt.id,
                        sequence=sequence,
                        question=payload.get("question", ""),
                        options=json.dumps(payload.get("options", [])),
                        correct_index=payload.get("correct_index"),
                        explanation=payload.get("explanation"),
                    )
                    session.add(question)
                    created_questions.append(question)
            session.commit()
            # Extract IDs before session closes to avoid DetachedInstanceError
            session.refresh(attempt)
            for q in created_questions:
                session.refresh(q)
            question_data = [(q.id, q.sequence, q.question, q.options, q.correct_index, q.explanation) for q in created_questions]
            return attempt.id, question_data

    def record_quiz_answer(
        self,
        session_id: str,
        attempt_id: int,
        question_id: Optional[int],
        selected_index: Optional[int],
        selected_option: Optional[str],
        is_correct: bool,
        note: Optional[str] = None,
        confidence: Optional[float] = None,
    ) -> bool:
        with self.Session() as session:
            attempt = session.get(QuizAttempt, attempt_id)
            if not attempt or attempt.session_id != session_id:
                return
            if question_id:
                question = session.get(QuizQuestion, question_id)
                if question and question.attempt_id != attempt_id:
                    question_id = None
            answer = QuizAnswer(
                attempt_id=attempt_id,
                question_id=question_id,
                selected_index=selected_index,
                selected_option=selected_option,
                is_correct=is_correct,
                note=note,
                confidence=confidence,
            )
            session.add(answer)
            session.flush()
            correct_answers = (
                session.query(QuizAnswer)
                .filter(QuizAnswer.attempt_id == attempt_id, QuizAnswer.is_correct.is_(True))
                .count()
            )
            attempt.correct_count = correct_answers
            session.commit()
            return True

    def get_quiz_history(self, session_id: str) -> List[Dict[str, Any]]:
        with self.Session() as session:
            attempts = (
                session.query(QuizAttempt)
                .filter(QuizAttempt.session_id == session_id)
                .order_by(QuizAttempt.created_at.desc())
                .all()
            )
            history: List[Dict[str, Any]] = []
            for attempt in attempts:
                questions = (
                    session.query(QuizQuestion)
                    .filter(QuizQuestion.attempt_id == attempt.id)
                    .order_by(QuizQuestion.sequence)
                    .all()
                )
                answers = (
                    session.query(QuizAnswer)
                    .filter(QuizAnswer.attempt_id == attempt.id)
                    .order_by(QuizAnswer.created_at)
                    .all()
                )
                answer_map = {answer.question_id: answer for answer in answers}
                history.append(
                    {
                        "attempt_id": attempt.id,
                        "task": attempt.task,
                        "topic": attempt.topic,
                        "total_questions": attempt.total_questions,
                        "correct_count": attempt.correct_count,
                        "meta": json.loads(attempt.meta or "{}"),
                        "created_at": attempt.created_at.isoformat(),
                        "questions": [
                            self._serialize_question(question, answer_map.get(question.id))
                            for question in questions
                        ],
                    }
                )
            return history

    def log_weak_topics(self, session_id: str, summary: str) -> None:
        entries = self._parse_summary(summary)
        if not entries:
            entries = [("analysis", summary.strip())]
        with self.Session() as session:
            created_topics: List[WeakTopic] = []
            for topic, detail in entries:
                weak_topic = WeakTopic(session_id=session_id, topic=topic, detail=detail)
                session.add(weak_topic)
                created_topics.append(weak_topic)
            session.flush()
            if created_topics:
                self._create_tasks_from_weak_topics(session, session_id, created_topics)
            session.commit()

    def get_history(self, session_id: str) -> List[Dict[str, Any]]:
        with self.Session() as session:
            records = (
                session.query(Message)
                .filter(Message.session_id == session_id)
                .order_by(Message.created_at)
                .all()
            )
            return [
                {
                    "role": message.role,
                    "content": message.content,
                    "task": message.task,
                    "meta": json.loads(message.meta or "{}"),
                    "created_at": message.created_at.isoformat(),
                }
                for message in records
            ]

    def get_weak_topics(self, session_id: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Get weak topics for a session, limited to most recent (default 5)"""
        with self.Session() as session:
            topics = (
                session.query(WeakTopic)
                .filter(WeakTopic.session_id == session_id)
                .order_by(WeakTopic.created_at.desc())
                .limit(limit)
                .all()
            )
            return [
                {
                    "id": topic.id,
                    "title": topic.topic,
                    "detail": topic.detail,
                    "severity": topic.severity,
                    "source": topic.source,
                    "created_at": topic.created_at.isoformat(),
                }
                for topic in topics
            ]

    def get_roadmap_tasks(self, session_id: str) -> List[Dict[str, Any]]:
        with self.Session() as session:
            tasks = (
                session.query(RoadmapTask)
                .filter(RoadmapTask.session_id == session_id)
                .order_by(RoadmapTask.status, RoadmapTask.priority, RoadmapTask.created_at)
                .all()
            )
            return [
                {
                    "id": task.id,
                    "title": task.title,
                    "detail": task.detail,
                    "status": task.status,
                    "priority": task.priority,
                    "weak_topic_id": task.weak_topic_id,
                    "created_at": task.created_at.isoformat(),
                    "updated_at": task.updated_at.isoformat() if task.updated_at else None,
                }
                for task in tasks
            ]

    def update_task_status(self, session_id: str, task_id: int, status: str) -> bool:
        if status not in {TASK_STATUS_PENDING, TASK_STATUS_COMPLETE}:
            return False
        with self.Session() as session:
            task = session.get(RoadmapTask, task_id)
            if not task or task.session_id != session_id:
                return False
            task.status = status
            session.commit()
            return True

    def _create_tasks_from_weak_topics(
        self, session: Session, session_id: str, weak_topics: Sequence[WeakTopic]
    ) -> None:
        existing_tasks = session.query(RoadmapTask).filter(RoadmapTask.session_id == session_id).all()
        # Case-insensitive deduplication
        existing = {(task.title.lower(), task.detail.lower()) for task in existing_tasks}
        
        # Enforce maximum of 5 pending tasks at a time to prevent overwhelming the user but allow more growth
        pending_count = sum(1 for task in existing_tasks if task.status == TASK_STATUS_PENDING)
        max_pending = 5

        for weak_topic in weak_topics:
            if pending_count >= max_pending:
                break
                
            title = f"Review {weak_topic.topic.title()}"
            detail = weak_topic.detail or f"Practice {weak_topic.topic} until it feels comfortable."
            key = (title.lower(), detail.lower())
            if key in existing:
                continue
                
            session.add(
                RoadmapTask(
                    session_id=session_id,
                    title=title,
                    detail=detail,
                    status=TASK_STATUS_PENDING,
                    priority=1,
                    weak_topic_id=weak_topic.id,
                )
            )
            existing.add(key)
            pending_count += 1

    def _parse_summary(self, summary: str) -> List[Tuple[str, str]]:
        """Parse weak topics from LLM output, handling various formats including markdown"""
        items: List[Tuple[str, str]] = []
        normalized = summary.replace("\r", "\n")
        numbered_chunks = [chunk.strip() for chunk in re.split(r"(?=\b\d+\.\s+)", normalized) if chunk.strip()]
        source_lines = numbered_chunks if len(numbered_chunks) > 1 else normalized.splitlines()
        clean_lines = [line.strip() for line in source_lines if line.strip()]
        
        for line in clean_lines:
            line = re.sub(r"^\d+\.\s*", "", line).strip()

            # Skip obvious header or instruction lines
            if any(skip_phrase in line.lower() for skip_phrase in [
                'based on the', 'analyze the', 'top 5 weak', 'weakest areas', 
                'quiz performance', 'here are', 'following are'
            ]):
                continue

            # Skip very long prose only if it doesn't look like a structured topic/detail item
            if len(line) > 180 and ':' not in line and '-' not in line:
                continue
            
            # Remove bullet points, numbers, and list markers
            stripped = line.lstrip("•-–*123456789. ")
            
            # Remove markdown bold formatting
            stripped = stripped.replace('**', '')
            
            # Skip if it's too short or empty
            if not stripped or len(stripped) < 5:
                continue
            
            # Try to extract topic: detail format
            if ":" in stripped:
                parts = stripped.split(":", 1)
                topic = parts[0].strip()
                detail = parts[1].strip() if len(parts) > 1 else stripped
                
                # Special case: If topic is generic like "Topic Name", swap it
                if topic.lower() in ['topic name', 'topic', 'weak area', 'concept']:
                    if ' - ' in detail:
                        topic = detail.split(' - ', 1)[0].strip()
                    else:
                        topic = detail
                    detail = stripped
            elif "-" in stripped and stripped.count("-") == 1:
                parts = stripped.split("-", 1)
                topic = parts[0].strip()
                detail = parts[1].strip() if len(parts) > 1 else stripped
            else:
                # If no clear separator, use first few words as topic
                words = stripped.split()
                if len(words) > 5:
                    topic = " ".join(words[:3])
                    detail = stripped
                else:
                    topic = stripped
                    detail = stripped
            
            # Clean up topic name - remove common prefixes and extra text
            topic = topic.replace('TOP 5 WEAK AREAS', '').replace('WEAK AREAS', '')
            topic = topic.replace('TOP 5 STUDY AREAS', '').replace('STUDY AREAS', '').strip()
            topic = topic.replace('Specific misconception or gap', '').strip()
            topic = topic.strip(':-,.')
            if len(topic) > 50:
                topic = " ".join(topic.split()[:6]).strip(':-,.')

            generic_topics = {
                'analysis', 'review', 'chat', 'conversation', 'quiz', 'performance', 'weak areas', 'study areas',
                'not enough conversation', 'no quiz attempts', 'no data available'
            }
            generic_details = [
                'not enough conversation history',
                'no quiz attempts found',
                'no data available for analysis'
            ]
            
            # Only add if topic is meaningful and not too long
            if 3 <= len(topic) <= 50 and not any(skip in topic.lower() for skip in [
                'given', 'based on', 'here are', 'the learner', 'quiz performance',
                'are the', 'following', 'identify'
            ]) and topic.lower() not in generic_topics and not any(text in detail.lower() for text in generic_details):
                items.append((topic, detail))
        
        return items[:5]  # Limit to top 5

    def _serialize_question(self, question: QuizQuestion, answer: Optional[QuizAnswer]) -> Dict[str, Any]:
        return {
            "id": question.id,
            "sequence": question.sequence,
            "question": question.question,
            "options": self._decode_options(question.options),
            "correct_index": question.correct_index,
            "explanation": question.explanation,
            "answer": self._serialize_answer(answer),
        }

    def _decode_options(self, raw: Optional[str]) -> List[str]:
        if not raw:
            return []
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return []

    def _serialize_answer(self, answer: Optional[QuizAnswer]) -> Optional[Dict[str, Any]]:
        if not answer:
            return None
        return {
            "selected_index": answer.selected_index,
            "selected_option": answer.selected_option,
            "is_correct": answer.is_correct,
            "note": answer.note,
            "confidence": answer.confidence,
            "created_at": answer.created_at.isoformat() if answer.created_at else None,
        }

    def update_concept_mastery(self, session_id: str, concept: str, correct: int, total: int) -> Dict[str, Any]:
        """Update or create mastery tracking for a concept"""
        with self.Session() as session:
            mastery = session.query(ConceptMastery).filter(
                ConceptMastery.session_id == session_id,
                ConceptMastery.concept == concept
            ).first()
            
            if mastery:
                mastery.total_questions += total
                mastery.correct_answers += correct
                mastery.quiz_attempts += 1
            else:
                mastery = ConceptMastery(
                    session_id=session_id,
                    concept=concept,
                    total_questions=total,
                    correct_answers=correct,
                    quiz_attempts=1
                )
                session.add(mastery)
            
            # Calculate mastery score (0-100)
            if mastery.total_questions > 0:
                accuracy = (mastery.correct_answers / mastery.total_questions) * 100
                # Weight by number of attempts (more attempts = more reliable score)
                confidence_factor = min(mastery.quiz_attempts / 5, 1.0)
                mastery.mastery_score = accuracy * confidence_factor
            
            session.commit()
            session.refresh(mastery)
            
            return {
                "concept": mastery.concept,
                "mastery_score": round(mastery.mastery_score, 2),
                "total_questions": mastery.total_questions,
                "correct_answers": mastery.correct_answers,
                "quiz_attempts": mastery.quiz_attempts,
                "last_practiced": mastery.last_practiced.isoformat(),
            }

    def get_concept_mastery(self, session_id: str, concept: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get mastery data for a specific concept or all concepts"""
        with self.Session() as session:
            query = session.query(ConceptMastery).filter(ConceptMastery.session_id == session_id)
            if concept:
                query = query.filter(ConceptMastery.concept == concept)
            
            masteries = query.order_by(ConceptMastery.mastery_score.asc()).all()
            
            return [
                {
                    "id": m.id,
                    "concept": m.concept,
                    "mastery_score": round(m.mastery_score, 2),
                    "total_questions": m.total_questions,
                    "correct_answers": m.correct_answers,
                    "quiz_attempts": m.quiz_attempts,
                    "last_practiced": m.last_practiced.isoformat(),
                    "created_at": m.created_at.isoformat(),
                }
                for m in masteries
            ]

    def log_flashcards(self, session_id: str, topic: Optional[str], cards: List[Dict[str, str]]) -> None:
        with self.Session() as session:
            gen = FlashcardGen(session_id=session_id, topic=topic)
            session.add(gen)
            session.flush()
            for c in cards:
                session.add(FlashcardItem(gen_id=gen.id, front=c.get("front", ""), back=c.get("back", "")))
            session.commit()

    def get_flashcards_history(self, session_id: str) -> List[Dict[str, Any]]:
        with self.Session() as session:
            gens = session.query(FlashcardGen).filter(FlashcardGen.session_id == session_id).order_by(FlashcardGen.created_at.desc()).all()
            history = []
            for gen in gens:
                items = session.query(FlashcardItem).filter(FlashcardItem.gen_id == gen.id).all()
                history.append({
                    "id": gen.id,
                    "topic": gen.topic,
                    "created_at": gen.created_at.isoformat(),
                    "flashcards": [{"front": item.front, "back": item.back} for item in items]
                })
            return history

    def log_mindmap(self, session_id: str, topic: Optional[str], mindmap: str) -> None:
        with self.Session() as session:
            gen = MindmapGen(session_id=session_id, topic=topic, mindmap=mindmap)
            session.add(gen)
            session.commit()

    def get_mindmap_history(self, session_id: str) -> List[Dict[str, Any]]:
        with self.Session() as session:
            gens = session.query(MindmapGen).filter(MindmapGen.session_id == session_id).order_by(MindmapGen.created_at.desc()).all()
            return [
                {
                    "id": gen.id,
                    "topic": gen.topic,
                    "mindmap": gen.mindmap,
                    "created_at": gen.created_at.isoformat()
                }
                for gen in gens
            ]
