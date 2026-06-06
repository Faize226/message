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

const CHANNEL_NAME = 'chat'

export function subscribeToMessages(
  onChange: (payload: MessageChangePayload) => void
): () => void {
  const channel = supabase
    .channel(CHANNEL_NAME)
    .on<MessageRow>(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'Message' },
      onChange
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

export function trackPresence(
  currentUserId: string,
  onSync: (state: PresenceMap) => void
): () => void {
  const channel = supabase.channel(CHANNEL_NAME, {
    config: { presence: { key: currentUserId } },
  })

  channel
    .on('presence', { event: 'sync' }, () => {
      onSync(channel.presenceState<PresenceState>())
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          user_id: currentUserId,
          online_at: new Date().toISOString(),
        })
      }
    })

  return () => {
    supabase.removeChannel(channel)
  }
}
