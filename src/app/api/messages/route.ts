import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendPushNotification, isPushConfigured } from '@/lib/push-server'

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

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id || !session.user.name) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const dbUser = await prisma.user.findUnique({
    where: { username: session.user.name },
    select: { id: true, name: true },
  })
  if (!dbUser) {
    return NextResponse.json({ error: 'Session invalide' }, { status: 401 })
  }

  let body: {
    type?: string
    content?: string | null
    url?: string | null
    duration?: number | null
    replyToId?: string | null
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })
  }

  const type = typeof body.type === 'string' ? body.type : 'text'
  if (!['text', 'image', 'video', 'audio', 'gif', 'sticker'].includes(type)) {
    return NextResponse.json({ error: 'Type invalide' }, { status: 400 })
  }
  const content = typeof body.content === 'string' ? body.content : null
  const url = typeof body.url === 'string' ? body.url : null
  const duration = typeof body.duration === 'number' ? body.duration : null
  const replyToId = typeof body.replyToId === 'string' ? body.replyToId : null

  if (type === 'text') {
    if (!content || content.length === 0 || content.length > 4000) {
      return NextResponse.json({ error: 'Contenu texte invalide' }, { status: 400 })
    }
  } else {
    if (!url) {
      return NextResponse.json({ error: 'URL média requise' }, { status: 400 })
    }
  }

  if (replyToId) {
    const exists = await prisma.message.findUnique({ where: { id: replyToId }, select: { id: true } })
    if (!exists) return NextResponse.json({ error: 'Message cité introuvable' }, { status: 400 })
  }

  try {
    const message = await prisma.message.create({
      data: {
        type,
        content,
        url,
        duration,
        userId: dbUser.id,
        replyToId,
      },
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
    })

    const payload = {
      id: message.id,
      content: message.content,
      type: message.type,
      url: message.url,
      duration: message.duration,
      userId: message.userId,
      createdAt: message.createdAt.toISOString(),
      editedAt: message.editedAt ? message.editedAt.toISOString() : null,
      replyTo: message.replyTo
        ? {
            id: message.replyTo.id,
            content: message.replyTo.content,
            type: message.replyTo.type,
            user: {
              name: message.replyTo.user.name,
              username: message.replyTo.user.username,
            },
          }
        : null,
      user: { id: message.user.id, name: message.user.name, username: message.user.username },
    }

    void sendPushToRecipient(
      dbUser.id,
      message.user.name || message.user.username || 'Quelqu\'un',
      type,
      content
    )

    return NextResponse.json(payload)
  } catch (err) {
    console.error('[api/messages POST] error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

async function sendPushToRecipient(
  senderId: string,
  senderName: string,
  type: string,
  content: string | null
) {
  if (!isPushConfigured()) return
  try {
    const recipient = await prisma.user.findFirst({
      where: { id: { not: senderId } },
      select: { id: true },
    })
    if (!recipient) return

    const subs = await prisma.pushSubscription.findMany({
      where: { userId: recipient.id },
    })
    if (subs.length === 0) return

    const PREVIEW_BY_TYPE: Record<string, string> = {
      image: '📷 Image',
      video: '🎥 Vidéo',
      audio: '🎤 Message vocal',
      gif: '🎬 GIF',
      sticker: '😀 Sticker',
    }
    const textPreview = (content || '').slice(0, 100).trim()
    const bodyPreview =
      type === 'text' ? (textPreview || 'Nouveau message') : PREVIEW_BY_TYPE[type] || 'Nouveau message'

    await Promise.all(
      subs.map(async (sub) => {
        try {
          await sendPushNotification(
            { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
            { title: senderName, body: bodyPreview, url: '/chat' }
          )
        } catch (pushErr: unknown) {
          const statusCode = (pushErr as { statusCode?: number })?.statusCode
          if (statusCode === 410 || statusCode === 404) {
            await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {})
          } else {
            console.error('[push] send failed:', pushErr)
          }
        }
      })
    )
  } catch (err) {
    console.error('[push] logic error:', err)
  }
}
