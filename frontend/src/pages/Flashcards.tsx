import { useState, useEffect } from 'react'
import { fetchFlashcards, fetchFlashcardsHistory, getSessionId } from '../api'

type FlashcardSet = {
  id: number
  topic: string | null
  created_at: string
  flashcards: Array<{ front: string; back: string }>
}

export default function Flashcards() {
  const [cards, setCards] = useState<Array<{ front: string; back: string }>>([])
  const [history, setHistory] = useState<FlashcardSet[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [topic, setTopic] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)

  useEffect(() => {
    loadHistory()
  }, [])

  async function loadHistory() {
    const sid = getSessionId()
    if (!sid) return
    try {
      const data = await fetchFlashcardsHistory(sid)
      setHistory(data.history || [])
    } catch (e) {
      console.error("Failed to load flashcard history", e)
    }
  }

  async function generate() {
    const sid = getSessionId()
    if (!sid) return
    setLoading(true)
    setError('')
    setIsFlipped(false)
    setCurrentIndex(0)
    try {
      const data = await fetchFlashcards(sid, topic.trim() || undefined)
      setCards(data.flashcards || [])
      await loadHistory()
    } catch (e: any) {
      setError(`Failed to generate flashcards: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  function nextCard() {
    setIsFlipped(false)
    setTimeout(() => {
      setCurrentIndex(i => Math.min(i + 1, cards.length - 1))
    }, 150) // delay flip state resetting until partially turned
  }

  function prevCard() {
    setIsFlipped(false)
    setTimeout(() => {
      setCurrentIndex(i => Math.max(i - 1, 0))
    }, 150)
  }

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <input
          value={topic}
          onChange={e => setTopic(e.target.value)}
          placeholder="🎯 Specific focus topic (Optional, e.g. SVMs)"
          style={{ marginBottom: '1rem', width: '320px', textAlign: 'center', background: '#f8fafc', border: '2px solid #e2e8f0', borderRadius: '12px', padding: '10px' }}
      />
      <button onClick={generate} disabled={loading} style={{
        marginBottom: '2rem',
        background: 'linear-gradient(135deg, #a855f7, #ec4899)',
        boxShadow: '0 4px 14px rgba(236,72,153,0.3)',
        padding: '14px 28px',
        fontSize: '16px'
      }}>
        {loading ? '🧠 Architecting Cards...' : '✨ Auto-Generate Flashcards'}
      </button>

      {error && <p style={{ color: '#ef4444', fontWeight: 'bold' }}>{error}</p>}

      {cards.length > 0 && !loading && (
        <div style={{ width: '100%', maxWidth: '500px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

          <div style={{
            fontSize: '14px', color: '#64748b', fontWeight: 800, marginBottom: '1rem',
            background: '#f1f5f9', padding: '6px 14px', borderRadius: '99px'
          }}>
            {currentIndex + 1} / {cards.length}
          </div>

          <div
            onClick={() => setIsFlipped(!isFlipped)}
            style={{
              width: '100%',
              height: '320px',
              perspective: '1000px',
              cursor: 'pointer',
              marginBottom: '2rem',
            }}
          >
            <div style={{
              width: '100%',
              height: '100%',
              position: 'relative',
              transition: 'transform 0.6s cubic-bezier(0.4, 0.2, 0.2, 1)',
              transformStyle: 'preserve-3d',
              transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            }}>
              {/* Front */}
              <div style={{
                position: 'absolute', width: '100%', height: '100%',
                backfaceVisibility: 'hidden',
                background: 'linear-gradient(135deg, #f0f9ff, #e0f2fe)',
                border: '3px solid #bae6fd',
                borderRadius: '24px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '30px', textAlign: 'center',
                boxShadow: '0 10px 30px rgba(2,132,199,0.15)',
              }}>
                <h2 style={{ color: '#0369a1', fontSize: '22px', fontWeight: 900, lineHeight: 1.5 }}>
                  {cards[currentIndex].front}
                </h2>
                <div style={{ position: 'absolute', bottom: '20px', color: '#7dd3fc', fontSize: '13px', fontWeight: 800 }}>Tap to Flip</div>
              </div>

              {/* Back */}
              <div style={{
                position: 'absolute', width: '100%', height: '100%',
                backfaceVisibility: 'hidden',
                background: 'linear-gradient(135deg, #fefce8, #fff7ed)',
                border: '3px solid #fde68a',
                borderRadius: '24px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '30px', textAlign: 'center',
                transform: 'rotateY(180deg)',
                boxShadow: '0 10px 30px rgba(217,119,6,0.15)',
              }}>
                <h2 style={{ color: '#b45309', fontSize: '18px', fontWeight: 700, lineHeight: 1.6 }}>
                  {cards[currentIndex].back}
                </h2>
                <div style={{ position: 'absolute', bottom: '20px', color: '#fcd34d', fontSize: '13px', fontWeight: 800 }}>Tap to Flip back</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <button onClick={prevCard} disabled={currentIndex === 0} style={{
              background: 'rgba(255,255,255,0.7)', color: '#334155', border: '2px solid #e2e8f0', boxShadow: 'none'
            }}>
              ◀ Previous
            </button>
            <button onClick={nextCard} disabled={currentIndex === cards.length - 1} style={{
              background: 'var(--grad-sky)', minWidth: '120px'
            }}>
              Next ▶
            </button>
          </div>

        </div>
      )}

      {/* History Deck Rendering */}
      {!loading && history.length > 0 && cards.length === 0 && (
        <div style={{ width: '100%', maxWidth: '600px', marginTop: '2rem' }}>
          <h3 style={{ color: '#475569', fontSize: '18px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🗃️</span> Your Flashcard Decks
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {history.map(set => (
              <div 
                key={set.id}
                onClick={() => {
                   setCards(set.flashcards)
                   setCurrentIndex(0)
                   setIsFlipped(false)
                }}
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '16px 20px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                  transition: 'transform 0.2s, box-shadow 0.2s'
                }}
                onMouseOver={e => {
                   e.currentTarget.style.transform = 'translateY(-2px)'
                   e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.05)'
                }}
                onMouseOut={e => {
                   e.currentTarget.style.transform = 'translateY(0)'
                   e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02)'
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '15px', marginBottom: '4px' }}>
                    {set.topic || 'General Learning Concepts'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                    {new Date(set.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                  </div>
                </div>
                <div style={{
                  background: '#f1f5f9',
                  padding: '4px 12px',
                  borderRadius: '99px',
                  fontSize: '12px',
                  fontWeight: 800,
                  color: '#64748b'
                }}>
                  {set.flashcards.length} Cards
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
