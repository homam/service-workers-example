# Making almost every Web page work offline

I hope this post clarifies some tricks and techniques in Cache Storage and Service Worker APIs.

Most of the code snippets of this post can be run in Chrome console while reading this blog at Medium.

## function fetch (req : Request) : Promise<Response>

[Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) provides a rich interface for creating request / responses in browser-side JavaScript:

```javascript
var req = new Request('https://api.ipify.org');
fetch(req).then(res => res.text()).then(console.log);
```

We can add custom headers to this request, but note that the browser might override our headers. For example Chrome always overrides `User-Agent` and `Referer`. Extensions like [ModHeader](https://chrome.google.com/webstore/detail/modheader/idgpnmonknjnojddfkpgkljpfnnfcklj) may also add or override our headers *only when the browser is online*.

```javascript
var headers = new Headers({
  'x-right-now': new Date().toJSON()
});
var req = new Request('https://api.ipify.org', {headers});
fetch(req).then(res => res.text()).then(console.log);
```

We can easliy make POST, HEAD or DELETE requests:

```javascript
var req = new Request('some-url', {method: 'POST', body: '{"foo": "bar"}'})
fetch(req)
```

The result of `fetch()` is a Promise of type `Response`.`Response` also has a flexible API. Let's give it a try by faking a text response:

```javascript
var res = new Response('hello')
res.text().then(x => console.log('response =', x))
```

`res.text().then(...)` is exactly the code that we use to handle a `fetch` request. Here instead of getting the response from the network, we created the response object ourselves.

Another example of a fake JSON response:

```javascript
var resp = new Response('[{"a": 1}, {"a": 2}]')
resp.json().then(x => console.log('response = ', x))
```

We can even create fake responses returning binary files: (borrowed from [SO 12168909](http://stackoverflow.com/questions/12168909/blob-from-dataurl))

```javascript
function dataURItoBlob(dataURI) {
  const byteString = atob(dataURI.split(',')[1]);
  const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0]
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (var i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  const blob = new Blob([ab], {type: mimeString});
  return blob;
}

var res = new Response(dataURItoBlob('data:image/gif;base64,R0lGOD lhCwAOAMQfAP////7+/vj4+Hh4eHd3d/v7+/Dw8HV1dfLy8ubm5vX19e3t7fr 6+nl5edra2nZ2dnx8fMHBwYODg/b29np6eujo6JGRkeHh4eTk5LCwsN3d3dfX 13Jycp2dnevr6////yH5BAEAAB8ALAAAAAALAA4AAAVq4NFw1DNAX/o9imAsB tKpxKRd1+YEWUoIiUoiEWEAApIDMLGoRCyWiKThenkwDgeGMiggDLEXQkDoTh CKNLpQDgjeAsY7MHgECgx8YR8oHwNHfwADBACGh4EDA4iGAYAEBAcQIg0DkgcEIQA7'));
res.blob().then(x => {
  var img = new Image();
  img.src = URL.createObjectURL(x);
  document.body.appendChild(img);
});
```

## Cache Storage

Cache Storage provides a mechanism for caching request / responses.

Let's play with our new toys Cache, Request and Response:

```javascript

// _ => Request
var makeReq = () => new Request('some-fake-url')

// Request -> Promise Response
var myFetch = req => 
  new URL('some-fake-url', document.location.href).toString() == req.url ?
    Promise.resolve(new Response(new Date().toJSON().toString())) :
    fetch(req)

var req = makeReq();
caches.open('my-cache').then(cache => 
  myFetch(req).then(res =>
    cache.put(req, res)
  )
);

// we wait a moment for the previous async operation to finish
setTimeout(() => 
  caches.open('my-cache').then(
    cache => cache.match(makeReq())
  ).then(v => v.text())
   .then(console.log)
, 100);

```

You can copy and paste this snippet in Chrome / Firefox console on this page.

Here we created a fake API that returns the current time. `myFetch()` function returns our fake Response if the URL matches `some-fake-url` otherwise falls back to the standard `fetch()`. (`caches.open()` function is explained in the versioning section below.)


The simplified signature of the standard `fetch()` function is more or less like:

```flowtype
declare function fetch (req : Request) : Promise<Response>
```

`fetch()` takes a `Request` as its only argument and returns a `Promise` that resolves in a `Response` object. We can easily create a `cachedFetch` function with a similar signature which tries to retrieve the response from the cache first, but will fallback to the standard `fetch()` if the item was not found in the cache.

```javascript
const cachedFetch = request => request.method != 'GET' ? 
  // we can only cache GET requests
  fetch(request) : 
  caches.open('my-cache').then(cache =>
    cache.match(request).then(resp => {
      if(!!resp) {
        console.log('from cache', request.url)
        return resp;
      } else {
        console.log('!not in cache', request.url)
        return fetch(request).then(response => {
          // put the new response in the cache for next fetches
          cache.put(request, response.clone());
          return response
        })
      }
    })
  )

cachedFetch(new Request('https://api.ipify.org'))
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

These functions are most useful when we want to ensure that some resources are always cached and are available offline.

### Flow type declaration for Cache Storage

[Flow type declaration for cache storage](https://flowtype.org/try/#0PQKgBAAgZgNg9gdzCYAoVATApgYxgQwCcsw98BncsAYXxwAssB5ABwBcBLOAOyoG9UYMBwDm3OMQDKWIgwBcYAPwAjOHBgBuQcLESsAWSxt6cDApVrN20eOIA1IgE9zq9VqE46jAHL4AtlgulloAvujYZMTC3GxYhFB0JLQMJAJC+BgYABQAroQwCuRshBzcIgCUCgAKhHB+HORYADwAbnAcGAB87mAZGACCMDC5+eQKANoASlgAjjlYRWAAPmBFJWUAupVgNXUNzW0d3drYMEZYWcRzC2wK09eLK2ulIgA0YHDsXLyKCsmMrE4PHI2129UaTVcMGOQgA1lhHOQsqDauDmlNZvMihsYWA-Pg2AxLpibncSY9VsUXu9PkCfn8vMwvsCUXsIdNyCxgVhcfjCfRBsMrljbmB7iLlmBJFSyjTmfSaIzAd8QdVUfsmhiHmwcT0WDk2MTtWTtZLnmVWWjWu0uqFwrgCFFSrF4olFSl+CcsGdYll4c5KesKmq2c0obj6BQ-QjCjLgzt1RDwz1-UjLRrxuaRLrtHyicLSWLyWxJdKg3K6eRfu6AfLVQnQ00OVzeDyep8sNwsp4Ur4ArGg+mIf826gwkJMA6iCQWkRSIyxjWFkA)
```flowtype
/* @flow */

declare class CacheOptions {
  ignoreSearch: ?bool;
  ignoreMethod: ?bool;
  ignoreVary: ?bool;
  cacheName: ?bool;
}

declare interface Cache {
  add(url: string): Promise<void>;
  addAll(urls: [Request | string]): Promise<void>;
  delete(request: Request | string, options?: CacheOptions): Promise<bool>;
  keys(): Promise<[Request]>;
  match(request: Request | string, options?: CacheOptions): Promise<Response>;
  matchAll(request: Request | String, options?: CacheOptions): Promise<[Request]>;
  put(request: Request | string): Promise<void>;
}

declare interface Caches {
  delete(key: string): Promise<bool>;
  has(key: string): Promise<bool>;
  keys(): Promise<[string]>;
  match(request: Request | String, options?: CacheOptions): Promise<Response>;
  open(cacheName: string): Promise<Cache>;
}
  
declare var caches: Caches
```

## Service Workers

By now we're able to cache any fetch request / response. Service Workers allow us to hijack any request in our web app and potentially respond with a cached (or even a completely fake) response.

We take advantage of `fetch` event in service workers. If a page is managed by a service worker, this event is triggered every time that the page creates a HTTP request (whether by JavaScript or by a DOM element like `<img src="" />`)

```
self.addEventListener('fetch', event => event.respondWith(
    cachedFetch(event.request)
  )
)
```

There are many security concerns with regard to service workers; apps that utilize service workers have to be served through HTTPS and all 3rd any party resources (including CDN content) must have a compatible CORS settings.

**Here's a service worker that blindly caches every GET requests:**

[01-service-worker-caches-all-gets.js](./01-service-worker-caches-all-gets.js)

The problem with the above snippet is that it never updates its cached resources. I prefer a solution that adapts to browser's connectivity status. The next snippet fetches the resource from the network and caches it when the browser is online, otherwise serves the resource from the cache storage when browser is offline:

**A service worker that falls back to cache if the browser is offline:**

[02-service-workers-caches-only-if-online.js](./02-service-workers-caches-only-if-online.js)


## Versioning

There's no way of specifying any expiration date for items in the cache storage. Once a response is cached it remains there and we can only delete it by explicitly calling `cache.delete()` function.

We can have different instances of cache storage in the same app. An instance can be created (or opened) by `cache.open(key: string)` function which returns a Promise that resolves in a cache storage object.

`caches.keys()` function lists the name of all existing cache instances:

```
caches.keys().then(keys => console.log(keys))
```

We can use cache instances to cache different versions of the same resource. In order to completely retire a version, we have to delete it manually:

```
caches.delete(oldKey: string)
```

One common practice is to have a global version (cache key):

```
const currentCacheName = 'v1'
caches.open(currentCacheName).then(cache => 
  cache.addAll(['https://api.ipify.org/?v=1', 'https://api.ipify.org/?v=2'])
)
```

We can clean up the 'previous' versions by filtering their keys:

```
caches.keys()
.then(keys => Promise.all(
  keys
  .filter(key => key != currentCacheName)
  .map(key => cache.delete(key))
));
```

Cache instances have use-cases beyond versioning, for example we can categorize resources by caching them in different instances. This gives us more control when it comes to deleting expired resources. In this post we only deal with one cache instance.


## Web Server Considerations

Service workers and the pages that they control must be serviced over a secure connection (HTTPS or localhost).

Fetch requests for resources that have been cached by the browser (as the result of HTTP cache-control headers), will not reach the service worker; the browser handle these resources directly from its cache (even if we change the cache name / version).

This was a gotcha for me.

Make sure that your server responds with correct cache-control headers. During the development, while testing caching in a service worker, your server should respond with:

```
cache-control: max-age=-1
```

For example this is how you we disable browser HTTP caching in Node's [http-server](https://github.com/indexzero/http-server).

```
http-server . -c-1
```
