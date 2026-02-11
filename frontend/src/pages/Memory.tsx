import { useState, useEffect } from 'react'
import { addMemoryFromFile, addMemoryFromText, fetchHistory, getSessionId } from '../api'

export default function Memory() {
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploadCount, setUploadCount] = useState(0)

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

  return (
    <div className="panel">
      {uploadCount > 0 && (
        <div className="box" style={{ marginBottom: '1rem', fontSize: '0.9rem', padding: '0.5rem' }}>
          📚 {uploadCount} items in memory bank
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
