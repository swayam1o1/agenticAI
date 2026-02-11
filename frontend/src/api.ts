export type Task = 'tutor' | 'quiz' | 'analyze' | 'roadmap' | 'questions'
export type TaskStatus = 'pending' | 'complete'

const BASE = 'http://127.0.0.1:8001'
const SESSION_KEY = 'agentic-study-session'

export type QuizQuestionDto = {
  id: number
  sequence: number
  question: string
  options: string[]
  correct_index?: number | null
  explanation?: string
}

export type QuizAnswerPayload = {
  session_id: string
  attempt_id: number
  question_id?: number | null
  selected_index?: number
  selected_option?: string | null
  is_correct: boolean
  note?: string
  confidence?: number
}

export type RoadmapTaskDto = {
  id: number
  title: string
  detail: string
  status: TaskStatus
  priority: number
  weak_topic_id?: number
  created_at: string
  updated_at?: string | null
}

export function getSessionId(): string | undefined {
  if (typeof window === 'undefined') return undefined
  return localStorage.getItem(SESSION_KEY) ?? undefined
}

function persistSessionId(id?: string): void {
  if (typeof window === 'undefined' || !id) return
  localStorage.setItem(SESSION_KEY, id)
}

export async function callAgent(
  task: Task,
  input: string,
  history: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [],
  sessionId?: string,
) {
  const payload: any = { task, input, history }
  const stored = sessionId ?? getSessionId()
  if (stored) {
    payload.session_id = stored
  }
  const response = await fetch(`${BASE}/api/agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error(`Agent error: ${response.status}`)
  const data = await response.json()
  if (data.session_id) {
    persistSessionId(data.session_id)
  }
  return data as Promise<{ task: Task; output: any; meta: any; session_id?: string }>
}

export async function submitQuizAnswer(payload: QuizAnswerPayload) {
  const response = await fetch(`${BASE}/api/quiz-answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error('Failed to save quiz answer')
  return response.json()
}

export async function fetchRoadmapTasks(sessionId: string) {
  const response = await fetch(`${BASE}/api/roadmap?session_id=${encodeURIComponent(sessionId)}`)
  if (!response.ok) throw new Error('Failed to load roadmap tasks')
  return response.json() as Promise<{ session_id: string; tasks: RoadmapTaskDto[] }>
}

export async function updateRoadmapTaskStatus(sessionId: string, taskId: number, status: TaskStatus) {
  const response = await fetch(`${BASE}/api/roadmap/task-status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, task_id: taskId, status }),
  })
  if (!response.ok) throw new Error('Failed to update task status')
  return response.json()
}

export async function fetchHistory(sessionId: string) {
  const response = await fetch(`${BASE}/api/history?session_id=${encodeURIComponent(sessionId)}`)
  if (!response.ok) throw new Error('Failed to load history')
  return response.json() as Promise<{ session_id: string; messages: Array<{ role: string; content: string; task: string; timestamp: string }> }>
}

export async function fetchAnalysis(sessionId: string) {
  const response = await fetch(`${BASE}/api/analysis?session_id=${encodeURIComponent(sessionId)}`)
  if (!response.ok) throw new Error('Failed to load analysis')
  return response.json() as Promise<{ session_id: string; summary: string | null; timestamp?: string }>
}

export async function fetchWeakTopics(sessionId: string) {
  const response = await fetch(`${BASE}/api/weak-topics?session_id=${encodeURIComponent(sessionId)}`)
  if (!response.ok) throw new Error('Failed to load weak topics')
  return response.json() as Promise<{ session_id: string; weak_topics: Array<{ id: number; title: string; detail: string; created_at: string }> }>
}

export async function addMemoryFromText(text: string) {
  const fd = new FormData()
  fd.append('texts', text)
  const r = await fetch(`${BASE}/api/memory`, { method: 'POST', body: fd })
  if (!r.ok) throw new Error('Failed to add memory')
  return r.json()
}

export async function addMemoryFromFile(file: File) {
  const fd = new FormData()
  fd.append('file', file)
  const r = await fetch(`${BASE}/api/memory`, { method: 'POST', body: fd })
  if (!r.ok) throw new Error('Failed to add memory file')
  return r.json()
}

export async function startLearning(sessionId: string, concept: string) {
  const response = await fetch(`${BASE}/api/learn/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, concept }),
  })
  if (!response.ok) throw new Error('Failed to start learning')
  return response.json()
}

export async function generateConceptQuiz(sessionId: string, concept: string, focusWeak: boolean = false) {
  const response = await fetch(`${BASE}/api/learn/quiz`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, concept, focus_weak_areas: focusWeak }),
  })
  if (!response.ok) throw new Error('Failed to generate concept quiz')
  return response.json()
}

export async function analyzeConceptQuiz(sessionId: string, attemptId: number, concept: string) {
  const response = await fetch(`${BASE}/api/learn/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, attempt_id: attemptId, concept }),
  })
  if (!response.ok) throw new Error('Failed to analyze quiz')
  return response.json()
}

export async function getLearningProgress(sessionId: string, concept?: string) {
  const url = concept 
    ? `${BASE}/api/learn/progress?session_id=${encodeURIComponent(sessionId)}&concept=${encodeURIComponent(concept)}`
    : `${BASE}/api/learn/progress?session_id=${encodeURIComponent(sessionId)}`
  const response = await fetch(url)
  if (!response.ok) throw new Error('Failed to get learning progress')
  return response.json()
}

export async function getConceptMastery(sessionId: string) {
  const response = await fetch(`${BASE}/api/mastery?session_id=${encodeURIComponent(sessionId)}`)
  if (!response.ok) throw new Error('Failed to get mastery data')
  return response.json()
}
