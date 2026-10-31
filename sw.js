/* LilieVET · service worker: permite instalar la app y abrirla rápido.
   Los datos (Supabase) nunca se guardan aquí: siempre se piden al servidor.
   Al publicar una versión nueva, sube el número de VERSION para que los teléfonos la descarguen. */
const VERSION = 'lilievet-1.0.0';
const SHELL = ['./', 'index.html', 'config.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (url.hostname.endsWith('supabase.co') || url.pathname.includes('/rest/') || url.pathname.includes('/auth/')) return; // datos: siempre en línea
  const sameOrigin = url.origin === self.location.origin;
  const isShell = sameOrigin && (req.mode === 'navigate' || /\/(index\.html|config\.js)?$/.test(url.pathname));
  if (isShell) {
    // Primero la red (para recibir versiones nuevas); si no hay internet, la copia guardada
    e.respondWith(fetch(req).then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return res; })
      .catch(() => caches.match(req).then(r => r || caches.match('index.html'))));
    return;
  }
  if (sameOrigin || url.hostname === 'cdn.jsdelivr.net' || url.hostname.endsWith('gstatic.com') || url.hostname.endsWith('googleapis.com')) {
    e.respondWith(caches.match(req).then(hit => {
      const net = fetch(req).then(res => { if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); } return res; }).catch(() => hit);
      return hit || net;
    }));
  }
});
