# Design — Notifications Push Web

**Date** : 2026-06-06
**Statut** : Approuvé
**Cible** : Nouria (Android Chrome) reçoit une notification système quand Faïssal envoie un message, même si l'app n'est pas ouverte.

## Contexte & contraintes

- App actuelle : Next.js 16.2.7 + Prisma + SQLite + NextAuth v5 + Socket.io + Supabase Storage
- 2 utilisateurs : `faissal` et `nouria`
- HTTPS disponible (déployé en ligne)
- Cible : Android Chrome (Web Push natif, pas de PWA install requise)
- Pas de compte externe, pas de SDK tiers — Web Push API standard

## Approche retenue

**Web Push API** (auto-hébergé, standard, gratuit). Pas de Firebase ni OneSignal.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Setup (une fois)                                            │
│                                                             │
│ 1. Génération clés VAPID (paire public/privé)               │
│    → privée dans .env (serveur)                            │
│    → publique dans NEXT_PUBLIC_ (client)                   │
│                                                             │
│ 2. Service Worker enregistré sur le domaine                 │
│    → public/sw.js (écoute les events 'push')               │
│                                                             │
│ 3. Permission navigateur + souscription                     │
│    → Notification.requestPermission()                       │
│    → pushManager.subscribe({applicationServerKey: VAPID})   │
│    → subscription envoyée à /api/push/subscribe            │
│    → stockée en DB liée à l'utilisateur                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Envoi d'un message (à chaque nouveau message)              │
│                                                             │
│ Faïssal → socket.emit('sendMessage')                       │
│   → serveur: save en DB                                    │
│   → serveur: io.to('room:global').emit('newMessage')       │
│   → serveur: destinataire en ligne ?                       │
│       OUI → stop, le socket s'en charge                     │
│       NON → web-push.sendNotification(subscription, payload)│
│           → SW de Nouria reçoit 'push'                     │
│           → SW.showNotification(titre, body, icon, ...)     │
└─────────────────────────────────────────────────────────────┘
```

**Règle clé** : push envoyé **uniquement si destinataire hors ligne** (sinon double-notif socket + push). On utilise `userSocketCount` déjà en place côté serveur.

## Schéma DB

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

Ajouter `pushSubscriptions PushSubscription[]` dans `User`.

## Fichiers

### À créer

| Fichier | Rôle |
|---|---|
| `public/sw.js` | Service Worker — events `push` + `notificationclick` |
| `public/icon.png` | Icône des notifications (192×192) |
| `src/lib/push-server.ts` | Wrapper `web-push` (VAPID, sendNotification) |
| `src/lib/push-client.ts` | `registerSW`, `subscribeToPush`, `unsubscribeFromPush`, `urlBase64ToUint8Array` |
| `src/app/api/push/subscribe/route.ts` | POST : enregistre subscription |
| `src/app/api/push/unsubscribe/route.ts` | POST : supprime subscription |
| `src/components/NotificationPrompt.tsx` | Bandeau flottant demande permission + subscribe |

### À modifier

| Fichier | Modification |
|---|---|
| `prisma/schema.prisma` | Ajout modèle `PushSubscription` |
| `src/lib/socket.ts` | Dans `sendMessage` : push si destinataire hors ligne |
| `src/app/chat/ChatClient.tsx` | `registerSW()` au mount, rend `<NotificationPrompt />` |
| `.env` | `VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_SUBJECT` |
| `package.json` | Dépendance `web-push` (+ `@types/web-push` en dev) |

## Contenu de la notification

- **Title** : nom de l'expéditeur (`Faïssal` ou `Nouria`)
- **Body** :
  - `text` → contenu tronqué à 100 chars
  - `image` → `📷 Image`
  - `video` → `🎥 Vidéo`
  - `audio` → `🎤 Message vocal`
  - `gif` → `🎬 GIF`
  - `sticker` → `😀 Sticker`
- **Icon** : `/icon.png`
- **Tag** : `message` (regroupe)
- **Vibrate** : `[200, 100, 200]`
- **Click** : focus l'onglet `/chat` ou l'ouvre

## Cas limites

| Cas | Comportement |
|---|---|
| Subscription expirée (410 Gone) | Supprimée auto de la DB |
| Pas de subscription | Skip silencieux |
| Destinataire en ligne | Pas de push (socket gère) |
| Message supprimé après envoi | Push déjà parti, pas de retraction |
| Texte > 100 chars | Tronqué avec `…` |
| Multi-appareils (PC + tel) | v1 : 1 subscription/user, YAGNI |

## UX du NotificationPrompt

- Flottant en bas, centré, glassmorphism
- S'affiche **seulement** si `Notification.permission === 'default'`
- `granted` ou `denied` → caché
- Click "Activer" → `requestPermission()` → `subscribeToPush()` → POST en DB → disparu
- "× Plus tard" ferme temporairement (réapparaît au reload)

## Variables d'environnement

```
VAPID_PRIVATE_KEY=<généré par web-push>
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<généré par web-push>
VAPID_SUBJECT=mailto:admin@example.com
```

Génération : `npx web-push generate-vapid-keys`

## Test end-to-end

1. Générer VAPID keys, ajouter à `.env`
2. `npx prisma db push` (crée la table)
3. `npm install web-push`
4. Déployer (HTTPS) ou ngrok
5. Téléphone : login, bandeau "Activer", autoriser
6. Fermer l'onglet téléphone
7. Envoyer message depuis l'autre navigateur
8. → Notification push sur le téléphone
