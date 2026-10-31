/* Offline cache for Pack Ripper. */
var V = 'pr-e3665a745b';
var FILES = ['./', 'index.html'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(V).then(function (c) {
    return Promise.all(FILES.map(function (f) {
      return fetch(new Request(f, { cache: 'reload' })).then(function (r) { if (r.ok) return c.put(f, r); });
    }));
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('pr-') === 0 && k !== V; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(function (r) {
      var cp = r.clone(); caches.open(V).then(function (c) { c.put('index.html', cp); }); return r;
    }).catch(function () { return caches.open(V).then(function (c) { return c.match('index.html'); }); }));
    return;
  }
  e.respondWith(caches.open(V).then(function (c) { return c.match(req, { ignoreSearch: true }).then(function (hit) { return hit || fetch(req); }); }));
});
