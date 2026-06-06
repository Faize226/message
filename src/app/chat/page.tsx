import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import ChatClient from './ChatClient'

interface MessageRow {
  id: string
  content: string | null
  type: string
  url: string | null
  duration: number | null
  userId: string
  createdAt: Date
  editedAt: Date | null
  replyTo: {
    id: string
    content: string | null
    type: string
    user: { name: string | null; username: string }
  } | null
  user: { id: string; name: string | null; username: string }
}

export default async function ChatPage() {
  const session = await auth()
  if (!session?.user?.id || !session.user.name) redirect('/auth')

  // Resolve user by stable username to avoid stale JWT id (DB may have been reset)
  const currentUser = await prisma.user.findUnique({
    where: { username: session.user.name },
    select: { id: true, name: true, username: true },
  })
  if (!currentUser) redirect('/auth')

  const otherUser = await prisma.user.findFirst({
    where: { id: { not: currentUser.id } },
    select: { id: true, name: true, username: true },
  })

  const rawMessages = await prisma.message.findMany({
    include: {
      user: { select: { id: true, name: true, username: true } },
      replyTo: {
        select: {
          id: true,
          content: true,
          type: true,
          user: { select: { name: true, username: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  const messages = (rawMessages as unknown as MessageRow[]).map((m) => ({
    id: m.id,
    content: m.content,
    type: m.type,
    url: m.url,
    duration: m.duration,
    userId: m.userId,
    createdAt: m.createdAt.toISOString(),
    editedAt: m.editedAt ? m.editedAt.toISOString() : null,
    replyTo: m.replyTo
      ? {
          id: m.replyTo.id,
          content: m.replyTo.content,
          type: m.replyTo.type,
          user: {
            name: m.replyTo.user.name,
            username: m.replyTo.user.username,
          },
        }
      : null,
    user: { id: m.user.id, name: m.user.name, username: m.user.username },
  }))

  return (
    <ChatClient
      currentUserId={currentUser.id}
      otherUser={otherUser}
      initialMessages={messages}
    />
  )
}
