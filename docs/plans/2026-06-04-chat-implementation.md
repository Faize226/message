# Chat Privé à Deux — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a private chat between two pre-seeded users with real-time messaging via Socket.io.

**Architecture:** Next.js 14 App Router with Prisma/SQLite for persistence, NextAuth for credentials auth, and Socket.io for bidirectional real-time communication. Single conversation between two users, no registration, no sidebar.

**Tech Stack:** Next.js 14+, Prisma + SQLite, NextAuth.js, Socket.io, Tailwind CSS, bcrypt, TypeScript

---

### Task 1: Project scaffolding + dependencies

**Files:**
- Create: `package.json` (via create-next-app)
- Create: `tsconfig.json`, `tailwind.config.ts`, `postcss.config.js`
- Create: `app/globals.css`
- Create: `app/layout.tsx`

**Step 1: Initialize the project**

Run:
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --no-import-alias --use-npm
```
(If directory not empty, use `--force` or run in empty dir)

**Step 2: Install additional dependencies**

Run:
```bash
npm install prisma @prisma/client next-auth@beta @auth/prisma-adapter bcryptjs socket.io socket.io-client
npm install -D @types/bcryptjs @types/node ts-node
```

**Step 3: Verify project starts**

Run: `npm run dev`
Expected: Next.js dev server starts on localhost:3000

**Step 4: Commit**
```bash
git add .
git commit -m "feat: scaffold Next.js project with dependencies"
```

---

### Task 2: Prisma schema + client

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/prisma.ts`
- Create: `prisma/seed.ts`

**Step 1: Write Prisma schema**

`prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id        String    @id @default(cuid())
  name      String?
  email     String    @unique
  password  String
  messages  Message[]
  createdAt DateTime  @default(now())
}

model Message {
  id        String   @id @default(cuid())
  content   String
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  createdAt DateTime @default(now())
}
```

**Step 2: Write Prisma client singleton**

`src/lib/prisma.ts`:
```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

**Step 3: Write seed script**

`prisma/seed.ts`:
```typescript
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const password = await bcrypt.hash('password123', 10)

  const user1 = await prisma.user.upsert({
    where: { email: 'alice@example.com' },
    update: {},
    create: { email: 'alice@example.com', name: 'Alice', password },
  })

  const user2 = await prisma.user.upsert({
    where: { email: 'bob@example.com' },
    update: {},
    create: { email: 'bob@example.com', name: 'Bob', password },
  })

  console.log('Seeded users:', { user1: user1.email, user2: user2.email })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

**Step 4: Add env + scripts**

Create `.env`:
```
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="change-me-to-a-random-string"
NEXTAUTH_URL="http://localhost:3000"
```

Add to `package.json` scripts:
```json
"prisma:generate": "prisma generate",
"prisma:push": "prisma db push",
"prisma:seed": "tsx prisma/seed.ts",
"postinstall": "prisma generate"
```

Also add `"prisma": { "seed": "tsx prisma/seed.ts" }` to `package.json`.

Run:
```bash
npm install -D tsx
npx prisma db push && npx prisma generate && npx tsx prisma/seed.ts
```
Expected: SQLite DB created, 2 users seeded

**Step 5: Commit**
```bash
git add .
git commit -m "feat: add Prisma schema with User and Message models + seed"
```

---

### Task 3: NextAuth configuration

**Files:**
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Create: `src/lib/auth.ts`
- Create: `src/app/api/auth/[...nextauth]/AuthProvider.tsx`

**Step 1: Write auth config**

`src/lib/auth.ts`:
```typescript
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Mot de passe', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        })

        if (!user) return null

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        )

        if (!isValid) return null

        return { id: user.id, email: user.email, name: user.name }
      },
    }),
  ],
  pages: {
    signIn: '/auth',
  },
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) { token.id = user.id }
      return token
    },
    async session({ session, token }) {
      if (session.user) { session.user.id = token.id as string }
      return session
    },
  },
})
```

**Step 2: Write API route handler**

`src/app/api/auth/[...nextauth]/route.ts`:
```typescript
import { handlers } from '@/lib/auth'

export const { GET, POST } = handlers
```

**Step 3: Create .env (if not done)**

**Step 4: Test auth endpoint**

Run: `curl -X POST http://localhost:3000/api/auth/callback/credentials -H "Content-Type: application/json" -d '{"email":"alice@example.com","password":"password123"}'`
Expected: Returns session data or redirect

**Step 5: Commit**
```bash
git add .
git commit -m "feat: add NextAuth with credentials provider"
```

---

### Task 4: Auth page

**Files:**
- Create: `src/app/auth/page.tsx`
- Create: `src/components/AuthForm.tsx`

**Step 1: Write AuthForm component**

`src/components/AuthForm.tsx`:
```tsx
'use client'

import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'

export default function AuthForm() {
  const router = useRouter()
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')

    const form = new FormData(e.currentTarget)
    const email = form.get('email') as string
    const password = form.get('password') as string

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    if (result?.error) {
      setError('Email ou mot de passe incorrect')
    } else {
      router.push('/chat')
      router.refresh()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
      <h1 className="text-2xl font-semibold text-[#f1f5f9] text-center">Connexion</h1>
      {error && (
        <p className="text-red-400 text-sm text-center">{error}</p>
      )}
      <input
        name="email"
        type="email"
        placeholder="Email"
        required
        className="w-full px-4 py-3 rounded-lg bg-[#1a1a2e] text-[#f1f5f9] border border-[#2a2a4a] focus:outline-none focus:border-[#3b82f6] placeholder-[#94a3b8]"
      />
      <input
        name="password"
        type="password"
        placeholder="Mot de passe"
        required
        className="w-full px-4 py-3 rounded-lg bg-[#1a1a2e] text-[#f1f5f9] border border-[#2a2a4a] focus:outline-none focus:border-[#3b82f6] placeholder-[#94a3b8]"
      />
      <button
        type="submit"
        className="w-full py-3 rounded-lg bg-[#3b82f6] text-white font-medium hover:bg-[#2563eb] transition-colors"
      >
        Se connecter
      </button>
    </form>
  )
}
```

**Step 2: Write auth page**

`src/app/auth/page.tsx`:
```tsx
import AuthForm from '@/components/AuthForm'

export default function AuthPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <AuthForm />
    </div>
  )
}
```

**Step 3: Commit**
```bash
git add .
git commit -m "feat: add auth page with login form"
```

---

### Task 5: Middleware + layout protection

**Files:**
- Create: `src/middleware.ts`
- Modify: `src/app/layout.tsx`

**Step 1: Write middleware**

`src/middleware.ts`:
```typescript
export { auth as middleware } from '@/lib/auth'

export const config = {
  matcher: ['/chat/:path*'],
}
```

**Step 2: Update layout to include SessionProvider**

`src/app/layout.tsx`:
```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/Providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Message',
  description: 'Chat privé',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

**Step 3: Create Providers component**

`src/components/Providers.tsx`:
```tsx
'use client'

import { SessionProvider } from 'next-auth/react'

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>
}
```

**Step 4: Commit**
```bash
git add .
git commit -m "feat: add middleware protection and session provider"
```

---

### Task 6: Socket.io server

**Files:**
- Create: `src/lib/socket.ts`
- Modify: `src/app/layout.tsx`

**Step 1: Write Socket.io server handler**

`src/lib/socket.ts`:
```typescript
import { Server as HTTPServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { prisma } from './prisma'

let io: SocketIOServer | null = null

export function getIO() {
  return io
}

export function initSocketServer(httpServer: HTTPServer) {
  if (io) return io

  io = new SocketIOServer(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  })

  io.on('connection', (socket) => {
    const userId = socket.handshake.query.userId as string
    if (!userId) return

    socket.join('room:global')
    socket.broadcast.emit('userOnline', userId)

    socket.on('sendMessage', async (data: { content: string; userId: string }) => {
      const message = await prisma.message.create({
        data: { content: data.content, userId: data.userId },
        include: { user: { select: { id: true, name: true, email: true } } },
      })

      io?.to('room:global').emit('newMessage', message)
    })

    socket.on('disconnect', () => {
      socket.broadcast.emit('userOffline', userId)
    })
  })

  return io
}
```

**Step 2: Create custom server entry point**

`server.ts` (at root):
```typescript
import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { initSocketServer } from './src/lib/socket'

const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true)
    handle(req, res, parsedUrl)
  })

  initSocketServer(httpServer)

  httpServer.listen(3000, () => {
    console.log('> Ready on http://localhost:3000')
  })
})
```

**Step 3: Update package.json scripts**

```json
"dev": "tsx server.ts",
"build": "next build",
"start": "NODE_ENV=production node server.js"
```

**Step 4: Install tsx for dev server**
Run: `npm install -D tsx` (if not already done)

**Step 5: Commit**
```bash
git add .
git commit -m "feat: add Socket.io server with message handling"
```

---

### Task 7: Chat page — Socket client + messages

**Files:**
- Create: `src/app/chat/page.tsx`
- Create: `src/components/ChatHeader.tsx`
- Create: `src/components/MessageList.tsx`
- Create: `src/components/MessageBubble.tsx`
- Create: `src/components/MessageInput.tsx`

**Step 1: Write Socket client hook**

`src/lib/socket-client.ts`:
```typescript
'use client'

import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export function getSocket() {
  if (!socket) {
    socket = io({ transports: ['websocket'] })
  }
  return socket
}
```

**Step 2: Write ChatHeader component**

`src/components/ChatHeader.tsx`:
```tsx
'use client'

import { signOut, useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { getSocket } from '@/lib/socket-client'

interface ChatHeaderProps {
  otherUserName: string
  otherUserId: string
}

export default function ChatHeader({ otherUserName, otherUserId }: ChatHeaderProps) {
  const [isOnline, setIsOnline] = useState(false)

  useEffect(() => {
    const socket = getSocket()

    socket.on('userOnline', (userId: string) => {
      if (userId === otherUserId) setIsOnline(true)
    })

    socket.on('userOffline', (userId: string) => {
      if (userId === otherUserId) setIsOnline(false)
    })

    socket.emit('checkOnline', otherUserId)

    return () => {
      socket.off('userOnline')
      socket.off('userOffline')
    }
  }, [otherUserId])

  return (
    <header className="border-b border-[#2a2a4a] bg-[#0a0a0a] px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500' : 'bg-[#4a4a6a]'}`} />
        <h2 className="text-[#f1f5f9] font-medium">{otherUserName}</h2>
        <span className="text-xs text-[#94a3b8]">{isOnline ? 'En ligne' : 'Hors ligne'}</span>
      </div>
      <button
        onClick={() => signOut({ callbackUrl: '/auth' })}
        className="text-sm text-[#94a3b8] hover:text-[#f1f5f9] transition-colors"
      >
        Déconnexion
      </button>
    </header>
  )
}
```

**Step 3: Write MessageBubble component**

`src/components/MessageBubble.tsx`:
```tsx
interface MessageBubbleProps {
  content: string
  isMine: boolean
  time: string
}

export default function MessageBubble({ content, isMine, time }: MessageBubbleProps) {
  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[70%] px-4 py-2.5 rounded-2xl ${
          isMine
            ? 'bg-[#3b82f6] text-white rounded-br-sm'
            : 'bg-[#1e293b] text-[#f1f5f9] rounded-bl-sm'
        }`}
      >
        <p className="text-sm">{content}</p>
        <p className={`text-[10px] mt-1 ${isMine ? 'text-blue-200' : 'text-[#64748b]'}`}>{time}</p>
      </div>
    </div>
  )
}
```

**Step 4: Write MessageList component**

`src/components/MessageList.tsx`:
```tsx
'use client'

import { useEffect, useRef } from 'react'
import MessageBubble from './MessageBubble'

interface Message {
  id: string
  content: string
  userId: string
  createdAt: string
  user: { id: string; name: string | null }
}

interface MessageListProps {
  messages: Message[]
  currentUserId: string
}

export default function MessageList({ messages, currentUserId }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          content={msg.content}
          isMine={msg.userId === currentUserId}
          time={new Date(msg.createdAt).toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
```

**Step 5: Write MessageInput component**

`src/components/MessageInput.tsx`:
```tsx
'use client'

import { FormEvent, useState } from 'react'

interface MessageInputProps {
  onSend: (content: string) => void
}

export default function MessageInput({ onSend }: MessageInputProps) {
  const [content, setContent] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    onSend(content.trim())
    setContent('')
  }

  return (
    <form onSubmit={handleSubmit} className="border-t border-[#2a2a4a] bg-[#0a0a0a] px-6 py-4">
      <div className="flex gap-3">
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Écrire un message..."
          className="flex-1 px-4 py-3 rounded-xl bg-[#1a1a2e] text-[#f1f5f9] border border-[#2a2a4a] focus:outline-none focus:border-[#3b82f6] placeholder-[#94a3b8]"
        />
        <button
          type="submit"
          className="px-5 py-3 rounded-xl bg-[#3b82f6] text-white font-medium hover:bg-[#2563eb] transition-colors disabled:opacity-50"
          disabled={!content.trim()}
        >
          Envoyer
        </button>
      </div>
    </form>
  )
}
```

**Step 6: Write Chat page**

`src/app/chat/page.tsx`:
```tsx
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import ChatClient from './ChatClient'

export default async function ChatPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth')

  const allUsers = await prisma.user.findMany({
    where: { id: { not: session.user.id } },
    select: { id: true, name: true },
  })

  const messages = await prisma.message.findMany({
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  })

  const otherUser = allUsers[0]

  const serializedMessages = messages.map((m) => ({
    ...m,
    createdAt: m.createdAt.toISOString(),
  }))

  return (
    <ChatClient
      currentUserId={session.user.id}
      otherUser={otherUser}
      initialMessages={serializedMessages}
    />
  )
}
```

**Step 7: Write ChatClient component**

`src/app/chat/ChatClient.tsx`:
```tsx
'use client'

import { useEffect, useState } from 'react'
import { getSocket } from '@/lib/socket-client'
import ChatHeader from '@/components/ChatHeader'
import MessageList from '@/components/MessageList'
import MessageInput from '@/components/MessageInput'

interface User {
  id: string
  name: string | null
}

interface Message {
  id: string
  content: string
  userId: string
  createdAt: string
  user: { id: string; name: string | null }
}

interface ChatClientProps {
  currentUserId: string
  otherUser: User
  initialMessages: Message[]
}

export default function ChatClient({ currentUserId, otherUser, initialMessages }: ChatClientProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const socket = getSocket()

  useEffect(() => {
    socket.emit('join', { userId: currentUserId })

    socket.on('newMessage', (message: Message) => {
      setMessages((prev) => [...prev, message])
    })

    return () => {
      socket.off('newMessage')
    }
  }, [currentUserId, socket])

  function handleSend(content: string) {
    socket.emit('sendMessage', { content, userId: currentUserId })
  }

  return (
    <div className="h-screen bg-[#0a0a0a] flex flex-col">
      <ChatHeader otherUserName={otherUser.name ?? 'Inconnu'} otherUserId={otherUser.id} />
      <MessageList messages={messages} currentUserId={currentUserId} />
      <MessageInput onSend={handleSend} />
    </div>
  )
}
```

**Step 8: Update globals.css**

`src/app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  padding: 0;
}

::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: #0a0a0a;
}
::-webkit-scrollbar-thumb {
  background: #2a2a4a;
  border-radius: 3px;
}
```

**Step 9: Commit**
```bash
git add .
git commit -m "feat: add chat page with real-time messaging"
```

---

### Task 8: Root page redirection

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Write root page**

`src/app/page.tsx`:
```tsx
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

export default async function Home() {
  const session = await auth()
  if (session?.user) redirect('/chat')
  redirect('/auth')
}
```

**Step 2: Commit**
```bash
git add .
git commit -m "feat: add root page with auth-based redirect"
```

---

### Task 9: Final verification

**Step 1: Start the server**

Run: `npm run dev`
Expected: Server starts on http://localhost:3000

**Step 2: Test login flow**
- Open http://localhost:3000 → redirected to /auth
- Login with alice@example.com / password123 → redirected to /chat
- Chat page shows header with other user name, message list, input

**Step 3: Test real-time**
- Open second browser/incognito
- Login with bob@example.com / password123
- Send messages from each → appear in real-time on the other

**Step 4: Test persistence**
- Refresh page → messages still there

**Step 5: Build for production**

Run: `npm run build`
Expected: Build succeeds
