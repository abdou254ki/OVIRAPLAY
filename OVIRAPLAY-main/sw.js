const CACHE_NAME = 'ovira-play-static-v6-20261117-185920';
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './ovira-experience.css',
  './ovira-design-v4.css?v=20261118-v4',
  './shared/ovira-tokens.css',
  './app.js',
  './pwa.js',
  './manifest.json',
  './assets/ovira-icon.svg',
  './assets/ovira-icon-192.png',
  './assets/ovira-icon-512.png',
  './assets/fonts/OVIRA-NotoSansArabic-Regular.ttf',
  './assets/fonts/OVIRA-NotoSansArabic-SemiBold.ttf',
  './assets/fonts/OVIRA-NotoSansArabic-ExtraBold.ttf',
  './offline.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('ovira-play-') && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy));
          }
          return response;
        })
        .catch(async () => (await caches.match('./index.html')) || (await caches.match('./offline.html')))
    );
    return;
  }

  const isAppAsset = /\.(?:css|js|svg|png|json|woff2?|ttf)$/i.test(url.pathname) || url.pathname.endsWith('/index.html');
  if (!isAppAsset) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => (await caches.match(request)) || Response.error())
  );
});
