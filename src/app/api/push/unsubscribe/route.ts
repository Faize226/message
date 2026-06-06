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

  let body: { endpoint?: string } = {}
  try {
    body = await req.json()
  } catch {
    // pas grave, on supprime toutes les subscriptions de l'user
  }

  try {
    if (body.endpoint) {
      await prisma.pushSubscription.deleteMany({
        where: { userId: dbUser.id, endpoint: body.endpoint },
      })
    } else {
      await prisma.pushSubscription.deleteMany({
        where: { userId: dbUser.id },
      })
    }
  } catch (err) {
    console.error('[push/unsubscribe] error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
