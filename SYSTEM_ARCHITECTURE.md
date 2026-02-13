# ITR (Intelligent Tutoring & Roadmap) - System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    USER INTERACTION                                          │
│                                                                                              │
│                      Frontend (React + TypeScript + Vite)                                    │
│                                Port 5174                                                     │
└──────────────────────────────────────┬───────────────────────────────────────────────────────┘
                                       │
                                       │ HTTP/REST API
                                       │ (fetch calls)
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                               INTERACTION LAYER                                              │
│                         Backend (FastAPI + Uvicorn)                                          │
│                                Port 8000                                                     │
│                                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────────────┐         │
│  │  API Endpoints (main.py)                                                       │         │
│  │  • POST /api/agent          → Route to agent tasks                             │         │
│  │  • POST /api/quiz-answer    → Save quiz responses                              │         │
│  │  • GET  /api/roadmap        → Fetch learning tasks                             │         │
│  │  • GET  /api/history        → Fetch chat messages                              │         │
│  │  • GET  /api/weak-topics    → Fetch identified weak areas                      │         │
│  │  • POST /api/memory         → Add documents to vector store                    │         │
│  └────────────────────────────────────────────────────────────────────────────────┘         │
│                                       │                                                      │
│                                       ▼                                                      │
│  ┌────────────────────────────────────────────────────────────────────────────────┐         │
│  │  Session Management (storage.py)                                               │         │
│  │  • UUID-based session isolation                                                │         │
│  │  • Chat log segmentation                                                       │         │
│  │  • Quiz attempt tracking                                                       │         │
│  └────────────────────────────────────────────────────────────────────────────────┘         │
└──────────────────────────────────────┬───────────────────────────────────────────────────────┘
                                       │
                                       │ Task Routing
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                          INTELLIGENCE LAYER                                                  │
│                      LangGraph Agent (agent.py)                                              │
│                                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────────────┐           │
│  │  Multi-Agent State Machine                                                   │           │
│  │                                                                               │           │
│  │  START → ROUTER → [Task-Specific Node] → END                                 │           │
│  │                                                                               │           │
│  │  Nodes:                                                                       │           │
│  │  1. RETRIEVE   → Search vector DB for relevant context                       │           │
│  │  2. TUTOR      → Generate teaching response with examples                    │           │
│  │  3. QUIZ       → Generate 5 MCQ questions on topic                           │           │
│  │  4. ANALYZE    → Identify weak areas (quiz/chat-based)                       │           │
│  │  5. ROADMAP    → Create personalized learning tasks                          │           │
│  │  6. QUESTIONS  → Handle clarification questions                              │           │
│  └──────────────────────────────────────────────────────────────────────────────┘           │
│                                       │                                                      │
│                                       ▼                                                      │
│  ┌────────────────────────────────────────────────────────────────────────────────┐         │
│  │  LLM Integration (ollama_client.py)                                            │         │
│  │  • Ollama Local LLM: llama3.2:latest                                           │         │
│  │  • Streaming support for real-time responses                                  │         │
│  │  • Temperature: 0.3 (focused), 0.7 (creative)                                 │         │
│  └────────────────────────────────────────────────────────────────────────────────┘         │
└──────────────────────────────────────┬───────────────────────────────────────────────────────┘
                                       │
                                       │ Parallel Processing
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                            ANALYSIS & ADAPTATION LAYER                                       │
│                                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────────────┐         │
│  │  Weak Area Identification                                                      │         │
│  │  • Quiz-Based Analysis:                                                        │         │
│  │    - Last 5 quiz attempts                                                      │         │
│  │    - Focus on incorrect answers                                                │         │
│  │    - Pattern detection (repeated mistakes)                                     │         │
│  │                                                                                 │         │
│  │  • Chat-Based Analysis:                                                        │         │
│  │    - Last 30 conversation messages                                             │         │
│  │    - Confusion patterns (repetitive questions)                                 │         │
│  │    - Clarification request frequency                                           │         │
│  └────────────────────────────────────────────────────────────────────────────────┘         │
│                                       │                                                      │
│                                       ▼                                                      │
│  ┌────────────────────────────────────────────────────────────────────────────────┐         │
│  │  Concept Extraction & Parsing (_parse_summary)                                 │         │
│  │  • Markdown filtering (remove **)                                              │         │
│  │  • Header detection and skipping                                               │         │
│  │  • Topic length validation (3-50 chars)                                        │         │
│  │  • Phrase filtering ("based on", "weakest areas")                              │         │
│  │  • Generic label detection ("Topic Name" → actual topic)                       │         │
│  │  • Return top 5 weak topics                                                    │         │
│  └────────────────────────────────────────────────────────────────────────────────┘         │
│                                       │                                                      │
│                                       ▼                                                      │
│  ┌────────────────────────────────────────────────────────────────────────────────┐         │
│  │  Performance Tracking (storage.py)                                             │         │
│  │  • Quiz attempt history                                                        │         │
│  │  • Correct/incorrect answer counts                                             │         │
│  │  • Confidence levels                                                           │         │
│  │  • Learning progress metrics                                                   │         │
│  └────────────────────────────────────────────────────────────────────────────────┘         │
└──────────────────────────────────────┬───────────────────────────────────────────────────────┘
                                       │
                                       │ Generate Learning Content
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                          CONTENT GENERATION LAYER                                            │
│                                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────────────┐         │
│  │  Quiz Generation                                                               │         │
│  │  • Auto-generate 5 MCQ questions                                               │         │
│  │  • Based on identified weak areas                                              │         │
│  │  • Include explanations for correct answers                                    │         │
│  │  • Track difficulty and confidence                                             │         │
│  └────────────────────────────────────────────────────────────────────────────────┘         │
│                                       │                                                      │
│                                       ▼                                                      │
│  ┌────────────────────────────────────────────────────────────────────────────────┐         │
│  │  Roadmap Generation                                                            │         │
│  │  • Personalized learning plan                                                  │         │
│  │  • Step-by-step topic breakdown                                                │         │
│  │  • Linked to weak_topic_id for context                                         │         │
│  │  • Task status tracking (pending/complete)                                     │         │
│  └────────────────────────────────────────────────────────────────────────────────┘         │
│                                       │                                                      │
│                                       ▼                                                      │
│  ┌────────────────────────────────────────────────────────────────────────────────┐         │
│  │  Response Formatting                                                           │         │
│  │  • Structured JSON output for frontend                                         │         │
│  │  • Markdown support for rich text                                              │         │
│  │  • Code blocks with syntax highlighting                                        │         │
│  │  • Math equations (LaTeX/KaTeX)                                                │         │
│  └────────────────────────────────────────────────────────────────────────────────┘         │
└──────────────────────────────────────┬───────────────────────────────────────────────────────┘
                                       │
                                       │ Store & Retrieve
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                              DATA PERSISTENCE LAYER                                          │
│                                                                                              │
│  ┌───────────────────────────────┐    ┌──────────────────────────────────────────┐         │
│  │  SQLite Database              │    │  FAISS Vector Store (memory.py)          │         │
│  │  (backend/data/chat.db)       │    │  • mxbai-embed-large embeddings          │         │
│  │                               │    │  • Document chunking (500 chars)         │         │
│  │  Tables (8):                  │    │  • Similarity search for RAG             │         │
│  │  1. ChatSession               │    │  • Context retrieval for tutor           │         │
│  │  2. Message                   │    └──────────────────────────────────────────┘         │
│  │  3. WeakTopic                 │                                                          │
│  │  4. QuizAttempt               │    ┌──────────────────────────────────────────┐         │
│  │  5. QuizQuestion              │    │  LocalStorage (Frontend)                 │         │
│  │  6. QuizAnswer                │    │  • Session metadata                      │         │
│  │  7. RoadmapTask               │    │  • Current session ID                    │         │
│  │  8. ConceptMastery            │    │  • Auto-analyze flags                    │         │
│  └───────────────────────────────┘    └──────────────────────────────────────────┘         │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       │ Render Response
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                                  FRONTEND OUTPUT                                             │
│                                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────────────┐         │
│  │  Pages & Views (src/pages/)                                                    │         │
│  │                                                                                 │         │
│  │  1. Tutor View         → Chat interface with role labels                       │         │
│  │                           Markdown-style messages (no bubbles)                 │         │
│  │                           Auto-learning flow from roadmap                      │         │
│  │                                                                                 │         │
│  │  2. Quiz Display       → Interactive MCQ questions                             │         │
│  │                           Confidence slider (0-100%)                           │         │
│  │                           Auto-redirect to analytics                           │         │
│  │                                                                                 │         │
│  │  3. Analytics View     → Dual analysis cards (quiz/chat)                       │         │
│  │                           Color-coded results (indigo/rose)                    │         │
│  │                           Line-by-line parsed weak areas                       │         │
│  │                                                                                 │         │
│  │  4. Roadmap View       → Weak areas section (top 5)                            │         │
│  │                           Learning tasks with "Learn" button                   │         │
│  │                           Task status toggle (pending/complete)                │         │
│  │                                                                                 │         │
│  │  5. Memory View        → Upload documents for RAG                              │         │
│  │                           Vector store status                                  │         │
│  │                                                                                 │         │
│  │  6. Sessions View      → Session management UI                                 │         │
│  │                           Create/switch/delete sessions                        │         │
│  └────────────────────────────────────────────────────────────────────────────────┘         │
│                                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────────────┐         │
│  │  Design System (Deep Obsidian Theme)                                           │         │
│  │  • Background: #0a0a0f (near-black)                                            │         │
│  │  • Cards: #1a1a24 with #27272f borders                                         │         │
│  │  • Text: #e4e4e7 (light gray)                                                  │         │
│  │  • Accents: Indigo (#6366F1), Rose (#F43F5E)                                   │         │
│  │  • Typography: Inter font with 0.02em letter-spacing                           │         │
│  └────────────────────────────────────────────────────────────────────────────────┘         │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## **Data Flow Diagram**

```
USER INPUT
    │
    ├─→ Chat Question → TUTOR Node → FAISS Retrieve → LLM Response → Chat Display
    │
    ├─→ Take Quiz → QUIZ Node → Generate 5 MCQs → Quiz Display → Save Answers
    │                                                                   │
    │                                                                   ▼
    ├─→ Auto-Analyze → ANALYZE Node → Quiz/Chat Analysis → Weak Topics
    │                                                           │
    │                                                           ▼
    ├─→ View Roadmap → ROADMAP Node → Generate Tasks → Task List Display
    │                                        │
    │                                        ▼
    └─→ Start Learning → Extract Topic → TUTOR Node → Personalized Teaching
```

---

## **Key Architecture Patterns**

### 1. **Session Isolation**
- Each session (UUID) has independent: messages, quizzes, weak topics, roadmap tasks
- Prevents data overflow and allows focused learning sessions
- LocalStorage tracks current session, backend stores all data

### 2. **Multi-Agent Orchestration (LangGraph)**
- State machine with task routing
- Each node specializes in one function (SRP - Single Responsibility)
- Parallel execution where possible (RETRIEVE + TUTOR)

### 3. **Dual Analysis System**
- **Quiz-based**: Objective performance metrics (correct/incorrect)
- **Chat-based**: Subjective confusion patterns (repetitive questions)
- Provides flexibility for different learning stages

### 4. **RAG (Retrieval-Augmented Generation)**
- FAISS vector store with mxbai-embed-large embeddings
- Chunks documents into 500-char segments
- Enhances LLM responses with domain-specific context

### 5. **Progressive Enhancement**
- Works without memory documents (pure LLM knowledge)
- Enhanced with uploaded PDFs/text (domain expertise)
- Learning improves over time with quiz data

---

## **Technology Stack**

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18.2 + TypeScript 5.3 | Component-based UI |
| **Build Tool** | Vite 5.0 | Fast HMR, optimized builds |
| **Routing** | React Router 6.22 | Client-side navigation |
| **Backend** | FastAPI + Uvicorn | Async API server |
| **Database** | SQLite + SQLAlchemy | Relational data storage |
| **Vector DB** | FAISS | Similarity search for RAG |
| **LLM** | Ollama (llama3.2) | Local inference, no API costs |
| **Embeddings** | mxbai-embed-large | Document vectorization |
| **Agent Framework** | LangGraph | State machine orchestration |

---

## **Scalability & Future Enhancements**

1. **Multi-User Support**: Add authentication, user_id to session isolation
2. **Cloud Deployment**: Migrate to PostgreSQL, vector DB to Pinecone/Weaviate
3. **Advanced Analytics**: Spaced repetition scheduling, forgetting curves
4. **Content Library**: Pre-built courses with curated learning paths
5. **Mobile App**: React Native version with offline mode
6. **Collaboration**: Shared sessions, peer learning, instructor dashboard
