// Becasue when we're online, we first fetch a request and then cache
// its response, cacheName is not really used in this service worker.
// Changing the cacheName will cause other (previous) caches to be deleted
// (check activate event handler).
const cacheName = '1'

// utlity 
const trace = (x, y) => {
  console.log(x);
  return y;
}


self.addEventListener('install', event => {
  console.log('% install')
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  console.log('% activate')

  // delete "old" cacheName s
  event.waitUntil(
    caches.keys().then(keys => 
      Promise.all(
        keys.filter(key => cacheName != key).map(key =>
          trace(`# deleting ${key}`, caches.delete(key))
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
          cacheAResponse(cache, event, response, '$ cached ')
        )
      }
    })
  );


self.addEventListener('fetch', event => 
  event.respondWith(navigator.onLine
    ? cacheARequest(event.request)
    : tryServingFromCache(event.request)
  )
);