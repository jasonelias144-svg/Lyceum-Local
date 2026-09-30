/*
 * Keeps the app itself available offline. The model files are stored by WebLLM in its own caches
 * (names starting "webllm/"), which this worker never touches: requests to Hugging Face and to the
 * model code on GitHub pass straight through.
 */
const SHELL_CACHE = 'lyceum-local-shell-v1';
// Must match the version in js/webllm.js (test/sw.test.js checks).
const WEBLLM_URL = 'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.85/lib/index.js';
const SHELL = [
  './',
  './index.html',
  './css/app.css',
  './js/app.js',
  './js/models.js',
  './js/device.js',
  './js/chat.js',
  './js/engine.js',
  './js/worker.js',
  './js/webllm.js',
  './manifest.webmanifest',
  './img/icon.svg',
  './img/icon-180.png',
  './img/icon-192.png',
  './img/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await cache.addAll(SHELL);
      try {
        await cache.add(new Request(WEBLLM_URL, { mode: 'cors' }));
      } catch {
        /* fetched and cached on first use instead */
      }
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith('lyceum-local-shell-') && key !== SHELL_CACHE) await caches.delete(key);
      }
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.href === WEBLLM_URL) {
    // A pinned version never changes, so the stored copy is always right.
    event.respondWith(cacheFirst(request));
  } else if (url.origin === self.location.origin) {
    // The app's own files: fresh when online, stored copy when offline.
    event.respondWith(networkFirst(request));
  }
});

async function cacheFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const hit = await cache.match(request, { ignoreSearch: true });
    if (hit) return hit;
    throw err;
  }
}
