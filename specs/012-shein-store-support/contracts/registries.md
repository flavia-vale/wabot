# Contrato — Checklist de registries

O sistema é registry-driven: adicionar loja é preencher mapas existentes. **Toda linha abaixo é
obrigatória na mesma PR.** Linhas conferidas no código em 2026-08-17.

⚠️ As 6 primeiras da tabela D são a lista de domínios duplicada. Fazer só o backend faz a loja
funcionar no espelhamento e o painel dizer "link não suportado".

---

## A. Detecção e conversão

| # | Arquivo:linha | O que fazer |
|---|---|---|
| A1 | `src/detector.js:4-9` | `PATTERNS.shein` com os domínios reais, mantendo o prefixo `(?:[a-z0-9-]+\.)*`. **Não incluir `s.shein.com`** (não existe). Alimenta `detectLinks` **e** `isOfferUrl` — sem isso `removeNonOfferUrls` apaga o link da mensagem espelhada |
| A2 | `src/converters/index.js:1-11` | `import { convert as convertShein } from './shein.js'` + entrada `shein` em `CONVERTERS` |
| A3 | `src/converters/linkKind.js:24-27` | `PRODUCT_ID_DETECTORS.shein = (url) => /-p-\d+|[?&]goods_id=\d+/i.test(url)` — defesa em profundidade; o conversor já devolve `linkKind` explícito, que tem precedência |

## B. Configuração e credencial

| # | Arquivo:linha | O que fazer |
|---|---|---|
| B1 | `src/credentialHealth.js:3` | `PLATFORM_LABELS.shein = 'SHEIN'` (habilita `PLATFORMS`, e com isso `PUT`/`DELETE`) |
| B2 | `src/credentialHealth.js:51` | `REQUIRED_FIELDS.shein = ['tag']` |
| B3 | `src/credentialHealth.js:66` | ramo `shein` em `getFormatWarnings` (ver `credential-shein.md`) |
| B4 | `src/credentialHealth.js:200` | ramo `shein` em `sanitizeCredentialBody` (normaliza link → número) |
| B5 | `prisma/schema.prisma:294` | default de `BotConfig.platforms` inclui `shein` |
| B6 | `prisma/migrations/<ts>_botconfig_platforms_add_shein/` | migration DML idempotente (sem `ALTER TABLE`) |
| B7 | `src/api/routes/config.js:12` | CSV default |
| B8 | `src/bot-worker.js:633` | CSV default |
| B9 | `scripts/reset-legacy-botconfig-fields.mjs:29` | CSV default |
| B10 | `src/api/routes/groups.js:175` | whitelist `allowedPlatforms` ganha `'shein'` |

### NÃO alterar (FR-008)

| Arquivo:linha | Por quê |
|---|---|
| `src/credentialSaveCheck.js:25` | `PLATFORMS_WITH_SESSION_CHECK` — a credencial da SHEIN não vence |
| `src/credentialExpiry/policy.js:19` | `EXPIRY_ALERT_PLATFORMS` — idem |
| `src/bot-worker.js:234` | `TITLE_MISMATCH_GUARD_PLATFORMS` — sem título raspado confiável, o guard bloquearia oferta boa (research.md D-007) |

## C. Apresentação da oferta

| # | Arquivo:linha | O que fazer |
|---|---|---|
| C1 | `src/bot-worker.js:1501` | `STORE_PREVIEW_TITLES.shein = 'SHEIN'` (FR-021 — o campo `title` do card **nunca** pode ser omitido) |
| C2 | `src/converters/storeBrandCard.js:28` | `BRAND_STYLES.shein = { store: 'SHEIN', bg: '#000000', fg: '#FFFFFF', accent: '#FFFFFF' }` |
| C3 | `src/core/mirrorTemplate.js:17` | `PLATFORM_LABELS.shein = 'SHEIN'` |
| C4 | `src/core/copyLinter.js:11` | `BRAND_RE` ganha `shein` |
| C5 | `src/converters/imageScrapers.js:419` | ramo `shein` em `fetchProductImage`: `og:image` da página do oneLink + strip do sufixo de miniatura em `img.ltwebstatic.com` (research.md D-005) |
| C6 | `src/converters/productInfoScraper.js:254,278` | frase promocional genérica da SHEIN em `BOGUS_SCRAPE_TITLES` / `BOGUS_SCRAPE_TITLE_PATTERNS` (FR-020) |

## D. Painel (as 6 duplicações + catálogos)

| # | Arquivo:linha | O que fazer |
|---|---|---|
| D1 | `src/detector.js:4` | (= A1) fonte do backend |
| D2 | `dashboard/app/painel/converte-links/page.js:15` | `SUPPORTED_LINK_RE` ganha os domínios da SHEIN |
| D3 | `dashboard/app/painel/converte-links/page.js:42` | texto "Use um link de Amazon, Mercado Livre, Shopee ou Magazine Luiza" ganha SHEIN |
| D4 | `dashboard/app/painel/criar-oferta/page.js:25` | `STORES` ganha `{ test: /shein/i, name: 'SHEIN', bg: '#000000', fg: '#fff', mark: 'S' }` |
| D5 | `dashboard/app/painel/criar-oferta/page.js:286` | texto "Cole um link de …" ganha SHEIN |
| D6 | `dashboard/lib/mobileOfferComposer.js:60` | `COUPON_STORES` ganha `{ key: 'shein', nome: 'SHEIN', cor: '#000000' }` |
| D7 | `dashboard/lib/mobileOfferComposer.js:129` | detecção por host: `if (host.includes('shein')) return 'shein'` |
| D8 | `src/converters/offerEngine.js:52` | `inferTitleFromUrl` — ramo SHEIN **opcional**, só para `-p-<slug>` direto. O destino do oneLink (`/br/ark/default`) não tem slug, então na maioria dos casos não há título a inferir |
| D9 | `src/converters/productInfoScraper.js:310` | `extractTitleFromUrl` — mesma nota de D8 |
| D10 | `dashboard/app/painel/grupos/page.js:20` | `ALL_PLATFORMS` |
| D11 | `dashboard/lib/mobileGroupPicker.js:44` | `MOBILE_GROUP_PLATFORMS` |
| D12 | `dashboard/lib/mobileLogs.js:12` | `MOBILE_LOG_PLATFORM_LABEL.shein = 'SHEIN'` (FR-001 — rotulagem nos registros) |
| D13 | `dashboard/lib/mobileCouponStore.js:9` | `DEFAULT_COUPON_LINKS` ganha `shein: ''` |
| D14 | `dashboard/lib/painel/affiliatePlatforms.js:75-86` | entrada `shein` (ver `credential-shein.md`) |

> A allowlist do painel vai para o **bundle** do Next: mudança em D2-D14 só vale depois de
> `cd dashboard && npm run build`.

---

## E. Testes

| Arquivo | O que cobrir |
|---|---|
| `test/converters-shein.test.js` (novo) | INV-1..INV-6 (ver `converter-shein.md`) |
| `test/shein-shortlink-resolve.test.js` (novo) | hops, `<input id="url">`, parada em `/risk/`, cookies, `maxHops` |
| `test/migrations-botconfig-platforms-shein.test.js` (novo) | migration é DML puro (sem `ALTER TABLE`) e idempotente |
| `test/detector.test.js` | domínios reais casam; `s.shein.com` e host colado (`notshein.com`) **não** casam |
| `test/link-kind.test.js` | produto vs cupom |
| `test/store-brand-card.test.js` | banner SHEIN renderiza; guarda estrutural do `title` segue valendo |
| `test/product-info-scraper.test.js` | frase genérica reprovada como título |
| `test/mirror-template.test.js` | rótulo da loja |
| `test/painel-linguagem-leiga.test.js` | jargão da SHEIN não chega à tela |
| `test/painel-ids-afiliada-privacy.test.js` | nenhum campo de sessão para SHEIN |
| `test/groups-route-image-mode.test.js` | `shein` aceito na whitelist de plataformas |
| `test/mobile-*.test.js` | catálogos móveis |
| suíte inteira (`npm test`) | FR-023 — zero regressão nas quatro lojas existentes |
