import { useState, useEffect } from 'react'
import { callAgent, fetchHistory, getSessionId } from '../api'
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
    }
  }, [])

  // Check for learning concept separately
  useEffect(() => {
    const concept = localStorage.getItem('agentic-learning-concept')
    if (concept) {
      setLearningConcept(concept)
      localStorage.removeItem('agentic-learning-concept')
      // Auto-prompt to learn
      const prompt = `Please teach me about ${concept}. Explain it clearly with examples and key points.`
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
    const userMsg: Msg = { role: 'user', content: textToSend }
    setMessages(m => [...m, userMsg])
    setLoading(true)
    try {
      const res = await callAgent('tutor', textToSend, messages as any)
      const answer = (res.output?.answer ?? '').toString()
      setMessages(m => [...m, { role: 'assistant', content: answer }])
      // Show quiz button after teaching
      if (learningConcept) {
        setShowQuizButton(true)
      }
    } catch (e: any) {
      setMessages(m => [...m, { role: 'assistant', content: `Error: ${e.message}` }])
    } finally {
      setLoading(false)
      setInput('')
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

  return (
    <div className="panel">
      {learningConcept && (
        <div className="box" style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#e7f3ff' }}>
          <strong>🎯 Learning: {learningConcept}</strong>
        </div>
      )}
      <div className="chat">
        {messages.map((m, i) => <ChatMessage key={i} role={m.role} content={m.content} />)}
        {loading && <div className="loading">Thinking…</div>}
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
