/* Offline cache for One Phone. Bump V when index.html changes. */
var V = 'op-1';
var FILES = ['./', 'index.html'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(V).then(function (c) {
    return c.addAll(FILES.map(function (f) { return new Request(f, { cache: 'reload' }); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('op-') === 0 && k !== V; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

/* Network first so updates arrive when online; cache when offline. */
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(fetch(req).then(function (r) {
    if (r.ok && req.mode === 'navigate') {
      var copy = r.clone();
      caches.open(V).then(function (c) { c.put('index.html', copy); });
    }
    return r;
  }).catch(function () {
    return caches.open(V).then(function (c) {
      return c.match(req).then(function (hit) { return hit || c.match('index.html'); });
    });
  }));
});
