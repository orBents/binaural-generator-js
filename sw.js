// sw.js
self.addEventListener('install', e => {
    e.waitUntil(
      // depois que o Service Worker estiver instalado,,
      // abra um novo cache
      caches.open('my-pwa-cache').then(cache => {
        // adicione todas as URLs de recursos que queremos armazenar em cache
        return cache.addAll([
          '/',
          '/index.html',
        ]);
      })
    );
   });

   self.addEventListener("fetch", fetchEvent => {
    fetchEvent.respondWith(
      caches.match(fetchEvent.request).then(res => {
        return res || fetch(fetchEvent.request)
      })
    )
  })