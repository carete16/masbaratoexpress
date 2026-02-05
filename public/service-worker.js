// Service Worker para Masbarato Express
// Cachea recursos para carga más rápida

const CACHE_NAME = 'masbarato-express-v1';
const urlsToCache = [
    '/public/index.html',
    '/api/deals',
    'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css'
];

// Instalación - cachear recursos
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('📦 Service Worker: Cacheando recursos');
                return cache.addAll(urlsToCache);
            })
    );
    self.skipWaiting();
});

// Activación - limpiar cachés antiguos
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('🗑️ Service Worker: Eliminando caché antiguo:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch - servir desde caché cuando sea posible
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Retornar desde caché si existe
                if (response) {
                    console.log('⚡ Service Worker: Sirviendo desde caché:', event.request.url);
                    return response;
                }

                // Si no está en caché, hacer fetch normal
                return fetch(event.request).then(response => {
                    // No cachear si no es una respuesta válida
                    if (!response || response.status !== 200 || response.type === 'error') {
                        return response;
                    }

                    // Cachear la nueva respuesta
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });

                    return response;
                });
            })
    );
});
