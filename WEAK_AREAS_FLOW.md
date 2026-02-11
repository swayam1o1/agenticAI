# How Weak Areas Are Determined - Complete Flow

## 🎯 Initial Weak Area Detection

### **Method 1: From Quiz Performance (Primary)**

When a user takes a quiz, the system automatically analyzes their performance:

```
User takes quiz → Answers questions → System tracks:
- Which questions were answered correctly/incorrectly
- The topic of each question
- Overall accuracy per topic
```

**Automatic Analysis Trigger:**
- After 3+ quizzes
- OR after any quiz with < 60% accuracy
- System calls Analysis Agent automatically

### **Method 2: Manual Analysis (Secondary)**

User can manually click "Analyze Weak Areas" which:
1. Loads full conversation history from database
2. Analyzes tutor conversations + quiz results
3. Uses LLM to identify patterns of confusion/mistakes
4. Extracts specific misconceptions

## 📊 The Complete Workflow

### **Step 1: User Learns (No weak areas yet)**
```
User: "Explain recursion"
Tutor Agent: [Explains recursion with examples]
Status: No weak areas identified yet
```

### **Step 2: First Quiz**
```
User generates quiz on "Recursion"
Quiz Agent: Creates 5 questions (generic, not focused)
User answers: 3/5 correct (60%)
Storage saves: QuizAttempt + QuizAnswers
```

### **Step 3: Analysis Triggers**
After 2-3 quizzes OR if performance < 60%, two options:

**Option A - Automatic (if < 60% on any quiz):**
```python
# In orchestrator.py
if accuracy < 0.6:
    # Auto-trigger analysis
    agent.run(task="analyze", ...)
```

**Option B - Manual:**
```
User clicks "Analyze Weak Areas" button
→ Analysis Agent runs
```

### **Step 4: Analysis Agent Extracts Weak Topics**
```python
# agent.py - _analyze() method
def _analyze(self, state: State):
    # Get conversation history + quiz results
    history_text = "\n".join([msg.content for msg in history][-20:])
    
    # LLM analyzes
    prompt = """
    Given the learner's recent interactions and quiz results,
    identify 3 weakest subtopics, misconceptions, and next steps.
    """
    analysis = llm.generate(prompt)
    
    # Returns something like:
    # "**Weakest Subtopics:**
    # - Base Case Identification: Struggles with...
    # - Recursive Call Structure: Confuses...
    # - Stack Overflow Prevention: Doesn't understand..."
```

### **Step 5: Parse & Store Weak Topics**
```python
# storage.py - log_weak_topics()
def log_weak_topics(session_id, summary):
    # Parse bullet points from LLM output
    entries = _parse_summary(summary)
    # Example: [
    #   {"topic": "Base Case Identification", "detail": "Struggles with..."},
    #   {"topic": "Recursive Call Structure", "detail": "Confuses..."}
    # ]
    
    # Save to database
    for entry in entries:
        weak_topic = WeakTopic(
            session_id=session_id,
            topic=entry["topic"],
            detail=entry["detail"]
        )
        db.add(weak_topic)
    
    # Auto-create roadmap tasks
    _create_tasks_from_weak_topics(weak_topics)
```

### **Step 6: Roadmap Tasks Auto-Created**
```python
# storage.py - _create_tasks_from_weak_topics()
for weak_topic in weak_topics:
    task = RoadmapTask(
        session_id=session_id,
        title=f"Review {weak_topic.topic.title()}",
        detail=weak_topic.detail,
        status="pending",
        weak_topic_id=weak_topic.id  # Links back!
    )
    db.add(task)
```

Now the database contains:
```sql
WeakTopics:
  id=1, topic="Base Case Identification", detail="Struggles with..."

RoadmapTasks:
  id=1, title="Review Base Case Identification", 
  weak_topic_id=1, status="pending"
```

### **Step 7: Next Quiz Is Focused**
```python
# agent.py - _quiz() method
def _quiz(state):
    weak_topics = storage.get_weak_topics(session_id)
    
    if weak_topics:
        # Inject into LLM prompt
        focus = "Focus heavily on: " + ", ".join([
            f"{wt['title']}: {wt['detail']}" 
            for wt in weak_topics[:3]
        ])
        
        prompt = f"""
        Create a 5-question quiz on {topic}.
        {focus}
        """
    
    # LLM generates questions weighted toward weak areas!
```

### **Step 8: User Sees Targeted Content**
Frontend displays:
```
🎯 Target These Weak Areas:
- Base Case Identification: Struggles with determining when recursion stops
- Recursive Call Structure: Confuses parameter passing

[Generate Focused Quiz on Weak Areas] button
```

When clicked → Quiz Agent gets weak topics → LLM focuses questions on those areas

### **Step 9: Cycle Repeats (Adaptive Learning)**
```
User takes focused quiz → New performance data
→ If improved: weak topic stays but weight decreases
→ If still struggling: more focused content
→ If mastered: weak topic can be marked resolved
```

## 🔍 Example: Complete Trace

### **Session Start**
```
Messages: []
WeakTopics: []
QuizAttempts: []
RoadmapTasks: []
```

### **After Tutor Conversation**
```
Messages: [
  {role: "user", content: "explain recursion"},
  {role: "assistant", content: "Recursion is..."}
]
WeakTopics: [] ← Still none, just learning
```

### **After First Quiz (60% accuracy)**
```
QuizAttempts: [
  {topic: "Recursion", correct: 3, total: 5, accuracy: 0.6}
]
QuizAnswers: [
  {question_id: 1, is_correct: true},
  {question_id: 2, is_correct: false}, ← Missed base case question
  {question_id: 3, is_correct: true},
  {question_id: 4, is_correct: false}, ← Missed stack question
  {question_id: 5, is_correct: true}
]
```

### **Orchestrator Detects Low Performance**
```python
# orchestrator.py
if accuracy < 0.6:
    return {"action": "analyze", "trigger": "automatic"}
```

### **Analysis Runs (Manual or Auto)**
```
User clicks "Analyze Weak Areas" OR auto-triggered

Analysis Agent output:
"**Weakest Subtopics:**
- Base Case Identification: Missed question about stopping condition
- Stack Overflow: Doesn't understand call stack depth

**Targeted Next Steps:**
- Practice identifying base cases
- Study call stack visualization"
```

### **Storage Parses & Saves**
```python
# Parsed entries:
[
  {"topic": "Base Case Identification", "detail": "Missed stopping condition"},
  {"topic": "Stack Overflow", "detail": "Call stack depth confusion"}
]

# Database after save:
WeakTopics: [
  {id: 1, topic: "Base Case Identification", detail: "..."},
  {id: 2, topic: "Stack Overflow", detail: "..."}
]

RoadmapTasks: [
  {id: 1, title: "Review Base Case Identification", weak_topic_id: 1},
  {id: 2, title: "Review Stack Overflow", weak_topic_id: 2}
]
```

### **Next Quiz Generation**
```
User: "Generate quiz on recursion"

Quiz Agent queries: storage.get_weak_topics(session_id)
Returns: [
  {id: 1, title: "Base Case Identification", detail: "..."},
  {id: 2, title: "Stack Overflow", detail: "..."}
]

LLM Prompt:
"Create 5-question quiz on recursion.
**IMPORTANT: Focus heavily on these weak areas:**
- Base Case Identification: Missed stopping condition
- Stack Overflow: Call stack depth confusion"

Result: 4/5 questions focus on base cases and stack depth!
```

## 🎓 Summary

**Initial weak areas come from:**
1. ✅ **Quiz performance analysis** (primary) - incorrect answers
2. ✅ **Conversation analysis** (secondary) - confusion in chat
3. ✅ **LLM pattern detection** - identifies misconceptions from text

**The LLM's role:**
- Analyzes conversation + quiz history
- Extracts semantic patterns (not just wrong answers)
- Identifies *why* user is struggling (e.g., "confuses base case with exit condition")
- Formats as structured bullet points

**Key insight:**
It's not just "wrong answer tracking" - the system uses LLM to understand *conceptual gaps* from both conversations and quiz performance, then adaptively generates content to fill those gaps.
