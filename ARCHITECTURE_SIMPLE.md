# ITR System Architecture

```
                                ┌─────────────────┐
                                │   User Prompt   │
                                └────────┬────────┘
                                         │
                ┌────────────────────────┼────────────────────────┐
                │                        │                        │
                ▼                        ▼                        ▼


┌───────────────────────┐  ┌───────────────────────┐  ┌───────────────────────┐
│   INTERACTION LAYER   │  │   ANALYSIS LAYER      │  │  GENERATION LAYER     │
├───────────────────────┤  ├───────────────────────┤  ├───────────────────────┤
│                       │  │                       │  │                       │
│ • Frontend (React)    │  │ • Weak Area ID        │  │ • Quiz Generation     │
│   1. Chat Interface   │  │   1. Analyze quiz     │  │   1. Auto-generate    │
│   2. Quiz Display     │  │   2. Detect gaps      │  │      questions        │
│   3. Roadmap View     │  │                       │  │   2. Based on weak    │
│                       │  │ • Concept Extraction  │  │      areas            │
│ • Backend (FastAPI)   │  │   1. Identify weak    │  │                       │
│   1. Chat logs        │  │      topics           │  │ • Roadmap Generation  │
│   2. Session mgmt     │  │                       │  │   1. Personalized     │
│   3. Quiz tracking    │  │ • Performance Track   │  │      learning plan    │
│                       │  │   1. Based on quiz    │  │   2. Step-by-step     │
│ • LLM (Ollama)        │  │      attempts         │  │                       │
│   1. Tutor response   │  │                       │  │ • Response Format     │
│                       │  │                       │  │   1. Structured       │
│                       │  │                       │  │      output for UI    │
└───────────────────────┘  └───────────────────────┘  └───────────────────────┘
            │                          │                          │
            └──────────────────────────┼──────────────────────────┘
                                       │
                                       ▼
                            ┌──────────────────────┐
                            │   FRONTEND OUTPUT    │
                            ├──────────────────────┤
                            │ • Tutor Response     │
                            │ • Quiz Display       │
                            │ • Roadmap View       │
                            └──────────────────────┘
```

---

## Component Details

### **Interaction Layer**
- **Frontend**: React-based UI with 6 pages (Tutor, Quiz, Analytics, Roadmap, Memory, Sessions)
- **Backend**: FastAPI server handling API requests, SQLite for data persistence
- **LLM**: Ollama (llama3.2) for generating tutor responses

### **Analysis Layer**
- **Weak Area Identification**: Analyzes quiz performance (incorrect answers) and chat patterns
- **Concept Extraction**: Parses LLM output to extract clean topic names (top 5)
- **Performance Tracking**: Monitors quiz attempts, correct/incorrect counts, confidence levels

### **Generation Layer**
- **Quiz Generation**: Auto-creates 5 MCQ questions based on identified weak areas
- **Roadmap Generation**: Creates personalized learning tasks linked to weak topics
- **Response Formatting**: Structures data as JSON for frontend consumption

### **Frontend Output**
- **Tutor Response**: Chat interface with markdown support
- **Quiz Display**: Interactive MCQs with confidence slider
- **Roadmap View**: Learning tasks with progress tracking

---

## Data Flow

```
User Input → API Call → Agent Router → Task Node → LLM Processing 
    → Database Storage → Frontend Display
```

### Example Flow: Quiz Analysis
1. User completes quiz → Answers saved to database
2. User clicks "Analyze" → Agent analyzes last 5 quiz attempts
3. LLM identifies weak areas → Parsed and stored as weak_topics
4. Roadmap tasks auto-generated → Linked to weak_topic_id
5. User views roadmap → Clicks "Learn" → Tutor teaches that topic

---

## Technology Stack

| Component | Technology |
|-----------|-----------|
| Frontend | React 18.2 + TypeScript 5.3 |
| Build Tool | Vite 5.0 |
| Backend | FastAPI + Uvicorn |
| Database | SQLite + SQLAlchemy |
| Vector DB | FAISS |
| LLM | Ollama (llama3.2) |
| Agent Framework | LangGraph |
| Styling | Deep Obsidian Theme |
