import { useState, useEffect } from 'react'
import { fetchWeakTopics, fetchHistory, getSessionId } from '../api'
import { useNavigate } from 'react-router-dom'

type WeakTopic = { id: number; title: string; detail: string; created_at: string }

export default function Analytics() {
  const [weakTopics, setWeakTopics] = useState<WeakTopic[]>([])
  const [history, setHistory] = useState<Array<{ role: string; content: string }>>([])
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const refreshData = async (showLoader = false) => {
    const sessionId = getSessionId()
    if (!sessionId) return
    if (showLoader) setLoading(true)
    try {
      const [weakData, histData] = await Promise.all([
        fetchWeakTopics(sessionId),
        fetchHistory(sessionId)
      ])
      setWeakTopics(weakData.weak_topics || [])
      setHistory(histData.messages.map((m: any) => ({ role: m.role, content: m.content })))
      setLastUpdated(new Date().toLocaleTimeString())
    } catch (e) { console.error(e) }
    finally { if (showLoader) setLoading(false) }
  }

  useEffect(() => {
    refreshData(true)
    // Poll every 8 seconds to pick up background analysis updates
    const interval = setInterval(() => refreshData(), 8000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="panel">
      {/* Live Engine Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(224,242,254,0.85), rgba(243,232,255,0.85))',
        border: '2.5px solid rgba(168,85,247,0.5)',
        borderRadius: 'var(--radius)',
        padding: '22px 24px',
        marginBottom: '1.5rem',
        boxShadow: '0 6px 24px rgba(168,85,247,0.15)',
        display: 'flex',
        alignItems: 'center',
        gap: '16px'
      }}>
        <div style={{ fontSize: '40px', animation: 'float 3s ease-in-out infinite' }}>🔬</div>
        <div style={{ flex: 1 }}>
          <h2 style={{ color: 'var(--purple-dark)', fontWeight: 900, marginBottom: '4px', fontSize: '17px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            Autonomous Analytics Engine
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#dcfce7', color: '#15803d', fontSize: '11px', fontWeight: 900, padding: '2px 10px', borderRadius: '99px', border: '1.5px solid #86efac' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'pulse 1.5s ease-in-out infinite' }} />
              LIVE
            </span>
          </h2>
          <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: '13px', lineHeight: '1.6', margin: 0 }}>
            Monitoring chat patterns in real-time. Weak areas auto-update every 8 seconds from the background engine.
            {lastUpdated && <span style={{ color: '#a855f7', marginLeft: 8, fontWeight: 900 }}>⏱ Last synced: {lastUpdated}</span>}
          </p>
        </div>
      </div>

      {/* Chat Message Count */}
      <div style={{
        background: 'rgba(255,255,255,0.65)', backdropFilter: 'blur(14px)',
        border: '2px solid rgba(186,230,253,0.6)', borderRadius: 'var(--radius-sm)',
        padding: '14px 20px', marginBottom: '1.25rem',
        display: 'flex', alignItems: 'center', gap: '12px'
      }}>
        <span style={{ fontSize: '20px' }}>📜</span>
        <span style={{ fontWeight: 900, fontSize: '14px', color: 'var(--text)' }}>
          {history.length} messages tracked in session
        </span>
        <span style={{ marginLeft: 'auto', background: 'var(--grad-sky)', color: '#fff', fontSize: '11px', fontWeight: 900, padding: '2px 10px', borderRadius: '99px' }}>
          {history.filter(m => m.role === 'user').length} from you
        </span>
      </div>

      {loading && <div className="loading">🔬 Loading weak areas…</div>}

      {/* Weak Topics Cards */}
      {weakTopics.length > 0 ? (
        <div>
          <h3 style={{ fontSize: '15px', fontWeight: 900, marginBottom: '14px', color: 'var(--purple-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            🎯 Identified Study Areas
            <span style={{ background: 'var(--grad-candy)', color: '#fff', fontSize: '11px', fontWeight: 900, padding: '2px 10px', borderRadius: '99px' }}>
              {weakTopics.length} detected
            </span>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {weakTopics.map((wt, i) => (
              <div key={wt.id} style={{
                background: 'linear-gradient(135deg, rgba(252,231,243,0.85), rgba(255,247,237,0.85))',
                border: '2.5px solid rgba(236,72,153,0.3)',
                borderRadius: 'var(--radius-sm)',
                padding: '16px 20px',
                animation: `fadeUp 0.3s ${i * 0.05}s ease both`,
                display: 'flex', gap: '14px', alignItems: 'flex-start'
              }}>
                <span style={{ fontSize: '20px', flexShrink: 0 }}>⚠️</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 900, fontSize: '14px', color: '#9d174d', marginBottom: '4px' }}>
                    {wt.title}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '13px', color: '#be185d', lineHeight: 1.6 }}>
                    {wt.detail}
                  </div>
                  <div style={{ fontSize: '11px', color: '#f9a8d4', fontWeight: 700, marginTop: '6px' }}>
                    🕐 Detected: {new Date(wt.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
            <button onClick={() => navigate('/roadmap')} style={{ background: 'var(--grad-candy)', fontSize: '15px', padding: '14px 32px' }}>
              🗺️ View Roadmap &amp; Start Learning
            </button>
          </div>
        </div>
      ) : !loading && (
        <div style={{
          textAlign: 'center', padding: '3rem',
          background: 'linear-gradient(135deg, rgba(224,242,254,0.5), rgba(243,232,255,0.5))',
          borderRadius: 'var(--radius)', border: '2.5px dashed rgba(168,85,247,0.3)',
        }}>
          <div className="float" style={{ fontSize: '48px', marginBottom: '10px' }}>🧠</div>
          <p style={{ color: 'var(--muted)', fontWeight: 900, fontSize: '15px', margin: 0 }}>
            No weak areas detected yet — chat with the Tutor to generate insights!
          </p>
        </div>
      )}
    </div>
  )
}
