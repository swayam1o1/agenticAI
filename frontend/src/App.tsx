import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { createNewSession, getSessionDisplayName } from './api'

/* tiny floating star */
const Star = ({ style }: { style: React.CSSProperties }) => (
  <span
    aria-hidden
    style={{
      position: 'absolute',
      fontSize: '18px',
      pointerEvents: 'none',
      animation: 'float 3s ease-in-out infinite',
      opacity: 0.7,
      zIndex: 0,
      ...style,
    }}
  >
    ✦
  </span>
)

export default function App() {
  const { pathname } = useLocation()
  const navigate     = useNavigate()
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
    { to: '/',          label: 'Tutor',      icon: '🤖' },
    { to: '/quiz',      label: 'Quiz',       icon: '🧠' },
    { to: '/analytics', label: 'Weak Areas', icon: '📊' },
    { to: '/roadmap',   label: 'Roadmap',    icon: '🗺️'  },
    { to: '/memory',    label: 'Memory',     icon: '💡' },
    { to: '/flashcards',label: 'Flashcards', icon: '📇' },
    { to: '/mindmap',   label: 'Mindmap',    icon: '🗺️' },
    { to: '/sessions',  label: 'Sessions',   icon: '📚' },
  ]

  return (
    <div className="app">
      <header className="header" style={{ position: 'relative', overflow: 'hidden' }}>

        {/* Decorative floating stars in header */}
        <Star style={{ top: 10, right: 220, animationDelay: '0s',   color: 'rgba(255,255,255,0.55)',  fontSize: '14px' }} />
        <Star style={{ top: 28, right: 360, animationDelay: '0.8s', color: 'rgba(255,255,255,0.45)',  fontSize: '10px' }} />
        <Star style={{ top: 8,  right: 500, animationDelay: '1.5s', color: 'rgba(255,255,255,0.35)',  fontSize: '16px' }} />
        <Star style={{ top: 32, right: 80,  animationDelay: '2.2s', color: 'rgba(255,255,255,0.5)',   fontSize: '12px' }} />

        {/* Top row: title + session info */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
          marginBottom: '10px',
          position: 'relative',
          zIndex: 1,
        }}>
          <div>
            <h1>🚀 ITR Learning</h1>
            <p style={{
              margin: 0,
              fontSize: '12px',
              color: 'rgba(255,255,255,0.7)',
              fontWeight: 700,
              letterSpacing: '0.04em',
            }}>
              ✨ Your personal AI study companion
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', zIndex: 1 }}>
            <span style={{
              fontSize: '12px',
              color: 'rgba(255,255,255,0.9)',
              fontWeight: 800,
              background: 'rgba(255,255,255,0.18)',
              backdropFilter: 'blur(12px)',
              padding: '6px 14px',
              borderRadius: '99px',
              letterSpacing: '0.04em',
              border: '1px solid rgba(255,255,255,0.3)',
            }}>
              📝 {sessionName}
            </span>
            <button
              onClick={handleNewSession}
              style={{
                padding: '8px 18px',
                fontSize: '13px',
                background: 'rgba(255,255,255,0.2)',
                color: '#fff',
                border: '2px solid rgba(255,255,255,0.45)',
                borderRadius: '12px',
                cursor: 'pointer',
                fontWeight: 900,
                backdropFilter: 'blur(12px)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                letterSpacing: '0.02em',
              }}
            >
              ✨ New Session
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ position: 'relative', zIndex: 1 }}>
          {tabs.map((t, i) => (
            <Link
              key={t.to}
              to={t.to}
              className={pathname === t.to ? 'active' : ''}
              style={{ animationDelay: `${i * 0.06}s` }}
            >
              <span style={{ fontSize: '16px' }}>{t.icon}</span>
              {t.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
