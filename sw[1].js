/* Service worker de Surtidor.
   - Guarda la "carcasa" de la web para que abra al instante y funcione la interfaz sin conexión.
   - NO guarda precios ni mapas: los datos del Ministerio y las teselas van siempre a la red,
     para no enseñar nunca precios caducados como si fueran actuales.
   Al cambiar archivos de la web, sube el número de VERSION para que los móviles se actualicen. */
const VERSION = 'surtidor-v1';

const SHELL = [
  './',
  'index.html',
  'sobre-nosotros.html',
  'contacto.html',
  'politica-privacidad.html',
  'aviso-legal.html',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(VERSION).then(cache =>
      Promise.all(SHELL.map(url => cache.add(url).catch(() => null)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Todo lo externo (API de precios, teselas, Leaflet, fuentes, anuncios) va directo a la red.
  if (url.origin !== self.location.origin) return;

  // Páginas: red primero (siempre la versión más nueva); sin conexión, la copia guardada.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(req, copy));
        return res;
      }).catch(() =>
        caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html'))
      )
    );
    return;
  }

  // Archivos propios (iconos, manifest...): copia guardada y se refresca en segundo plano.
  event.respondWith(
    caches.match(req).then(cached => {
      const net = fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || net;
    })
  );
});
