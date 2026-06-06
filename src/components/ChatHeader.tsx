'use client'

import { signOut } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { trackPresence, type PresenceMap } from '@/lib/realtime'
import { LogOut } from 'lucide-react'

interface ChatHeaderProps {
  otherUserName: string
  otherUserId: string
  currentUserId: string
}

export default function ChatHeader({ otherUserName, otherUserId, currentUserId }: ChatHeaderProps) {
  const [isOnline, setIsOnline] = useState(false)

  useEffect(() => {
    const onSync = (state: PresenceMap) => {
      setIsOnline(Object.keys(state).some((key) => key === otherUserId))
    }
    const unsubscribe = trackPresence(currentUserId, onSync)
    return unsubscribe
  }, [otherUserId, currentUserId])

  return (
    <header className="border-b border-white/[0.06] bg-white/[0.02] backdrop-blur-xl px-5 py-3.5 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center w-9 h-9 rounded-full bg-white/[0.06]">
          <span className="text-sm font-medium text-white/70">
            {otherUserName.charAt(0).toUpperCase()}
          </span>
          <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#07070a] transition-colors duration-300 ${isOnline ? 'bg-green-500' : 'bg-white/20'}`} />
        </div>
        <div>
          <h2 className="text-sm font-medium text-white/80">{otherUserName}</h2>
          <p className="text-[11px] text-white/30">{isOnline ? 'En ligne' : 'Hors ligne'}</p>
        </div>
      </div>
      <button
        onClick={() => signOut({ callbackUrl: '/auth' })}
        className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-white/[0.04]"
      >
        <LogOut className="h-3.5 w-3.5" />
        Quitter
      </button>
    </header>
  )
}
