// ============================================================
// Monitor ISP — Service Worker
// - Guarda en caché el "cascarón" de la app (HTML, CSS, JS, íconos)
//   para que abra rápido y no se vea en blanco sin internet.
// - NUNCA cachea las peticiones a Supabase: son datos sensibles
//   (protegidos por login) y en un monitor deben ser siempre frescos.
// - Al publicar cambios, sube el número de CACHE (v1 -> v2) para
//   forzar la limpieza del caché anterior.
// ============================================================

const CACHE = 'monitor-isp-v1';

const SHELL = [
    './',
    'index.html',
    'manifest.json',
    'assets/css/style.css',
    'assets/js/config.js',
    'assets/js/app.js',
    'assets/icons/icon-192.png',
    'assets/icons/icon-512.png'
];

// Librerías externas (CDN) que la página necesita para arrancar
const CDN = [
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
    'https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css'
];

self.addEventListener('install', event => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE);
        await cache.addAll(SHELL);
        // CDN: mejor esfuerzo; si alguna falla, la instalación no se cancela
        await Promise.allSettled(CDN.map(async url => {
            const resp = await fetch(url, { mode: 'no-cors' });
            await cache.put(url, resp);
        }));
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const claves = await caches.keys();
        await Promise.all(claves.filter(k => k !== CACHE).map(k => caches.delete(k)));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', event => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);

    // Supabase (datos y autenticación): directo a la red, sin caché
    if (url.hostname.endsWith('supabase.co')) return;

    // Páginas: red primero (para recibir actualizaciones); caché como respaldo sin conexión
    if (req.mode === 'navigate') {
        event.respondWith(
            fetch(req)
                .then(resp => {
                    if (resp.ok) {
                        const copia = resp.clone();
                        caches.open(CACHE).then(c => c.put(req, copia));
                    }
                    return resp;
                })
                .catch(() => caches.match(req).then(r => r || caches.match('index.html')))
        );
        return;
    }

    // Archivos estáticos (propios y CDN): responde del caché y actualiza en segundo plano
    event.respondWith(
        caches.match(req).then(enCache => {
            const red = fetch(req)
                .then(resp => {
                    if (resp && (resp.ok || resp.type === 'opaque')) {
                        const copia = resp.clone();
                        caches.open(CACHE).then(c => c.put(req, copia));
                    }
                    return resp;
                })
                .catch(() => enCache);
            return enCache || red;
        })
    );
});
