// Ingryd service worker: caches the app shell only.
// Bumping CACHE_NAME makes every browser drop caches written by older versions
// (which also cached Supabase responses and could show stale profile/history).
const CACHE_NAME = 'ingryd-shell-v2'
const SHELL_ASSETS = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/favicon.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).catch(() => {})
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  // Never touch anything that is not our own origin — Supabase (profile, history,
  // routine, auth) and other third parties must always come live from the network.
  if (url.origin !== self.location.origin) return
  // Never cache our own API either.
  if (url.pathname.startsWith('/api/')) return

  // Page loads: network first so a new deploy shows up immediately; fall back to
  // the cached shell only when offline.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/')))
    return
  }

  // Static assets (hashed JS/CSS, icons): cache first, refresh in the background.
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        })
        .catch(() => cached)
      return cached || networkFetch
    })
  )
})
