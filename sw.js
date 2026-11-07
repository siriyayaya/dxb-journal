/* 인터넷이 없어도 열리게: 첫 화면(index.html) · 잠긴 내용(site.bin) · 글꼴을 휴대폰에 저장해 두고 씀.
   인터넷이 되면 열 때마다 새 버전이 있는지 확인하고(바뀐 게 없으면 거의 안 받음),
   느리거나 끊기면 저장해 둔 걸로 바로 열어요. 받던 건 뒤에서 마저 받아 다음에 씀 */
const CORE = 'dxb-core-v1', FONT = 'dxb-font-v1';
const FILES = ['./index.html', './site.bin', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CORE)
    .then(c => c.addAll(FILES.map(f => new Request(f, {cache: 'no-cache'}))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k.startsWith('dxb-') && k !== CORE && k !== FONT).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function offlinePage(){
  return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><p style="font:16px/1.6 -apple-system,sans-serif;padding:24px">인터넷이 연결되면 한 번 열어 주세요. 그다음부터는 인터넷 없이도 열려요.</p>',
    {headers: {'Content-Type': 'text/html; charset=utf-8'}});
}

/* 새로 받아 보고, ms 안에 안 오거나 실패하면 저장본을 줌 */
async function netOrSaved(e, key, ms, isPage){
  const c = await caches.open(CORE);
  const net = fetch(key, {cache: 'no-cache'}).then(async r => { if(r.ok) await c.put(key, r.clone()); return r; });
  e.waitUntil(net.catch(() => {}));
  const saved = await c.match(key);
  if(!saved){
    try{ return await net; }catch(err){ return isPage ? offlinePage() : Response.error(); }
  }
  try{
    const r = await Promise.race([net, new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), ms))]);
    return r.ok ? r : saved;
  }catch(err){ return saved; }
}

self.addEventListener('fetch', e => {
  if(e.request.method !== 'GET') return;
  const u = new URL(e.request.url), same = u.origin === location.origin;
  if(same && (e.request.mode === 'navigate' || /\/index\.html$/.test(u.pathname))){
    e.respondWith(netOrSaved(e, './index.html', 3000, true));
    return;
  }
  if(same && /\/site\.bin$/.test(u.pathname)){
    e.respondWith(netOrSaved(e, './site.bin', 6000, false));
    return;
  }
  if(/(^|\.)fonts\.(googleapis|gstatic)\.com$|^cdn\.jsdelivr\.net$/.test(u.hostname)){
    e.respondWith(caches.open(FONT).then(async c => {
      const hit = await c.match(e.request); if(hit) return hit;
      try{ const r = await fetch(e.request); if(r.ok || r.type === 'opaque') c.put(e.request, r.clone()); return r; }
      catch(err){ return Response.error(); }
    }));
    return;
  }
  if(same) e.respondWith(caches.match(e.request, {ignoreSearch: true}).then(h => h || fetch(e.request)));
});
