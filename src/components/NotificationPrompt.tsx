'use client'

import { useEffect, useState } from 'react'
import { Bell, X } from 'lucide-react'
import {
  getNotificationPermission,
  subscribeToPush,
} from '@/lib/push-client'

export default function NotificationPrompt() {
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [dismissed, setDismissed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Lecture de Notification.permission après le montage pour éviter
    // un mismatch d'hydratation (le serveur rend avec 'default', le client
    // doit d'abord rendre la même chose puis se mettre à jour).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPermission(getNotificationPermission())
  }, [])

  if ((permission === 'granted' || permission === 'denied' || dismissed) && !error) {
    return null
  }

  async function handleEnable() {
    setLoading(true)
    setError(null)
    try {
      const result = await Notification.requestPermission()
      setPermission(result)
      if (result === 'granted') {
        const subscription = await subscribeToPush()
        if (!subscription) {
          setError("Impossible d'activer les notifications. Réessaye.")
        }
      }
    } catch (err) {
      console.error('[prompt] enable failed:', err)
      setError("Impossible d'activer les notifications. Réessaye.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[min(28rem,calc(100vw-2rem))] animate-dialog-content">
      <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#0e0e14]/90 backdrop-blur-xl shadow-2xl px-4 py-3">
        <div className="shrink-0 w-9 h-9 rounded-full bg-[#3b82f6]/15 flex items-center justify-center">
          <Bell className="h-4 w-4 text-[#3b82f6]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white/90 font-medium">Activer les notifications</p>
          <p className={error ? 'text-xs text-red-400' : 'text-xs text-white/50'}>
            {error ?? 'Reçois une alerte à chaque nouveau message'}
          </p>
        </div>
        <button
          onClick={handleEnable}
          disabled={loading}
          className="shrink-0 h-8 px-3.5 rounded-lg bg-white text-[#07070a] text-sm font-medium hover:bg-white/90 disabled:opacity-50 transition-colors"
        >
          {loading ? '...' : 'Activer'}
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 w-7 h-7 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.05] flex items-center justify-center"
          aria-label="Plus tard"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
