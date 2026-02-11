import { useState, useEffect } from 'react'
import { callAgent, getSessionId, submitQuizAnswer, fetchHistory, fetchWeakTopics } from '../api'
import type { QuizQuestionDto } from '../api'
import { useNavigate } from 'react-router-dom'

export default function Quiz() {
  const [topic, setTopic] = useState('')
  const [loading, setLoading] = useState(false)
  const [quizRaw, setQuizRaw] = useState('')
  const [questions, setQuestions] = useState<QuizQuestionDto[]>([])
  const [attemptId, setAttemptId] = useState<number | null>(null)
  const [sessionId, setSessionId] = useState<string | undefined>(getSessionId())
  const [answerState, setAnswerState] = useState<Record<number, { selected?: number; status?: 'saved' | 'correct' | 'incorrect' }>>({})
  const [previousTopics, setPreviousTopics] = useState<string[]>([])
  const [weakTopics, setWeakTopics] = useState<Array<{ id: number; title: string; detail: string }>>([])
  const [showRawLog, setShowRawLog] = useState(false)
  const [quizScore, setQuizScore] = useState<{ correct: number; total: number } | null>(null)
  const [quizComplete, setQuizComplete] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const sid = getSessionId()
    if (sid && previousTopics.length === 0 && weakTopics.length === 0) {
      // Only load if not already loaded
      fetchHistory(sid)
        .then(data => {
          const topics = data.messages
            .filter(m => m.task === 'quiz' && m.role === 'user')
            .map(m => m.content)
          setPreviousTopics(topics)
        })
        .catch(err => console.error('Failed to load quiz history:', err))
      
      fetchWeakTopics(sid)
        .then(data => {
          setWeakTopics(data.weak_topics || [])
        })
        .catch(err => console.error('Failed to load weak topics:', err))
    }
  }, [])

  // Check for auto-quiz separately
  useEffect(() => {
    const concept = localStorage.getItem('agentic-quiz-concept')
    if (concept) {
      setTopic(concept)
      localStorage.removeItem('agentic-quiz-concept')
      // Auto-generate quiz after a brief delay
      setTimeout(() => {
        generateQuizForConcept(concept)
      }, 500)
    }
  }, [])

  async function generateQuizForConcept(conceptTopic: string) {
    if (!conceptTopic.trim()) return
    setLoading(true)
    setShowRawLog(false)
    setQuizScore(null)
    setQuizComplete(false)
    try {
      const res = await callAgent('quiz', conceptTopic)
      setQuizRaw(res.output?.raw ?? 'No quiz generated')
      setQuestions(res.output?.questions ?? [])
      setAttemptId(res.meta?.quiz_attempt_id ?? null)
      setSessionId(res.session_id ?? getSessionId())
      setAnswerState({})
    } catch (e: any) {
      setQuizRaw(`Error: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function generate() {
    if (!topic.trim()) return
    setLoading(true)
    setShowRawLog(false)
    setQuizScore(null)
    setQuizComplete(false)
    try {
      const res = await callAgent('quiz', topic)
      setQuizRaw(res.output?.raw ?? 'No quiz generated')
      setQuestions(res.output?.questions ?? [])
      setAttemptId(res.meta?.quiz_attempt_id ?? null)
      setSessionId(res.session_id ?? getSessionId())
      setAnswerState({})
    } catch (e: any) {
      setQuizRaw(`Error: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function handleAnswer(question: QuizQuestionDto, selectedIndex: number) {
    if (!attemptId || !sessionId) return
    const option = question.options[selectedIndex] ?? ''
    const payload = {
      session_id: sessionId,
      attempt_id: attemptId,
      question_id: question.id,
      selected_index: selectedIndex,
      selected_option: option,
      is_correct: selectedIndex === question.correct_index,
    }
    try {
      await submitQuizAnswer(payload)
      const newAnswerState = {
        ...answerState,
        [question.id]: {
          selected: selectedIndex,
          status: payload.is_correct ? 'correct' : 'incorrect',
        },
      }
      setAnswerState(newAnswerState)
      // Update score
      const answered = Object.keys(newAnswerState).length
      const correct = Object.values(newAnswerState).filter(a => a.status === 'correct').length
      setQuizScore({ correct, total: questions.length })
      
      // Check if all questions answered
      if (answered === questions.length) {
        setQuizComplete(true)
        localStorage.setItem('agentic-quiz-topic', topic)
        localStorage.setItem('agentic-quiz-attempt-id', attemptId.toString())
      }
    } catch (err) {
      setAnswerState(prev => ({ ...prev, [question.id]: { ...prev[question.id], status: 'saved' } }))
    }
  }

  function goToAnalysis() {
    navigate('/analytics')
  }

  async function generateWeakAreasQuiz() {
    if (weakTopics.length === 0) return
    
    // Build a comprehensive prompt with all weak areas
    const weakAreasList = weakTopics.map(wt => `${wt.title}: ${wt.detail}`).join(', ')
    const focusedTopic = `Focus on these weak areas: ${weakAreasList}`
    
    setTopic(focusedTopic)
    setLoading(true)
    setShowRawLog(false)
    setQuizScore(null)
    setQuizComplete(false)
    
    try {
      const res = await callAgent('quiz', focusedTopic)
      setQuizRaw(res.output?.raw ?? 'No quiz generated')
      setQuestions(res.output?.questions ?? [])
      setAttemptId(res.meta?.quiz_attempt_id ?? null)
      setSessionId(res.session_id ?? getSessionId())
      setAnswerState({})
    } catch (e: any) {
      setQuizRaw(`Error: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="panel">
      {weakTopics.length > 0 && (
        <div className="box" style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#fff3cd' }}>
          <strong>🎯 Target These Weak Areas:</strong>
          <ul style={{ marginTop: '0.5rem', marginBottom: '0.5rem', paddingLeft: '1.5rem' }}>
            {weakTopics.map(wt => (
              <li key={wt.id}><strong>{wt.title}</strong>: {wt.detail}</li>
            ))}
          </ul>
          <button onClick={generateWeakAreasQuiz} style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}>
            Generate Focused Quiz on Weak Areas
          </button>
        </div>
      )}
      {previousTopics.length > 0 && (
        <div className="box" style={{ marginBottom: '1rem', fontSize: '0.9rem', padding: '0.5rem' }}>
          <strong>Previous Quiz Topics:</strong> {previousTopics.join(', ')}
        </div>
      )}
      <div className="row">
        <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="Topic to quiz (e.g., Photosynthesis)" onKeyDown={e=>{if(e.key==='Enter') generate()}} />
        <button onClick={generate} disabled={loading}>Generate Quiz</button>
      </div>
      {loading && <div className="loading">Generating…</div>}
      {quizScore && (
        <div className="box" style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#d4edda', fontWeight: 'bold' }}>
          📊 Current Score: {quizScore.correct} / {quizScore.total} ({Math.round((quizScore.correct / quizScore.total) * 100)}%)
        </div>
      )}
      {quizComplete && (
        <div style={{ marginTop: '1rem', marginBottom: '1rem', textAlign: 'center' }}>
          <button 
            onClick={goToAnalysis}
            style={{ backgroundColor: '#ff6b6b', color: '#fff', padding: '0.6rem 1.2rem', fontSize: '1rem' }}
          >
            📊 Analyze Weak Areas & Get Roadmap
          </button>
        </div>
      )}
      {quizRaw && questions.length > 0 && (
        <div style={{ marginTop: '1rem', marginBottom: '1rem' }}>
          <button 
            onClick={() => setShowRawLog(!showRawLog)} 
            style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
          >
            {showRawLog ? '🔽 Hide Raw Chat Log' : '📜 View Raw Chat Log'}
          </button>
          {showRawLog && <pre className="box" style={{ marginTop: '0.5rem' }}>{quizRaw}</pre>}
        </div>
      )}
      {questions.length > 0 && (
        <div className="quiz-grid">
          {questions.map(question => (
            <div key={question.id} className="quiz-card">
              <h4>{question.sequence}. {question.question}</h4>
              <ul>
                {question.options.map((option, idx) => (
                  <li key={idx}>
                    <button
                      type="button"
                      className={`option ${answerState[question.id]?.selected === idx ? 'selected' : ''}`}
                      onClick={() => handleAnswer(question, idx)}
                    >
                      {option}
                    </button>
                  </li>
                ))}
              </ul>
              {answerState[question.id] && (
                <div className="status">
                  {answerState[question.id]?.status === 'correct' && '✅ Correct'}
                  {answerState[question.id]?.status === 'incorrect' && '⚠️ Keep practicing'}
                  {answerState[question.id]?.status === 'saved' && '📝 Recorded'}
                </div>
              )}
              {question.explanation && <p className="explanation">{question.explanation}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
