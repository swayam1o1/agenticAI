import { useState, useEffect } from 'react'
import { callAgentStream, fetchHistory, getRecommendations, getSessionId } from '../api'
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
    }
  }, [])

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
      {nextAction && (
        <div className="box" style={{ marginBottom: '1rem', borderLeft: '3px solid #6366F1' }}>
          <strong>🤖 Next recommended step: {nextAction.action}</strong>
          <p style={{ marginTop: '0.5rem' }}>{nextAction.reason}</p>
          <p style={{ color: '#a1a1aa', marginTop: '0.25rem' }}>{nextAction.suggestion}</p>
          <button onClick={followRecommendation} style={{ marginTop: '0.75rem' }}>
            Do this next
          </button>
        </div>
      )}
      {learningConcept && (
        <div className="box" style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#e7f3ff' }}>
          <strong>🎯 Learning: {learningConcept}</strong>
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
            style={{ backgroundColor: '#28a745', color: '#fff', padding: '0.6rem 1.2rem', fontSize: '1rem' }}
          >
            ✅ Ready! Go to Quiz on {learningConcept}
          </button>
        </div>
      )}
      <div className="input-row">
        <input value={input} onChange={e => setInput(e.target.value)} placeholder="Ask anything from your study materials…" onKeyDown={e => { if(e.key==='Enter') send() }} />
        <button onClick={send} disabled={loading}>Send</button>
      </div>
    </div>
  )
}
