# Design : Réponse & Édition de messages

**Date** : 2026-06-06
**Statut** : Approuvé
**Pré-requis** : bug de synchro temps-réel des suppressions résolu (`src/lib/socket.ts` utilise `globalThis` pour partager l'instance `io`).

## Objectif

Permettre à chaque utilisateur de :
1. **Répondre** à n'importe quel message du chat (citation au-dessus, type WhatsApp/Telegram).
2. **Modifier** ses propres messages texte (avec marqueur "modifié", sans limite de temps).

Les deux features doivent fonctionner en temps réel pour les deux participants.

## Modèle de données

Ajout de deux colonnes à la table `Message` (Prisma) :

```prisma
model Message {
  // ... existants
  replyToId String?
  replyTo   Message?  @relation("MessageReplies", fields: [replyToId], references: [id], onDelete: SetNull)
  replies   Message[] @relation("MessageReplies")
  editedAt  DateTime?
}
```

- `replyToId` : FK self-référentiel optionnel. `onDelete: SetNull` pour que la suppression d'un message parent n'efface pas les réponses (la citation affichera "Message supprimé").
- `editedAt` : timestamp de la dernière édition. `null` = jamais modifié.

Migration : `prisma db push` (workflow actuel du projet).

## Forme client des messages

Chaque message enrichi avec :

```ts
interface Message {
  id: string
  content: string | null
  type: string
  url: string | null
  duration: number | null
  userId: string
  createdAt: string
  editedAt: string | null       // NOUVEAU
  replyTo: ReplyRef | null      // NOUVEAU
  user: { id: string; name: string | null; username: string | null }
}

interface ReplyRef {
  id: string
  content: string | null
  type: string
  user: { name: string | null; username: string | null }
}
```

## API

### `GET /api/messages` (modifié)

Ajout à l'include Prisma :
```ts
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
}
select: { ..., editedAt: true }
```

Le mapping en sortie ajoute `replyTo: m.replyTo ? { ... } : null` et `editedAt: m.editedAt?.toISOString() ?? null`.

### `src/app/chat/page.tsx` (modifié)

Même enrichissement que l'API : le SSR initial renvoie la même forme de message.

### `PATCH /api/messages/[id]` (nouveau)

- Auth requise (`auth()` + résolution username).
- Charge le message. 404 si introuvable. 403 si `message.userId !== currentUser.id`.
- 400 si `message.type !== 'text'`.
- Body : `{ content: string }` (validé non-vide, max 4000 chars).
- Update : `content` + `editedAt: new Date()`.
- Broadcast : `io.to('room:global').emit('messageEdited', { id, content, editedAt: editedAt.toISOString() })`.
- Retourne le message mis à jour (forme client complète).

## Événements Socket.io

### Nouveau (serveur → client)

- **`messageEdited`** : `{ id: string, content: string | null, editedAt: string }` — émis par le PATCH route.

### Modifié (client → serveur)

- **`sendMessage`** : payload enrichi avec `replyToId?: string | null` (le serveur le persiste tel quel sur `prisma.message.create`).

### Listener client (ChatClient)

```ts
socket.on('messageEdited', ({ id, content, editedAt }) => {
  setMessages((prev) => prev.map((m) => m.id === id ? { ...m, content, editedAt } : m))
})
```

## UI

### Nouveau composant : `MessageContextMenu`

Déclenché par :
- **Mobile** : `onTouchStart` + timer 500ms (long-press)
- **Desktop** : `onContextMenu` (clic droit, `preventDefault` pour bloquer le menu natif)

Positionnement : `position: fixed` calculé depuis les coordonnées du touch / clic, contraint aux bords de la fenêtre.

Affiche un menu avec 1 à 3 actions selon le contexte :
- **Répondre** (toujours)
- **Modifier** (si `isMine && type === 'text'`)
- **Supprimer** (si `isMine`)

Fermeture : clic ailleurs, scroll (`addEventListener('scroll', close, true)` en capture), Escape, sélection d'une action, ou unmount.

### `MessageBubble` (modifié)

- Retire le menu 3-points actuel (suppression déplacée dans le context menu).
- Si `msg.replyTo` est non-null, affiche un bloc de citation **au-dessus** du contenu de la bulle :
  - Bordure gauche colorée (couleur du sender)
  - Nom de l'auteur en petit, en gras
  - Contenu tronqué à 1-2 lignes (ellipsis), ou aperçu adapté au type :
    - `image` : "📷 Image"
    - `video` : "🎥 Vidéo"
    - `audio` : `🎤 Message vocal (0:42)`
    - `sticker` : "😀 Sticker"
    - `gif` : "🎬 GIF"
  - Si le parent a été supprimé (`replyTo` existe mais vide en DB) : afficher "Message supprimé" en italique grisé.
  - **Clic sur la citation** : scroll fluide vers le message parent (`scrollIntoView` + highlight bref).
- Si `msg.editedAt` est non-null, affiche `· modifié` après l'heure (texte `text-[10px] text-white/30`).
- Ajout des props `onReply?: (msg: Message) => void`.

### `MessageInput` (modifié)

Nouveau state interne : `mode: { type: 'send' } | { type: 'reply', target: ReplyRef } | { type: 'edit', message: Message }`.

Bannière contextuelle au-dessus de l'input :
- **Mode reply** : "Réponse à **[Nom]**" + extrait cité + bouton ✕.
- **Mode edit** : "Modification du message" + ✕.
- **Mode send** : pas de bannière.

En mode edit, l'input est pré-rempli avec le contenu actuel. Le bouton "Envoyer" devient "Modifier" et déclenche `onSubmitEdit` au lieu de `onSubmit`.

Props modifiées :
- `replyTo?: ReplyRef | null`
- `editingMessage?: Message | null`
- `onSend: (data: SendData & { replyToId?: string | null }) => void`
- `onCancel: () => void` (quitte le mode reply/edit)
- `onSubmitEdit: (content: string) => void`

### `MessageList` (modifié)

- Ajout des props `onReply?: (msg: Message) => void`.
- Passe `onReply` à `MessageBubble`.

### `ChatClient` (modifié)

Nouveaux states :
```ts
const [replyTarget, setReplyTarget] = useState<ReplyRef | null>(null)
const [editingMessage, setEditingMessage] = useState<Message | null>(null)
```

Handlers :
- `handleReply(msg)` : `setReplyTarget({ id, content, type, user: msg.user })`, focus l'input via ref.
- `handleEdit(msg)` : `setEditingMessage(msg)`, focus + sélectionne le texte dans l'input.
- `handleSend(data)` : si `editingMessage` → `PATCH /api/messages/[editingMessage.id]` avec `data.content`. Sinon → `socket.emit('sendMessage', { ...data, replyToId: replyTarget?.id ?? null })`.
- `handleCancelMode()` : reset les deux states.

Le listener `messageEdited` met à jour le state `messages` avec un map immutable.

Passe `replyTo` et `editingMessage` à `<MessageInput>`, `onReply` à `<MessageList>`.

## Hors-scope (YAGNI)

- Historique des versions éditées
- Édition de médias (remplacement de fichier image/vidéo/audio)
- Chaînes de citations au-delà du parent direct
- Push notifications pour les edits/replies
- Indicateurs "en train d'écrire"
- Accusés de lecture

## Critères d'acceptation

1. ✅ Clic droit / long-press sur n'importe quel message ouvre le menu contextuel.
2. ✅ "Répondre" affiche la bannière de citation au-dessus de l'input, et la nouvelle réponse porte la citation dans le chat.
3. ✅ Toute réponse (texte, image, vidéo, audio, sticker, GIF) fonctionne, et cite tout type de message.
4. ✅ "Modifier" n'apparaît que sur ses propres messages texte, et met à jour le contenu en place avec marqueur "modifié".
5. ✅ L'autre participant voit la réponse / l'édition en temps réel (sans refresh).
6. ✅ L'édition est possible sans limite de temps.
7. ✅ Supprimer un message parent n'efface pas les réponses, mais la citation devient "Message supprimé".
8. ✅ Clic sur une citation scrolle jusqu'au message parent.
9. ✅ Les suppressions temps-réel continuent de fonctionner (pas de régression du fix `globalThis`).
10. ✅ `tsc --noEmit` et `eslint` restent clean.

## Risques connus

- **Migration en prod** : `prisma db push` ajoute 2 colonnes. Pas de backfill nécessaire (`null` est l'état par défaut).
- **Anciens messages** : tous les messages existants auront `replyTo: null` et `editedAt: null` après migration. Comportement identique à aujourd'hui.
- **Performance** : l'include `replyTo` ajoute une jointure par message. Sur 2 users avec quelques milliers de messages, négligeable. Si le chat grossit, basculer en lazy-load (ne charger le `replyTo` que des X derniers messages).
