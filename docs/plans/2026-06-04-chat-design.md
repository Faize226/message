# Chat privé à deux — Design Document

## Stack technique
- **Framework** : Next.js 14+ (App Router)
- **Base de données** : SQLite via Prisma ORM
- **Authentification** : NextAuth.js (Credentials provider)
- **Temps réel** : Socket.io
- **Style** : Tailwind CSS (dark theme)
- **Langue** : Français (interface + code)

## Pages
- `/auth` — Connexion (email + mot de passe), pas d'inscription
- `/chat` — Interface de chat unique (protégée, redirection si non connecté)
- `/` — Redirection vers `/chat` ou `/auth`

## Modèle de données
- **User** : id (cuid), name, email (unique), password (hashé par bcrypt), createdAt
- **Message** : id (cuid), content, userId, conversationId, createdAt

Deux utilisateurs seedés en BDD (via `prisma/seed.ts`). Une seule conversation pré-créée entre eux au seed.

## Composants UI
- **AuthForm** — Formulaire de connexion (email + mot de passe), design minimal centré
- **ChatLayout** — Layout protégé avec vérification de session
- **ChatHeader** — Nom du correspondant + statut connecté/déconnecté (Socket.io)
- **MessageList** — Liste des messages scrollable, scroll automatique en bas
- **MessageBubble** — Bulle de message (droite = moi, gauche = autre)
- **MessageInput** — Champ de texte + bouton d'envoi, fixe en bas

## Flux
1. Seed : création de 2 users + 1 conversation
2. Utilisateur arrive sur `/` → redirection vers `/auth` si non connecté, `/chat` si connecté
3. Connexion via email/mdp → vérification bcrypt → session NextAuth
4. Arrivée sur `/chat` → connexion Socket.io → chargement des messages existants
5. Envoi d'un message → Socket.io émet "sendMessage" → sauvegarde BDD → broadcast "newMessage"
6. Réception en temps réel → message s'affiche sans rechargement
7. Statut en ligne : Socket.io émet "userOnline"/"userOffline"

## Palette (dark theme)
- Fond : `#0a0a0a` (principal), `#1a1a2e` (surfaces)
- Accent : `#3b82f6` (bleu), `#8b5cf6` (violet)
- Texte : `#f1f5f9` (primaire), `#94a3b8` (secondaire)
- Bulles : `#3b82f6` (moi), `#1e293b` (autre)
