/* The build injects a content version and the complete offline app shell. */
const CACHE='franmo-app-__CACHE_VERSION__';
const FILES=__PRECACHE_FILES__;
const STATIC=new Set(FILES);
self.addEventListener('install',event=>{
 event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  await cache.addAll(FILES.map(path=>new Request(path,{cache:'reload'})));
 })());
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  for(const key of await caches.keys())if(key.startsWith('franmo-app-')&&key!==CACHE)await caches.delete(key);
  await self.clients.claim();
 })());
});
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 // Account, progress and avatar requests always go to the network.
 if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname.startsWith('/.netlify/')||url.pathname==='/textbooks-preview.html'||url.pathname==='/android-update.json')return;
 if(request.mode==='navigate'){
  // Serve one complete build: new assets activate only with their own HTML.
  event.respondWith((async()=>{
   const cached=await (await caches.open(CACHE)).match('/index.html');
   // Pages redirects /index.html to /. Navigation requests use manual redirects
   // and reject a cached followed-redirect response with ERR_FAILED.
   if(cached?.redirected)return new Response(cached.body,{status:cached.status,statusText:cached.statusText,headers:cached.headers});
   return cached||fetch(request);
  })());
 }else if(STATIC.has(url.pathname)&&!url.search){
  event.respondWith((async()=>{
   const cached=await (await caches.open(CACHE)).match(url.pathname);
   return cached||fetch(request);
  })());
 }
});
