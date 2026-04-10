import { useEffect, useState } from 'react'
import { fetchRoadmapTasks, fetchWeakTopics, getSessionId, updateRoadmapTaskStatus } from '../api'
import type { RoadmapTaskDto, TaskStatus } from '../api'
import { useNavigate } from 'react-router-dom'

export default function Roadmap() {
  const [sessionId, setSessionId]   = useState<string | undefined>(getSessionId())
  const [tasks, setTasks]           = useState<RoadmapTaskDto[]>([])
  const [weakTopics, setWeakTopics] = useState<Array<{ id: number; title: string; detail: string }>>([])
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const navigate = useNavigate()

  const fetchData = async (sid: string, showLoader = false) => {
    if (showLoader) setLoading(true)
    try {
      const [r, w] = await Promise.all([fetchRoadmapTasks(sid), fetchWeakTopics(sid)])
      setTasks(r.tasks)
      setWeakTopics(w.weak_topics || [])
      setError(null)
    } catch (e: any) { setError(e.message) }
    finally { if (showLoader) setLoading(false) }
  }

  useEffect(() => {
    const sid = getSessionId()
    if (!sid) return
    setSessionId(sid)
    // Initial load with spinner
    fetchData(sid, true)
    // Poll every 8 seconds for live background updates
    const interval = setInterval(() => fetchData(sid), 8000)
    return () => clearInterval(interval)
  }, [])

  async function toggleTask(task: RoadmapTaskDto) {
    if (!sessionId) return
    const next: TaskStatus = task.status === 'pending' ? 'complete' : 'pending'
    setLoading(true)
    try {
      await updateRoadmapTaskStatus(sessionId, task.id, next)
      setTasks(p => p.map(t => t.id === task.id ? { ...t, status: next } : t))
      setError(null)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  function startLearning(task: RoadmapTaskDto) {
    let concept = task.title.replace(/^Review\s+/i, '').trim()
    if (task.weak_topic_id && weakTopics.length > 0) {
      const wt = weakTopics.find(w => w.id === task.weak_topic_id)
      if (wt?.title) concept = wt.title.trim()
    }
    if (!concept || /^(analysis|review|chat|conversation)$/i.test(concept)) {
      const d = task.detail.replace(/^\d+\.\s*/, '').trim()
      concept = d.includes(':') ? d.split(':', 1)[0].trim() : d.split(/\s+/).slice(0, 6).join(' ')
    }
    if (concept.length > 50 || /weakest|based on/i.test(concept))
      concept = concept.split(' ').filter(w => w.length > 2).slice(0, 3).join(' ')
    localStorage.setItem('agentic-learning-concept', concept)
    localStorage.setItem('agentic-learning-detail', task.detail)
    navigate('/')
  }

  if (!sessionId) return (
    <div className="panel" style={{ textAlign: 'center', padding: '3rem' }}>
      <div style={{ fontSize: '56px', marginBottom: '12px' }} className="float">🗺️</div>
      <p style={{ color: 'var(--muted)', fontWeight: 800, fontSize: '15px' }}>
        Start a quiz or chat to build your roadmap!
      </p>
    </div>
  )

  const pending  = tasks.filter(t => t.status === 'pending')
  const complete = tasks.filter(t => t.status === 'complete')
  const pct      = tasks.length ? Math.round((complete.length / tasks.length) * 100) : 0

  return (
    <div className="panel">
      {loading && <div className="loading">Refreshing roadmap…</div>}
      {error && (
        <div style={{
          padding: '12px 18px', marginBottom: '1rem', fontWeight: 800, fontSize: '14px',
          background: 'linear-gradient(135deg, rgba(254,226,226,0.9), rgba(252,165,165,0.7))',
          border: '2px solid rgba(252,165,165,0.7)', borderRadius: 'var(--radius-sm)', color: '#dc2626',
          animation: 'fadeUp 0.4s ease both',
        }}>❌ {error}</div>
      )}

      {/* Weak Areas */}
      {weakTopics.length > 0 && (
        <div style={{
          marginBottom: '1.5rem', padding: '22px',
          background: 'linear-gradient(135deg, rgba(252,231,243,0.85), rgba(255,247,237,0.85))',
          backdropFilter: 'blur(14px)',
          border: '2.5px solid rgba(236,72,153,0.35)',
          borderRadius: 'var(--radius)', boxShadow: '0 6px 24px rgba(236,72,153,0.12)',
          animation: 'fadeUp 0.4s cubic-bezier(.34,1.56,.64,1) both',
        }}>
          <strong style={{ color: 'var(--pink)', fontSize: '16px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px' }}>
            🎯 Identified Weak Areas
          </strong>
          <ul style={{ marginTop: '12px', marginBottom: '8px', paddingLeft: '1.4rem', color: '#9d174d', fontWeight: 700 }}>
            {weakTopics.map(wt => (
              <li key={wt.id} style={{ marginBottom: '6px', fontSize: '14px', lineHeight: '1.65' }}>
                <strong style={{ color: 'var(--pink)' }}>{wt.title}</strong>: {wt.detail}
              </li>
            ))}
          </ul>
          <p style={{ fontSize: '13px', marginTop: '10px', marginBottom: 0, color: '#be185d', fontWeight: 800 }}>
            ✅ Tasks below are automatically generated for these areas
          </p>
        </div>
      )}

      {/* Progress stat cards */}
      {tasks.length > 0 && (
        <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '1.5rem' }}>
          {[
            { label: '📋 Pending', value: pending.length,  grad: 'var(--grad-sky)',    text: 'var(--sky-dark)' },
            { label: '✅ Done',    value: complete.length, grad: 'var(--grad-spring)', text: '#15803d' },
            { label: '🌟 Progress',value: `${pct}%`,       grad: 'var(--grad-candy)',  text: 'var(--purple-dark)' },
          ].map(item => (
            <div key={item.label} style={{
              background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(12px)',
              border: '2px solid rgba(186,230,253,0.5)',
              borderRadius: 'var(--radius)', padding: '18px', textAlign: 'center',
              boxShadow: 'var(--shadow-sm)',
              transition: 'all 0.22s cubic-bezier(.34,1.56,.64,1)',
              cursor: 'default',
            }}>
              <div style={{
                fontSize: '34px', fontWeight: 900, color: item.text,
                background: item.grad, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                {item.value}
              </div>
              <div style={{ fontSize: '13px', fontWeight: 900, color: 'var(--muted)', marginTop: '4px' }}>
                {item.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Progress bar */}
      {tasks.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ height: '10px', background: 'rgba(186,230,253,0.4)', borderRadius: '99px', overflow: 'hidden', border: '1.5px solid rgba(186,230,253,0.6)' }}>
            <div style={{
              height: '100%', width: `${pct}%`,
              background: 'var(--grad-candy)', backgroundSize: '200% 200%',
              animation: 'gradientShift 4s ease infinite',
              borderRadius: '99px',
              transition: 'width 0.8s cubic-bezier(.34,1.56,.64,1)',
              boxShadow: '0 2px 8px rgba(168,85,247,0.4)',
            }} />
          </div>
          <p style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 800, marginTop: '6px', textAlign: 'right' }}>
            {complete.length} of {tasks.length} tasks completed
          </p>
        </div>
      )}

      {/* Task list */}
      <div className="task-list">
        {tasks.map(task => (
          <div key={task.id} className={`task ${task.status}`} style={{
            background: task.status === 'complete'
              ? 'linear-gradient(135deg, rgba(220,252,231,0.85), rgba(187,247,208,0.85))'
              : 'rgba(255,255,255,0.78)',
            backdropFilter: 'blur(12px)',
            border: `2.5px solid ${task.status === 'complete' ? 'rgba(134,239,172,0.7)' : 'rgba(196,181,253,0.5)'}`,
          }}>
            <div style={{ flex: 1 }}>
              <strong style={{ color: task.status === 'complete' ? '#15803d' : 'var(--purple-dark)', fontSize: '15px', fontWeight: 900 }}>
                {task.status === 'complete' ? '✅ ' : '📌 '}{task.title}
              </strong>
              <p style={{ color: 'var(--muted)', marginTop: '4px', fontSize: '13.5px', fontWeight: 700 }}>{task.detail}</p>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flexShrink: 0 }}>
              {task.status !== 'complete' && (
                <button type="button" onClick={() => startLearning(task)}
                  style={{ background: 'var(--grad-sky)', padding: '10px 18px', fontSize: '13px' }}>
                  📚 Learn
                </button>
              )}
              <button type="button" onClick={() => toggleTask(task)} style={{
                background: task.status === 'complete'
                  ? 'linear-gradient(135deg, rgba(243,232,255,0.9), rgba(233,213,255,0.9))'
                  : 'linear-gradient(135deg, rgba(220,252,231,0.9), rgba(187,247,208,0.9))',
                color: task.status === 'complete' ? 'var(--purple-dark)' : '#15803d',
                boxShadow: 'none', border: '2px solid ' + (task.status === 'complete' ? 'rgba(196,181,253,0.6)' : 'rgba(134,239,172,0.6)'),
                fontSize: '13px', padding: '10px 16px',
              }}>
                {task.status === 'pending' ? '🎉 Mark Done' : '🔁 Reopen'}
              </button>
            </div>
          </div>
        ))}
        {!tasks.length && !loading && (
          <div style={{
            textAlign: 'center', padding: '3rem',
            background: 'linear-gradient(135deg, rgba(224,242,254,0.5), rgba(243,232,255,0.5))',
            borderRadius: 'var(--radius)', border: '2.5px dashed rgba(168,85,247,0.3)',
            animation: 'fadeUp 0.5s cubic-bezier(.34,1.56,.64,1) both',
          }}>
            <div className="float" style={{ fontSize: '56px', marginBottom: '12px' }}>🗺️</div>
            <p style={{ color: 'var(--muted)', fontWeight: 800, fontSize: '15px', margin: 0 }}>
              No roadmap tasks yet — run a quiz or analysis first!
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
