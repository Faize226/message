'use client'

import { useEffect, useState } from 'react'
import { subscribeToMessages, type MessageChangePayload } from '@/lib/realtime'
import ChatHeader from '@/components/ChatHeader'
import MessageList from '@/components/MessageList'
import MessageInput, { SendData } from '@/components/MessageInput'
import NotificationPrompt from '@/components/NotificationPrompt'
import { registerServiceWorker } from '@/lib/push-client'

interface User {
  id: string
  name: string | null
  username: string | null
}

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
  user: { id: string; name: string | null; username: string | null }
}

interface ChatClientProps {
  currentUserId: string
  otherUser: User | null
  initialMessages: Message[]
}

function replyRefFromMessage(msg: Message): ReplyRef {
  return {
    id: msg.id,
    content: msg.content,
    type: msg.type,
    user: { name: msg.user.name, username: msg.user.username },
  }
}

export default function ChatClient({ currentUserId, otherUser, initialMessages }: ChatClientProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [replyTarget, setReplyTarget] = useState<ReplyRef | null>(null)
  const [editingMessage, setEditingMessage] = useState<(ReplyRef & { content: string }) | null>(null)

  useEffect(() => {
    const unsubscribe = subscribeToMessages(async (payload: MessageChangePayload) => {
      if (payload.eventType === 'INSERT') {
        const newId = (payload.new as { id: string }).id
        if (!newId) return
        try {
          const res = await fetch(`/api/messages/${newId}`, { cache: 'no-store' })
          if (!res.ok) return
          const full: Message = await res.json()
          setMessages((prev) => (prev.some((m) => m.id === full.id) ? prev : [...prev, full]))
        } catch (err) {
          console.error('[client] fetch new message failed:', err)
        }
      } else if (payload.eventType === 'UPDATE') {
        const updated = payload.new as { id: string; content: string | null; editedAt: string | null }
        setMessages((prev) =>
          prev.map((m) =>
            m.id === updated.id
              ? { ...m, content: updated.content, editedAt: updated.editedAt }
              : m
          )
        )
      } else if (payload.eventType === 'DELETE') {
        const oldId = (payload.old as { id: string }).id
        if (!oldId) return
        setMessages((prev) => prev.filter((m) => m.id !== oldId))
      }
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    registerServiceWorker()
  }, [])

  async function handleSend(data: SendData, replyToId: string | null) {
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: data.type,
          content: data.content,
          url: data.url,
          duration: data.duration,
          replyToId,
        }),
      })
      if (!res.ok) {
        console.error('[client] send failed:', res.status, await res.text())
        return
      }
      const message: Message = await res.json()
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]))
      setReplyTarget(null)
    } catch (err) {
      console.error('[client] send error:', err)
    }
  }

  function handleReply(messageId: string) {
    const target = messages.find((m) => m.id === messageId)
    if (!target) return
    setReplyTarget(replyRefFromMessage(target))
    setEditingMessage(null)
  }

  function handleEdit(messageId: string) {
    const target = messages.find((m) => m.id === messageId)
    if (!target || target.type !== 'text' || target.userId !== currentUserId) return
    setEditingMessage({
      id: target.id,
      content: target.content ?? '',
      type: target.type,
      user: { name: target.user.name, username: target.user.username },
    })
    setReplyTarget(null)
  }

  function handleCancelMode() {
    setReplyTarget(null)
    setEditingMessage(null)
  }

  async function handleSubmitEdit(content: string) {
    if (!editingMessage) return
    try {
      const res = await fetch(`/api/messages/${editingMessage.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      if (!res.ok) {
        console.error('[client] edit failed:', res.status, await res.text())
        return
      }
      const updated = await res.json()
      setMessages((prev) =>
        prev.map((m) =>
          m.id === updated.id ? { ...m, content: updated.content, editedAt: updated.editedAt } : m
        )
      )
      setEditingMessage(null)
    } catch (err) {
      console.error('[client] edit error:', err)
    }
  }

  function handleScrollToMessage(messageId: string) {
    const el = document.querySelector(`[data-message-id="${messageId}"]`) as HTMLElement | null
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('ring-2', 'ring-white/30')
    setTimeout(() => el.classList.remove('ring-2', 'ring-white/30'), 1500)
  }

  async function handleDelete(messageId: string) {
    try {
      const res = await fetch(`/api/messages/${messageId}`, { method: 'DELETE' })
      if (res.status === 404) {
        setMessages((prev) => prev.filter((m) => m.id !== messageId))
        return
      }
      if (!res.ok) {
        console.error('[client] delete failed:', res.status, await res.text())
        return
      }
      setMessages((prev) => prev.filter((m) => m.id !== messageId))
    } catch (err) {
      console.error('[client] delete error:', err)
    }
  }

  const displayName = otherUser?.name ?? otherUser?.username ?? 'Inconnu'

  return (
    <div className="h-screen bg-[#07070a] flex flex-col">
      <ChatHeader
        otherUserName={displayName}
        otherUserId={otherUser?.id ?? ''}
        currentUserId={currentUserId}
      />
      <MessageList
        messages={messages}
        currentUserId={currentUserId}
        onDelete={handleDelete}
        onReply={handleReply}
        onEdit={handleEdit}
        onScrollToMessage={handleScrollToMessage}
      />
      <MessageInput
        onSend={handleSend}
        onSubmitEdit={handleSubmitEdit}
        replyTo={replyTarget}
        editingMessage={editingMessage}
        onCancel={handleCancelMode}
      />
      <NotificationPrompt />
    </div>
  )
}
