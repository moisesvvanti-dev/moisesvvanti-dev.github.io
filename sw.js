const CACHE_NAME = 'kord-offline-cache-v1';
const OFFLINE_URLS = [
    './',
    './index.html',
    './manifest.json',
    './assets/css/style.css',
    './assets/css/support.css',
    './assets/css/changelog.css',
    './assets/css/donate.css',
    './assets/js/app.js',
    './assets/js/kord_auth.js',
    './assets/js/kord_core.js',
    './assets/js/kord_webrtc.js',
    './assets/js/security.js',
    './assets/js/changelog.js',
    './assets/js/donate.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(OFFLINE_URLS);
        }).catch(err => {
            console.error('Falha ao armazenar cache OFFLINE do Kord:', err);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((name) => {
                    if (name !== CACHE_NAME) {
                        return caches.delete(name);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    // Apenas intercepta requisições de mesma origem (arquivos locais do Kord)
    // Deixa chamadas do Firebase ou APIs externas passarem (elas falham naturalmente se offline na ponta do app js)
    const url = new URL(event.request.url);
    if (url.origin === location.origin) {
        event.respondWith(
            caches.match(event.request).then((response) => {
                // Return cache if available, otherwise fetch from network
                return response || fetch(event.request).catch(() => {
                    // Fallback para index HTML se navegação falhar
                    if (event.request.mode === 'navigate') {
                        return caches.match('./index.html');
                    }
                });
            })
        );
    }
});
