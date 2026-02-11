from typing import List, Literal, Optional, TypedDict, Dict, Any
from pydantic import BaseModel


TaskType = Literal["tutor", "quiz", "analyze", "roadmap", "questions"]


class Message(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class AgentRequest(BaseModel):
    task: TaskType
    input: str
    history: Optional[List[Message]] = None
    options: Optional[Dict[str, Any]] = None
    session_id: Optional[str] = None


class AgentResponse(BaseModel):
    task: TaskType
    output: Any
    meta: Dict[str, Any] = {}
    session_id: Optional[str] = None


class QuizQuestion(BaseModel):
    id: str
    question: str
    options: List[str]
    answer_index: Optional[int] = None
    explanation: Optional[str] = None


class QuizResult(BaseModel):
    total: int
    correct: int
    details: List[Dict[str, Any]]


class StudyRoadmapItem(BaseModel):
    topic: str
    objective: str
    resources: List[str]
    estimate_hours: float


class StudyRoadmap(BaseModel):
    focus_area: str
    timeframe_days: int
    items: List[StudyRoadmapItem]


class TaskStatusUpdate(BaseModel):
    session_id: str
    task_id: int
    status: Literal["pending", "complete"]


class QuizAnswerSubmission(BaseModel):
    session_id: str
    attempt_id: int
    question_id: Optional[int]
    selected_index: Optional[int]
    selected_option: Optional[str] = None
    is_correct: bool
    note: Optional[str] = None
    confidence: Optional[float] = None
