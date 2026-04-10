import { useState, useEffect } from 'react'
import { addMemoryFromFile, addMemoryFromText, fetchHistory, fetchMemoryBank, getSessionId, fetchMindmap } from '../api'
import type { MemoryBankItem } from '../api'

export default function Memory() {
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploadCount, setUploadCount] = useState(0)
  const [memoryItems, setMemoryItems] = useState<MemoryBankItem[]>([])
  const [viewingBank, setViewingBank] = useState(false)
  const [mindmapRaw, setMindmapRaw] = useState<string | null>(null)

  useEffect(() => {
    const sid = getSessionId()
    if (sid && uploadCount === 0) {
      fetchHistory(sid)
        .then(d => setUploadCount(d.messages.filter(m =>
          m.content.toLowerCase().includes('memory') || m.content.toLowerCase().includes('upload')
        ).length))
        .catch(console.error)
    }
  }, [])

  async function submitText() {
    if (!text.trim()) return
    setLoading(true)
    try { const r = await addMemoryFromText(text, getSessionId()); setStatus(`🎉 Added ${r.added} text items!`); setText('') }
    catch (e: any) { setStatus(`❌ ${e.message}`) }
    finally { setLoading(false) }
  }

  async function submitFile() {
    if (!file) return
    setLoading(true)
    try { const r = await addMemoryFromFile(file, getSessionId()); setStatus(`🎉 Added ${r.added} items from file!`); setFile(null) }
    catch (e: any) { setStatus(`❌ ${e.message}`) }
    finally { setLoading(false) }
  }

  async function loadMemoryBank() {
    setLoading(true)
    try {
      const r = await fetchMemoryBank()
      setMemoryItems(r.items || [])
      setViewingBank(true)
      setStatus(`📚 Loaded ${r.items?.length || 0} memory items.`)
    } catch (e: any) { setStatus(`❌ ${e.message}`) }
    finally { setLoading(false) }
  }

  async function handleMindMap() {
    const sid = getSessionId()
    if (!sid) return
    setLoading(true)
    try {
      const r = await fetchMindmap(sid)
      setMindmapRaw(r.mindmap)
      setStatus(`🧠 Mind Map Generated successfully!`)
    } catch (e: any) { setStatus(`❌ ${e.message}`) }
    finally { setLoading(false) }
  }

  const section = (bg: string, border: string, children: React.ReactNode) => (
    <div style={{
      background: bg, backdropFilter: 'blur(14px)',
      border: `2.5px solid ${border}`,
      borderRadius: 'var(--radius)', padding: '22px',
      marginBottom: '1rem', boxShadow: 'var(--shadow-sm)',
      transition: 'box-shadow 0.2s ease',
    }}>
      {children}
    </div>
  )

  return (
    <div className="panel">
      {/* Count badge */}
      {uploadCount > 0 && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          background: 'linear-gradient(135deg, rgba(254,252,232,0.9), rgba(255,247,237,0.9))',
          border: '2px solid rgba(253,230,138,0.8)',
          borderRadius: '12px', padding: '10px 18px',
          marginBottom: '1.25rem', fontWeight: 900, color: '#b45309', fontSize: '14px',
          boxShadow: '0 4px 14px rgba(250,204,21,0.18)',
          animation: 'fadeUp 0.4s cubic-bezier(.34,1.56,.64,1) both',
        }}>
          📚 {uploadCount} items saved in memory
        </div>
      )}

      {/* Buttons */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <button onClick={loadMemoryBank} disabled={loading} style={{ background: 'var(--grad-sky)' }}>
          📚 View Memory Bank
        </button>
        <button onClick={handleMindMap} disabled={loading} style={{ background: 'linear-gradient(135deg, #a855f7, #ec4899)' }}>
          🧠 Generate Mind Map
        </button>
        {(viewingBank || mindmapRaw) && (
          <button onClick={() => { setViewingBank(false); setMindmapRaw(null); }} disabled={loading}
            style={{ background: 'rgba(243,232,255,0.8)', color: 'var(--purple-dark)', boxShadow: 'none', border: '2px solid rgba(196,181,253,0.6)' }}>
            🙈 Hide Data
          </button>
        )}
      </div>

      {mindmapRaw && section(
         'linear-gradient(135deg, #f8fafc, #f1f5f9)', '#cbd5e1',
         <>
          <h3 style={{ marginBottom: '12px', color: '#1e293b' }}>🧠 AI Concept Map</h3>
          <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '14px' }}>Here is a Mermaid.js syntax structure of your concepts.</p>
          <pre style={{
             background: '#0f172a', color: '#38bdf8', padding: '16px', borderRadius: '12px',
             fontSize: '13px', overflowX: 'auto', whiteSpace: 'pre-wrap'
          }}>
{mindmapRaw}
          </pre>
         </>
      )}

      {/* Memory Bank */}
      {viewingBank && section(
        'linear-gradient(135deg, rgba(224,242,254,0.85), rgba(243,232,255,0.85))',
        'rgba(196,181,253,0.5)',
        <>
          <h3 style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            🧠 Memory Bank
            <span style={{
              background: 'var(--grad-candy)', color: '#fff',
              fontSize: '11px', fontWeight: 900, padding: '2px 10px', borderRadius: '99px',
            }}>
              {memoryItems.length} items
            </span>
          </h3>
          {memoryItems.length === 0
            ? <p style={{ color: 'var(--muted)', fontWeight: 800, textAlign: 'center', padding: '1rem' }}>🌱 Empty — add some notes below!</p>
            : (
              <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '380px', overflow: 'auto' }}>
                {memoryItems.map(item => (
                  <div key={item.id} style={{
                    padding: '14px 16px', border: '2px solid rgba(196,181,253,0.5)',
                    borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.8)',
                    backdropFilter: 'blur(8px)', boxShadow: '0 2px 10px rgba(168,85,247,0.08)',
                    transition: 'all 0.2s ease',
                  }}>
                    <div style={{ fontSize: '11px', color: 'var(--purple)', fontWeight: 900, marginBottom: '6px', letterSpacing: '0.05em' }}>
                      🔖 {item.id}
                    </div>
                    <div style={{ whiteSpace: 'pre-wrap', fontSize: '14px', lineHeight: '1.7', color: 'var(--text)', fontWeight: 700 }}>
                      {item.text}
                    </div>
                    {item.meta && Object.keys(item.meta).length > 0 && (
                      <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--muted)', fontWeight: 700, background: 'rgba(224,242,254,0.5)', borderRadius: '6px', padding: '4px 8px' }}>
                        {JSON.stringify(item.meta)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          }
        </>
      )}

      {/* Add Text */}
      {section(
        'linear-gradient(135deg, rgba(224,242,254,0.8), rgba(187,247,208,0.5))',
        'rgba(56,189,248,0.4)',
        <>
          <h3 style={{ marginBottom: '12px', color: 'var(--sky-dark)' }}>✏️ Add Memory (Text)</h3>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="📝 Paste your notes or study material here…"
            rows={6}
            style={{ marginBottom: '12px' }}
          />
          <button onClick={submitText} disabled={loading} style={{ background: 'var(--grad-spring)' }}>
            💾 Save to Memory
          </button>
        </>
      )}

      {/* Add File */}
      {section(
        'linear-gradient(135deg, rgba(254,252,232,0.8), rgba(255,247,237,0.8))',
        'rgba(253,230,138,0.7)',
        <>
          <h3 style={{ marginBottom: '12px', color: '#b45309' }}>📁 Add Memory (File)</h3>
          <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} style={{ marginBottom: '12px' }} />
          <button onClick={submitFile} disabled={loading || !file}
            style={{ background: 'linear-gradient(135deg, #f97316, #facc15)', boxShadow: '0 4px 16px rgba(249,115,22,0.35)' }}>
            📤 Upload File
          </button>
        </>
      )}

      {loading && <div className="loading">Processing…</div>}
      {status && (
        <div className="celebrate" style={{
          marginTop: '12px', padding: '12px 18px', fontWeight: 800, fontSize: '14px', borderRadius: 'var(--radius-sm)',
          background: status.startsWith('🎉')
            ? 'linear-gradient(135deg, rgba(220,252,231,0.9), rgba(187,247,208,0.9))'
            : 'linear-gradient(135deg, rgba(254,226,226,0.9), rgba(252,165,165,0.7))',
          border: `2px solid ${status.startsWith('🎉') ? 'rgba(134,239,172,0.7)' : 'rgba(252,165,165,0.7)'}`,
          color: status.startsWith('🎉') ? '#15803d' : '#dc2626',
        }}>
          {status}
        </div>
      )}
    </div>
  )
}
