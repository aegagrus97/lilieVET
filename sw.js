// LilieVET · service worker: guarda los archivos de la app para que abra rápido.
// Los datos (Supabase) nunca se guardan aquí: siempre van a la red.
const VERSION = 'lv-fase3-1';
const ARCHIVOS = [
  './', 'index.html', 'config.js', 'manifest.webmanifest',
  'ds/tokens.css', 'ds/bundle.css', 'ds/bundle.js', 'css/app.css',
  'vendor/react.production.min.js', 'vendor/react-dom.production.min.js', 'vendor/htm.umd.js', 'vendor/supabase.js',
  'js/main.js', 'js/lib.js', 'js/api.js', 'js/demo.js', 'js/shell.js', 'js/auth.js', 'js/secciones.js', 'js/componentes.js', 'js/cuenta.js',
  'js/tutor/inicio.js', 'js/tutor/perfil.js', 'js/mvz/hoy.js', 'js/mvz/alta.js', 'js/admin/inicio.js', 'js/admin/verificacion.js',
  'img/lilievet-logo.svg', 'img/lilievet-corazon.svg', 'icons/icon.svg', 'icons/favicon-32.png', 'icons/icon-192.png',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // Supabase y fuentes: directo a la red
  // Primero la red (para recibir cambios), y si no hay conexión, lo guardado
  e.respondWith(fetch(e.request).then((r) => {
    const copia = r.clone();
    caches.open(VERSION).then((c) => c.put(e.request, copia));
    return r;
  }).catch(() => caches.match(e.request).then((r) => r || caches.match('index.html'))));
});
