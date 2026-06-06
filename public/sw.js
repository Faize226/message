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
