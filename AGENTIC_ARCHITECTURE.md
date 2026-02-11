# Agentic Study Buddy - System Architecture

## 🤖 Agentic Orchestration Overview

This system implements a **multi-agent learning orchestration** where different AI agents communicate and collaborate to provide an adaptive, personalized learning experience.

## 📊 Architecture Components

### 1. **Core Agents**
- **Tutor Agent**: Answers questions using RAG (FAISS + LangChain)
- **Quiz Agent**: Generates targeted multiple-choice questions
- **Analysis Agent**: Identifies weak areas from performance
- **Roadmap Agent**: Creates personalized study plans

### 2. **Orchestrator** (`orchestrator.py`)
The brain of the system that:
- Analyzes learning progress
- Routes tasks between agents
- Maintains shared context
- Triggers automatic workflows
- Provides AI-powered recommendations

### 3. **Persistence Layer**
- **SQLite Database**: Stores sessions, messages, quiz attempts, weak topics, roadmap tasks
- **FAISS Vector Store**: Semantic search over study materials
- **Session Management**: Tracks user progress across page loads

## 🔄 Agentic Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                    Learning Cycle                            │
└─────────────────────────────────────────────────────────────┘

1️⃣ USER LEARNS
   ├─ Chat with Tutor Agent
   ├─ Ask questions about topics
   └─ FAISS retrieves relevant study materials

2️⃣ USER TAKES QUIZ
   ├─ Quiz Agent generates questions
   ├─ Questions stored in DB with correct answers
   ├─ User submits answers
   └─ System tracks: correct/incorrect/topic

3️⃣ SYSTEM ANALYZES (Auto-triggered)
   ├─ Analysis Agent reviews quiz performance
   ├─ Identifies patterns & weak areas
   ├─ Extracts specific misconceptions
   └─ Stores WeakTopics in DB

4️⃣ ROADMAP AUTO-UPDATES
   ├─ Weak topics → RoadmapTasks created
   ├─ Tasks linked to weak_topic_id
   ├─ User sees actionable todos
   └─ Tasks can be marked complete

5️⃣ NEXT QUIZ IS TARGETED
   ├─ Quiz Agent queries weak_topics table
   ├─ Generates questions focused on weak areas
   ├─ LLM prompt includes: "Focus on [weak areas]"
   └─ Cycle repeats → adaptive learning

6️⃣ ORCHESTRATOR RECOMMENDS
   ├─ GET /api/recommendations
   ├─ Returns: next_action, performance, suggestions
   └─ Frontend shows intelligent prompts
```

## 🧠 Inter-Agent Communication

### Shared State via Database
```python
# Quiz Agent writes results
quiz_attempt = QuizAttempt(session_id, topic, questions)
quiz_answers = QuizAnswer(attempt_id, question_id, is_correct)

# Analysis Agent reads quiz history
quiz_history = storage.get_quiz_history(session_id)
weak_areas = analyze_performance(quiz_history)
storage.log_weak_topics(session_id, weak_areas)

# Quiz Agent reads weak topics (next cycle)
weak_topics = storage.get_weak_topics(session_id)
focused_quiz = generate_quiz_with_focus(weak_topics)
```

### Orchestrator Coordination
```python
# orchestrator.py
def orchestrate_learning_cycle(session_id, current_task):
    weak_topics = storage.get_weak_topics(session_id)
    quiz_history = storage.get_quiz_history(session_id)
    
    if current_task == "quiz" and weak_topics:
        # Inject weak topics into Quiz Agent context
        return {"focus_areas": weak_topics}
    
    elif current_task == "analyze":
        # Trigger roadmap update after analysis
        return {"update_roadmap": True}
    
    # Recommend next action based on state
    return get_next_recommended_action(session_id)
```

## 🎯 Key Features

### 1. **Persistent Analysis**
- Analytics page loads previous analysis on mount
- Uses `GET /api/analysis?session_id=X`
- Analysis summary persists across navigation

### 2. **Weak Area Targeting**
- Quiz page shows weak topics banner
- "Generate Focused Quiz" button auto-fills topic
- Quiz Agent receives weak topics in prompt context

### 3. **Roadmap-Weak Topic Integration**
- Weak topics automatically create tasks
- Roadmap page shows weak areas source
- Tasks linked via `weak_topic_id` foreign key

### 4. **Adaptive Question Generation**
```python
# agent.py - _quiz() method
weak_topics = storage.get_weak_topics(session_id)
if weak_topics:
    focus_prompt = "Focus heavily on: " + weak_topics_list
    prompt = base_quiz_prompt + focus_prompt
```

### 5. **Smart Recommendations**
```python
# orchestrator.py
if accuracy < 0.6:
    return "Take focused quiz on weak areas"
elif no_analysis_yet and quiz_count >= 3:
    return "Analyze your progress"
elif weak_topics_exist:
    return "Review roadmap tasks"
```

## 📡 API Endpoints for Orchestration

```
POST /api/agent                  # Run any agent task
GET  /api/history                # Get chat history
GET  /api/analysis               # Get latest analysis (NEW)
GET  /api/weak-topics            # Get identified weak areas (NEW)
GET  /api/roadmap                # Get study plan tasks
GET  /api/quiz-history           # Get quiz attempts
POST /api/quiz-answer            # Submit quiz answer
POST /api/roadmap/task-status    # Update task status
GET  /api/recommendations        # Get AI recommendations (NEW)
```

## 🔧 Frontend Integration

### Analytics Page
```typescript
// Loads previous analysis on mount
useEffect(() => {
  fetchAnalysis(sessionId).then(data => {
    if (data.summary) setSummary(data.summary)
  })
}, [])
```

### Quiz Page
```typescript
// Shows weak topics and provides focus button
useEffect(() => {
  fetchWeakTopics(sessionId).then(data => {
    setWeakTopics(data.weak_topics)
  })
}, [])

// Auto-generate focused quiz
<button onClick={() => {
  setTopic('Review my weak areas')
  generate()
}}>Generate Focused Quiz</button>
```

### Roadmap Page
```typescript
// Shows weak topics that generated tasks
{weakTopics.map(wt => (
  <li>{wt.title}: {wt.detail}</li>
))}
<p>✅ Tasks below auto-created to address these areas</p>
```

## 🚀 Benefits of This Architecture

1. **Truly Adaptive**: Quiz difficulty/focus changes based on performance
2. **Self-Improving**: Each cycle generates better targeted content
3. **Persistent Context**: Agents share state via database
4. **Autonomous**: Analysis triggers automatically when needed
5. **Transparent**: User sees why quiz focuses on certain topics
6. **Action-Oriented**: Weak areas → Roadmap tasks → Next quiz

## 🔮 Future Enhancements

- **Spaced Repetition**: Track concept mastery over time
- **Difficulty Scaling**: Easier questions for weak areas, harder for strong areas
- **Multi-Modal Learning**: Generate diagrams, videos for visual learners
- **Peer Learning**: Compare with anonymized cohort performance
- **LangChain Agents**: Use LangChain's agent framework for more complex reasoning
- **LangSmith Tracing**: Monitor agent decisions and optimize prompts
