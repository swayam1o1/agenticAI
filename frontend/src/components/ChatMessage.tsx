type Props = { role: 'user' | 'assistant', content: string }
export default function ChatMessage({ role, content }: Props) {
  return (
    <div className={`chat-msg ${role}`}>
      <div className="role">{role === 'user' ? 'You' : 'Assistant'}</div>
      <div className="bubble">{content}</div>
    </div>
  )
}
