/* Offline cache for Tray Table. */
var V = 'tt-670456e7b0';
var FILES = ['./', 'index.html', 'app.css?v=670456e7b0', 'app.js?v=670456e7b0', 'games.js?v=670456e7b0', 'manifest.webmanifest', 'icon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(V).then(function (c) {
    return Promise.all(FILES.map(function (f) {
      return fetch(new Request(f, { cache: 'reload' })).then(function (r) {
        if (!r.ok) throw new Error('fetch failed: ' + f);
        return c.put(f, r);
      });
    }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('tt-') === 0 && k !== V; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  if (req.mode === 'navigate') {
    e.respondWith(caches.open(V).then(function (c) {
      return c.match('index.html').then(function (hit) {
        return hit || fetch(req);
      });
    }).catch(function () { return fetch(req); }));
    return;
  }
  e.respondWith(caches.open(V).then(function (c) {
    return c.match(req).then(function (hit) { return hit || fetch(req); });
  }));
});
