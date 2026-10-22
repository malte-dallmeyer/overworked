// Service worker: makes Overworked installable, and is where web push will arrive.
// No offline cache on purpose: without the server the app has nothing reliable to show.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
