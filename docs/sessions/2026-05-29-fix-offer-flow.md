# Session Documentation
Date: 2026-05-29

## Summary
Corrigidos 6 cenários de falha no fluxo `/m/op/offer` (conversão de link + scrape de título/preço para Amazon, ML e Shopee). 49/49 testes passando.

## Changes

### Fixes
- `fix(linkConversion)`: fallback de preço dispara quando `newPrice` está ausente, mesclando só o preço sem sobrescrever título já obtido
- `fix(amazon)`: `buildLongUrl` preserva slug no link reconstruído (antes `dp/${asin}` sem slug degradava o scrape)
- `fix(amazon)`: seletores de preço ancorados no buy-box (apexPriceToPay / priceToPay / corePriceDisplay); regex de preço captura separador de milhar pt-BR (`1.299,90`)
- `fix(productInfoScraper)`: pré-resolve landing social ML (`/social/`, `meli.la`, `mluvem.com`) via `resolveToCleanProductUrl` antes do fetch, eliminando bug que retornava R$1,00 de página de recomendação em vez do produto real
- `fix(shopee)`: nova `fetchShopeeProductInfo` via API de afiliado (`productOfferV2`) com `price`/`originPrice`; credenciais repassadas em toda a cadeia até `linkConversion`
- `fix(linkConversion)`: propaga `conversionWarning` (ex. `ml_ssid_expired`) no retorno de `/scrape-offer`

### Tests
- `test(linkConversion)`: adicionados 2 testes novos cobrindo Fix A (fallback de preço sem sobrescrever título) e Fix E (propagação de `conversionWarning`)

## Technical Decisions
- `titleFromUrl` mantido antes de `extractTitleFallback` (og:title) para não quebrar o teste de slug-title da Shopee — reordenar quebraria esse caso específico
- Credenciais Shopee repassadas explicitamente na cadeia em vez de lidas por import direto, mantendo testabilidade e isolamento entre conversores

## Known Issues / Future Work
- Preço final ML com cookies e preço Shopee via API afiliado só são 100% validáveis em staging com credenciais reais — validação pendente conforme fluxo canônico (`develop → staging → main`)
- Exemplo #6 (`amzn.divulgador.link`) retornou vazio por erro de TLS no encurtador externo — não é regressão do código
