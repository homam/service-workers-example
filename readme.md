# Making almost every Web page work offline

I hope this post clarifies some tricks and techniques in Cache Storage and Service Worker APIs.

## fetch :: Request -> Promise Response

```
var req = new Request('https://api.ipify.org')
req.headers.append('x-right-now', new Date().toJSON())
fetch(req)
```

We can add custom headers to this request, but browser can override our headers. For example Chrome always overrides `User-Agent` and `Referer` and **when the browser is online**, extensions like [ModHeader](https://chrome.google.com/webstore/detail/modheader/idgpnmonknjnojddfkpgkljpfnnfcklj) can add or override any header that you'd append to the request. 

```javascript
var req = new Request('https://api.ipify.org')
req.headers.append('x-right-now', new Date().toJSON())
fetch(req)
```

We can also make POST, HEAD or DELETE requests:

```javascript
var req = new Request('some-url', {method: 'POST', body: '{"foo":"bar"}'})
fetch(req)
```

## Cache Storage

The result of `fetch()` is a Promise of type `Response`. Similar to `Request`, `Response` also has a rich API. First let's fake a text response:

```javascript
var resp = new Response('hello')
resp.text().then(x => console.log('response =', x))
```

Another fake JSON response:

```javascript
var resp = new Response('[{"a": 1}, {"a": 2}]')
resp.json().then(x => console.log('response = ', x))
```

Or images (borrowed from [SO 12168909](http://stackoverflow.com/questions/12168909/blob-from-dataurl))

```javascript
function dataURItoBlob(dataURI) {
  var byteString = atob(dataURI.split(',')[1]);
  var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0]
  var ab = new ArrayBuffer(byteString.length);
  var ia = new Uint8Array(ab);
  for (var i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
  }
  var blob = new Blob([ab], {type: mimeString});
  return blob;
}

var resp = new Response(dataURItoBlob('data:image/gif;base64,R0lGOD lhCwAOAMQfAP////7+/vj4+Hh4eHd3d/v7+/Dw8HV1dfLy8ubm5vX19e3t7fr 6+nl5edra2nZ2dnx8fMHBwYODg/b29np6eujo6JGRkeHh4eTk5LCwsN3d3dfX 13Jycp2dnevr6////yH5BAEAAB8ALAAAAAALAA4AAAVq4NFw1DNAX/o9imAsB tKpxKRd1+YEWUoIiUoiEWEAApIDMLGoRCyWiKThenkwDgeGMiggDLEXQkDoTh CKNLpQDgjeAsY7MHgECgx8YR8oHwNHfwADBACGh4EDA4iGAYAEBAcQIg0DkgcEIQA7'))
resp.blob().then(x => {
  var img = new Image()
  img.src = URL.createObjectURL(x)
  document.body.appendChild(img)
});
```

Cache Storage provides a mechanism for caching reqeust / responses.

Let's play with our new toys Cache, Request and Response:

```javascript

// _ => Request
var makeReq = () => new Request('some-fake-url')

// Request -> Promise Response
var myFetch = req => 
  new URL('some-fake-url', document.location).toString() == req.url ?
    Promise.resolve(new Response(new Date().toJSON().toString())) :
    fetch(req)


var req = makeReq()
caches.open('my-cache').then(cache => 
  myFetch(req).then(resp =>
  cache.put(req, resp))
)

// we wait a moment for the previous async operation to finish
setTimeout(() => 
  caches.open('my-cache').then(
    cache => cache.match(makeReq())
  ).then(v => v.text())
   .then(console.log)
, 100)
```

Above we created a fake API that returns the current time. `myFetch()` function returns our fake Response if the URL matches `some-fake-url` otherwise fallbacks to the standard `fetch()` API.


Standard `fetch()` function signature is more or less like:

```haskell
fetch :: Request -> Promise Response
```

It takes a `Request` as its only argument and returns a `Promise` that will resolve to a `Response` object. We can easily create a `cachedFetch` function with a similar interface which first tries to retrieve the request from the cache first, but will fallback to the standard `fetch` if the item was not found in the cache.

```javascript
const cachedFetch = request => request.method != 'GET' ? 
  // we can only cache GET requests
  fetch(request) : 
  caches.open('my-cache').then(cache =>
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

cachedFetch(new Request('https://api.ipify.org?format=text'))
.then(x => x.text()).then(x => console.log(x))
```

## cache.add

`cache.add` and `cache.addAll` are utility functions that fetch and cache URLs in one call:

```javascript
caches.open('my-cache').then(cache => 
  cache.add('https://api.ipify.org')
)

caches.open('my-cache').then(cache => 
  cache.addAll(['https://api.ipify.org/?v=1', 'https://api.ipify.org/?v=2'])
)
```

They're most useful when we want to ensure that some resources are always cached and are available offline.

## Service Workers

By now we're able to cache any fetch request / response. Service Workers allow us to hijack any (GET) requests from our web app and potentially respond with a cached (or even a completely fake) response.

```
self.addEventListener('fetch', event => event.respondWith(
    cachedFetch(event.request)
  )
)
```

There are many security concerns and other.

[01-service-worker-caches-all-gets](./01-service-worker-caches-all-gets) a service worker that blindly caches every GET requests.


## Versioning

```
caches.keys().then(keys => console.log(keys))
```

### Web Server
This was a gotcha for me.

Fetch requests for resources that have been already cached by the browser (as the result of HTTP cache-control headers), will not reach the service worker; the browser handle these resources directly from its cache (even if you change the cache name).

Make sure that your server responds with correct cache disabling headers, while testing caching in a service worker:

```
cache-control: max-age=-1
```

For example this is how you can disable caching in node's [http-server](https://github.com/indexzero/http-server).

```
http-server . -c-1
```

...

## How to have an offline page?





```javascript

var cacheARequest = (cacheName, request) => caches.open(cacheName).then(
  cache =>
    fetch(request.clone()).then(response =>
      cacheAResponse(cache, request, response)
    )
  )

var cacheAResponse = (cache, request, response) => {
  cache.put(request, response.clone()); // we don't have to wait for put to finish
  return response;
}

var tryServingFromCache = (cacheName, request) => caches.open(cacheName).then(
  cache =>
    cache.match(request).then(resp => {
      if(!!resp) {
        console.log('> from cache', request.url)
        return resp;
      } else {
        console.log('! not in cache', request.url)
        return fetch(request).then(response => 
          cacheAResponse(cache, request, response)
        )
      }
    })
  )


// cacheARequest('duck', new Request('https://api.ipify.org')).then(x => x.text()).then(x => console.log(x))

tryServingFromCache('duck', new Request('https://api.ipify.org')).then(x => x.text()).then(x => console.log(x))
```