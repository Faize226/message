import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { supabase } from '@/lib/supabase'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id || !session.user.name) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { id } = await params

  const m = await prisma.message.findUnique({
    where: { id },
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

  if (!m) return NextResponse.json({ error: 'Message introuvable' }, { status: 404 })

  return NextResponse.json({
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
  })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id || !session.user.name) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  // Resolve user by stable username to avoid stale JWT id
  const dbUser = await prisma.user.findUnique({
    where: { username: session.user.name },
    select: { id: true },
  })
  if (!dbUser) {
    return NextResponse.json({ error: 'Session invalide' }, { status: 401 })
  }

  const { id } = await params

  const message = await prisma.message.findUnique({
    where: { id },
    select: { id: true, userId: true, url: true, type: true },
  })

  if (!message) {
    return NextResponse.json({ error: 'Message introuvable' }, { status: 404 })
  }

  if (message.userId !== dbUser.id) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  if (message.url && (message.type === 'image' || message.type === 'video' || message.type === 'audio')) {
    try {
      const url = new URL(message.url)
      const pathParts = url.pathname.split('/storage/v1/object/public/chat-media/')
      if (pathParts[1]) {
        await supabase.storage.from('chat-media').remove([pathParts[1]])
      }
    } catch (e) {
      console.error('Failed to delete from storage:', e)
    }
  }

  await prisma.message.delete({ where: { id } })

  return NextResponse.json({ success: true, id })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params

  let body: { content?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })
  }

  const content = typeof body.content === 'string' ? body.content.trim() : ''
  if (content.length === 0 || content.length > 4000) {
    return NextResponse.json({ error: 'Contenu invalide' }, { status: 400 })
  }

  const existing = await prisma.message.findUnique({
    where: { id },
    select: { id: true, userId: true, type: true },
  })
  if (!existing) {
    return NextResponse.json({ error: 'Message introuvable' }, { status: 404 })
  }
  if (existing.userId !== dbUser.id) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }
  if (existing.type !== 'text') {
    return NextResponse.json(
      { error: 'Seuls les messages texte peuvent être modifiés' },
      { status: 400 }
    )
  }

  const editedAt = new Date()
  const updated = await prisma.message.update({
    where: { id },
    data: { content, editedAt },
    include: { user: { select: { id: true, name: true, username: true } } },
  })

  return NextResponse.json({
    id: updated.id,
    content: updated.content,
    type: updated.type,
    url: updated.url,
    duration: updated.duration,
    userId: updated.userId,
    createdAt: updated.createdAt.toISOString(),
    editedAt: editedAt.toISOString(),
    replyTo: null,
    user: {
      id: updated.user.id,
      name: updated.user.name,
      username: updated.user.username,
    },
  })
}
