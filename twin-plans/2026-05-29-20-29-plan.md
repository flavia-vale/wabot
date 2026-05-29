# Twin Development Plan
Generated: 2026-05-29
Task: implemente todos os fixes (`/m/op/offer` — conversão e busca de título/preço)
Quality Level: pragmatic

## Análise Técnica

O endpoint `POST /api/link-conversion/scrape-offer` (`src/api/routes/linkConversion.js`) faz conversão de afiliado + scraping de título/preço. Cinco falhas distintas afetam os 6 cenários reportados:

1. **Fallback de preço suprimido** — o re-scrape do link original só dispara quando `!hasUsefulOfferInfo(info)` (linha 224), mas `hasUsefulOfferInfo` (linha 133) retorna `true` com QUALQUER título. Quando o scrape do convertido traz título mas não traz preço (Amazon #5/#6, Shopee #3), o preço fica vazio. **Bug central.**
2. **Amazon descarta o slug** — no fallback `?tag=`, `amazon.js:119` monta `https://www.amazon.com.br/dp/${asin}` ignorando o slug do produto da URL resolvida, degradando o scrape e o título-por-URL.
3. **ML landing ancora no produto errado** — `extractFromMercadoLivreLanding` (`productInfoScraper.js:441`) pega o 1º bloco de preço do HTML da landing `/social/`, que é uma recomendação (retornou R$1,00 em vez de R$29,89 no exemplo 2).
4. **Shopee API v4 bloqueada** — `fetchShopeeItemInfo` usa `api/v4/item/get` (bloqueada por anti-bot, `error 90309999`). A API de afiliado (`shopee.js`, com HMAC) não é usada para preço; e as credenciais Shopee nem são repassadas a `fetchProductInfo`.
5. **Warning `ml_ssid_expired` silenciado** — `conversionResult.warning` é descartado (linha 202-204) e não aparece no retorno do `/scrape-offer`.

Restrições confirmadas: `resolveToCleanProductUrl` e `fetchMercadoLivreProductInfo` já existem; `mercadolivre.js` importa só `axios`+`logger` (sem ciclo com `productInfoScraper.js`); `buildCredentialsMap` já expõe `credentialsMap.shopee`. Testes ficam em `test/` (node:test), fixtures de HTML em `test/fixtures/`.

## Plano de Implementação

### Arquivos a Modificar:

- **`src/converters/shopee.js`** — Fix D: adicionar e exportar `fetchShopeeProductInfo(url, creds)` reutilizando `parseIds`/`resolveCanonical`/`buildAuth`, expandindo a query `productOfferV2` para incluir `price originPrice productName`. Retorna `{ title, newPrice, oldPrice }` ou `null`.
- **`src/converters/amazon.js`** — Fix B: criar helper `buildLongUrl(target, asin)` que preserva o slug (`/Slug/dp/ASIN`) da URL resolvida, caindo em `/dp/${asin}` só sem slug. Aplicar no `createAmazonShortLink` e no fallback `?tag=` (linha ~119, 122, 132/135).
- **`src/converters/productInfoScraper.js`** —
  - Fix D: importar `fetchShopeeProductInfo`; em `fetchShopeeItemInfo` (~338) usar a API de afiliado quando `opts.shopeeCreds?.appId` existir, com fallback para v4.
  - Fix C: importar `resolveToCleanProductUrl` de `mercadolivre.js`; em `fetchProductInfo` (~454), quando a URL for landing ML (`meli.la`/`mluvem.com`/path `/social/`), pré-resolver para a URL canônica antes do `fetchHtml`. `extractFromMercadoLivreLanding` vira último fallback.
  - Fix B: em `extractAmazonTitleAndPrice` (~233) ancorar seletores de preço (`.apexPriceToPay .a-offscreen`, `.priceToPay .a-offscreen`); na cadeia de título (~485) usar `extractTitleFallback` (og:title) antes de `titleFromUrl`.
- **`src/api/routes/linkConversion.js`** —
  - Fix A: trocar condição (linha 224) para `!info?.newPrice`; mesclar seletivamente preço do fallback mantendo título (`title: info?.title || fallbackInfo?.title`, `newPrice`/`oldPrice` do fallback, `finalUrl` mais canônico).
  - Fix D: passar `shopeeCredentials: credentialsMap.shopee || null` ao `fetchProductInfo` (linha 219).
  - Fix E: guardar `conversionResult` em variável (linha 202-204) e propagar `conversionWarning` no retorno (linha 238).
- **Testes**: `test/link-conversion-route.test.js` (Fix A: título presente/preço ausente; Fix E: conversionWarning), `test/converters-amazon.test.js` (Fix B: slug preservado), `test/product-info-scraper.test.js` (Fix C: landing âncora no produto certo; Fix D: Shopee via creds afiliado).

### Ordem de Implementação:
1. **Fix D em `shopee.js`** (nova função isolada, sem dependências).
2. **Fix B em `amazon.js`** (helper local isolado).
3. **Fix D em `productInfoScraper.js`** (import + uso da nova função).
4. **Fix C em `productInfoScraper.js`** (pré-resolução landing ML; `node --check` para confirmar ausência de ciclo).
5. **Fix B em `productInfoScraper.js`** (seletores Amazon + ordem da cadeia de título).
6. **Fix A + Fix E em `linkConversion.js`** (fallback, pass-through Shopee, conversionWarning).
7. **Testes** com fixtures.

### Riscos Técnicos:
- **Campos `price`/`originPrice` na query Shopee** podem não existir no schema → `fetchShopeeProductInfo` retorna `null` e cai no fallback v4 (sem regressão). Logar resposta bruta e validar em staging com creds reais.
- **Ciclo de import** `productInfoScraper.js` → `mercadolivre.js`: improvável (ML só importa axios/logger), mas validar com `node --check`.
- **Slug Amazon com acentos**: `new URL(target).pathname` mantém encoding — testar produto acentuado.
- **Fix A não pode perder título**: usar `title: info?.title || fallbackInfo?.title`.
- **Cenários #1 (meli.la), #3/#4 (preço Shopee)** dependem de credenciais válidas (SSID ML, appId/secretKey Shopee) — validação final só em staging com creds reais.

## Próximo Passo
Para implementar este plano, digite: ok, continue, ou approve
Para cancelar, digite: cancel ou inicie uma nova tarefa
