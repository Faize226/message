'use client'

import { useEffect, useRef } from 'react'
import MessageBubble from './MessageBubble'

interface ReplyRef {
  id: string
  content: string | null
  type: string
  user: { name: string | null; username: string | null }
}

interface Message {
  id: string
  content: string | null
  type: string
  url: string | null
  duration: number | null
  userId: string
  createdAt: string
  editedAt: string | null
  replyTo: ReplyRef | null
  user: { id: string; name: string | null }
}

interface MessageListProps {
  messages: Message[]
  currentUserId: string
  onDelete?: (id: string) => void
  onReply?: (id: string) => void
  onEdit?: (id: string) => void
  onScrollToMessage?: (id: string) => void
}

export default function MessageList({ messages, currentUserId, onDelete, onReply, onEdit, onScrollToMessage }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex-1 overflow-y-auto px-5 py-5 space-y-2">
      {messages.length === 0 && (
        <div className="flex items-center justify-center h-full">
          <p className="text-sm text-white/20">Aucun message pour le moment</p>
        </div>
      )}
      {messages.map((msg, i) => {
        const prev = messages[i - 1]
        const isSameUser = prev?.userId === msg.userId
        return (
          <div key={msg.id} data-message-id={msg.id}>
            <MessageBubble
              id={msg.id}
              content={msg.content}
              type={msg.type}
              url={msg.url}
              duration={msg.duration}
              isMine={msg.userId === currentUserId}
              time={new Date(msg.createdAt).toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
              isConsecutive={isSameUser}
              replyTo={msg.replyTo}
              editedAt={msg.editedAt}
              onDelete={onDelete}
              onReply={onReply}
              onEdit={onEdit}
              onScrollToMessage={onScrollToMessage}
            />
          </div>
        )
      })}
      <div ref={bottomRef} />
    </div>
  )
}
