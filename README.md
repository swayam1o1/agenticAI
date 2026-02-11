# Agentic Study Buddy

Single-agent, stateful RAG tutor powered by LangGraph + FAISS + Ollama (Llama 3).

## Features
- Tutor: grounded explanations with citations
- Quiz: auto-generate MCQs from your materials
- Weak Areas: analyze recent history to find gaps
- Roadmap: personalized 2-week daily plan
- Memory: ingest notes/files into FAISS for persistent recall

## Prereqs
- Python 3.10+
- Node.js 18+
- Ollama running with model `llama3`

```bash
ollama pull llama3
ollama serve
```

## Quick Start (Recommended)

```bash
# 1. Ensure Ollama is running
ollama serve

# 2. Start both services
./start.sh
```

Then open http://127.0.0.1:5173 in your browser.

## Manual Setup

### Backend

```bash
cd backend
# Uses system Python 3.9 (no venv needed for this setup)
/usr/bin/python3 -m pip install --user -r requirements.txt
/usr/bin/python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --app-dir .
```

Health check: http://127.0.0.1:8001/api/health

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Visit: http://127.0.0.1:5173

## Quick Start

**Terminal 1 - Backend:**
```bash
cd backend
/usr/bin/python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --app-dir .
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

**Open browser:** http://127.0.0.1:5173

## Available Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check - returns `{"status":"ok"}` |
| `/api/memory` | POST | Add study materials (text or file upload) |
| `/api/agent` | POST | Run agent tasks: `tutor`, `quiz`, `analyze`, `roadmap`, `questions` |

## API Examples

**Check backend health:**
```bash
curl http://127.0.0.1:8001/api/health
```

**Add memory (text):**
```bash
curl -X POST -F "texts=Photosynthesis converts light to chemical energy." \
  http://127.0.0.1:8001/api/memory
```

**Tutor task:**
```bash
curl -X POST http://127.0.0.1:8001/api/agent \
  -H 'Content-Type: application/json' \
  -d '{"task":"tutor","input":"Explain photosynthesis briefly"}'
```

**Generate quiz:**
```bash
curl -X POST http://127.0.0.1:8001/api/agent \
  -H 'Content-Type: application/json' \
  -d '{"task":"quiz","input":"Cell biology basics"}'
```

## Frontend Features

1. **Tutor Tab**: Ask questions and get answers grounded in your uploaded materials
2. **Quiz Tab**: Generate MCQ quizzes on any topic
3. **Weak Areas Tab**: Analyze your learning history to identify gaps
4. **Roadmap Tab**: Create personalized 2-week study plans
5. **Memory Tab**: Upload study materials (notes, PDFs as text)

## Architecture Notes

- **Backend**: Python 3.9+, FastAPI, LangGraph state machine, FAISS vector store
- **Frontend**: React 18, TypeScript, Vite, React Router
- **LLM**: Ollama (llama3) running locally on port 11434
- **Memory**: FAISS index persists to `backend/data/memory.index`
- **CORS**: Enabled for http://127.0.0.1:5173

## Troubleshooting

**"Load failed" in browser console:**
- Check backend is running: `curl http://127.0.0.1:8001/api/health`
- Check frontend logs in terminal
- Clear browser cache and reload

**Backend import errors:**
- Ensure using system Python 3.9+: `/usr/bin/python3 --version`
- Reinstall dependencies: `pip install -r requirements.txt`

**Ollama connection errors:**
- Start Ollama: `ollama serve`
- Verify model: `ollama list` (should show llama3)
- Pull if missing: `ollama pull llama3`
