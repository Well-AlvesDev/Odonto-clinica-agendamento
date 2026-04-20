const CACHE_NAME = 'odonto-images-v1';
const CACHE_EXPIRY_MS = 5 * 60 * 60 * 1000; // 5 horas em milissegundos
const DB_NAME = 'odonto-cache-db';
const STORE_NAME = 'cache-metadata';

// Lista de imagens para fazer cache
const IMAGES_TO_CACHE = [
    './recursos/imgs/img1.webp',
    './recursos/imgs/image.webp',
    './recursos/imgs/img2.svg',
    './recursos/imgs/img3.webp',
    './recursos/imgs/img4.webp',
    './recursos/imgs/img2.webp',
    './recursos/imgs/logodev.png'
];

// Inicializar IndexedDB para rastrear expiração
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'url' });
            }
        };
    });
}

// Verificar se cache ainda é válido
function isCacheValid(cachedTime) {
    const now = Date.now();
    return (now - cachedTime) < CACHE_EXPIRY_MS;
}

// Salvar metadados no IndexedDB
async function saveCacheMetadata(url, timestamp) {
    try {
        const db = await initDB();
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        store.put({ url, timestamp });
    } catch (error) {
        console.warn('Erro ao salvar metadados de cache:', error);
    }
}

// Obter metadados do IndexedDB
async function getCacheMetadata(url) {
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(url);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });
    } catch (error) {
        console.warn('Erro ao obter metadados de cache:', error);
        return null;
    }
}

// Limpar cache expirado
async function clearExpiredCache() {
    try {
        const db = await initDB();
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);

        return new Promise((resolve) => {
            const request = store.getAll();
            request.onsuccess = async () => {
                const items = request.result;
                const cache = await caches.open(CACHE_NAME);

                for (const item of items) {
                    if (!isCacheValid(item.timestamp)) {
                        await cache.delete(item.url);
                        // Remover metadados expirados
                        const dbTransaction = db.transaction([STORE_NAME], 'readwrite');
                        dbTransaction.objectStore(STORE_NAME).delete(item.url);
                    }
                }
                resolve();
            };
        });
    } catch (error) {
        console.warn('Erro ao limpar cache expirado:', error);
    }
}

// Install event - fazer cache das imagens
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            const timestamp = Date.now();

            // Fazer cache de todas as imagens
            for (const imageUrl of IMAGES_TO_CACHE) {
                try {
                    const response = await fetch(imageUrl);
                    if (response.ok) {
                        await cache.put(imageUrl, response.clone());
                        await saveCacheMetadata(imageUrl, timestamp);
                    }
                } catch (error) {
                    console.warn(`Erro ao fazer cache de ${imageUrl}:`, error);
                }
            }

            self.skipWaiting();
        })
    );
});

// Activate event - limpar cache expirado e versões antigas
self.addEventListener('activate', (event) => {
    event.waitUntil(
        (async () => {
            // Limpar caches antigos
            const cacheNames = await caches.keys();
            await Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );

            // Limpar cache expirado
            await clearExpiredCache();

            self.clients.claim();
        })()
    );
});

// Fetch event - servir do cache se disponível e válido
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = request.url;

    // Apenas interceptar requisições de imagens
    if (!url.includes('/recursos/imgs/')) {
        return;
    }

    event.respondWith(
        (async () => {
            try {
                // Verificar metadados de cache
                const metadata = await getCacheMetadata(url);

                if (metadata && isCacheValid(metadata.timestamp)) {
                    // Cache ainda é válido, servir do cache
                    const cached = await caches.match(url);
                    if (cached) {
                        return cached;
                    }
                }

                // Cache expirou ou não existe, buscar do servidor
                const response = await fetch(request);

                if (response.ok) {
                    // Atualizar cache e metadados
                    const cache = await caches.open(CACHE_NAME);
                    const timestamp = Date.now();

                    cache.put(url, response.clone());
                    await saveCacheMetadata(url, timestamp);
                }

                return response;
            } catch (error) {
                // Se falhar ao buscar do servidor, tentar usar cache
                const cached = await caches.match(url);
                if (cached) {
                    return cached;
                }

                console.error('Erro ao fazer fetch de imagem:', error);
                throw error;
            }
        })()
    );
});
