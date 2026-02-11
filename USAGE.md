# Agentic Study Buddy - Usage Guide

## Features Overview

### 1. **Tutor** (AI Tutoring)
Ask questions about your study materials. The agent retrieves relevant context from memory and provides detailed explanations with citations.

**Example:** "Explain photosynthesis step by step"

### 2. **Quiz** (Practice Tests)
Generate multiple-choice quizzes on any topic. The agent creates 5 questions with explanations.

**Example topic:** "Cell biology" or "World War II"

### 3. **Weak Areas** (Analysis)
Paste your quiz results or conversation history to identify knowledge gaps and get targeted improvement suggestions.

**Input:** Recent study session transcripts or quiz scores

### 4. **Roadmap** (Study Planning)
Get a personalized 2-week study plan with daily objectives, resources, and time estimates.

**Example:** "Prepare for AP Chemistry exam" or "Learn React fundamentals"

### 5. **Memory** (Knowledge Base)
Upload study materials (notes, PDFs, text) to build your personalized knowledge base. The agent uses FAISS to semantically search this content.

## Workflow Example

1. **Build Knowledge Base**
   - Go to "Memory" tab
   - Upload biology textbook chapter or paste notes
   - System indexes content for semantic search

2. **Study with Tutor**
   - Go to "Tutor" tab
   - Ask: "What is the Krebs cycle?"
   - Get grounded explanations with citations from your materials

3. **Test Yourself**
   - Go to "Quiz" tab
   - Enter: "Cellular respiration"
   - Take the generated quiz

4. **Analyze Performance**
   - Go to "Weak Areas" tab
   - Paste quiz results
   - Get targeted improvement plan

5. **Create Study Plan**
   - Go to "Roadmap" tab
   - Enter: "Master cellular biology in 2 weeks"
   - Follow the daily plan

## Technical Details

- **Backend:** FastAPI running on http://127.0.0.1:8001
- **Frontend:** React (Vite) on http://127.0.0.1:5173
- **LLM:** Ollama (llama3) - runs locally, no API keys needed
- **Memory:** FAISS vector store persists in `backend/data/memory.index`
- **Orchestration:** LangGraph manages the retrieve→generate workflow

## Tips

- Add study materials to Memory *before* asking questions for better responses
- The more context you provide, the more personalized the roadmap
- Quiz questions adapt to your uploaded materials
- Analysis works best with at least 5-10 interaction history items
