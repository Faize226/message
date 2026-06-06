# Reply & Edit Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Permettre à chaque utilisateur de répondre à n'importe quel message (citation au-dessus, type WhatsApp/Telegram) et de modifier ses propres messages texte (marqueur "modifié", sans limite de temps), avec synchronisation temps-réel via Socket.io pour les deux participants.

**Architecture:** Ajout de deux colonnes Prisma (`replyToId` FK self-ref, `editedAt`). Nouvelle route `PATCH /api/messages/[id]` pour l'édition. Nouveau broadcast socket `messageEdited`. Le `sendMessage` existant est enrichi d'un champ optionnel `replyToId`. Nouveau composant `MessageContextMenu` déclenché par long-press mobile / clic droit PC. `MessageBubble` affiche la citation au-dessus et le marqueur "modifié". `MessageInput` gère 3 modes (send / reply / edit) via une bannière contextuelle.

**Tech Stack:** Next.js 16.2.7, Prisma 6 + SQLite, Socket.io 4, React 19, Tailwind 4.

**Pré-requis:** Le bug de synchro temps-réel des suppressions est résolu (`src/lib/socket.ts` utilise `globalThis`).

**Note testing:** Ce projet n'a pas de framework de test automatisé. Chaque tâche a une vérification manuelle (curl, console, navigateur). Les vérifications attendues sont précisées.

---

## Task 1: Migration Prisma (replyToId + editedAt)

**Files:**
- Modify: `prisma/schema.prisma` (ligne du `model Message`)

**Step 1: Ajouter les colonnes au schéma**

Ouvrir `prisma/schema.prisma`. Trouver le `model Message` (vers la fin). Ajouter ces lignes à la fin du bloc (avant l'accolade fermante), dans l'ordre indiqué :

```prisma
  replyToId String?
  replyTo   Message?  @relation("MessageReplies", fields: [replyToId], references: [id], onDelete: SetNull)
  replies   Message[] @relation("MessageReplies")
  editedAt  DateTime?
```

**Step 2: Appliquer la migration**

```bash
cd C:\Users\PC\Documents\message
npx prisma db push
```

Attendu : `Your database is now in sync with your Prisma schema.` (ou message équivalent indiquant le succès). Aucune perte de données.

**Step 3: Régénérer le client Prisma**

```bash
cd C:\Users\PC\Documents\message
npx prisma generate
```

Attendu : `✔ Generated Prisma Client (vX.X.X)`.

**Step 4: Vérifier la compilation**

```bash
cd C:\Users\PC\Documents\message
npx tsc --noEmit
```

Attendu : aucune erreur.

---

## Task 2: Enrichir la forme des messages (SSR + API GET)

**Files:**
- Modify: `src/app/chat/page.tsx:33-47`
- Modify: `src/app/api/messages/route.ts:20-34`
- Modify: `src/app/chat/ChatClient.tsx:17-26`
- Modify: `src/components/MessageList.tsx:6-15`

**Step 1: Mettre à jour `page.tsx`**

Dans `src/app/chat/page.tsx`, remplacer l'appel `prisma.message.findMany` (lignes 33-36) par :

```ts
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
```

Puis remplacer le mapping (lignes 38-47) par :

```ts
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
```

**Step 2: Mettre à jour l'interface `MessageRow`**

Dans `src/app/chat/page.tsx`, remplacer l'interface `MessageRow` (lignes 6-15) par :

```ts
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
```

**Step 3: Mettre à jour `src/app/api/messages/route.ts`**

Remplacer le bloc `prisma.message.findMany` + `.map()` (lignes 20-34) par :

```ts
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
```

**Step 4: Mettre à jour l'interface `Message` côté client**

Dans `src/app/chat/ChatClient.tsx`, remplacer l'interface `Message` (lignes 17-26) par :

```ts
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
```

**Step 5: Mettre à jour l'interface `Message` dans `MessageList`**

Dans `src/components/MessageList.tsx`, remplacer l'interface `Message` (lignes 6-15) par :

```ts
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
  user: { id: string; name: string | null }
}
```

**Step 6: Vérifier la compilation**

```bash
cd C:\Users\PC\Documents\message
npx tsc --noEmit
npx eslint src/app/chat/page.tsx src/app/api/messages/route.ts src/app/chat/ChatClient.tsx src/components/MessageList.tsx
```

Attendu : aucune erreur, aucun warning.

**Step 7: Vérifier en navigateur**

Ouvrir `/chat`. La page doit charger sans erreur de console. La forme des messages a 2 champs en plus (`editedAt`, `replyTo`), tous deux `null` pour les messages existants.

---

## Task 3: PATCH /api/messages/[id] (route d'édition)

**Files:**
- Modify: `src/app/api/messages/[id]\route.ts` (ajout de la méthode PATCH)

**Step 1: Ajouter la méthode PATCH**

Dans `src/app/api/messages/[id]\route.ts`, ajouter à la fin du fichier (après la fonction `DELETE`, avant la fermeture du fichier) :

```ts
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
    return NextResponse.json({ error: 'Seuls les messages texte peuvent être modifiés' }, { status: 400 })
  }

  const editedAt = new Date()
  const updated = await prisma.message.update({
    where: { id },
    data: { content, editedAt },
    include: { user: { select: { id: true, name: true, username: true } } },
  })

  const io = getIO()
  if (io) {
    io.to('room:global').emit('messageEdited', {
      id: updated.id,
      content: updated.content,
      editedAt: editedAt.toISOString(),
    })
    console.log('[api/messages] edit broadcast sent for id:', id)
  } else {
    console.error('[api/messages] edit: io is null, broadcast skipped for id:', id)
  }

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
```

**Step 2: Vérifier la compilation**

```bash
cd C:\Users\PC\Documents\message
npx tsc --noEmit
npx eslint src/app/api/messages/[id]/route.ts
```

Attendu : aucune erreur, aucun warning.

**Step 3: Vérifier le runtime (smoke test)**

Le serveur dev est en cours d'exécution. Pour tester la route PATCH manuellement, il faut être authentifié. Le test le plus simple est de déclencher l'édition depuis l'UI dans la Task 7+.

Pour cette tâche, on vérifie que la route est compilée et accessible :
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X PATCH http://localhost:3000/api/messages/inexistant
```
Attendu : `401` (auth requise avant la logique 404).

---

## Task 4: Persister `replyToId` dans le broadcast `sendMessage`

**Files:**
- Modify: `src/lib/socket.ts:56-77` (handler `sendMessage`)
- Modify: `src/lib/socket.ts:66-77` (Prisma create + include)

**Step 1: Enrichir le type du payload et la création Prisma**

Dans `src/lib/socket.ts`, remplacer le bloc `socket.on('sendMessage', async (data: {...}) => { ... })` (lignes 56-77) par :

```ts
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

        // Normaliser editedAt (Date ou null) en ISO string
        const payload = {
          ...message,
          createdAt: message.createdAt.toISOString(),
          editedAt: message.editedAt ? message.editedAt.toISOString() : null,
        }
        io?.to('room:global').emit('newMessage', payload)
        console.log('[socket] message broadcast:', message.id)
```

**Note:** Le `try { ... } catch (err) { console.error('[socket] sendMessage error:', err) }` qui enveloppait l'ancien bloc doit rester tel quel. On n'a modifié que l'intérieur.

**Step 2: Vérifier la compilation**

```bash
cd C:\Users\PC\Documents\message
npx tsc --noEmit
npx eslint src/lib/socket.ts
```

Attendu : aucune erreur, aucun warning.

---

## Task 5: Listener socket `messageEdited` côté client

**Files:**
- Modify: `src/app/chat/ChatClient.tsx:37-89` (bloc useEffect du socket)

**Step 1: Ajouter le listener `messageEdited`**

Dans `src/app/chat/ChatClient.tsx`, à l'intérieur du `useEffect` qui gère le socket (lignes 37-89), ajouter ce handler après le `onDeleted` :

```tsx
    const onEdited = ({ id, content, editedAt }: { id: string; content: string | null; editedAt: string }) => {
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content, editedAt } : m)))
    }
```

Puis dans la section d'enregistrement (après `socket.on('messageDeleted', onDeleted)`), ajouter :

```tsx
    socket.on('messageEdited', onEdited)
```

Et dans le cleanup (après `socket.off('messageDeleted', onDeleted)`), ajouter :

```tsx
      socket.off('messageEdited', onEdited)
```

**Step 2: Vérifier la compilation**

```bash
cd C:\Users\PC\Documents\message
npx tsc --noEmit
npx eslint src/app/chat/ChatClient.tsx
```

Attendu : aucune erreur, aucun warning.

---

## Task 6: Nouveau composant `MessageContextMenu`

**Files:**
- Create: `src/components/MessageContextMenu.tsx`

**Step 1: Créer le composant**

Créer `src/components/MessageContextMenu.tsx` avec ce contenu :

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Reply, Pencil, Trash2 } from 'lucide-react'

interface MessageContextMenuProps {
  x: number
  y: number
  isMine: boolean
  type: string
  onReply: () => void
  onEdit?: () => void
  onDelete?: () => void
  onClose: () => void
}

export default function MessageContextMenu({
  x,
  y,
  isMine,
  type,
  onReply,
  onEdit,
  onDelete,
  onClose,
}: MessageContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [adjustedPos, setAdjustedPos] = useState({ x, y })

  useEffect(() => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const padding = 8
    let nx = x
    let ny = y
    if (x + rect.width + padding > window.innerWidth) {
      nx = Math.max(padding, window.innerWidth - rect.width - padding)
    }
    if (y + rect.height + padding > window.innerHeight) {
      ny = Math.max(padding, window.innerHeight - rect.height - padding)
    }
    setAdjustedPos({ x: nx, y: ny })
  }, [x, y])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    function handleScroll() {
      onClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    document.addEventListener('scroll', handleScroll, true)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('scroll', handleScroll, true)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[160px] rounded-xl border border-white/[0.08] bg-[#0e0e14] shadow-2xl py-1"
      style={{ left: adjustedPos.x, top: adjustedPos.y }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <button
        onClick={() => { onReply(); onClose() }}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/80 hover:bg-white/[0.06]"
      >
        <Reply className="h-3.5 w-3.5" />
        Répondre
      </button>
      {isMine && type === 'text' && onEdit && (
        <button
          onClick={() => { onEdit(); onClose() }}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/80 hover:bg-white/[0.06]"
        >
          <Pencil className="h-3.5 w-3.5" />
          Modifier
        </button>
      )}
      {isMine && onDelete && (
        <button
          onClick={() => { onDelete(); onClose() }}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Supprimer
        </button>
      )}
    </div>
  )
}
```

**Step 2: Vérifier la compilation**

```bash
cd C:\Users\PC\Documents\message
npx tsc --noEmit
npx eslint src/components/MessageContextMenu.tsx
```

Attendu : aucune erreur, aucun warning.

---

## Task 7: Mettre à jour `MessageBubble` (citation + marqueur modifié + suppression de l'ancien menu)

**Files:**
- Modify: `src/components/MessageBubble.tsx`

**Step 1: Mettre à jour les imports et les props**

En haut de `src/components/MessageBubble.tsx`, remplacer l'import de lucide-react (ligne 4) :

```ts
import { Play, Pause, Download, MoreHorizontal, Reply, Pencil, Trash2, X } from 'lucide-react'
```

Puis remplacer l'interface `MessageBubbleProps` (lignes 7-17) par :

```ts
interface ReplyRef {
  id: string
  content: string | null
  type: string
  user: { name: string | null; username: string | null }
}

interface MessageBubbleProps {
  id: string
  content: string | null
  type: string
  url: string | null
  duration: number | null
  isMine: boolean
  time: string
  isConsecutive?: boolean
  replyTo: ReplyRef | null
  editedAt: string | null
  onDelete?: (id: string) => void
  onReply?: (id: string) => void
  onEdit?: (id: string) => void
  onScrollToMessage?: (id: string) => void
}
```

**Step 2: Mettre à jour la signature du composant**

Remplacer la ligne `export default function MessageBubble(...) {` (ligne 25) par :

```ts
export default function MessageBubble({
  id,
  content,
  type,
  url,
  duration,
  isMine,
  time,
  isConsecutive,
  replyTo,
  editedAt,
  onDelete,
  onReply,
  onEdit,
  onScrollToMessage,
}: MessageBubbleProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const longPressTimer = useRef<number | null>(null)
  const touchStartPos = useRef<{ x: number; y: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
```

**Note:** On retire `menuOpen` et `menuRef` (l'ancien menu 3-points est supprimé) et `MoreHorizontal` n'est plus utilisé localement — il reste dans l'import au cas où, mais on peut le retirer en toute sécurité. Le retirer pour YAGNI :

```ts
import { Play, Pause, Download, Reply, Pencil, Trash2, X } from 'lucide-react'
```

**Step 3: Ajouter les handlers long-press / context menu**

Après le `useEffect` existant (lignes 30-46, qui gère `menuOpen` mais n'existe plus maintenant qu'on a retiré `menuOpen` — on le retire) — remplacer tout le bloc `useEffect` (lignes 30-46) par les handlers + un useEffect minimal pour la fermeture du context menu sur Escape :

En fait, le `useEffect` lignes 30-46 référence `menuOpen` qui n'existe plus. **Le supprimer entièrement** et le remplacer par :

```tsx
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setContextMenu(null)
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])

  function handleTouchStart(e: React.TouchEvent) {
    const t = e.touches[0]
    touchStartPos.current = { x: t.clientX, y: t.clientY }
    longPressTimer.current = window.setTimeout(() => {
      if (touchStartPos.current) {
        setContextMenu({ x: touchStartPos.current.x, y: touchStartPos.current.y })
      }
    }, 500)
  }

  function handleTouchMove() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  function handleTouchEnd() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }
```

**Step 4: Mettre à jour les handlers delete et ajouter les handlers reply/edit**

Remplacer `handleDelete` (ligne 48) par :

```tsx
  function handleDelete() {
    setContextMenu(null)
    setConfirmOpen(true)
  }
```

Remplacer `confirmDelete` (ligne 53) par :

```tsx
  function confirmDelete() {
    setConfirmOpen(false)
    onDelete?.(id)
  }
```

**Step 5: Helper pour l'aperçu de citation**

Avant le `return`, ajouter cette fonction utilitaire :

```tsx
  function getReplyPreview(): string {
    if (!replyTo) return ''
    const PREVIEW_BY_TYPE: Record<string, string> = {
      image: '📷 Image',
      video: '🎥 Vidéo',
      audio: '🎤 Message vocal',
      gif: '🎬 GIF',
      sticker: '😀 Sticker',
    }
    if (replyTo.type !== 'text') return PREVIEW_BY_TYPE[replyTo.type] || 'Message'
    const text = (replyTo.content || '').trim()
    if (text.length === 0) return 'Message vide'
    return text.length > 80 ? text.slice(0, 80) + '…' : text
  }
```

**Step 6: Remplacer le rendu**

Remplacer tout le `return` (lignes 58-132) par :

```tsx
  return (
    <div
      ref={containerRef}
      className={`group flex items-start gap-1.5 ${isMine ? 'justify-end' : 'justify-start'} ${isConsecutive ? 'mt-0.5' : 'mt-2'}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onContextMenu={handleContextMenu}
    >
      <ConfirmDialog
        open={confirmOpen}
        title="Supprimer ce message ?"
        message="Cette action est irréversible. Le message disparaîtra pour les deux participants."
        confirmText="Supprimer"
        cancelText="Annuler"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setConfirmOpen(false)}
      />
      {contextMenu && (
        <MessageContextMenuWrapper
          x={contextMenu.x}
          y={contextMenu.y}
          isMine={isMine}
          type={type}
          onReply={() => onReply?.(id)}
          onEdit={() => onEdit?.(id)}
          onDelete={() => handleDelete()}
          onClose={() => setContextMenu(null)}
        />
      )}
      {isMine && onDelete && (
        <div className="pt-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <button
            onClick={handleContextMenuProxy}
            className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.05]"
            title="Plus d'actions"
            aria-label="Plus d'actions"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <div
        className={`max-w-[75%] ${
          isMine
            ? 'bg-white/10 text-white/90 rounded-2xl rounded-br-md'
            : 'bg-white/[0.04] text-white/80 rounded-2xl rounded-bl-md'
        } overflow-hidden`}
      >
        {replyTo && (
          <button
            type="button"
            onClick={() => onScrollToMessage?.(replyTo.id)}
            className={`w-full text-left flex flex-col gap-0.5 px-4 pt-2 pb-1.5 border-l-2 ${
              isMine ? 'border-white/30 bg-white/[0.04]' : 'border-white/20 bg-white/[0.02]'
            } hover:bg-white/[0.06] transition-colors`}
          >
            <span className={`text-[11px] font-semibold ${isMine ? 'text-white/70' : 'text-white/60'}`}>
              {replyTo.user.name || replyTo.user.username || 'Utilisateur'}
            </span>
            <span className={`text-[12px] truncate ${isMine ? 'text-white/55' : 'text-white/45'}`}>
              {getReplyPreview()}
            </span>
          </button>
        )}
        {type === 'image' && url && <ImageContent url={url} />}
        {type === 'video' && url && <VideoContent url={url} />}
        {type === 'gif' && url && (
          <img src={url} alt="gif" className="max-w-full max-h-72 object-cover" loading="lazy" />
        )}
        {type === 'sticker' && url && <StickerContent url={url} />}
        {type === 'audio' && url && <AudioContent url={url} duration={duration || 0} isMine={isMine} />}

        {content && type === 'text' && (
          <div className="px-4 py-2.5">
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{content}</p>
          </div>
        )}

        {content && type !== 'text' && (
          <div className="px-4 py-2.5">
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{content}</p>
          </div>
        )}

        {type !== 'sticker' && (
          <div className="px-4 pb-2 flex items-center gap-1">
            <p className={`text-[10px] ${isMine ? 'text-white/30' : 'text-white/20'}`}>{time}</p>
            {editedAt && (
              <p className={`text-[10px] ${isMine ? 'text-white/30' : 'text-white/20'}`}>· modifié</p>
            )}
          </div>
        )}
        {type === 'sticker' && (
          <div className={`px-4 pb-1 flex items-center gap-1 ${isMine ? 'text-right' : 'text-left'}`}>
            <p className={`text-[10px] ${isMine ? 'text-white/30' : 'text-white/20'}`}>{time}</p>
            {editedAt && (
              <p className={`text-[10px] ${isMine ? 'text-white/30' : 'text-white/20'}`}>· modifié</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
```

**Step 7: Ajouter les helpers et l'import manquant**

En haut du fichier (juste après les imports), ajouter :

```tsx
function handleContextMenuProxy(this: unknown) {
  // placeholder, sera défini plus bas
}
```

En fait, plus simple : on retire le bouton 3-points (devenu redondant avec le clic droit), et on retire donc `handleContextMenuProxy`. Remplacer le bloc `{isMine && onDelete && (...)}` par simplement :

```tsx
      {isMine && onDelete && (
        <div className="pt-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <button
            onClick={() => onDelete?.(id)}
            className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-white/[0.05]"
            title="Supprimer"
            aria-label="Supprimer"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
```

Et retirer l'appel à `handleContextMenuProxy` dans le JSX ci-dessus.

**Step 8: Wrapper pour MessageContextMenu**

Le JSX ci-dessus référence `<MessageContextMenuWrapper ...>`. En haut du fichier, après les imports, ajouter :

```tsx
import MessageContextMenu from './MessageContextMenu'

function MessageContextMenuWrapper(props: React.ComponentProps<typeof MessageContextMenu>) {
  return <MessageContextMenu {...props} />
}
```

**Step 9: Vérifier la compilation**

```bash
cd C:\Users\PC\Documents\message
npx tsc --noEmit
npx eslint src/components/MessageBubble.tsx
```

Attendu : aucune erreur, aucun warning. Si erreurs, ajuster (le plus probable : import React pour `React.ComponentProps`, ou référence à `MessageContextMenu` non résolu).

---

## Task 8: Mettre à jour `MessageList` (passer les nouvelles props)

**Files:**
- Modify: `src/components/MessageList.tsx`

**Step 1: Mettre à jour les props**

Remplacer l'interface `MessageListProps` (lignes 17-21) par :

```ts
interface MessageListProps {
  messages: Message[]
  currentUserId: string
  onDelete?: (id: string) => void
  onReply?: (id: string) => void
  onEdit?: (id: string) => void
  onScrollToMessage?: (id: string) => void
}
```

**Step 2: Mettre à jour la signature du composant**

Remplacer la ligne 23 :

```ts
export default function MessageList({ messages, currentUserId, onDelete, onReply, onEdit, onScrollToMessage }: MessageListProps) {
```

**Step 3: Passer les props à MessageBubble**

Dans le JSX (lignes 41-55), remplacer le `<MessageBubble ... />` par :

```tsx
          <MessageBubble
            key={msg.id}
            id={msg.id}
            content={msg.content}
            type={msg.type}
            url={msg.url}
            duration={msg.duration}
            isMine={msg.userId === currentUserId}
            time={new Date(msg.createdAt).toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
            isConsecutive={isSameUser}
            replyTo={msg.replyTo}
            editedAt={msg.editedAt}
            onDelete={onDelete}
            onReply={onReply}
            onEdit={onEdit}
            onScrollToMessage={onScrollToMessage}
          />
```

**Step 4: Vérifier la compilation**

```bash
cd C:\Users\PC\Documents\message
npx tsc --noEmit
npx eslint src/components/MessageList.tsx
```

Attendu : aucune erreur, aucun warning.

---

## Task 9: Mettre à jour `MessageInput` (modes reply/edit)

**Files:**
- Modify: `src/components/MessageInput.tsx` (lecture complète d'abord pour comprendre la structure)

**Step 1: Lire le fichier actuel**

```bash
cd C:\Users\PC\Documents\message
cat src/components/MessageInput.tsx
```

(Lecture avec l'outil Read).

**Step 2: Planifier les modifications**

Les modifications précises dépendent de la structure actuelle. Les ajouts nécessaires :
- Props : `replyTo?: ReplyRef | null`, `editingMessage?: Message | null`, `onCancel?: () => void`, `onSubmitEdit?: (content: string) => void`.
- State : `content: string` (interne, pour l'input), `prefillFromEdit: boolean` (pour pré-remplir une fois).
- `useEffect` : si `editingMessage` change, pré-remplir `content` avec `editingMessage.content`.
- Bannière au-dessus de l'input (rendue avant la zone d'input actuelle) :
  - Mode reply : "Réponse à [Nom]" + extrait + ✕ → appelle `onCancel`.
  - Mode edit : "Modification du message" + ✕ → appelle `onCancel`.
- `handleSubmit` modifié :
  - Si `editingMessage` → `onSubmitEdit(content)`.
  - Sinon → `onSend({ ...data, replyToId: replyTo?.id ?? null })`.
- Texte du bouton "Envoyer" : "Modifier" en mode edit, "Envoyer" sinon.

**Note :** Les détails d'implémentation exacts (où insérer le JSX de la bannière, comment pré-remplir l'input) dépendent de la structure de `MessageInput.tsx`. L'ingénieur doit lire le fichier avant de modifier.

**Step 3: Appliquer les modifications**

Lire le fichier avec l'outil `read`, puis faire les edits en suivant le pattern ci-dessus. S'assurer que :
1. Le bouton "Envoyer" appelle `onSubmitEdit` en mode edit.
2. Le state `content` est pré-rempli une seule fois quand `editingMessage` change.
3. La bannière montre le bon texte selon le mode.
4. `onCancel` reset proprement les deux states externes (géré dans `ChatClient`).

**Step 4: Vérifier la compilation**

```bash
cd C:\Users\PC\Documents\message
npx tsc --noEmit
npx eslint src/components/MessageInput.tsx
```

Attendu : aucune erreur, aucun warning.

---

## Task 10: Câbler le tout dans `ChatClient`

**Files:**
- Modify: `src/app/chat/ChatClient.tsx`

**Step 1: Ajouter les imports**

En haut du fichier, après les imports existants, ajouter :

```tsx
import { useRef as _useRef } from 'react'
```

Non, ce n'est pas nécessaire. `useRef` n'est pas utilisé. Passer à l'étape suivante.

**Step 2: Ajouter les states**

Après `const [messages, setMessages] = useState<Message[]>(initialMessages)` (ligne 35), ajouter :

```tsx
  const [replyTarget, setReplyTarget] = useState<ReplyRef | null>(null)
  const [editingMessage, setEditingMessage] = useState<Message | null>(null)
```

**Step 3: Ajouter les handlers**

Après `function handleSend(data: SendData) { ... }` (lignes 95-97), ajouter :

```tsx
  function handleReply(messageId: string) {
    const target = messages.find((m) => m.id === messageId)
    if (!target) return
    setReplyTarget({
      id: target.id,
      content: target.content,
      type: target.type,
      user: target.user,
    })
    setEditingMessage(null)
  }

  function handleEdit(messageId: string) {
    const target = messages.find((m) => m.id === messageId)
    if (!target || target.type !== 'text' || target.userId !== currentUserId) return
    setEditingMessage(target)
    setReplyTarget(null)
  }

  function handleCancel() {
    setReplyTarget(null)
    setEditingMessage(null)
  }

  function handleSendWithContext(data: SendData) {
    if (editingMessage) {
      // Mode édition
      fetch(`/api/messages/${editingMessage.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: data.content ?? '' }),
      })
        .then(async (res) => {
          if (!res.ok) {
            console.error('[client] edit failed:', res.status, await res.text())
            return
          }
          const updated = await res.json()
          setMessages((prev) =>
            prev.map((m) =>
              m.id === updated.id
                ? { ...m, content: updated.content, editedAt: updated.editedAt }
                : m
            )
          )
          setEditingMessage(null)
        })
        .catch((err) => console.error('[client] edit error:', err))
      return
    }
    // Mode envoi (avec ou sans reply)
    getSocket(currentUserId).emit('sendMessage', {
      ...data,
      userId: currentUserId,
      replyToId: replyTarget?.id ?? null,
    })
    setReplyTarget(null)
  }
```

**Step 4: Ajouter le handler scroll-to-message**

Après les handlers précédents, ajouter :

```tsx
  function handleScrollToMessage(messageId: string) {
    const el = document.querySelector(`[data-message-id="${messageId}"]`) as HTMLElement | null
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('ring-2', 'ring-white/30')
    setTimeout(() => el.classList.remove('ring-2', 'ring-white/30'), 1500)
  }
```

**Step 5: Mettre à jour le rendu**

Remplacer le `return` (lignes 120-131) par :

```tsx
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
        onSend={handleSendWithContext}
        replyTo={replyTarget}
        editingMessage={editingMessage}
        onCancel={handleCancel}
      />
      <NotificationPrompt />
    </div>
  )
}
```

**Step 6: Ajouter `data-message-id` aux MessageBubble**

Pour que `handleScrollToMessage` fonctionne, chaque `MessageBubble` doit avoir un attribut `data-message-id`. Ouvrir `src/components/MessageList.tsx` et remplacer le `<div ref={bottomRef} />` (ligne 58) par un mécanisme où chaque `MessageBubble` porte cet attribut.

Plus simple : dans `MessageList`, wrapper chaque `MessageBubble` dans un `<div data-message-id={msg.id}>`. Remplacer le `.map(...)` (lignes 37-57) par :

```tsx
      {messages.map((msg, i) => {
        const prev = messages[i - 1]
        const isSameUser = prev?.userId === msg.userId
        return (
          <div key={msg.id} data-message-id={msg.id}>
            <MessageBubble
              id={msg.id}
              content={msg.content}
              type={msg.type}
              url={msg.url}
              duration={msg.duration}
              isMine={msg.userId === currentUserId}
              time={new Date(msg.createdAt).toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
              isConsecutive={isSameUser}
              replyTo={msg.replyTo}
              editedAt={msg.editedAt}
              onDelete={onDelete}
              onReply={onReply}
              onEdit={onEdit}
              onScrollToMessage={onScrollToMessage}
            />
          </div>
        )
      })}
```

**Step 7: Vérifier la compilation**

```bash
cd C:\Users\PC\Documents\message
npx tsc --noEmit
npx eslint src/app/chat/ChatClient.tsx src/components/MessageList.tsx
```

Attendu : aucune erreur, aucun warning.

---

## Task 11: Vérification finale end-to-end

**Step 1: tsc + eslint sur l'ensemble du projet**

```bash
cd C:\Users\PC\Documents\message
npx tsc --noEmit
npx eslint src
```

Attendu : aucune erreur, aucun warning.

**Step 2: Vérifier le dev server**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/chat
```

Attendu : `307` (auth redirect).

**Step 3: Vérification manuelle en navigateur**

Ouvrir deux fenêtres (ou une fenêtre + un onglet en navigation privée) connectées avec `faissal` et `nouria`.

Scénarios à tester :
1. **Réponse à un message texte** : Faïssal envoie "salut". Nouria fait un clic droit (ou long-press sur mobile) sur le message → menu "Répondre" → tape "bien et toi ?" → envoie. Nouria doit voir la citation "salut" au-dessus de sa réponse. Faïssal doit voir la citation "salut" apparaître en temps réel au-dessus de la réponse de Nouria.
2. **Réponse à une image** : envoyer une image, faire un clic droit dessus, répondre avec du texte. La citation doit afficher "📷 Image".
3. **Édition** : Faïssal clique droit sur un de ses messages texte → "Modifier" → change le texte → envoie. Nouria doit voir le texte mis à jour en temps réel, avec "· modifié" à côté de l'heure.
4. **Édition impossible sur média** : clic droit sur une image → "Modifier" ne doit PAS apparaître dans le menu.
5. **Suppression d'un parent** : Nouria répond à un message de Faïssal. Faïssal supprime son message parent. Chez Nouria, la citation doit devenir "Message supprimé" (ou fallback gracieux, pas de crash).
6. **Clic sur citation** : cliquer sur la citation d'un message répondu → la vue doit scroller jusqu'au message parent avec un bref highlight.
7. **Push delete sync** : Faïssal supprime un message. Chez Nouria, le message disparaît sans refresh (vérifier que le fix `globalThis` de la Task précédente tient toujours).

Si un scénario échoue, ouvrir la console du navigateur et `dev.log` pour identifier la régression, puis corriger.

**Step 4: Vérifier le dev log**

```bash
tail -n 30 "C:\Users\PC\Documents\message\dev2.log"
```

Attendu : pas d'erreurs, éventuellement des logs `[socket] sendMessage received:`, `[api/messages] edit broadcast sent for id:` après les actions en navigateur.

---

## Critères de fin

- [ ] tsc clean
- [ ] eslint clean
- [ ] Les 7 scénarios du test manuel passent
- [ ] Aucune régression sur le fix delete-sync existant
