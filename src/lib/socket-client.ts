'use client'

import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null
let currentUserId = ''

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySocket = Socket<any, any>

export function getSocket(userId: string): AnySocket {
  if (!socket) {
    console.log('[socket-client] creating socket for userId:', userId)
    currentUserId = userId
    socket = io({
      transports: ['websocket', 'polling'],
      query: { userId },
    })
  } else if (userId !== currentUserId) {
    console.log('[socket-client] userId changed, recreating socket', { from: currentUserId, to: userId })
    socket.removeAllListeners()
    socket.disconnect()
    currentUserId = userId
    socket = io({
      transports: ['websocket', 'polling'],
      query: { userId },
    })
  }
  return socket
}
