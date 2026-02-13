import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { createNewSession, getSessionDisplayName } from './api'

export default function App() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [sessionName, setSessionName] = useState('')
  
  useEffect(() => {
    setSessionName(getSessionDisplayName())
  }, [pathname])
  
  const handleNewSession = () => {
    if (confirm('Create a new learning session? This will start fresh with no history.')) {
      createNewSession()
      setSessionName(getSessionDisplayName())
      navigate('/')
      window.location.reload()
    }
  }
  
  const tabs = [
    { to: '/', label: 'Tutor' },
    { to: '/quiz', label: 'Quiz' },
    { to: '/analytics', label: 'Weak Areas' },
    { to: '/roadmap', label: 'Roadmap' },
    { to: '/memory', label: 'Memory' },
    { to: '/sessions', label: 'Sessions' }
  ]

  return (
    <div className="app">
      <header className="header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <h1>ITR</h1>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {sessionName}
            </span>
            <button 
              onClick={handleNewSession}
              style={{ 
                padding: '6px 12px', 
                fontSize: '11px',
                backgroundColor: '#6366F1',
                color: 'white',
                border: '1px solid #6366F1',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '500',
                letterSpacing: '0.01em'
              }}
            >
              New Session
            </button>
          </div>
        </div>
        <nav>
          {tabs.map(t => (
            <Link key={t.to} to={t.to} className={pathname === t.to ? 'active' : ''}>{t.label}</Link>
          ))}
        </nav>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
