import { useEffect, useState } from 'react'
import { fetchRoadmapTasks, fetchWeakTopics, getSessionId, updateRoadmapTaskStatus } from '../api'
import type { RoadmapTaskDto, TaskStatus } from '../api'
import { useNavigate } from 'react-router-dom'

export default function Roadmap() {
  const [sessionId, setSessionId] = useState<string | undefined>(getSessionId())
  const [tasks, setTasks] = useState<RoadmapTaskDto[]>([])
  const [weakTopics, setWeakTopics] = useState<Array<{ id: number; title: string; detail: string }>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [learningConcept, setLearningConcept] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const sid = getSessionId()
    if (!sid || tasks.length > 0 || weakTopics.length > 0) return
    setSessionId(sid)
    setLoading(true)
    Promise.all([
      fetchRoadmapTasks(sid),
      fetchWeakTopics(sid)
    ])
      .then(([roadmapRes, weakRes]) => {
        setTasks(roadmapRes.tasks)
        setWeakTopics(weakRes.weak_topics || [])
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  async function toggleTask(task: RoadmapTaskDto) {
    if (!sessionId) return
    const nextStatus: TaskStatus = task.status === 'pending' ? 'complete' : 'pending'
    setLoading(true)
    try {
      await updateRoadmapTaskStatus(sessionId, task.id, nextStatus)
      setTasks(prev => prev.map(item => (item.id === task.id ? { ...item, status: nextStatus } : item)))
      setError(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function startLearning(taskTitle: string) {
    // Extract concept from title (e.g., "Review Arrays" -> "Arrays")
    const concept = taskTitle.replace(/^Review\s+/i, '').trim()
    setLearningConcept(concept)
    // Store in localStorage for Tutor page to pick up
    localStorage.setItem('agentic-learning-concept', concept)
    navigate('/')
  }

  if (!sessionId) {
    return <div className="panel">Start a quiz or message to build a roadmap (session not created yet).</div>
  }

  return (
    <div className="panel">
      {loading && <div className="loading">Refreshing roadmap…</div>}
      {error && <div className="error">{error}</div>}
      
      {weakTopics.length > 0 && (
        <div className="box" style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#f8d7da' }}>
          <strong>🎯 Identified Weak Areas (Auto-generated from Analysis):</strong>
          <ul style={{ marginTop: '0.5rem', marginBottom: '0', paddingLeft: '1.5rem' }}>
            {weakTopics.map(wt => (
              <li key={wt.id}><strong>{wt.title}</strong>: {wt.detail}</li>
            ))}
          </ul>
          <p style={{ fontSize: '0.85rem', marginTop: '0.5rem', marginBottom: 0 }}>
            ✅ Tasks below are automatically created to address these areas
          </p>
        </div>
      )}
      
      <div className="task-list">{tasks.map(task => (
          <div key={task.id} className={`task ${task.status}`}>
            <div>
              <strong>{task.title}</strong>
              <p>{task.detail}</p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button 
                type="button" 
                onClick={() => startLearning(task.title)}
                style={{ backgroundColor: '#007bff', color: '#fff' }}
              >
                📚 Learn
              </button>
              <button type="button" onClick={() => toggleTask(task)}>
                {task.status === 'pending' ? 'Mark complete' : 'Reopen'}
              </button>
            </div>
          </div>
        ))}
        {!tasks.length && <p>No roadmap tasks yet; run a quiz or analysis first.</p>}
      </div>
    </div>
  )
}
