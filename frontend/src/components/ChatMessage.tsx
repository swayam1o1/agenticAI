type Props = { role: 'user' | 'assistant', content: string }
export default function ChatMessage({ role, content }: Props) {
  return (
    <div className={`chat-msg ${role}`}>
      <div className="avatar">{role === 'user' ? '🧑' : '🤖'}</div>
      <div className="bubble">
        <pre>{content}</pre>
      </div>
    </div>
  )
}
