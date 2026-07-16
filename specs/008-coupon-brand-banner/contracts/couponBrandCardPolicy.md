# Contrato — Módulo LEAF `src/converters/couponBrandCardPolicy.js`

Módulo puro, sem I/O, sem importar `bot-worker.js`/`db.js`/sockets. Consumido por `buildManualLinkPreview` em `bot-worker.js`. Testável isoladamente.

## Export principal

```js
export function shouldUseCouponBrandCard({
  enabled,          // boolean — COUPON_BRAND_CARD_ENABLED === 'true'
  platform,         // string  — primary.platform
  linkKind,         // string  — primary.linkKind (resolveLinkKind, inalterado)
  couponTextSignal, // boolean — isCouponAnnouncement(sanitizedText) || sinal vitrine ML
  resolvedUrl,      // string  — primary.converted || primary.url
} = {}): boolean
```

### Semântica (FR-004 / FR-005 / FR-007)

Retorna `true` **apenas** quando TODAS forem verdadeiras:

1. `enabled === true`
2. `platform` é loja suportada pelo banner (`isBrandCardPlatform`: amazon | shopee | mercadolivre | magazineluiza)
3. `linkKind === 'coupon'`
4. `couponTextSignal === true`
5. a URL resolvida **não** contém ASIN (Amazon) nem MLB (Mercado Livre) — via detector reusado de `linkKind.js`

Caso contrário retorna `false` (comportamento atual / foto do produto).

### Invariantes

- Função **pura**: mesmas entradas → mesma saída, sem efeitos colaterais.
- Nunca lança: entradas ausentes/`undefined` → tratadas como falsas → retorna `false`.
- Não altera classificação de link (não chama `resolveLinkKind`); só **lê** `linkKind` e usa o detector de ID de produto.

## Dependência reusada de `linkKind.js` (adição de export, sem alterar `resolveLinkKind`)

```js
// Novo export em src/converters/linkKind.js — reusa AMAZON_ASIN_RE / MLB_ID_RE / PRODUCT_ID_DETECTORS
export function urlHasProductId(platform, url): boolean
```

- Retorna `true` se a URL revela ID de produto para a plataforma (Amazon: ASIN; ML: MLB), `false` caso contrário (inclui plataformas sem detector).
- `resolveLinkKind` permanece byte-a-byte inalterado (FR-010).

## Contrato de integração em `bot-worker.js` (`buildManualLinkPreview`)

- Substituir `const COUPON_BRAND_CARD_ENABLED = false` por leitura da env (`=== 'true'`).
- O chamador passa `couponTextSignal` (derivado de `isCouponMsg` / sinal vitrine ML) para `buildManualLinkPreview`.
- Trocar a guarda `COUPON_BRAND_CARD_ENABLED && primary?.linkKind === 'coupon'` (2 lugares: bloco do banner + argumento de `storePreviewTitle`) por uma única variável `useCouponBrandCard = shouldUseCouponBrandCard({...})`.
- `title` do card SEMPRE presente (`storePreviewTitle(..., useCouponBrandCard)`), invariante #1186 preservada.
- Falha ao gerar banner (`buildStoreBrandCardImage` → `null`) não interrompe o envio (FR-009).

## Testes esperados (contrato de verificação)

- `test/coupon-brand-card-policy.test.js` (novo): matriz das 5 condições — cada uma isoladamente falsa derruba a decisão; todas verdadeiras → `true`. Inclui explicitamente o cenário de não-regressão **produto Amazon/ML por short link (linkKind='coupon', couponTextSignal=false) → `false`** e o cenário **URL com ASIN/MLB → `false`** (FR-012).
- `urlHasProductId`: casos ASIN (`/dp/…`, `/gp/product/…`) e MLB (`MLB123456`) → `true`; short link sem ID → `false`.
- `test/store-brand-card.test.js`: **preservado** (guard estrutural de `storePreviewTitle`/`title`), não remover (FR-011).
