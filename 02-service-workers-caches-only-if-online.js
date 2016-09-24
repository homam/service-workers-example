// Becasue when we're online, we first fetch a request and then cache
// its response, cacheName is not really used in this service worker.
// Changing the cacheName will cause other (previous) caches to be deleted
// (check activate event handler).
const cacheName = 'v1'

// utlity 
const trace = (x, y) => {
  console.log(x);
  return y;
}


const urlsToCache = new Set([
  self.location.href
].map(u => new URL(u, self.location.href).href))


self.addEventListener('install', event => {
  console.log('% install')
  caches.open(cacheName).then(cache =>
    cache.addAll(Array.from(urlsToCache))
  )
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  console.log('% activate')

  // delete "old" cacheName s
  event.waitUntil(
    self.clients.claim().then(_ =>
      caches.keys().then(keys => 
        Promise.all(
          keys.filter(key => cacheName != key).map(key =>
            trace(`# deleting ${key}`, caches.delete(key))
          )
        )
      )
    )
  );
});

const cacheAResponse = (cache, request, response, log) => {
  console.log(log, request.url);
  cache.put(request, response.clone());
  return response;
}

const cacheARequest = request => trace(`+ caching ${request.url}`, 
  caches.open(cacheName).then(cache =>
    fetch(request.clone()).then(response => 
      cacheAResponse(cache, request, response, '* cached ')
    )
  )
);

const tryServingFromCache = request =>
  caches.open(cacheName).then(cache =>
    cache.match(request).then(resp => {
      if(!!resp) {
        console.log('> from cache', request.url)
        return resp;
      } else {
        console.log('! not in cache', request.url)
        return fetch(request).then(response => 
          cacheAResponse(cache, request, response, '$ cached ')
        )
      }
    })
  );


self.addEventListener('fetch', event => {
  if(event.request.method != 'GET') {
    event.respondWith(fetch(event.request))
  } else {
    const url = new URL(event.request.url, self.location.href);
    if(['.png', '.jpg'].some(x => url.pathname.endsWith(x))) {
      event.respondWith(tryServingFromCache(event.request));
    } else {
      event.respondWith(navigator.onLine
        ? cacheARequest(event.request)
        : tryServingFromCache(event.request)
      )
    }
  }
});
