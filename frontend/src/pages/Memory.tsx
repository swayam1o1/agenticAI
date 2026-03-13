import { useState, useEffect } from 'react'
import { addMemoryFromFile, addMemoryFromText, fetchHistory, fetchMemoryBank, getSessionId } from '../api'
import type { MemoryBankItem } from '../api'

export default function Memory() {
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploadCount, setUploadCount] = useState(0)
  const [memoryItems, setMemoryItems] = useState<MemoryBankItem[]>([])
  const [viewingBank, setViewingBank] = useState(false)

  useEffect(() => {
    const sessionId = getSessionId()
    if (sessionId && uploadCount === 0) {
      fetchHistory(sessionId)
        .then(data => {
          const count = data.messages.filter(m => m.content.toLowerCase().includes('memory') || m.content.toLowerCase().includes('upload')).length
          setUploadCount(count)
        })
        .catch(err => console.error('Failed to load memory history:', err))
    }
  }, [])

  async function submitText() {
    if (!text.trim()) return
    setLoading(true)
    try {
      const res = await addMemoryFromText(text)
      setStatus(`Added ${res.added} text items.`)
      setText('')
    } catch (e: any) {
      setStatus(`Error: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function submitFile() {
    if (!file) return
    setLoading(true)
    try {
      const res = await addMemoryFromFile(file)
      setStatus(`Added ${res.added} items from file.`)
      setFile(null)
    } catch (e: any) {
      setStatus(`Error: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function loadMemoryBank() {
    setLoading(true)
    try {
      const res = await fetchMemoryBank()
      setMemoryItems(res.items || [])
      setViewingBank(true)
      setStatus(`Loaded ${res.items?.length || 0} memory items.`)
    } catch (e: any) {
      setStatus(`Error: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="panel">
      {uploadCount > 0 && (
        <div className="box" style={{ marginBottom: '1rem', fontSize: '0.9rem', padding: '0.5rem' }}>
          📚 {uploadCount} items in memory bank
        </div>
      )}
      <div className="row" style={{ marginTop: 0 }}>
        <button onClick={loadMemoryBank} disabled={loading}>View Memory Bank</button>
        {viewingBank && (
          <button onClick={() => setViewingBank(false)} disabled={loading}>Hide Memory Bank</button>
        )}
      </div>

      {viewingBank && (
        <div className="box" style={{ marginBottom: '1rem' }}>
          <h3 style={{ marginBottom: '0.75rem' }}>Memory Bank</h3>
          {memoryItems.length === 0 ? (
            <div className="status">No memory items stored yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '420px', overflow: 'auto' }}>
              {memoryItems.map(item => (
                <div key={item.id} style={{ padding: '12px', border: '1px solid #27272f', borderRadius: '6px', background: '#1a1a24' }}>
                  <div style={{ fontSize: '11px', color: '#71717a', marginBottom: '6px' }}>{item.id}</div>
                  <div style={{ whiteSpace: 'pre-wrap', fontSize: '13px', lineHeight: '1.6' }}>{item.text}</div>
                  {item.meta && Object.keys(item.meta).length > 0 && (
                    <div style={{ marginTop: '8px', fontSize: '12px', color: '#a1a1aa' }}>
                      Meta: {JSON.stringify(item.meta)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <h3>Add Memory (Text)</h3>
      <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Paste notes or content to remember…" rows={8} />
      <div className="row">
        <button onClick={submitText} disabled={loading}>Add Text</button>
      </div>

      <h3>Add Memory (File)</h3>
      <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} />
      <div className="row">
        <button onClick={submitFile} disabled={loading || !file}>Upload File</button>
      </div>

      {loading && <div className="loading">Uploading…</div>}
      {status && <div className="status">{status}</div>}
    </div>
  )
}
