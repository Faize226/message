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
    console.error('[push] unsubscribe failed:', err)
  }
}

export function getNotificationPermission(): NotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'denied'
  return Notification.permission
}
