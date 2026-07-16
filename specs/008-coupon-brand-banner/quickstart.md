# Quickstart — Validação do banner "CUPOM + loja"

Guia de validação end-to-end. Detalhes de contrato em [contracts/couponBrandCardPolicy.md](./contracts/couponBrandCardPolicy.md); regra de decisão em [data-model.md](./data-model.md).

## Pré-requisitos

- Branch `claude/showcase-coupon-images-fhfxgj`, PR contra `develop`.
- Staging autodeployado (`~/wabot-staging`, `http://178.105.54.0:3006`).
- Grupo monitorado de staging no modo preview.

## 1. Testes unitários (sem I/O, roda local)

```bash
cd ~/wabot
node --test test/coupon-brand-card-policy.test.js
node --test test/store-brand-card.test.js        # guard estrutural PRESERVADO
node --test test/link-kind.test.js               # urlHasProductId + resolveLinkKind inalterado
```

Esperado: verde. A matriz de `shouldUseCouponBrandCard` cobre as 5 condições e o caso crítico de não-regressão.

## 2. Ligar em staging (FR-013)

No VPS, `.env` de staging (gitignored, aplicação manual):

```
COUPON_BRAND_CARD_ENABLED=true
```

Aplicar com delete+start (pegadinha #1 — env cacheada pelo PM2):

```bash
pm2 delete api-staging
cd ~/wabot-staging && pm2 start ecosystem.config.cjs --only api-staging
pm2 save
```

## 3. Cenários de aceitação (checar no celular)

| Cenário | Envio | Esperado |
|---------|-------|----------|
| US1 cupom | mensagem de cupom real de cada loja (Amazon/Shopee/ML/Magalu), texto com "Cupom" + código, link sem produto | card com banner "CUPOM + <loja>" + `title` "Cupom <loja>" |
| US2 vitrine ML | link de vitrine ML (coleção, sem produto único) | card com banner "CUPOM + Mercado Livre", não produto aleatório |
| US3 não-regressão | produto Amazon e produto ML por **short link** (amzn.to / meli.la, sem ASIN/MLB na URL, texto sem "cupom") | card com **FOTO do produto**, NUNCA banner |
| URL com ID | link classificado coupon mas cuja URL resolvida tem ASIN/MLB | sem banner (tratado como produto) |
| Feature OFF | `COUPON_BRAND_CARD_ENABLED` ausente/`false` | comportamento bit-a-bit igual ao de hoje, nenhum banner |

Em todos: o card renderiza (nunca some) → invariante #1186 (`title` presente).

## 4. Rollback (SC-006)

Desligar a env e delete+start — reverte sem redeploy, < 1 min:

```
# .env: remover COUPON_BRAND_CARD_ENABLED ou setar =false
pm2 delete api-staging && cd ~/wabot-staging && pm2 start ecosystem.config.cjs --only api-staging && pm2 save
```

## 5. Promoção a produção

Só após validação em staging com links reais. Prod fica **default OFF** (`COUPON_BRAND_CARD_ENABLED` ausente) até decisão explícita de ligar. PR `develop → main` segue o fluxo canônico do AGENTS.md.
