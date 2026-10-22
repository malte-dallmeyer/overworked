// Service worker: makes Overworked installable and shows the alarm as web push.
// No offline cache on purpose: without the server the app has nothing reliable to show.
// The payloads come from backend/src/overworked/push.py.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  const message = event.data?.json()
  if (!message) return
  if (message.type === 'clear') {
    event.waitUntil(closeAll(message.tag))
    return
  }
  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      // Same tag: a repeat replaces the earlier notification, and with renotify it alerts again.
      tag: message.tag ?? undefined,
      renotify: Boolean(message.tag),
      requireInteraction: message.urgent,
      silent: !message.urgent,
      actions: message.actions.map(({ action, title }) => ({ action, title })),
      data: { click: message.click, actions: message.actions },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  const { click, actions } = event.notification.data ?? {}
  event.notification.close()
  const button = actions?.find((a) => a.action === event.action)
  // A button ("Feierabend", "10 min später") calls its URL, like in ntfy; a click opens the app.
  event.waitUntil(button ? fetch(button.url, { method: 'POST' }) : openApp(click ?? '/'))
})

async function closeAll(tag) {
  const notifications = await self.registration.getNotifications({ tag })
  notifications.forEach((n) => n.close())
}

async function openApp(url) {
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  const open = windows.find((w) => new URL(w.url).origin === self.location.origin)
  return open ? open.focus() : self.clients.openWindow(url)
}
