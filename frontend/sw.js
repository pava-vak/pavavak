// ============================================================
// PaVa-Vak Service Worker  |  sw.js
// Place at: /home/opc/PaVa-Vak/frontend/sw.js
// Updated: PRECACHE_ASSETS reflects actual frontend files
// ============================================================

const CACHE_NAME = 'pava-vak-v1';
const OFFLINE_URL = '/offline.html';

// ─── APP SHELL — only real, non-empty files ───────────────────
const PRECACHE_ASSETS = [
  '/',
  '/offline.html',
  '/index.html',
  '/chat.html',
  '/register.html',
  '/settings.html',
  // CSS
  '/css/login.css',
  '/css/chat.css',
  '/css/admin.css',
  '/css/settings.css',
  // JS
  '/js/login.js',
  '/js/chat.js',
  '/js/admin.js',
  '/js/settings.js',
  '/js/register.js',
  '/js/pwa.js',
  // Icons
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// ─── INSTALL ──────────────────────────────────────────────────
// Cache the app shell immediately on SW install
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching app shell');
      // Use allSettled so one missing file doesn't break everything
      return Promise.allSettled(
        PRECACHE_ASSETS.map((url) =>
          cache.add(url).catch((err) =>
            console.warn(`[SW] Failed to cache ${url}:`, err)
          )
        )
      );
    })
  );
  // Activate immediately — don't wait for old SW to finish
  self.skipWaiting();
});

// ─── ACTIVATE ─────────────────────────────────────────────────
// Delete old caches when a new SW version takes over
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      )
    )
  );
  // Take control of all open tabs immediately
  self.clients.claim();
});

// ─── FETCH ────────────────────────────────────────────────────
// Strategy per request type:
//   socket.io  → always bypass (real-time, never cache)
//   /api/*     → always bypass (dynamic data, never cache)
//   navigation → network first, fallback to cache, then offline page
//   assets     → cache first, network fallback (fast loads)
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Always bypass socket.io and API calls
  if (
    url.pathname.startsWith('/socket.io') ||
    url.pathname.startsWith('/api/')
  ) {
    return; // Browser handles it natively
  }

  // 2. Navigation requests (HTML pages)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Update cache with fresh version
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() =>
          caches.match(request).then(
            (cached) => cached || caches.match(OFFLINE_URL)
          )
        )
    );
    return;
  }

  // 3. Static assets — cache first, network fallback
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // Only cache successful same-origin responses
        if (
          response &&
          response.status === 200 &&
          response.type === 'basic'
        ) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});

// ─── PUSH NOTIFICATIONS ───────────────────────────────────────
// Ready for Step 6 — activates automatically once VAPID keys are set
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'PaVa-Vak', body: event.data.text() };
  }

  const options = {
    body: data.body || 'You have a new message',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [200, 100, 200],
    tag: 'pava-vak-message',       // replaces previous notification
    renotify: true,
    data: {
      url: data.url || '/',
      senderId: data.senderId || null,
    },
    actions: [
      { action: 'open',    title: 'Open Chat' },
      { action: 'dismiss', title: 'Dismiss'   },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'PaVa-Vak', options)
  );
});

// ─── NOTIFICATION CLICK ───────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        // Focus existing open window if found
        for (const client of clients) {
          if (
            client.url.includes(self.location.origin) &&
            'focus' in client
          ) {
            client.postMessage({
              type: 'NOTIFICATION_CLICK',
              url: targetUrl,
            });
            return client.focus();
          }
        }
        // Otherwise open a new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

// ─── MESSAGE FROM APP ─────────────────────────────────────────
// Allows the app to trigger SW update (used by update banner in pwa.js)
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});