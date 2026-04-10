import { useState, useEffect } from 'react'
import { callAgent, getSessionId, submitQuizAnswer, fetchHistory, fetchWeakTopics, fetchQuizHistory } from '../api'
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
  const [quizHistoryList, setQuizHistoryList] = useState<any[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    const sid = getSessionId()
    if (sid && previousTopics.length === 0 && weakTopics.length === 0) {
      fetchHistory(sid)
        .then(data => {
          const topics = data.messages
            .filter(m => m.task === 'quiz' && m.role === 'user')
            .map(m => m.content)
          setPreviousTopics(topics)
        })
        .catch(err => console.error('Failed to load quiz history:', err))
      fetchWeakTopics(sid)
        .then(data => setWeakTopics(data.weak_topics || []))
        .catch(err => console.error('Failed to load weak topics:', err))
        
        fetchQuizHistory(sid)
        .then(data => {
          const history = data.quiz_history || []
          setQuizHistoryList(history)
          if (history.length > 0) {
            const lastAttempt = history[0]
            if (lastAttempt.questions && lastAttempt.questions.length > 0) {
                setTopic(lastAttempt.topic || '')
                setQuizRaw(lastAttempt.raw_output || '')
                setQuestions(lastAttempt.questions)
                setAttemptId(lastAttempt.attempt_id)
                
                const newAnswerState: Record<number, any> = {}
                let correct = 0
                for (const q of lastAttempt.questions) {
                    if (q.answer) {
                       newAnswerState[q.id] = {
                           selected: q.answer.selected_index,
                           status: q.answer.is_correct ? 'correct' : 'incorrect'
                       }
                       if (q.answer.is_correct) correct++
                    }
                }
                
                if (Object.keys(newAnswerState).length > 0) {
                    setAnswerState(newAnswerState)
                    setQuizScore({ correct, total: lastAttempt.questions.length })
                    if (Object.keys(newAnswerState).length === lastAttempt.questions.length) {
                        setQuizComplete(true)
                    }
                }
            }
          }
        })
        .catch(err => console.error('Failed to load quiz history:', err))
    }
  }, [])

  useEffect(() => {
    const concept = localStorage.getItem('agentic-quiz-concept')
    if (concept) {
      setTopic(concept)
      localStorage.removeItem('agentic-quiz-concept')
      setTimeout(() => generateQuizForConcept(concept), 500)
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
      const newAnswerState: Record<number, { selected?: number; status?: 'saved' | 'correct' | 'incorrect' }> = {
        ...answerState,
        [question.id]: { selected: selectedIndex, status: (payload.is_correct ? 'correct' : 'incorrect') as 'correct' | 'incorrect' },
      }
      setAnswerState(newAnswerState)
      const answered = Object.keys(newAnswerState).length
      const correct  = Object.values(newAnswerState).filter(a => a.status === 'correct').length
      setQuizScore({ correct, total: questions.length })
      if (answered === questions.length) {
        setQuizComplete(true)
        localStorage.setItem('agentic-quiz-topic', topic)
        localStorage.setItem('agentic-quiz-attempt-id', attemptId.toString())
      }
    } catch {
      setAnswerState(prev => ({ ...prev, [question.id]: { ...prev[question.id], status: 'saved' } }))
    }
  }

  async function generateWeakAreasQuiz() {
    if (weakTopics.length === 0) return
    const weakAreasList = weakTopics.map(wt => `${wt.title}: ${wt.detail}`).join(', ')
    const focusedTopic = `Focus on these weak areas: ${weakAreasList}`
    setTopic(focusedTopic)
    await generateQuizForConcept(focusedTopic)
  }

  return (
    <div className="panel">
      {/* Weak Areas Banner */}
      {weakTopics.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #fefce8, #fff7ed)',
          border: '2.5px solid #fde68a',
          borderRadius: '14px',
          padding: '18px 20px',
          marginBottom: '1.25rem',
          boxShadow: '0 4px 14px rgba(250,204,21,0.18)',
        }}>
          <strong style={{ color: '#b45309', fontSize: '15px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '6px' }}>
            🎯 Target These Weak Areas:
          </strong>
          <ul style={{ marginTop: '10px', marginBottom: '12px', paddingLeft: '1.5rem', color: '#92400e', fontWeight: 700 }}>
            {weakTopics.map(wt => (
              <li key={wt.id} style={{ marginBottom: '4px' }}>
                <strong style={{ color: '#b45309' }}>{wt.title}</strong>: {wt.detail}
              </li>
            ))}
          </ul>
          <button onClick={generateWeakAreasQuiz} style={{ background: 'linear-gradient(135deg, #f97316, #facc15)', boxShadow: '0 4px 14px rgba(249,115,22,0.3)' }}>
            ⚡ Generate Focused Quiz on Weak Areas
          </button>
        </div>
      )}

      {/* Previous Topics */}
      {previousTopics.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #f0f9ff, #e0f2fe)',
          border: '2px solid #bae6fd',
          borderRadius: '12px',
          padding: '12px 16px',
          marginBottom: '1rem',
          fontSize: '14px',
          fontWeight: 700,
          color: '#0284c7',
        }}>
          📖 Previous Topics: {previousTopics.join(', ')}
        </div>
      )}

      {/* Topic Input */}
      <div className="row">
        <input
          value={topic}
          onChange={e => setTopic(e.target.value)}
          placeholder="🌟 Topic to quiz (e.g., Photosynthesis, Gravity…)"
          onKeyDown={e => { if (e.key === 'Enter') generate() }}
        />
        <button onClick={generate} disabled={loading}>🧠 Generate Quiz</button>
      </div>

      {loading && <div className="loading">Generating your quiz… hold tight! 🚀</div>}

      {/* Score Banner */}
      {quizScore && (
        <div style={{
          marginTop: '1rem',
          padding: '14px 18px',
          background: (() => {
            const pct = quizScore.correct / quizScore.total
            return pct >= 0.7
              ? 'linear-gradient(135deg, #dcfce7, #d1fae5)'
              : pct >= 0.4
                ? 'linear-gradient(135deg, #fefce8, #fff7ed)'
                : 'linear-gradient(135deg, #fee2e2, #fecdd3)'
          })(),
          border: '2px solid ' + (() => {
            const pct = quizScore.correct / quizScore.total
            return pct >= 0.7 ? '#86efac' : pct >= 0.4 ? '#fde68a' : '#fca5a5'
          })(),
          borderRadius: '12px',
          fontWeight: 800,
          fontSize: '16px',
          color: '#1e3a5f',
        }}>
          📊 Score: {quizScore.correct} / {quizScore.total} ({Math.round((quizScore.correct / quizScore.total) * 100)}%)
          {quizScore.correct / quizScore.total >= 0.7 ? ' 🌟 Great job!' : quizScore.correct / quizScore.total >= 0.4 ? ' 💪 Keep going!' : ' 🔁 Review &amp; retry!'}
        </div>
      )}

      {/* Complete – Go to Analysis */}
      {quizComplete && (
        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          <button
            onClick={() => navigate('/analytics')}
            style={{ background: 'linear-gradient(135deg, #ec4899, #f97316)', fontSize: '15px', padding: '14px 28px' }}
          >
            📊 View Updated Weak Areas Roadmap
          </button>
        </div>
      )}

      {/* Quiz History */}
      {quizHistoryList.length > 0 && !questions.length && (
         <div style={{ marginTop: '3rem', borderTop: '2px dashed #cbd5e1', paddingTop: '2rem' }}>
            <h3 style={{ color: '#1e293b', marginBottom: '16px', fontSize: '18px', fontWeight: 900 }}>📅 Previous Quizzes</h3>
            <div style={{ display: 'grid', gap: '12px' }}>
              {quizHistoryList.map(h => {
                const total = h.questions ? h.questions.length : 0;
                let c = 0;
                if (h.questions) {
                  for (let q of h.questions) {
                    if (q.answer && q.answer.is_correct) c++
                  }
                }
                const scorePct = total > 0 ? (c / total) * 100 : 0
                
                return (
                 <div key={h.attempt_id} style={{
                    background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px',
                    padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                 }}>
                    <div>
                        <div style={{ fontWeight: 800, color: '#334155', fontSize: '15px' }}>{h.topic}</div>
                        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px', fontWeight: 700 }}>
                           Attempt #{h.attempt_id} • {new Date(h.created_at).toLocaleString()}
                        </div>
                    </div>
                    <div style={{
                       fontSize: '15px', fontWeight: 900, padding: '6px 12px', borderRadius: '8px',
                       background: scorePct >= 70 ? '#dcfce7' : scorePct >= 40 ? '#fefce8' : '#fee2e2',
                       color: scorePct >= 70 ? '#15803d' : scorePct >= 40 ? '#a16207' : '#b91c1c'
                    }}>
                       {c} / {total}
                    </div>
                 </div>
               )
              })}
            </div>
         </div>
      )}

      {/* Raw Chat Log Toggle */}
      {quizRaw && questions.length > 0 && (
        <div style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>
          <button
            onClick={() => setShowRawLog(!showRawLog)}
            style={{ background: 'rgba(56,189,248,0.12)', color: '#0284c7', boxShadow: 'none', border: '2px solid #bae6fd', fontSize: '13px', padding: '8px 14px' }}
          >
            {showRawLog ? '🔽 Hide Raw Chat Log' : '📜 View Raw Chat Log'}
          </button>
          {showRawLog && <pre className="box" style={{ marginTop: '0.5rem', fontSize: '13px' }}>{quizRaw}</pre>}
        </div>
      )}

      {/* Quiz Questions */}
      {questions.length > 0 && (
        <div className="quiz-grid">
          {questions.map(question => {
            const answered = answerState[question.id]
            return (
              <div key={question.id} className="quiz-card"
                style={{ animationDelay: `${(questions.indexOf(question)) * 0.07}s` }}>
                <h4 style={{ marginBottom: '14px', color: '#7c3aed', fontWeight: 900, fontSize: '15px', lineHeight: '1.5' }}>
                  {question.sequence}. {question.question}
                </h4>
                <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {question.options.map((option, idx) => {
                    const isSelected = answered?.selected === idx
                    const isCorrect  = answered && idx === question.correct_index
                    const isWrong    = isSelected && answered?.status === 'incorrect'
                    return (
                      <li key={idx}>
                        <button
                          type="button"
                          onClick={() => handleAnswer(question, idx)}
                          disabled={!!answered}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: '12px 16px',
                            borderRadius: '10px',
                            fontWeight: 700,
                            fontSize: '14px',
                            border: '2px solid',
                            cursor: answered ? 'default' : 'pointer',
                            boxShadow: 'none',
                            transform: 'none',
                            transition: 'all 0.15s ease',
                            background: isCorrect
                              ? 'linear-gradient(135deg, #dcfce7, #d1fae5)'
                              : isWrong
                                ? 'linear-gradient(135deg, #fee2e2, #fecdd3)'
                                : isSelected
                                  ? 'linear-gradient(135deg, #e0f2fe, #f3e8ff)'
                                  : 'linear-gradient(135deg, #f8fafc, #f1f5f9)',
                            borderColor: isCorrect
                              ? '#22c55e'
                              : isWrong
                                ? '#f87171'
                                : isSelected
                                  ? '#a855f7'
                                  : '#e2e8f0',
                            color: isCorrect ? '#15803d' : isWrong ? '#dc2626' : '#1e3a5f',
                          }}
                        >
                          {['🅐','🅑','🅒','🅓'][idx] || `${idx + 1}.`} {option}
                        </button>
                      </li>
                    )
                  })}
                </ul>
                {answered && (
                  <div className={answered.status === 'correct' ? 'celebrate' : ''} style={{
                    marginTop: '10px',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    fontWeight: 800,
                    fontSize: '14px',
                    background: answered.status === 'correct'
                      ? 'linear-gradient(135deg, #dcfce7, #d1fae5)'
                      : 'linear-gradient(135deg, #fce7f3, #fecdd3)',
                    color: answered.status === 'correct' ? '#15803d' : '#be185d',
                    border: `2px solid ${answered.status === 'correct' ? 'rgba(134,239,172,0.7)' : 'rgba(252,165,165,0.5)'}`,
                  }}>
                    {answered.status === 'correct'   && '✅ Correct! Well done! 🌟'}
                    {answered.status === 'incorrect' && '💪 Keep practicing! You\'ve got this!'}
                    {answered.status === 'saved'     && '📝 Recorded!'}
                  </div>
                )}
                {question.explanation && (
                  <p style={{
                    marginTop: '10px',
                    fontSize: '13px',
                    color: '#64748b',
                    fontWeight: 600,
                    lineHeight: '1.6',
                    background: '#f8fafc',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    borderLeft: '3px solid #a855f7',
                  }}>
                    💡 {question.explanation}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
