import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { createNewSession, getSessionId } from '../api'

type SessionInfo = {
  id: string
  created: string
  isCurrent: boolean
}

export default function Sessions() {
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const navigate = useNavigate()
  const currentSessionId = getSessionId()

  useEffect(() => {
    loadSessions()
  }, [])

  function loadSessions() {
    const allSessions: SessionInfo[] = []
    
    // Scan localStorage for all session metadata
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith('session_') && key.endsWith('_created')) {
        const sessionId = key.replace('session_', '').replace('_created', '')
        const created = localStorage.getItem(key) || ''
        allSessions.push({
          id: sessionId,
          created,
          isCurrent: sessionId === currentSessionId
        })
      }
    }
    
    // Sort by creation date (newest first)
    allSessions.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime())
    setSessions(allSessions)
  }

  function handleNewSession() {
    createNewSession()
    navigate('/')
    window.location.reload()
  }

  function switchToSession(sessionId: string) {
    localStorage.setItem('agentic-study-session', sessionId)
    navigate('/')
    window.location.reload()
  }

  function deleteSession(sessionId: string) {
    if (!confirm('Delete this session? This cannot be undone.')) return
    
    // Remove session metadata
    localStorage.removeItem(`session_${sessionId}_created`)
    
    // If it's the current session, create a new one
    if (sessionId === currentSessionId) {
      createNewSession()
    }
    
    loadSessions()
  }

  function formatDate(isoString: string): string {
    const date = new Date(isoString)
    return date.toLocaleString()
  }

  function formatRelativeTime(isoString: string): string {
    const date = new Date(isoString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} min ago`
    if (diffHours < 24) return `${diffHours} hours ago`
    if (diffDays < 7) return `${diffDays} days ago`
    return formatDate(isoString)
  }

  return (
    <div className="panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#e4e4e7', margin: 0 }}>Learning Sessions</h2>
        <button 
          onClick={handleNewSession}
          style={{ 
            padding: '10px 20px',
            backgroundColor: '#6366F1',
            color: 'white',
            border: '1px solid #6366F1',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '500'
          }}
        >
          ➕ Create New Session
        </button>
      </div>

      {sessions.length === 0 && (
        <div className="box" style={{ textAlign: 'center', padding: '2rem', color: '#a1a1aa' }}>
          <p>No sessions found. Create a new session to start learning!</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {sessions.map(session => (
          <div 
            key={session.id}
            className="box"
            style={{ 
              padding: '16px',
              backgroundColor: session.isCurrent ? '#1a1a24' : '#13131a',
              border: session.isCurrent ? '1px solid #6366F1' : '1px solid #27272f',
              borderLeft: session.isCurrent ? '3px solid #6366F1' : '1px solid #27272f',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <strong style={{ color: '#e4e4e7', fontSize: '14px' }}>{formatDate(session.created)}</strong>
                {session.isCurrent && (
                  <span style={{ 
                    fontSize: '10px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    backgroundColor: '#6366F1', 
                    color: 'white', 
                    padding: '2px 8px',
                    borderRadius: '3px',
                    fontWeight: '600'
                  }}>
                    CURRENT
                  </span>
                )}
              </div>
              <div style={{ fontSize: '12px', color: '#71717a' }}>
                {formatRelativeTime(session.created)} • ID: {session.id.slice(0, 8)}...
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              {!session.isCurrent && (
                <button 
                  onClick={() => switchToSession(session.id)}
                  style={{ 
                    padding: '8px 16px',
                    backgroundColor: '#6366F1',
                    color: 'white',
                    border: '1px solid #6366F1',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '500'
                  }}
                >
                  Switch
                </button>
              )}
              <button 
                onClick={() => deleteSession(session.id)}
                style={{ 
                  padding: '8px 16px',
                  backgroundColor: '#27272f',
                  color: '#F43F5E',
                  border: '1px solid #27272f',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                🗑️
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="box" style={{ 
        marginTop: '1.5rem',
        padding: '16px',
        backgroundColor: '#1a1a24',
        border: '1px solid #6366F1',
        borderLeft: '3px solid #6366F1'
      }}>
        <strong style={{ color: '#6366F1', fontSize: '13px' }}>💡 About Sessions</strong>
        <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#a1a1aa', lineHeight: '1.6' }}>
          Each session stores its own chat history, quizzes, weak areas, and roadmap separately. 
          Create a new session when starting a new topic or want a fresh start.
        </p>
      </div>
    </div>
  )
}
