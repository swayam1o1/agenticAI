import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import mermaid from 'mermaid'
import { fetchMindmap, fetchMindmapHistory, getSessionId } from '../api'

type MindmapSet = {
  id: number
  topic: string | null
  mindmap: string
  created_at: string
}

function MermaidChart({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [renderError, setRenderError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (chart && ref.current) {
        mermaid.initialize({ startOnLoad: false, theme: 'default' })
        const uid = `mermaid-${Math.random().toString(36).substr(2, 9)}`
        setRenderError(null)
        try {
            mermaid.render(uid, chart).then((res: { svg: string }) => {
                if (ref.current) {
                   ref.current.innerHTML = res.svg
                   
                   // 🖱️ Inject Click Interactivity
                   // Target common Mermaid mindmap node selectors
                   const nodes = ref.current.querySelectorAll('.node, .mindmap-node, g[id^="node-"], .mindmap-node-text')
                   nodes.forEach((node: Element) => {
                       const gNode = node as SVGGElement
                       gNode.style.cursor = 'pointer'
                       gNode.onclick = (e: MouseEvent) => {
                           e.preventDefault()
                           e.stopPropagation()
                           // Extract text while ignoring internal ID labels
                           const text = gNode.textContent?.replace(/id\d+/g, '').trim() || ''
                           if (text) {
                               localStorage.setItem('agentic-learning-concept', text)
                               navigate('/')
                           }
                       }
                   })
                }
            }).catch(e => {
                console.error("Mermaid Render Error", e)
                setRenderError(`Render failed: ${e.message || String(e)}`)
            })
        } catch (e: any) {
            console.error("Mermaid Catch Error", e)
            setRenderError(`Catch failed: ${e.message || String(e)}`)
        }
    }
  }, [chart, navigate])

  if (renderError) {
      return <div style={{ color: '#ef4444', fontWeight: 'bold', padding: '10px' }}>{renderError}</div>
  }

  return <div ref={ref} style={{ width: '100%', overflowX: 'auto', display: 'flex', justifyContent: 'center' }} />
}

export default function Mindmap() {
  const [topic, setTopic] = useState('')
  const [chart, setChart] = useState('')
  const [history, setHistory] = useState<MindmapSet[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadHistory()
  }, [])

  async function loadHistory() {
    const sid = getSessionId()
    if (!sid) return
    try {
      const data = await fetchMindmapHistory(sid)
      setHistory(data.history || [])
    } catch (e) {
      console.error("Failed to load mindmap history", e)
    }
  }

  async function generate() {
    const sid = getSessionId()
    if (!sid) return
    setLoading(true)
    setError('')
    try {
      const data = await fetchMindmap(sid, topic.trim() || undefined)
      setChart(data.mindmap)
      await loadHistory()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <input
          value={topic}
          onChange={e => setTopic(e.target.value)}
          placeholder="🎯 Focus topic (Optional, e.g. Transformers)"
          style={{ marginBottom: '1rem', width: '320px', textAlign: 'center', background: '#f8fafc', border: '2px solid #e2e8f0', borderRadius: '12px' }}
      />
      <button onClick={generate} disabled={loading} style={{
          marginBottom: '2rem', 
          background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
          boxShadow: '0 4px 14px rgba(59,130,246,0.3)',
          padding: '14px 28px',
          fontSize: '16px'
      }}>
        {loading ? '🌐 Generating Mind Map...' : '🗺️ Generate Concept Map'}
      </button>

      {error && <p style={{ color: '#ef4444' }}>{error}</p>}
      
      {chart && !loading && (
         <div style={{ background: '#ffffff', padding: '24px', borderRadius: '16px', border: '2px dashed #cbd5e1', width: '100%' }}>
            <MermaidChart chart={chart} />
         </div>
      )}

      {!loading && history.length > 0 && !chart && (
        <div style={{ width: '100%', maxWidth: '600px', marginTop: '2rem' }}>
          <h3 style={{ color: '#475569', fontSize: '18px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🗺️</span> Your Mindmaps
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {history.map((set: MindmapSet) => (
              <div 
                key={set.id}
                onClick={() => setChart(set.mindmap)}
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '16px 20px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
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
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
