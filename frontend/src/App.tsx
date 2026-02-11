import { Link, Outlet, useLocation } from 'react-router-dom'

export default function App() {
  const { pathname } = useLocation()
  const tabs = [
    { to: '/', label: 'Tutor' },
    { to: '/quiz', label: 'Quiz' },
    { to: '/analytics', label: 'Weak Areas' },
    { to: '/roadmap', label: 'Roadmap' },
    { to: '/memory', label: 'Memory' }
  ]

  return (
    <div className="app">
      <header className="header">
        <h1>Agentic Study Buddy</h1>
        <nav>
          {tabs.map(t => (
            <Link key={t.to} to={t.to} className={pathname === t.to ? 'active' : ''}>{t.label}</Link>
          ))}
        </nav>
      </header>
      <main className="main">
        <Outlet />
      </main>
      <footer className="footer">Backend: http://127.0.0.1:8001 • Frontend: :5173</footer>
    </div>
  )
}
