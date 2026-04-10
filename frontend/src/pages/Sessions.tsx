import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { createNewSession, getSessionId } from '../api'

type SessionInfo = { id: string; created: string; isCurrent: boolean }

export default function Sessions() {
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const navigate = useNavigate()
  const currentSessionId = getSessionId()

  useEffect(() => { loadSessions() }, [])

  function loadSessions() {
    const all: SessionInfo[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith('session_') && key.endsWith('_created')) {
        const id = key.replace('session_', '').replace('_created', '')
        all.push({ id, created: localStorage.getItem(key) || '', isCurrent: id === currentSessionId })
      }
    }
    all.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime())
    setSessions(all)
  }

  function handleNewSession() { createNewSession(); navigate('/'); window.location.reload() }
  function switchToSession(id: string) { localStorage.setItem('agentic-study-session', id); navigate('/'); window.location.reload() }
  function deleteSession(id: string) {
    if (!confirm('Delete this session? This cannot be undone.')) return
    localStorage.removeItem(`session_${id}_created`)
    if (id === currentSessionId) createNewSession()
    loadSessions()
  }
  const fmt  = (s: string) => new Date(s).toLocaleString()
  const rel  = (s: string) => {
    const ms = Date.now() - new Date(s).getTime()
    const m = Math.floor(ms/60000), h = Math.floor(ms/3600000), d = Math.floor(ms/86400000)
    if (m < 1) return 'Just now'; if (m < 60) return `${m} min ago`
    if (h < 24) return `${h} hours ago`; if (d < 7) return `${d} days ago`; return fmt(s)
  }

  return (
    <div className="panel">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem' }}>
        <div>
          <h2 style={{ fontSize: '24px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            📚 Learning Sessions
          </h2>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '13px', fontWeight: 700 }}>
            {sessions.length} session{sessions.length !== 1 ? 's' : ''} stored
          </p>
        </div>
        <button onClick={handleNewSession} style={{ background: 'var(--grad-spring)' }}>
          ✨ New Session
        </button>
      </div>

      {sessions.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '3rem',
          background: 'linear-gradient(135deg, rgba(224,242,254,0.5), rgba(243,232,255,0.5))',
          borderRadius: 'var(--radius)', border: '2.5px dashed rgba(168,85,247,0.3)',
          animation: 'fadeUp 0.5s cubic-bezier(.34,1.56,.64,1) both',
        }}>
          <div style={{ fontSize: '56px', marginBottom: '12px' }} className="float">🌱</div>
          <p style={{ color: 'var(--muted)', fontWeight: 800, fontSize: '15px', margin: 0 }}>
            No sessions yet — create your first one to start learning!
          </p>
        </div>
      )}

      <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {sessions.map(s => (
          <div key={s.id} style={{
            padding: '18px 22px',
            background: s.isCurrent
              ? 'linear-gradient(135deg, rgba(224,242,254,0.9), rgba(243,232,255,0.9))'
              : 'rgba(255,255,255,0.75)',
            backdropFilter: 'blur(12px)',
            border: s.isCurrent ? '2.5px solid rgba(168,85,247,0.5)' : '2px solid rgba(186,230,253,0.6)',
            borderRadius: 'var(--radius)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            boxShadow: s.isCurrent ? '0 4px 20px rgba(168,85,247,0.18)' : 'var(--shadow-sm)',
            transition: 'all 0.22s cubic-bezier(.34,1.56,.64,1)',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                <strong style={{ color: 'var(--text)', fontSize: '14.5px', fontWeight: 900 }}>
                  🕐 {fmt(s.created)}
                </strong>
                {s.isCurrent && (
                  <span className="pulse-ring" style={{
                    fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em',
                    background: 'linear-gradient(135deg, #a855f7, #ec4899)',
                    color: '#fff', padding: '3px 12px', borderRadius: '99px',
                    boxShadow: '0 2px 10px rgba(168,85,247,0.4)',
                  }}>
                    ⭐ CURRENT
                  </span>
                )}
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--muted)', fontWeight: 700 }}>
                {rel(s.created)} · ID: {s.id.slice(0, 8)}…
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              {!s.isCurrent && (
                <button onClick={() => switchToSession(s.id)}
                  style={{ background: 'var(--grad-sky)', padding: '9px 18px', fontSize: '13px' }}>
                  🔀 Switch
                </button>
              )}
              <button onClick={() => deleteSession(s.id)} style={{
                background: 'linear-gradient(135deg, rgba(254,226,226,0.9), rgba(252,165,165,0.8))',
                color: '#dc2626', boxShadow: 'none',
                border: '2px solid rgba(252,165,165,0.6)',
                padding: '9px 14px', fontSize: '16px',
              }}>
                🗑️
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Info box */}
      <div style={{
        marginTop: '1.75rem', padding: '18px 22px',
        background: 'linear-gradient(135deg, rgba(254,252,232,0.9), rgba(255,247,237,0.9))',
        backdropFilter: 'blur(12px)',
        border: '2px solid rgba(253,230,138,0.7)',
        borderRadius: 'var(--radius)',
        boxShadow: '0 4px 16px rgba(250,204,21,0.12)',
      }}>
        <strong style={{ color: '#b45309', fontSize: '14px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '6px' }}>
          💡 About Sessions
        </strong>
        <p style={{ margin: '8px 0 0', fontSize: '13.5px', color: '#92400e', lineHeight: '1.7', fontWeight: 700 }}>
          Each session stores its own chat history, quizzes, weak areas, and roadmap separately.
          Create a new session when starting a new topic or want a fresh start! 🚀
        </p>
      </div>
    </div>
  )
}
