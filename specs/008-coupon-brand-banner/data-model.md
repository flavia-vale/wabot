# Phase 1 Data Model — Banner de marca "CUPOM + loja"

Feature **sem persistência**: nenhuma tabela, coluna ou migration. As "entidades" abaixo são estruturas lógicas em runtime.

## Entidade: Banner de marca (store brand card)

- **Origem**: `src/converters/storeBrandCard.js` (intocado).
- **Campos**: imagem JPEG quadrada 720x720, texto "CUPOM" + nome da loja, cor da marca; ~15-40KB.
- **Ciclo de vida**: gerada sob demanda, cacheada 1x por processo por loja (`Map` em `storeBrandCard.js`); falha de render também cacheada como `null`.
- **Lojas suportadas** (`BRAND_STYLES`): `amazon`, `shopee`, `mercadolivre`, `magazineluiza`.
- **Persistência**: nenhuma.

## Entidade: Decisão do banner (input do módulo LEAF)

Objeto de entrada de `shouldUseCouponBrandCard(input)` em `src/converters/couponBrandCardPolicy.js`:

| Campo             | Tipo    | Origem                                                        | Regra |
|-------------------|---------|--------------------------------------------------------------|-------|
| `enabled`         | boolean | `COUPON_BRAND_CARD_ENABLED === 'true'` (bot-worker)          | `false` → decisão sempre `false` |
| `platform`        | string  | `primary.platform`                                           | precisa ser loja suportada (`isBrandCardPlatform`) |
| `linkKind`        | string  | `primary.linkKind` (via `resolveLinkKind`, inalterado)       | condição (a): `=== 'coupon'` |
| `couponTextSignal`| boolean | `isCouponAnnouncement(sanitizedText)` OU sinal de vitrine ML | condição (b): precisa ser `true` |
| `resolvedUrl`     | string  | `primary.converted` / `primary.url`                          | condição (c): NÃO pode conter ASIN (Amazon) nem MLB (ML) |

**Regra de decisão (FR-004/FR-005)** — retorna `true` **somente** se todas verdadeiras:

```
enabled === true
  AND isBrandCardPlatform(platform)
  AND linkKind === 'coupon'
  AND couponTextSignal === true
  AND urlHasProductId(platform, resolvedUrl) === false   // sem ASIN/MLB
```

Qualquer condição falsa → `false` → comportamento atual (foto do produto / caminho existente). Princípio "na dúvida, foto de produto".

## Entidade: Flag de rollout `COUPON_BRAND_CARD_ENABLED`

- **Tipo**: variável de ambiente string.
- **Ativação**: exatamente `'true'`; qualquer outro valor/ausência → OFF.
- **Default**: OFF (prod); documentada como `true` em staging (FR-013).
- **Rollback**: desligar a env reverte sem redeploy (SC-006).

## Estados / transições

Não há máquina de estado persistida. A decisão é pura e stateless por mensagem: `(enabled, platform, linkKind, couponTextSignal, resolvedUrl) → {banner | comportamento atual}`.
