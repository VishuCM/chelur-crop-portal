const C="chelur-v4",A=["./","./index.html","./app.js","./manifest.webmanifest","./icon.svg","./gherkin-banner.png"];

self.addEventListener("install",e=>{
  e.waitUntil(
    caches.open(C).then(c=>c.addAll(A))
  );
});

self.addEventListener("activate",e=>{
  e.waitUntil(
    caches.keys().then(k=>
      Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))
    )
  );
});

self.addEventListener("fetch",e=>{
  if(e.request.method==="GET"){
    e.respondWith(
      fetch(e.request).then(r=>{
        let q=r.clone();
        caches.open(C).then(c=>c.put(e.request,q));
        return r;
      }).catch(()=>caches.match(e.request))
    );
  }
});
