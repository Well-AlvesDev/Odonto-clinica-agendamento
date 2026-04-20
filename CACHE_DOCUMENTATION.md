# Cache Persistente de Imagens - Documentação

## Visão Geral
O sistema implementa cache persistente para as imagens da tela inicial com expiração automática de **5 horas**. Isso reduz significativamente o tempo de carregamento quando o usuário retorna ao site.

## Como Funciona

### 1. **Service Worker** (`service-worker.js`)
- Intercepta requisições de imagens
- Verifica se o cache é válido (menos de 5 horas)
- Serve imagens do cache se disponível e válido
- Busca do servidor se cache expirou

### 2. **IndexedDB**
- Armazena metadados de timestamp para cada imagem
- Permite verificar expiração sem re-fazer download
- Limpa automaticamente dados expirados

### 3. **Cache Manager** (`cache-manager.js`)
- Registra e gerencia o Service Worker
- Fornece funções de administração do cache

## Imagens em Cache
As seguintes imagens são automaticamente cacheadas:
- `./recursos/imgs/img1.webp`
- `./recursos/imgs/image.webp`
- `./recursos/imgs/img2.svg`
- `./recursos/imgs/img3.webp`
- `./recursos/imgs/img4.webp`
- `./recursos/imgs/img2.webp`
- `./recursos/imgs/logodev.png`

## Timeline do Cache
- **Primeira visita**: Imagens são carregadas do servidor e cacheadas
- **Próximas 5 horas**: Imagens são servidas do cache
- **Após 5 horas**: Cache expira, imagens são recarregadas do servidor
- **A cada novo carregamento**: Timestamp é atualizado

## Funções de Administração

### Limpar Cache Manualmente
```javascript
window.clearImageCache();
```
Abre um prompt pedindo confirmação e limpa todo o cache de imagens.

### Verificar Tamanho do Cache
```javascript
window.getCacheSizeInfo();
```
Retorna o tamanho total do cache em MB no console.

## Benefícios

✅ **Redução de Bandwidth**: Imagens não são recarregadas por 5 horas  
✅ **Carregamento Mais Rápido**: Primeira requisição do cache é instantânea  
✅ **Offline Parcial**: Usuários podem ver imagens cacheadas mesmo offline  
✅ **Expiração Automática**: Sem necessidade de manual invalidation  
✅ **Compatibilidade**: Funciona em todos os navegadores modernos  

## Configuração

### Alterar Tempo de Expiração
Edite o arquivo `service-worker.js`:
```javascript
const CACHE_EXPIRY_MS = 5 * 60 * 60 * 1000; // Altere este valor
// 1 hora: 60 * 60 * 1000
// 24 horas: 24 * 60 * 60 * 1000
```

### Adicionar Mais Imagens ao Cache
Edite a array `IMAGES_TO_CACHE` em `service-worker.js`:
```javascript
const IMAGES_TO_CACHE = [
    './recursos/imgs/img1.webp',
    './resources/imgs/nova-imagem.png', // Adicione aqui
];
```

## Suporte do Navegador
- ✅ Chrome 40+
- ✅ Firefox 35+
- ✅ Safari 11+
- ✅ Edge 17+
- ✅ Opera 27+
- ❌ Internet Explorer (não suportado)

## Monitoramento

### Verificar no DevTools (Chrome/Firefox)
1. Abra DevTools (`F12`)
2. Vá para a aba **Application** (Chrome) ou **Storage** (Firefox)
3. Veja o cache sob **Cache Storage** → `odonto-images-v1`
4. Veja os metadados em **IndexedDB** → `odonto-cache-db`

## Segurança
- ✅ HTTPS é recomendado (Service Workers funcionam melhor com HTTPS)
- ✅ Cache é isolado por domínio
- ✅ Sem exposição de dados sensíveis (apenas imagens públicas)

## Troubleshooting

### Service Worker não registra
- Verifique se está usando HTTPS ou localhost
- Abra Console e procure por erros de registro

### Cache não funciona
- Limpe o cache com `window.clearImageCache()`
- Faça hard refresh: `Ctrl+Shift+R` (Windows) ou `Cmd+Shift+R` (Mac)
- Verifique se o navegador suporta Service Workers

### Cache cresce muito
- Verifique o tamanho com `window.getCacheSizeInfo()`
- Reduza o tempo de expiração se necessário
- Implemente limpeza periódica se necessário
