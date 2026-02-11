import json
import os
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

    def get_weak_topics(self, session_id: str) -> List[Dict[str, Any]]:
        with self.Session() as session:
            topics = (
                session.query(WeakTopic)
                .filter(WeakTopic.session_id == session_id)
                .order_by(WeakTopic.created_at.desc())
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
        existing = {
            (task.title, task.detail)
            for task in (
                session.query(RoadmapTask)
                .filter(RoadmapTask.session_id == session_id)
                .all()
            )
        }
        for weak_topic in weak_topics:
            title = f"Review {weak_topic.topic.title()}"
            detail = weak_topic.detail or f"Practice {weak_topic.topic} until it feels comfortable."
            key = (title, detail)
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

    def _parse_summary(self, summary: str) -> List[Tuple[str, str]]:
        items: List[Tuple[str, str]] = []
        clean_lines = [line.strip() for line in summary.splitlines() if line.strip()]
        for line in clean_lines:
            stripped = line.lstrip("•-– ")
            if ":" in stripped:
                head, tail = stripped.split(":", 1)
                topic, detail = head.strip(), tail.strip()
            elif "-" in stripped:
                head, tail = stripped.split("-", 1)
                topic, detail = head.strip(), tail.strip()
            else:
                parts = stripped.split(" – ", 1)
                if len(parts) == 2:
                    topic, detail = parts[0].strip(), parts[1].strip()
                else:
                    topic, detail = "weak_topic", stripped
            if topic:
                items.append((topic, detail))
        return items

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
