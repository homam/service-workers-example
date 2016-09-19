const cacheName = 'my-cache-48'

self.addEventListener('install', event => {
  console.log('% install')
});

self.addEventListener('activate', event => {
  console.log('% activate')
});


const cachedFetch = request => request.method != 'GET' ? 
  // we can only cache GET requests
  fetch(request) : 
  caches.open(cacheName).then(cache =>
    cache.match(request).then(resp => {
      if(!!resp) {
        console.log('> from cache', request.url)
        return resp;
      } else {
        console.log('! not in cache', request.url)
        return fetch(request).then(response => {
          // put the new response in the cache for next fetches
          cache.put(request, response.clone());
          return response
        })
      }
    })
  )

self.addEventListener('fetch', event => event.respondWith(
    cachedFetch(event.request)
  )
)