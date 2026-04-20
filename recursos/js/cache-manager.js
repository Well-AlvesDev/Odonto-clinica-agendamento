/**
 * Script para registrar e gerenciar o Service Worker
 * Responsável por fazer cache persistente das imagens com expiração de 5 horas
 */

(function () {
    // Verificar suporte a Service Workers
    if (!('serviceWorker' in navigator)) {
        console.warn('Service Workers não são suportados neste navegador');
        return;
    }

    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register(
                './sw.js',
                { scope: '/' }
            );

            console.log('Service Worker registrado com sucesso:', registration);

            // Verificar atualizações do Service Worker a cada 12 horas
            setInterval(() => {
                registration.update();
            }, 12 * 60 * 60 * 1000);

            // Listener para quando um novo Service Worker estiver ativado
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'activated') {
                        console.log('Novo Service Worker ativado');
                        // Opcionalmente, notificar o usuário sobre atualização
                    }
                });
            });
        } catch (error) {
            console.error('Erro ao registrar Service Worker:', error);
        }
    });

    // Função para limpar cache manualmente se necessário
    window.clearImageCache = async function () {
        try {
            if (confirm('Deseja limpar o cache de imagens? Elas serão recarregadas do servidor.')) {
                const cacheNames = await caches.keys();
                const imageCaches = cacheNames.filter(name => name.includes('odonto'));

                await Promise.all(
                    imageCaches.map(cacheName => caches.delete(cacheName))
                );

                console.log('Cache de imagens limpo com sucesso');
                alert('Cache limpo! As imagens serão recarregadas.');
            }
        } catch (error) {
            console.error('Erro ao limpar cache:', error);
        }
    };

    // Função para verificar tamanho do cache
    window.getCacheSizeInfo = async function () {
        try {
            const cacheNames = await caches.keys();
            let totalSize = 0;

            for (const cacheName of cacheNames) {
                const cache = await caches.open(cacheName);
                const keys = await cache.keys();

                for (const request of keys) {
                    const response = await cache.match(request);
                    if (response) {
                        const blob = await response.blob();
                        totalSize += blob.size;
                    }
                }
            }

            const sizeMB = (totalSize / (1024 * 1024)).toFixed(2);
            console.log(`Tamanho total do cache: ${sizeMB} MB`);
            return sizeMB;
        } catch (error) {
            console.error('Erro ao verificar tamanho do cache:', error);
        }
    };
})();
