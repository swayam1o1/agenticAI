import { useState, useEffect } from 'react'
import { callAgent, fetchHistory, fetchAnalysis, getSessionId } from '../api'
import { useNavigate } from 'react-router-dom'

export default function Analytics() {
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState('')
  const [history, setHistory] = useState<Array<{ role: string; content: string }>>([])
  const [autoAnalyzed, setAutoAnalyzed] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const sessionId = getSessionId()
    if (sessionId && history.length === 0) {
      // Only load if not already loaded
      fetchHistory(sessionId)
        .then(data => {
          const msgs = data.messages.map(m => ({ role: m.role, content: m.content }))
          setHistory(msgs)
        })
        .catch(err => console.error('Failed to load history:', err))
      
      fetchAnalysis(sessionId)
        .then(data => {
          if (data.summary) {
            setSummary(data.summary)
          }
        })
        .catch(err => console.error('Failed to load analysis:', err))
    }
  }, [])

  // Check for auto-analyze separately to avoid race conditions
  useEffect(() => {
    const shouldAutoAnalyze = localStorage.getItem('agentic-quiz-topic')
    if (shouldAutoAnalyze && !autoAnalyzed && history.length > 0) {
      setTimeout(() => {
        analyze()
        setAutoAnalyzed(true)
      }, 1000)
    }
  }, [history])

  async function analyze() {
    setLoading(true)
    try {
      const res = await callAgent('analyze', 'Analyze weaknesses from history', history as any)
      setSummary(res.output?.summary ?? 'No analysis produced')
      // Clear the auto-analyze trigger
      localStorage.removeItem('agentic-quiz-topic')
      localStorage.removeItem('agentic-quiz-attempt-id')
    } catch (e: any) {
      setSummary(`Error: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  function goToRoadmap() {
    navigate('/roadmap')
  }

  async function analyze() {
    setLoading(true)
    try {
      const res = await callAgent('analyze', 'Analyze weaknesses from history', history as any)
      setSummary(res.output?.summary ?? 'No analysis produced')
    } catch (e: any) {
      setSummary(`Error: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="panel">
      <div className="box">
        <h3>Conversation History ({history.length} messages)</h3>
        <div style={{ maxHeight: '200px', overflow: 'auto', marginTop: '1rem' }}>
          {history.map((m, i) => (
            <div key={i} style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>
              <strong>{m.role}:</strong> {m.content.substring(0, 100)}...
            </div>
          ))}
        </div>
      </div>
      <div className="row">
        <button onClick={analyze} disabled={loading || history.length === 0}>Analyze Weak Areas</button>
      </div>
      {loading && <div className="loading">Analyzing…</div>}
      {summary && (
        <>
          <pre className="box">{summary}</pre>
          <div style={{ marginTop: '1rem', textAlign: 'center' }}>
            <button 
              onClick={goToRoadmap}
              style={{ backgroundColor: '#6c5ce7', color: '#fff', padding: '0.6rem 1.2rem', fontSize: '1rem' }}
            >
              🗺️ View Roadmap & Start Learning
            </button>
          </div>
        </>
      )}
    </div>
  )
}
