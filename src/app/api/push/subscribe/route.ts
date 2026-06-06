import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.name) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const dbUser = await prisma.user.findUnique({
    where: { username: session.user.name },
    select: { id: true },
  })
  if (!dbUser) {
    return NextResponse.json({ error: 'Session invalide' }, { status: 401 })
  }

  let body: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Corps invalide' }, { status: 400 })
  }

  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return NextResponse.json({ error: 'Subscription invalide' }, { status: 400 })
  }

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.pushSubscription.findUnique({
        where: { endpoint: body.endpoint },
        select: { id: true, userId: true },
      })

      if (!existing) {
        await tx.pushSubscription.create({
          data: {
            userId: dbUser.id,
            endpoint: body.endpoint!,
            p256dh: body.keys!.p256dh!,
            auth: body.keys!.auth!,
          },
        })
        return
      }

      if (existing.userId !== dbUser.id) {
        throw new SubscriptionConflictError()
      }

      await tx.pushSubscription.update({
        where: { id: existing.id },
        data: {
          p256dh: body.keys!.p256dh!,
          auth: body.keys!.auth!,
        },
      })
    })
  } catch (err) {
    if (err instanceof SubscriptionConflictError) {
      return NextResponse.json(
        { error: 'Subscription existe pour un autre utilisateur' },
        { status: 409 }
      )
    }
    console.error('[push/subscribe] error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

class SubscriptionConflictError extends Error {
  constructor() {
    super('Push subscription already owned by another user')
    this.name = 'SubscriptionConflictError'
  }
}
