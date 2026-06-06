'use client'

import { supabase } from './supabase'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

export interface MessageRow {
  id: string
  content: string | null
  type: string
  url: string | null
  duration: number | null
  userId: string
  replyToId: string | null
  createdAt: string
  editedAt: string | null
}

export type MessageChangePayload = RealtimePostgresChangesPayload<MessageRow>

export interface PresenceState {
  user_id: string
  online_at: string
}

export type PresenceMap = Record<string, PresenceState[]>

// Noms distincts : supabase-js partage l'objet RealtimeChannel pour un même topic.
// Si on utilisait le même nom pour postgres_changes et presence, le second
// `supabase.channel('chat')` retournerait le canal déjà subscribed, et
// ajouter un listener après subscribe() lève l'erreur
// "cannot add postgres_changes callbacks for realtime:chat after subscribe()".
const MESSAGES_CHANNEL = 'chat-messages'
const PRESENCE_CHANNEL = 'chat-presence'

/**
 * Subscribe to all changes (INSERT/UPDATE/DELETE) on the Message table.
 * Wrapped in try/catch to never crash the page if Realtime is misconfigured
 * (missing env vars, invalid URL, etc.) — the chat still works without realtime.
 */
export function subscribeToMessages(
  onChange: (payload: MessageChangePayload) => void
): () => void {
  try {
    const channel = supabase
      .channel(MESSAGES_CHANNEL)
      .on<MessageRow>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Message' },
        onChange
      )
      .subscribe()

    return () => {
      try {
        supabase.removeChannel(channel)
      } catch (e) {
        console.error('[realtime] removeChannel (messages) failed:', e)
      }
    }
  } catch (e) {
    console.error('[realtime] subscribeToMessages failed:', e)
    return () => {}
  }
}

/**
 * Track current user's presence in the chat channel.
 * Wrapped in try/catch for the same reasons as above.
 */
export function trackPresence(
  currentUserId: string,
  onSync: (state: PresenceMap) => void
): () => void {
  let channel: ReturnType<typeof supabase.channel> | null = null
  try {
    channel = supabase.channel(PRESENCE_CHANNEL, {
      config: { presence: { key: currentUserId } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        if (!channel) return
        onSync(channel.presenceState<PresenceState>())
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && channel) {
          await channel.track({
            user_id: currentUserId,
            online_at: new Date().toISOString(),
          })
        }
      })
  } catch (e) {
    console.error('[realtime] trackPresence failed:', e)
  }

  return () => {
    if (!channel) return
    try {
      supabase.removeChannel(channel)
    } catch (e) {
      console.error('[realtime] removeChannel (presence) failed:', e)
    }
  }
}
