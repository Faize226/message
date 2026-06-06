import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id || !session.user.name) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const dbUser = await prisma.user.findUnique({
    where: { username: session.user.name },
    select: { id: true },
  })
  if (!dbUser) {
    return NextResponse.json({ error: 'Session invalide' }, { status: 401 })
  }

  try {
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

    const messages = rawMessages.map((m) => ({
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

    return NextResponse.json({ messages })
  } catch (err) {
    console.error('[api/messages] error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
