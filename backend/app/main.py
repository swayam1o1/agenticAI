import os

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
import uvicorn

from .memory import FAISSMemory
from .agent import StudyAgent
from .models import AgentRequest, AgentResponse, QuizAnswerSubmission, TaskStatusUpdate
from .storage import Storage
from .orchestrator import AgenticOrchestrator
from .learn_orchestrator import LearnOrchestrator

ROOT_DIR = os.path.dirname(os.path.dirname(__file__))
DATA_DIR = os.path.join(ROOT_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)
CHAT_DB = os.path.join(DATA_DIR, "chat.db")
OLLAMA_MODEL = "llama3.2"

app = FastAPI(title="Agentic Study Buddy", version="0.1.0")

# CORS (adjust origins as needed)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

memory = FAISSMemory(data_dir=DATA_DIR, embed_model=OLLAMA_MODEL)
storage = Storage(f"sqlite:///{CHAT_DB}")
agent = StudyAgent(memory=memory, model=OLLAMA_MODEL, storage=storage)
orchestrator = AgenticOrchestrator(agent=agent, storage=storage, memory=memory)
learn_orchestrator = LearnOrchestrator(agent=agent, storage=storage, memory=memory)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/memory")
async def ingest_memory(texts: Optional[List[str]] = Form(default=None), file: Optional[UploadFile] = File(default=None)):
    payload_texts: List[str] = []
    if texts:
        payload_texts.extend(texts)
    if file is not None:
        content = (await file.read()).decode("utf-8", errors="ignore")
        payload_texts.append(content)
    if not payload_texts:
        return {"added": 0, "ids": []}
    ids = memory.add_texts(payload_texts)
    return {"added": len(ids), "ids": ids}


@app.post("/api/agent", response_model=AgentResponse)
async def run_agent(req: AgentRequest):
    history = [m.dict() for m in (req.history or [])]
    result = agent.run(task=req.task, user_input=req.input, history=history, session_id=req.session_id)
    response = AgentResponse(task=req.task, output=result["output"], meta=result.get("meta", {}))
    response.session_id = result.get("session_id")
    return response


@app.get("/api/history")
async def read_history(session_id: str):
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id is required")
    return {"session_id": session_id, "messages": storage.get_history(session_id)}


@app.get("/api/weak-topics")
async def read_weak_topics(session_id: str):
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id is required")
    return {"session_id": session_id, "weak_topics": storage.get_weak_topics(session_id)}


@app.get("/api/analysis")
async def get_analysis(session_id: str):
    """Get the latest analysis summary for a session"""
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id is required")
    # Get the most recent analysis message
    history = storage.get_history(session_id)
    for msg in reversed(history):
        if msg.get("task") == "analyze" and msg.get("role") == "assistant":
            return {"session_id": session_id, "summary": msg.get("content", ""), "timestamp": msg.get("timestamp")}
    return {"session_id": session_id, "summary": None}


@app.get("/api/quiz-history")
async def read_quiz_history(session_id: str):
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id is required")
    return {"session_id": session_id, "quiz_history": storage.get_quiz_history(session_id)}


@app.get("/api/roadmap")
async def read_roadmap(session_id: str):
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id is required")
    return {"session_id": session_id, "tasks": storage.get_roadmap_tasks(session_id)}


@app.post("/api/roadmap/task-status")
async def update_task_status(payload: TaskStatusUpdate):
    if not storage.update_task_status(payload.session_id, payload.task_id, payload.status):
        raise HTTPException(status_code=400, detail="Task not found or invalid status")
    return {"status": "ok"}


@app.post("/api/quiz-answer")
async def submit_quiz_answer(payload: QuizAnswerSubmission):
    if not storage.record_quiz_answer(
        payload.session_id,
        payload.attempt_id,
        payload.question_id,
        payload.selected_index,
        payload.selected_option,
        payload.is_correct,
        note=payload.note,
        confidence=payload.confidence,
    ):
        raise HTTPException(status_code=400, detail="Failed to record answer")
    return {"status": "ok"}


@app.get("/api/recommendations")
async def get_recommendations(session_id: str):
    """Get AI-powered learning recommendations based on progress"""
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id is required")
    try:
        next_action = orchestrator.get_next_recommended_action(session_id)
        performance = orchestrator.analyze_quiz_performance(session_id)
        return {
            "session_id": session_id,
            "next_action": next_action,
            "performance": performance
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/learn/start")
async def start_learning_concept(payload: dict):
    """Start learning a concept - Phase 1: Teaching"""
    session_id = payload.get("session_id")
    concept = payload.get("concept")
    if not session_id or not concept:
        raise HTTPException(status_code=400, detail="session_id and concept are required")
    try:
        result = learn_orchestrator.start_learning(session_id, concept)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/learn/quiz")
async def generate_learning_quiz(payload: dict):
    """Generate quiz for concept - Phase 2: Quiz"""
    session_id = payload.get("session_id")
    concept = payload.get("concept")
    focus_weak = payload.get("focus_weak_areas", False)
    if not session_id or not concept:
        raise HTTPException(status_code=400, detail="session_id and concept are required")
    try:
        result = learn_orchestrator.generate_concept_quiz(session_id, concept, focus_weak)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/learn/analyze")
async def analyze_learning_quiz(payload: dict):
    """Analyze quiz results - Phase 3: Analysis"""
    session_id = payload.get("session_id")
    attempt_id = payload.get("attempt_id")
    concept = payload.get("concept")
    if not session_id or not attempt_id or not concept:
        raise HTTPException(status_code=400, detail="session_id, attempt_id, and concept are required")
    try:
        result = learn_orchestrator.analyze_quiz_results(session_id, attempt_id, concept)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/learn/progress")
async def get_learning_progress(session_id: str, concept: Optional[str] = None):
    """Get learning progress for concept(s)"""
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id is required")
    try:
        result = learn_orchestrator.get_learning_progress(session_id, concept)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/mastery")
async def get_concept_mastery(session_id: str):
    """Get all concept mastery data"""
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id is required")
    return {"session_id": session_id, "masteries": storage.get_concept_mastery(session_id)}


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="127.0.0.1", port=8001, reload=True)
