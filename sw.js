/* 가톨릭길동무 Service Worker - V3-S
   캐시를 매번 삭제하지 않고, 버전 변경 시 오래된 캐시만 정리합니다.
   localStorage/사용자 설정은 건드리지 않습니다. */
const CACHE_VERSION = 'catholic-way-V1-37';
/* 다이어트 1: 첫 실행에 꼭 필요한 앱 셸만 선캐시합니다.
   성당/성지/피정의집/기도문/관구교구/문의 페이지는 versioned fetch 시 cacheFirst로 저장됩니다. */
const APP_SHELL = [
  './',
  './index.html',
  './style.css?v=V1-37',
  './app.js?v=V1-37',
  './web.js?v=V1-37',
  './patches.js?v=V1-37',
  './sw-update.js?v=V1-37',
  './manifest.json?v=V1-37',
  './icon-192x192.png',
  './icon-512x512.png',
  './icon-512x512-maskable.png',
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
      /parishes(?:-[a-z-]+)?\.js|prayer\.js|retreats\.js|shrines\.js|diocese\.html|qa-firebase\.html|app\.js|style\.css|web\.js|patches\.js|sw-update\.js/.test(url.pathname);
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
