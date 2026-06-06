# Push Notifications Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Envoyer une notification push système à Nouria (Android Chrome) quand Faïssal envoie un message, même si l'app n'est pas ouverte au premier plan.

**Architecture:** Web Push API standard avec `web-push` côté serveur et un Service Worker côté client. Le push n'est envoyé que si le destinataire n'est pas connecté via Socket.io (évite la double-notification). Subscription stockée en DB (SQLite via Prisma), liée à l'utilisateur.

**Tech Stack:** Next.js 16.2.7, Prisma 6 + SQLite, Socket.io 4, `web-push` (npm), Service Worker natif, VAPID.

**Note testing:** Ce projet n'a pas de framework de test configuré. Les vérifications sont manuelles (curl, navigateur, console). Les commandes de vérification sont données pour chaque tâche.

---

## Task 1: Installer web-push et générer les clés VAPID

**Files:**
- Modify: `package.json` (via npm install)
- Modify: `.env`

**Step 1: Installer les dépendances**

```bash
cd C:\Users\PC\Documents\message
npm install web-push
npm install -D @types/web-push
```

**Step 2: Générer les clés VAPID**

```bash
npx web-push generate-vapid-keys
```

Sortie attendue (deux lignes, une commençant par `Public Key:`, l'autre par `Private Key:`).

**Step 3: Ajouter les clés au `.env`**

Ouvrir `.env` et ajouter à la fin :

```
VAPID_PRIVATE_KEY=<la_clé_privée_générée>
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<la_clé_publique_générée>
VAPID_SUBJECT=mailto:admin@example.com
```

**Step 4: Vérifier l'installation**

```bash
cd C:\Users\PC\Documents\message
npx tsc --noEmit
```

Attendu : aucune erreur (les types de `web-push` sont connus).

**Step 5: Commit (optionnel, si repo git)**

```bash
git add package.json package-lock.json .env
git commit -m "chore: add web-push and VAPID keys"
```

---

## Task 2: Ajouter le modèle PushSubscription à Prisma

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Ajouter le modèle et la relation**

Dans `prisma/schema.prisma`, ajouter le modèle `PushSubscription` à la fin (avant le `model Message` ou après, peu importe) :

```prisma
model PushSubscription {
  id        String   @id @default(cuid())
  userId    String
  endpoint  String   @unique
  p256dh    String
  auth      String
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

Dans le `model User` existant, ajouter le champ relation :

```prisma
model User {
  id               String            @id @default(cuid())
  username         String            @unique
  name             String?
  password         String
  createdAt        DateTime          @default(now())
  messages         Message[]
  pushSubscriptions PushSubscription[]
}
```

**Step 2: Pousser le schéma vers la DB**

```bash
cd C:\Users\PC\Documents\message
npx prisma db push
```

Attendu : `Your database is now in sync with your schema.`

⚠️ Note : si des données existent et que la migration touche des tables existantes, Prisma demandera confirmation. Les nouvelles tables (PushSubscription) n'affectent pas les données existantes.

**Step 3: Régénérer le client Prisma**

```bash
cd C:\Users\PC\Documents\message
npx prisma generate
```

Attendu : `Generated Prisma Client`.

**Step 4: Vérifier le typage**

```bash
cd C:\Users\PC\Documents\message
npx tsc --noEmit
```

Attendu : aucune erreur.

**Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(db): add PushSubscription model"
```

---

## Task 3: Créer le Service Worker (public/sw.js)

**Files:**
- Create: `public/sw.js`

**Step 1: Créer le fichier**

Créer `public/sw.js` avec le contenu suivant (version durcie : validation same-origin, parsing défensif, comparaison de chemin stricte) :

```js
// Service Worker — gestion des notifications push
// Ce fichier est servi depuis /sw.js (racine publique)

function safeSameOriginPath(target) {
  try {
    const url = new URL(target, self.location.origin)
    if (url.origin !== self.location.origin) return null
    return url.pathname + url.search + url.hash
  } catch {
    return null
  }
}

self.addEventListener('push', (event) => {
  let data = { title: 'Nouveau message', body: '', url: '/chat' }

  if (event.data) {
    let payload
    try {
      payload = event.data.json()
    } catch {
      try {
        data.body = event.data.text()
      } catch {
        // payload binaire ou illisible : on garde les défauts
      }
    }
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      data = { ...data, ...payload }
    } else if (typeof payload === 'string') {
      data.body = payload
    }
  }

  const safeUrl = safeSameOriginPath(data.url || '/chat') || '/chat'

  const options = {
    body: data.body,
    icon: data.icon || '/icon.png',
    badge: data.badge || '/icon.png',
    tag: data.tag || 'message',
    data: { url: safeUrl },
    vibrate: [200, 100, 200],
    requireInteraction: false,
  }

  event.waitUntil(self.registration.showNotification(data.title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/chat'

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (
            'focus' in client &&
            new URL(client.url, self.location.origin).pathname === targetUrl
          ) {
            return client.focus()
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(targetUrl)
        }
      })
      .catch((err) => console.error('[sw] notificationclick failed:', err))
  )
})
```

**Note durcissement (revue qualité code) :**
- `safeSameOriginPath` rejette toute URL hors du même origin (anti open-redirect via push malveillant) — l'URL validée est stockée dans `options.data.url` et c'est elle qui est utilisée au click.
- Le parsing JSON est entouré d'un `try/catch` ; le fallback `text()` a son propre `try/catch` (un payload binaire ne fait plus crasher le handler).
- Le payload n'est spread que s'il s'agit d'un objet plain (pas un array, pas une string, pas un number) — évite `[object Object]` comme body.
- La comparaison `client.url` utilise `pathname === targetUrl` au lieu d'`includes` (plus strict, pas de faux positifs type `/chats`).
- Le chainage du `notificationclick` se termine par un `.catch()` qui logge les échecs.

**Step 2: Vérifier que le SW est servi**

Le serveur dev doit tourner. Tester :

```bash
curl http://localhost:3000/sw.js
```

Attendu : le contenu du fichier `sw.js` est retourné (headers `Content-Type: application/javascript` ou `text/javascript`).

Si Next.js ne sert pas le fichier depuis `public/`, vérifier que le fichier est bien dans `C:\Users\PC\Documents\message\public\sw.js` et redémarrer le serveur dev.

**Step 3: Commit**

```bash
git add public/sw.js
git commit -m "feat(sw): add service worker for push notifications"
```

---

## Task 4: Créer le helper serveur (src/lib/push-server.ts)

**Files:**
- Create: `src/lib/push-server.ts`

**Step 1: Créer le fichier**

```ts
import webpush from 'web-push'

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@example.com'

let configured = false

function configure() {
  if (configured) return
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    throw new Error('VAPID keys are not configured in environment variables')
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
  configured = true
}

export interface PushPayload {
  title: string
  body: string
  url?: string
  icon?: string
  tag?: string
}

export interface PushSub {
  endpoint: string
  p256dh: string
  auth: string
}

export async function sendPushNotification(
  subscription: PushSub,
  payload: PushPayload
): Promise<void> {
  configure()
  await webpush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth },
    },
    JSON.stringify(payload)
  )
}

export function isPushConfigured(): boolean {
  return Boolean(VAPID_PUBLIC && VAPID_PRIVATE)
}
```

**Step 2: Vérifier le typage**

```bash
cd C:\Users\PC\Documents\message
npx tsc --noEmit
```

Attendu : aucune erreur.

**Step 3: Commit**

```bash
git add src/lib/push-server.ts
git commit -m "feat(push): add server-side web-push helper"
```

---

## Task 5: Créer les helpers client (src/lib/push-client.ts)

**Files:**
- Create: `src/lib/push-client.ts`

**Step 1: Créer le fichier**

```ts
'use client'

export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    output[i] = rawData.charCodeAt(i)
  }
  return output
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null
  try {
    const registration = await navigator.serviceWorker.register('/sw.js')
    console.log('[push] service worker registered:', registration.scope)
    return registration
  } catch (err) {
    console.error('[push] service worker registration failed:', err)
    return null
  }
}

export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (typeof window === 'undefined') return null
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!vapidKey) {
    console.error('[push] VAPID public key is not defined')
    return null
  }

  try {
    const registration = await navigator.serviceWorker.ready
    let subscription = await registration.pushManager.getSubscription()

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })
    }

    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription.toJSON()),
    })

    if (!res.ok) {
      console.error('[push] subscribe API failed:', res.status)
      return null
    }

    console.log('[push] subscribed successfully')
    return subscription
  } catch (err) {
    console.error('[push] subscribe failed:', err)
    return null
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (subscription) {
      const res = await fetch('/api/push/unsubscribe', { method: 'POST' })
      if (!res.ok) {
        console.error('[push] unsubscribe API failed:', res.status)
      }
      await subscription.unsubscribe()
      console.log('[push] unsubscribed')
    }
  } catch (err) {
    console.error('[socket] push logic error:', err)
  }
}
```

**Note durcissement (revue qualité code) :**
- **Table de lookup au lieu de ternary imbriqué** : les aperçus par type sont dans un `Record<string, string>` (image/video/audio/gif/sticker). Plus lisible, plus facile à étendre.
- **Fallback pour texte vide** : si `type === 'text'` mais que `content` est vide ou uniquement des espaces, on tombe sur `'Nouveau message'` au lieu d'envoyer une notif avec un body vide (qui ressemble à du spam).

**Step 3: Vérifier le typage**

```bash
cd C:\Users\PC\Documents\message
npx tsc --noEmit
```

Attendu : aucune erreur.

**Step 4: Tester visuellement**

Ouvrir le chat dans le navigateur. En bas de l'écran, le bandeau "Activer les notifications" doit apparaître. Cliquer sur "× Plus tard" → le bandeau disparaît. Recharger la page → le bandeau réapparaît (car `permission === 'default'`).

**Step 5: Commit**

```bash
git add src/app/chat/ChatClient.tsx
git commit -m "feat(chat): register SW and show notification prompt"
```

---

## Task 10: Intégrer le push dans le handler sendMessage du socket

**Files:**
- Modify: `src/lib/socket.ts`

**Step 1: Ajouter les imports**

En haut du fichier, ajouter :

```ts
import { sendPushNotification, isPushConfigured } from './push-server'
import { Prisma } from '@prisma/client'
```

**Step 2: Modifier le handler sendMessage**

Remplacer le bloc `io?.to('room:global').emit('newMessage', message)` par :

```ts
io?.to('room:global').emit('newMessage', message)
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
```

**Step 3: Vérifier le typage**

```bash
cd C:\Users\PC\Documents\message
npx tsc --noEmit
```

Attendu : aucune erreur.

**Step 4: Tester le flux complet (nécessite HTTPS — déploiement)**

Voir la Task 12 pour le test end-to-end.

**Step 5: Commit**

```bash
git add src/lib/socket.ts
git commit -m "feat(socket): send push notification to offline recipients"
```

---

## Task 11: Ajouter une icône de notification (public/icon.png)

**Files:**
- Create: `public/icon.png`

**Step 1: Créer ou ajouter l'icône**

Option A — utiliser un placeholder : créer un PNG 192×192 simple (fond `#0e0e14`, lettre `M` centrée en blanc). Utiliser n'importe quel outil (Figma, Photoshop, ou un convertisseur en ligne).

Option B — utiliser une icône existante : copier n'importe quel PNG 192×192 dans `public/icon.png`.

Option C — ignorer pour l'instant : le navigateur utilisera son icône par défaut. La notif fonctionnera quand même.

**Step 2: Vérifier l'accessibilité**

Avec le serveur dev qui tourne :

```bash
curl -I http://localhost:3000/icon.png
```

Attendu : `HTTP/1.1 200 OK` et `Content-Type: image/png`.

**Step 3: Commit (si icône créée)**

```bash
git add public/icon.png
git commit -m "chore: add notification icon"
```

---

## Task 12: Test end-to-end (nécessite HTTPS)

**Prérequis :**
- Code déployé sur un domaine HTTPS (Vercel, ou tunnel ngrok)
- Clés VAPID configurées dans `.env` du serveur déployé
- `npx prisma db push` exécuté sur la DB de production
- `web-push` installé (`npm install web-push` dans le déploiement)

**Étapes de test :**

1. **Sur le téléphone (Android Chrome) :**
   - Ouvrir l'URL HTTPS de l'app
   - Se connecter en tant que **Nouria**
   - Le bandeau "Activer les notifications" apparaît en bas
   - Cliquer "Activer"
   - Le navigateur demande la permission → cliquer "Autoriser"
   - Vérifier dans la console : `[push] subscribed successfully`

2. **Vérifier la DB :**
   ```bash
   npx prisma studio
   ```
   → Table `PushSubscription` doit contenir une entrée pour Nouria.

3. **Tester l'envoi de push :**
   - Sur le téléphone, **fermer l'onglet** (ou mettre en arrière-plan)
   - Sur l'ordinateur, se connecter en tant que **Faïssal**
   - Envoyer un message texte à Nouria
   - → Une notification push doit apparaître sur le téléphone

4. **Tester le cas "en ligne" :**
   - Sur le téléphone, rouvrir l'onglet du chat
   - Envoyer un autre message depuis Faïssal
   - → Pas de push (le socket gère, l'app affiche le message en temps réel)
   - Vérifier dans la console serveur : absence de `[socket] push sent to:`

5. **Tester le cas "subscription expirée" :**
   - Sur le téléphone, aller dans `chrome://settings/notifications` (ou Paramètres du site)
   - Révoquer la permission pour le site
   - Envoyer un message depuis Faïssal
   - → Côté serveur : `[socket] expired push subscription removed for: nouria`
   - Vérifier en DB : la subscription de Nouria n'existe plus

**Si ça ne marche pas, débugger :**
- Console navigateur (téléphone) : erreurs `Notification`, `PushManager`, `serviceWorker`
- Console serveur : logs `[socket] push sent` ou erreurs
- `chrome://gcm-internals/` sur le téléphone desktop pour voir l'état des pushes Google
- Vérifier que le SW est bien enregistré : `chrome://serviceworker-internals/`

---

## Résumé des fichiers touchés

**Créés (9) :**
- `public/sw.js`
- `public/icon.png` (optionnel)
- `src/lib/push-server.ts`
- `src/lib/push-client.ts`
- `src/app/api/push/subscribe/route.ts`
- `src/app/api/push/unsubscribe/route.ts`
- `src/components/NotificationPrompt.tsx`

**Modifiés (4) :**
- `prisma/schema.prisma`
- `src/lib/socket.ts`
- `src/app/chat/ChatClient.tsx`
- `package.json` + `package-lock.json`
- `.env`

**Variables d'env ajoutées :**
- `VAPID_PRIVATE_KEY`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_SUBJECT`
