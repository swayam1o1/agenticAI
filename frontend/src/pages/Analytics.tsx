import { useState, useEffect } from 'react'
import { callAgent, fetchHistory, fetchAnalysis, getSessionId } from '../api'
import { useNavigate } from 'react-router-dom'

export default function Analytics() {
  const [loading, setLoading] = useState(false)
  const [analysisType, setAnalysisType] = useState<'quiz' | 'chat' | null>(null)
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
        analyzeQuiz()
        setAutoAnalyzed(true)
      }, 1000)
    }
  }, [history])

  async function analyzeQuiz() {
    setLoading(true)
    setAnalysisType('quiz')
    try {
      const res = await callAgent('analyze', 'quiz-based', history as any)
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

  async function analyzeChat() {
    setLoading(true)
    setAnalysisType('chat')
    try {
      const res = await callAgent('analyze', 'chat-based', history as any)
      setSummary(res.output?.summary ?? 'No analysis produced')
    } catch (e: any) {
      setSummary(`Error: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  function goToRoadmap() {
    navigate('/roadmap')
  }

  return (
    <div className="panel">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '1rem' }}>
        <div className="box" style={{ 
          backgroundColor: '#1a1a24',
          border: '1px solid #6366F1',
          borderLeft: '3px solid #6366F1',
          cursor: 'pointer',
          transition: 'all 0.15s ease'
        }}
        onClick={analyzeQuiz}
        >
          <strong style={{ color: '#6366F1', fontSize: '14px' }}>📊 Quiz-Based Analysis</strong>
          <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#a1a1aa', lineHeight: '1.6' }}>
            Analyzes quiz performance to identify weak areas based on incorrect answers and patterns.
          </p>
          <button 
            style={{ marginTop: '12px', width: '100%' }}
            onClick={(e) => { e.stopPropagation(); analyzeQuiz(); }}
            disabled={loading}
          >
            Analyze Quiz Performance
          </button>
        </div>

        <div className="box" style={{ 
          backgroundColor: '#1a1a24',
          border: '1px solid #F43F5E',
          borderLeft: '3px solid #F43F5E',
          cursor: 'pointer',
          transition: 'all 0.15s ease'
        }}
        onClick={analyzeChat}
        >
          <strong style={{ color: '#F43F5E', fontSize: '14px' }}>💬 Chat Log Analysis</strong>
          <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#a1a1aa', lineHeight: '1.6' }}>
            Analyzes conversation history to identify topics where you asked many questions or showed confusion.
          </p>
          <button 
            style={{ marginTop: '12px', width: '100%', backgroundColor: '#F43F5E', borderColor: '#F43F5E' }}
            onClick={(e) => { e.stopPropagation(); analyzeChat(); }}
            disabled={loading}
          >
            Analyze Chat History
          </button>
        </div>
      </div>
      
      <div className="box">
        <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#e4e4e7' }}>
          Conversation History ({history.length} messages)
        </h3>
        <div style={{ maxHeight: '200px', overflow: 'auto', marginTop: '1rem' }}>
          {history.map((m, i) => (
            <div key={i} style={{ marginBottom: '0.5rem', fontSize: '13px', color: '#a1a1aa' }}>
              <strong style={{ color: '#e4e4e7' }}>{m.role}:</strong> {m.content.substring(0, 100)}...
            </div>
          ))}
        </div>
      </div>
      
      {loading && <div className="loading">
        {analysisType === 'quiz' ? 'Analyzing quiz performance…' : 'Analyzing chat history…'}
      </div>}
      
      {summary && (
        <>
          <div className="box" style={{ 
            backgroundColor: '#1a1a24',
            padding: '20px',
            marginTop: '1rem',
            border: analysisType === 'quiz' ? '1px solid #6366F1' : '1px solid #F43F5E',
            borderLeft: analysisType === 'quiz' ? '3px solid #6366F1' : '3px solid #F43F5E'
          }}>
            <h3 style={{ 
              marginTop: 0,
              marginBottom: '16px',
              fontSize: '14px',
              fontWeight: '600',
              color: analysisType === 'quiz' ? '#6366F1' : '#F43F5E',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              {analysisType === 'quiz' ? '🎯 Quiz-Based Weak Areas' : '💬 Chat-Based Weak Areas'}
            </h3>
            <div style={{ 
              whiteSpace: 'pre-wrap',
              margin: 0,
              fontSize: '13px',
              lineHeight: '1.7'
            }}>
              {summary.split('\n').map((line, idx) => {
                // Check if line starts with emoji or special formatting
                if (line.startsWith('🎯') || line.startsWith('Topic Name:')) {
                  return (
                    <div key={idx} style={{ 
                      color: analysisType === 'quiz' ? '#a5b4fc' : '#fda4af',
                      marginBottom: '4px',
                      fontWeight: line.startsWith('🎯') ? '600' : '400'
                    }}>
                      {line}
                    </div>
                  )
                } else if (line.trim().startsWith('Generate Focused Quiz')) {
                  return (
                    <div key={idx} style={{ 
                      color: analysisType === 'quiz' ? '#6366F1' : '#F43F5E',
                      fontWeight: '600',
                      marginTop: '12px'
                    }}>
                      {line}
                    </div>
                  )
                } else if (line.trim()) {
                  return (
                    <div key={idx} style={{ color: '#e4e4e7', marginBottom: '4px' }}>
                      {line}
                    </div>
                  )
                } else {
                  return <div key={idx} style={{ height: '8px' }} />
                }
              })}
            </div>
          </div>
          <div style={{ marginTop: '1rem', textAlign: 'center' }}>
            <button 
              onClick={goToRoadmap}
              style={{ 
                backgroundColor: '#6366F1',
                borderColor: '#6366F1',
                color: '#fff',
                padding: '12px 24px',
                fontSize: '13px'
              }}
            >
              🗺️ View Roadmap & Start Learning
            </button>
          </div>
        </>
      )}
    </div>
  )
}
