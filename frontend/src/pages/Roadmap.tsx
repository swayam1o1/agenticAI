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

  function startLearning(task: RoadmapTaskDto) {
    // Extract concept from task title (remove "Review " prefix)
    let concept = task.title.replace(/^Review\s+/i, '').trim()
    
    // If task is linked to a weak topic, use the actual weak topic title
    if (task.weak_topic_id && weakTopics.length > 0) {
      const weakTopic = weakTopics.find(wt => wt.id === task.weak_topic_id)
      if (weakTopic && weakTopic.title) {
        concept = weakTopic.title.trim()
        console.log('Using weak topic:', concept)
      }
    }
    
    // Final validation - if concept looks malformed, extract first few words
    if (concept.length > 50 || concept.toLowerCase().includes('weakest') || 
        concept.toLowerCase().includes('based on')) {
      const words = concept.split(' ').filter(w => w.length > 2)
      concept = words.slice(0, 3).join(' ')
    }
    
    console.log('Starting learning for concept:', concept)
    setLearningConcept(concept)
    localStorage.setItem('agentic-learning-concept', concept)
    navigate('/')
  }

  if (!sessionId) {
    return <div className="panel">Start a quiz or message to build a roadmap (session not created yet).</div>
  }

  return (
    <div className="panel">
      {loading && <div className="loading">Refreshing roadmap…</div>}
      {error && <div className="error" style={{ color: '#F43F5E', padding: '12px', marginBottom: '16px' }}>{error}</div>}
      
      {weakTopics.length > 0 && (
        <div className="box" style={{ 
          marginBottom: '1rem',
          padding: '20px',
          backgroundColor: '#1a1a24',
          border: '1px solid #F43F5E',
          borderLeft: '3px solid #F43F5E'
        }}>
          <strong style={{ 
            color: '#F43F5E',
            fontSize: '14px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            🎯 Identified Weak Areas
          </strong>
          <ul style={{ 
            marginTop: '12px',
            marginBottom: '0',
            paddingLeft: '1.5rem',
            color: '#e4e4e7'
          }}>
            {weakTopics.map(wt => (
              <li key={wt.id} style={{ 
                marginBottom: '8px',
                fontSize: '13px',
                lineHeight: '1.6'
              }}>
                <strong style={{ color: '#fb7185' }}>{wt.title}</strong>: {wt.detail}
              </li>
            ))}
          </ul>
          <p style={{ 
            fontSize: '12px',
            marginTop: '12px',
            marginBottom: 0,
            color: '#a1a1aa'
          }}>
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
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button 
                type="button" 
                onClick={() => startLearning(task)}
                style={{ backgroundColor: '#6366F1', borderColor: '#6366F1', color: '#fff' }}
              >
                📚 Learn
              </button>
              <button type="button" onClick={() => toggleTask(task)}>
                {task.status === 'pending' ? 'Mark complete' : 'Reopen'}
              </button>
            </div>
          </div>
        ))}
        {!tasks.length && <p style={{ color: '#a1a1aa', fontSize: '13px' }}>No roadmap tasks yet; run a quiz or analysis first.</p>}
      </div>
    </div>
  )
}
