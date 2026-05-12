/* 가톨릭길동무 Service Worker - V38
   캐시를 매번 삭제하지 않고, 버전 변경 시 오래된 캐시만 정리합니다.
   localStorage/사용자 설정은 건드리지 않습니다. */
const CACHE_VERSION = 'catholic-way-V38';
const APP_SHELL = [
  './',
  './index.html',
  './diocese.html',
  './qa-firebase.html',
  './parishes.js?v=V38',
  './style.css?v=V38',
  './app.js?v=V38',
  './web.js?v=V38',
  './prayer.js?v=V38',
  './patches.js?v=V38',
  './sw-update.js?v=V38',
  './manifest.json',
  './icon-192x192.png',
  './icon-512x512.png',
  './icon-512x512-maskable.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => Promise.all(APP_SHELL.map((url) => cache.add(url).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => key === CACHE_VERSION ? null : caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function sameOrigin(request) {
  try { return new URL(request.url).origin === self.location.origin; } catch (e) { return false; }
}
function isHtmlRequest(request) {
  return request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html');
}
function isVersionedAsset(request) {
  try {
    const url = new URL(request.url);
    return url.searchParams.has('v') ||
      /parishes\.js|prayer\.js|app\.js|style\.css|web\.js|patches\.js|sw-update\.js/.test(url.pathname);
  } catch (e) { return false; }
}
async function networkFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const fresh = await fetch(request, { cache: 'no-cache' });
    if (fresh && fresh.ok) cache.put(request, fresh.clone()).catch(() => null);
    return fresh;
  } catch (e) {
    const cached = await cache.match(request);
    return cached || cache.match('./index.html');
  }
}
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) cache.put(request, fresh.clone()).catch(() => null);
    return fresh;
  } catch (e) {
    return new Response('Offline', { status: 503 });
  }
}
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);
  const freshPromise = fetch(request)
    .then((fresh) => {
      if (fresh && fresh.ok) cache.put(request, fresh.clone()).catch(() => null);
      return fresh;
    })
    .catch(() => null);
  return cached || freshPromise || fetch(request);
}
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  if (!sameOrigin(request)) return;
  if (isHtmlRequest(request)) {
    event.respondWith(networkFirst(request));
    return;
  }
  if (isVersionedAsset(request)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  event.respondWith(staleWhileRevalidate(request));
});
