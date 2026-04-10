import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type Props = { role: 'user' | 'assistant', content: string, isStreaming?: boolean }
export default function ChatMessage({ role, content, isStreaming }: Props) {
  return (
    <div className={`chat-msg ${role}`}>
      <div className="role">
        {role === 'user' ? '🙋 You' : '🤖 Assistant'}
      </div>
      <div className="bubble">
        {role === 'assistant' ? (
          <div className="markdown-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            {isStreaming && <span className="typing-cursor" />}
          </div>
        ) : (
          content
        )}
      </div>
    </div>
  )
}
