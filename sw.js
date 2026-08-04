const RELEASE = 'noctia-pages-cache-reset-v2'
const SCOPE_PATH = new URL(self.registration.scope).pathname

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      const cache = await caches.open(name)
      for (const request of await cache.keys()) {
        if (new URL(request.url).pathname.startsWith(SCOPE_PATH)) await cache.delete(request)
      }
      if ((await cache.keys()).length === 0) await caches.delete(name)
    }
    await self.clients.claim()
    for (const client of await self.clients.matchAll({ type: 'window' })) {
      const url = new URL(client.url)
      if (!url.searchParams.has('noctia-update')) {
        url.searchParams.set('noctia-update', RELEASE)
        await client.navigate(url.href)
      }
    }
  })())
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin || !url.pathname.startsWith(SCOPE_PATH)) return
  if (event.request.mode === 'navigate' || url.pathname.endsWith('/config.js') || url.pathname.endsWith('/app.js')) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }))
  }
})
