import { useState, useEffect } from 'react'
import { callAgentStream, fetchHistory, getRecommendations, getSessionId, fetchWeakTopics } from '../api'
import type { RecommendedAction } from '../api'
import ChatMessage from '../components/ChatMessage'
import { useNavigate } from 'react-router-dom'

type Msg = { role: 'user'|'assistant', content: string }

export default function Tutor() {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([])
  const [learningConcept, setLearningConcept] = useState<string | null>(null)
  const [showQuizButton, setShowQuizButton] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [nextAction, setNextAction] = useState<RecommendedAction | null>(null)
  const [weakTopicsCount, setWeakTopicsCount] = useState<number | null>(null)
  const [newTopicToast, setNewTopicToast] = useState<string | null>(null)
  const navigate = useNavigate()

  // Load history only once
  useEffect(() => {
    const sessionId = getSessionId()
    if (sessionId && !historyLoaded) {
      fetchHistory(sessionId)
        .then(data => {
          const history = data.messages
            .filter(m => m.task === 'tutor')
            .map(m => ({ role: m.role as 'user'|'assistant', content: m.content }))
          setMessages(history)
          setHistoryLoaded(true)
        })
        .catch(err => console.error('Failed to load history:', err))

      getRecommendations(sessionId)
        .then(data => setNextAction(data.next_action))
        .catch(err => console.error('Failed to load recommendations:', err))
        
      fetchWeakTopics(sessionId)
        .then(data => setWeakTopicsCount(data.weak_topics?.length || 0))
        .catch(console.error)
    }
  }, [])
  
  // Poll for weak topics in background
  useEffect(() => {
    const sessionId = getSessionId()
    if (!sessionId) return
    const interval = setInterval(() => {
      fetchWeakTopics(sessionId)
        .then(data => {
            const count = data.weak_topics?.length || 0;
            if (weakTopicsCount !== null && count > weakTopicsCount) {
                setNewTopicToast(`Analysis engine found a new weak area: ${data.weak_topics[0].title}!`)
                // auto-hide toast
                setTimeout(() => setNewTopicToast(null), 8000)
            }
            setWeakTopicsCount(count)
        })
    }, 10000) // every 10 secs
    return () => clearInterval(interval)
  }, [weakTopicsCount])

  // Check for learning concept separately
  useEffect(() => {
    const concept = localStorage.getItem('agentic-learning-concept')
    const detail = localStorage.getItem('agentic-learning-detail')
    if (concept) {
      // Validate concept is not malformed
      const cleanConcept = concept.trim()
      if (cleanConcept.length > 50 || 
          cleanConcept.toLowerCase().includes('weakest') ||
          cleanConcept.toLowerCase().includes('based on') ||
          cleanConcept.toLowerCase().includes('subtopics')) {
        console.warn('Malformed learning concept detected:', cleanConcept)
        localStorage.removeItem('agentic-learning-concept')
        return
      }
      
      setLearningConcept(cleanConcept)
      localStorage.removeItem('agentic-learning-concept')
      localStorage.removeItem('agentic-learning-detail')
      // Auto-prompt to learn
      const prompt = detail
        ? `Please teach me about ${cleanConcept}. Focus especially on this weak area: ${detail}. Explain it clearly, connect it to operating systems, and use examples and key points.`
        : `Please teach me about ${cleanConcept}. Explain it clearly with examples and key points.`
      setInput(prompt)
      // Auto-send after a brief delay to ensure history is loaded
      setTimeout(() => {
        sendMessage(prompt)
      }, 800)
    }
  }, [])

  async function sendMessage(messageText?: string) {
    const textToSend = messageText || input
    if (!textToSend.trim()) return
    const historyForRequest = [...messages, { role: 'user' as const, content: textToSend }]
    setInput('')
    setMessages([...historyForRequest, { role: 'assistant', content: '' }])
    setLoading(true)
    try {
      await callAgentStream(
        textToSend,
        historyForRequest as any,
        (token) => {
          setMessages(m => {
            const updated = [...m]
            const lastMessage = updated[updated.length - 1]
            if (!lastMessage || lastMessage.role !== 'assistant') {
              updated.push({ role: 'assistant', content: token })
              return updated
            }
            updated[updated.length - 1] = {
              ...lastMessage,
              content: (lastMessage.content || '') + token,
            }
            return updated
          })
        },
        ({ nextAction: recommended }) => {
          if (learningConcept) setShowQuizButton(true)
          if (recommended) setNextAction(recommended)
          setLoading(false)
        },
      )
    } catch (e: any) {
      setMessages(m => {
        const updated = [...m]
        const errorMessage = { role: 'assistant' as const, content: `Error: ${e.message}` }
        const lastMessage = updated[updated.length - 1]
        if (!lastMessage || lastMessage.role !== 'assistant') {
          updated.push(errorMessage)
          return updated
        }
        updated[updated.length - 1] = errorMessage
        return updated
      })
      setLoading(false)
    }
  }

  async function send() {
    await sendMessage()
  }

  function goToQuiz() {
    if (learningConcept) {
      localStorage.setItem('agentic-quiz-concept', learningConcept)
      navigate('/quiz')
    }
  }

  function followRecommendation() {
    if (!nextAction) return
    if (nextAction.action === 'quiz') {
      const concept = nextAction.weak_topics?.[0]?.title || learningConcept || input
      if (concept) localStorage.setItem('agentic-quiz-concept', concept)
      navigate('/quiz')
      return
    }
    if (nextAction.action === 'analyze') {
      navigate('/analytics')
      return
    }
    if (nextAction.action === 'roadmap') {
      navigate('/roadmap')
      return
    }
    navigate('/')
  }

  return (
    <div className="panel">
      {newTopicToast && (
        <div className="celebrate" style={{
            padding: '16px 20px', 
            background: 'linear-gradient(135deg, #fefce8, #fff7ed)',
            border: '2.5px solid #fde68a',
            borderRadius: '14px',
            color: '#b45309',
            fontWeight: 900,
            marginBottom: '1rem',
            animation: 'fadeUp 0.4s cubic-bezier(.34,1.56,.64,1) both',
            boxShadow: '0 4px 14px rgba(250,204,21,0.18)'
        }}>
            🚨 {newTopicToast}
        </div>
      )}
      {nextAction && (
        <div style={{
          marginBottom: '1rem',
          padding: '16px 20px',
          background: 'linear-gradient(135deg, #f0f9ff, #f3e8ff)',
          border: '2.5px solid #c4b5fd',
          borderRadius: '14px',
          boxShadow: '0 4px 14px rgba(168,85,247,0.1)',
        }}>
          <strong style={{ color: '#7c3aed', fontWeight: 900, fontSize: '15px' }}>🤖 Next recommended step: {nextAction.action}</strong>
          <p style={{ marginTop: '0.5rem', color: '#1e3a5f', fontWeight: 600 }}>{nextAction.reason}</p>
          <p style={{ color: '#64748b', marginTop: '0.25rem', fontWeight: 600 }}>{nextAction.suggestion}</p>
          <button onClick={followRecommendation} style={{ marginTop: '0.75rem' }}>
            ✨ Do this next
          </button>
        </div>
      )}
      {learningConcept && (
        <div style={{
          marginBottom: '1rem',
          padding: '12px 18px',
          background: 'linear-gradient(135deg, #e0f2fe, #f3e8ff)',
          border: '2px solid #bae6fd',
          borderRadius: '12px',
          fontWeight: 800,
          color: '#0284c7',
          fontSize: '15px',
        }}>
          🎯 Learning: {learningConcept}
        </div>
      )}
      <div className="chat">
        {messages.map((m, i) => (
          <ChatMessage
            key={i}
            role={m.role}
            content={m.content}
            isStreaming={loading && i === messages.length - 1 && m.role === 'assistant'}
          />
        ))}
        {loading && messages[messages.length - 1]?.role !== 'assistant' && <div className="loading">Thinking…</div>}
      </div>
      {showQuizButton && learningConcept && (
        <div style={{ marginTop: '1rem', marginBottom: '1rem', textAlign: 'center' }}>
          <button
            onClick={goToQuiz}
            style={{ background: 'linear-gradient(135deg, #22c55e, #38bdf8)', fontSize: '15px', padding: '14px 28px' }}
          >
            🎉 Ready! Go to Quiz on {learningConcept}
          </button>
        </div>
      )}
      <div className="input-row">
        <input value={input} onChange={e => setInput(e.target.value)} placeholder="💬 Ask anything from your study materials…" onKeyDown={e => { if(e.key==='Enter') send() }} />
        <button onClick={send} disabled={loading}>🚀 Send</button>
      </div>
    </div>
  )
}
