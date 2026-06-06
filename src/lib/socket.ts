import { Server as HTTPServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { prisma } from './prisma'
import { sendPushNotification, isPushConfigured } from './push-server'

const globalForSocket = globalThis as unknown as {
  __socketIO?: SocketIOServer
  __userSocketCount?: Map<string, number>
}

let io: SocketIOServer | null = globalForSocket.__socketIO ?? null
const userSocketCount: Map<string, number> =
  globalForSocket.__userSocketCount ?? (globalForSocket.__userSocketCount = new Map<string, number>())

function addOnline(userId: string) {
  userSocketCount.set(userId, (userSocketCount.get(userId) || 0) + 1)
}

function removeOnline(userId: string): boolean {
  const next = (userSocketCount.get(userId) || 1) - 1
  if (next <= 0) {
    userSocketCount.delete(userId)
    return true
  }
  userSocketCount.set(userId, next)
  return false
}

function getOnlineUsers(): string[] {
  return Array.from(userSocketCount.keys())
}

export function getIO() {
  return globalForSocket.__socketIO ?? io
}

export function initSocketServer(httpServer: HTTPServer) {
  if (globalForSocket.__socketIO) return globalForSocket.__socketIO
  if (io) return io

  io = new SocketIOServer(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  })
  globalForSocket.__socketIO = io

  io.on('connection', (socket) => {
    const userId = socket.handshake.query.userId as string
    console.log('[socket] connection from userId:', userId)
    if (!userId) {
      console.log('[socket] No userId, disconnecting')
      socket.disconnect()
      return
    }

    addOnline(userId)
    socket.join('room:global')
    socket.emit('currentOnlineUsers', getOnlineUsers())
    socket.broadcast.emit('userOnline', userId)

    socket.on('getOnlineUsers', () => {
      socket.emit('currentOnlineUsers', getOnlineUsers())
    })

    socket.on('sendMessage', async (data: {
      type?: string
      content?: string | null
      url?: string | null
      duration?: number | null
      replyToId?: string | null
      userId: string
    }) => {
      console.log('[socket] sendMessage received:', { from: userId, data })
      const targetUserId = data.userId || userId
      try {
        const message = await prisma.message.create({
          data: {
            type: data.type || 'text',
            content: data.content ?? null,
            url: data.url ?? null,
            duration: data.duration ?? null,
            userId: targetUserId,
            replyToId: data.replyToId ?? null,
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
          ...message,
          createdAt: message.createdAt.toISOString(),
          editedAt: message.editedAt ? message.editedAt.toISOString() : null,
        }
        io?.to('room:global').emit('newMessage', payload)
        console.log('[socket] message broadcast:', message.id)

        // Envoi d'une push notification au destinataire s'il est hors ligne
        try {
          const recipient = await prisma.user.findFirst({
            where: { id: { not: targetUserId } },
            select: { id: true, name: true, username: true },
          })

          if (recipient && !userSocketCount.has(recipient.id) && isPushConfigured()) {
            const subs = await prisma.pushSubscription.findMany({
              where: { userId: recipient.id },
            })

            if (subs.length > 0) {
              const senderName = message.user.name || message.user.username || 'Quelqu\'un'
              const PREVIEW_BY_TYPE: Record<string, string> = {
                image: '📷 Image',
                video: '🎥 Vidéo',
                audio: '🎤 Message vocal',
                gif: '🎬 GIF',
                sticker: '😀 Sticker',
              }
              const textPreview = (message.content || '').slice(0, 100).trim()
              const bodyPreview =
                message.type === 'text'
                  ? (textPreview || 'Nouveau message')
                  : PREVIEW_BY_TYPE[message.type] || 'Nouveau message'

              await Promise.all(
                subs.map(async (sub) => {
                  try {
                    await sendPushNotification(
                      { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
                      { title: senderName, body: bodyPreview, url: '/chat' }
                    )
                    console.log('[socket] push sent to:', recipient.username, 'endpoint:', sub.endpoint.slice(0, 40))
                  } catch (pushErr: unknown) {
                    const statusCode = (pushErr as { statusCode?: number })?.statusCode
                    if (statusCode === 410 || statusCode === 404) {
                      await prisma.pushSubscription.delete({ where: { id: sub.id } })
                      console.log('[socket] expired push subscription removed:', sub.endpoint.slice(0, 40))
                    } else {
                      console.error('[socket] push send failed:', pushErr)
                    }
                  }
                })
              )
            }
          }
        } catch (err) {
          console.error('[socket] push logic error:', err)
        }
      } catch (err) {
        console.error('[socket] sendMessage error:', err)
      }
    })

    socket.on('disconnect', () => {
      const wasLast = removeOnline(userId)
      if (wasLast) {
        socket.broadcast.emit('userOffline', userId)
      }
    })
  })

  return io
}
