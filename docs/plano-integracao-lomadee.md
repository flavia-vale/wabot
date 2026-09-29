# Plano técnico — Integração LOMADEE (v1: só ofertas automáticas)

> Status: **PLANO, nada implementado.** Data: 2026-09-29.
> v1 = busca de ofertas para **Ofertas automáticas** (direct + fila de revisão).
> v2 (depois) = conversão de links. Fora do escopo da v1: ver seção 9.

## 0. Regra de honestidade sobre a API

A documentação oficial (`developer.socialsoul.com.vc`) estava fora do ar (503)
quando este plano foi feito. Só está confirmado por busca: a API de Ofertas exige
**app-token + sourceId**; existem também API de Cupons e API de Deeplink
(`https://api.lomadee.com/v2/{app-token}/deeplink/_create`). **Todo nome de
campo/parâmetro abaixo marcado com (⚠️ confirmar) é hipótese** e vira a Etapa 0.

## 1. Como as ofertas automáticas funcionam hoje (o que muda e o que não muda)

- `src/offerAutomation/shopeeOffers.js` → `fetchOffers()` chama a Shopee e
  devolve nós no formato Shopee (`itemId, productName, imageUrl, offerLink,
  price/priceMin/priceMax, priceDiscountRate, sales, ratingStar`).
- `dispatcher.js` (`runAutomation`, `resolveOffers`, `materializeAutomationOffer`)
  e `reviewDiscoveryService.js` consomem esse formato. **A Shopee está fixa em:**
  credencial `platform: 'shopee'` (dispatcher, discovery, rota `search-preview`),
  `storeName: 'Shopee'`, título padrão "Produto Shopee", story do Instagram.
- Já existe uma "costura" limpa: `fetchOffersFn` é injetável em `resolveOffers`,
  `runAutomation`, `discoverReviewItems` e `searchOffersPreview`.
- Dedup (`productDedupKey` por nome + `OfferAutomationSentLog` por grupo/preço +
  `sentItemIds`) é independente da loja e serve para a Lomadee.

## 2. Decisão de arquitetura (recomendada)

**Adaptador que devolve o MESMO formato dos nós da Shopee** (`src/offerAutomation/lomadeeOffers.js`
com `fetchOffers()` de mesma assinatura) + um campo `provider` na automação que
escolhe qual `fetchOffers` e qual credencial usar.

- Por quê: dispatcher, fila de revisão, dedup, cupom, variação e Stories seguem
  intactos (menor risco de regressão, menor diff).
- Alternativa descartada: formato neutro novo + reescrever dispatcher/review.
  Mais limpo, mas toca o caminho que envia para todas as clientes hoje.
- Mapa de escolha em um só lugar: `src/offerAutomation/providers.js`
  (`{ shopee: {fetchOffers, credentialPlatform, hasCreds, storeLabel}, lomadee: {...} }`).
  Regra do repo: um chokepoint só, não espalhar `if (provider === ...)`.

## 3. Decisões que dependem da usuária (perguntar ANTES de codar)

1. **Credencial por cliente ou token único da plataforma?**
   Recomendado: **por cliente** (cada cliente cadastra o próprio app-token +
   sourceId; a comissão é dela) — igual ao modelo da Shopee/Amazon/ML.
   Token único faria a comissão cair na conta da plataforma e mudaria o modelo de negócio.
2. Quais lojas da Lomadee entram? (a Lomadee mistura lojas; algumas o repo já
   converte com afiliado próprio — ML, Amazon, Magalu, AliExpress, SHEIN.
   Risco de a cliente ganhar comissão em dois lugares/conflito de tag.) Sugestão:
   v1 sem filtro por loja, mas com lista de exclusão configurável por env.
3. Plano: manter **PRO/Trial** (já é regra de Ofertas automáticas) — sem plano novo.
4. Liberar para todas ou para lista de contas no começo? Sugestão: allowlist.

## 4. Passo a passo (cada etapa = 1 PR pequeno contra `develop`)

### Etapa 0 — Descoberta da API (sem código de produção)
- Com um app-token/sourceId de teste, rodar `scripts/diag-busca-lomadee.mjs`
  (read-only, novo, no padrão dos `diag-*.mjs`) e registrar **em
  `docs/rca/ofertas-automaticas-e-criar-oferta.md`** a saída REAL: endpoint,
  parâmetros (palavra-chave, ordenação, página, tamanho — ⚠️ confirmar), campos
  de preço/preço antigo/desconto (⚠️ nem toda oferta traz desconto), imagem, loja,
  link (já é o link de afiliado?), limites de taxa, tamanho máximo de página.
- Decide: (a) se dá para filtrar por desconto mínimo; (b) se há "mais vendidos";
  (c) como paginar (a rotação `nextOfferPage` precisa de página numérica);
  (d) se o link expira; (e) o que a sandbox devolve vs. produção.
- Impacto: nenhum em produção. Bloqueia as demais etapas.

### Etapa 1 — Banco (staging antes de prod)
- `prisma/schema.prisma`: `OfferAutomation.provider String @default("shopee")`.
- Migration só adiciona coluna com default → automações existentes não mudam.
- Impacto: SQLite; coluna com default é barata. Backup já é diário
  (`scripts/backup_prod.sh`). Conferir `COUNT(*)` antes/depois no staging.
- `src/domain/lgpd/dataRequest.js` já cobre `offerAutomation`; credencial
  Lomadee entra pela tabela `Credential` existente (nada novo a apagar).

### Etapa 2 — Credencial `lomadee`
- `src/credentialHealth.js`: `PLATFORM_LABELS.lomadee`, `REQUIRED_FIELDS.lomadee = ['appToken','sourceId']`,
  `FIELD_LABELS` em português simples ("o token do aplicativo Lomadee", "o código da sua fonte"),
  `sanitizeCredentialBody` (trim, sem espaços/aspas), `getFormatWarnings`.
- ⚠️ `PLATFORMS = Object.keys(PLATFORM_LABELS)` é iterado em vários lugares
  (validação, listagem "Minhas credenciais", worker de conversão, admin,
  `dashboard/lib/painel/logsCopy.js`). **Auditar todo uso de `PLATFORMS`** e
  garantir que `lomadee` NÃO entra em caminho de conversão de link (v1 não
  converte) nem em "faltou cadastrar a loja"/`skip:no_valid_conversions`.
  Teste que falha se `lomadee` aparecer nesses caminhos.
- Segurança: criptografia já existe (`credentialCrypto`). **O app-token vai no
  caminho da URL (`/v2/{app-token}/...`)** → nunca logar URL/erro do axios
  cru (vaza token em log/PM2). Mascarar no adaptador (`redactLomadeeUrl`).
- Impacto: cliente nova vê um cartão a mais em credenciais; sem token nada muda.

### Etapa 3 — Adaptador `lomadeeOffers.js`
- `fetchOffers({ keyword, minDiscountPct, limit, excludeItemIds, creds, sortType, page })`
  → `{ offers, rawCount, dropped }` com nós no formato Shopee:
  - `itemId = 'lomadee:<id>'` (prefixo evita colisão com itemId da Shopee em
    `sentItemIds`/`OfferAutomationSentLog`);
  - `offerLink` = link Lomadee (rastreável) — **nunca reescrever/encurtar**;
  - `price`/`priceMin`, `priceDiscountRate` calculado de preço antigo (se vier);
  - `sales`, `ratingStar` = null (a Lomadee provavelmente não traz — ⚠️ confirmar);
  - campo extra `storeName` (loja real: Magalu, Casas Bahia…).
- Reusar `filterOffers`/`dedupeOffersByProduct`/`resolveShopeeOfferPrice` (mesmas regras
  de preço ausente e desconto mínimo).
- Timeout 10 s como na Shopee; erro da API **lançado** (nunca disfarçado de
  `no_offers_found` — lição do RCA da Shopee).
- **Sem cache** (a doc da Lomadee desaconselha cache de ofertas: preço/estoque mudam).
- Mapear `sortType` da tela → ordenação Lomadee só onde existir equivalente
  (⚠️ confirmar); o resto cai em relevância e a tela mostra só as opções válidas.
- Testes `test/lomadee-offers.test.js` (axios mockado; sem rede).

### Etapa 4 — Ligar o provider no fluxo (o ponto mais sensível)
- `providers.js` + `resolveOffers` recebe `provider` e escolhe `fetchOffersFn` e
  credencial. `runAutomation`, `discoverReviewItems` e `POST /search-preview`
  trocam o `findUnique({platform:'shopee'})` fixo por `providerFor(automation).loadCreds`.
- Textos fixos "Shopee" viram dinâmicos: `automationOfferProduct` usa
  `offer.storeName ?? 'Shopee'`; título padrão `Produto`; `storeName` do Story.
- Códigos de skip novos: `no_lomadee_credentials`, `invalid_lomadee_credentials`
  + textos em `ofertas-automaticas/page.js` e `dashboard/lib/mobileLogs.js`.
- **Não regredir:** para `provider = 'shopee'` (todas as automações atuais) o
  comportamento tem que ser byte a byte igual → testes de regressão existentes
  (`test/offer-automation.test.js`) rodam sem mudança e continuam verdes.
- Rota `POST/PATCH /api/offer-automations`: validar `provider ∈ {shopee, lomadee}`;
  `lomadee` só se a flag estiver ligada para a conta (Etapa 6) e a credencial existir.
  `listType`/`prioritizeAMS`/`isKeySeller` são conceitos da Shopee → ignorados
  (e escondidos na tela) para Lomadee.

### Etapa 5 — Tela (`dashboard/app/painel/ofertas-automaticas/page.js`)
- Seletor "Onde buscar: Shopee | Lomadee" (padrão Shopee). Seguir
  `docs/design-system/design-system-v2.html` (tokens, sem hex solto).
- Trocar os avisos "só na Shopee" (linhas ~301 e ~529) por texto que reflita as duas.
- Para Lomadee: esconder controles exclusivos da Shopee; mostrar aviso claro se
  não há credencial ("Cadastre seu token Lomadee em Minhas credenciais").
- Voz/texto em português simples; nada de "appToken/sourceId" sem explicar.
- Impacto: automações antigas abrem iguais (provider shopee).

### Etapa 6 — Flag de liberação gradual
- Padrão de `reviewFlags.js`: `LOMADEE_OFFERS_ENABLED` + `LOMADEE_OFFERS_USER_IDS`
  (allowlist). Desligada = rota recusa `provider=lomadee`; cron ignora automação
  `lomadee` com log claro.
- Mudar env exige `pm2 delete` + `start` (não `restart --update-env`).

### Etapa 7 — Diagnóstico e observabilidade
- `scripts/diag-busca-lomadee.mjs` (read-only, `--keyword`, lê a credencial do
  banco, mascara o token) — atalho novo no "Mapa de sintomas" do `AGENTS.md`.
- Log de contagem por motivo de descarte (igual `OFFER_DROP_REASON`) para separar
  "sem oferta" de "oferta sem preço/desconto".

### Etapa 8 — Testes, staging, produção
1. `node --test` dos arquivos afetados + suíte completa; teste do teto de
   `AGENTS.md` (40 KB) — só uma linha nova no índice/mapa.
2. PR → `develop` → deploy automático em staging (`inline`).
3. Validar em `http://178.105.54.0:3006` com credencial de teste: busca (preview),
   envio direto, fila de revisão, Story (se houver), dedup entre 2 automações
   no mesmo grupo, automação Shopee antiga inalterada.
4. Só então PR `develop → main`. Em produção (`remote`): o worker precisa de
   `pm2 restart bot-supervisor --update-env` **só se** mexermos em
   `bot-worker.js`/`core/`; este plano roda no cron da API (`src/offerAutomation`),
   então o deploy da API basta — confirmar no `docs/rca/deploy-e-infra.md`.
5. Liberar primeiro via allowlist; observar 48 h; ampliar.

## 5. Mapa de impactos e riscos

| Área | Risco | Mitigação |
|---|---|---|
| Automações Shopee existentes | regressão no dispatcher | `provider` default `shopee`; testes atuais intactos; PR separado da Etapa 4 |
| Vazamento de token | app-token na URL cai em log | mascarar URL/erros; nunca `console.log(err)` cru do axios |
| Dedup | mesmo produto em Shopee e Lomadee | `productDedupKey` por nome já cobre entre lojas; `itemId` com prefixo |
| Desconto mínimo | Lomadee pode não trazer preço antigo → tudo filtrado | Etapa 0 mede; se faltar, aviso na tela e `minDiscountPct` desativado p/ Lomadee |
| Imagem | miniatura pequena/hotlink bloqueado | reaproveitar `imageRefererUrl` + `previewImageFallbackPolicy`; medir na Etapa 0 |
| Comissão/conflito | loja coberta por afiliado próprio da cliente | decisão 3.2; lista de exclusão |
| Link | link Lomadee expirar ou perder rastreio | não reescrever; testar clique real no staging |
| Limite de taxa | N automações × tick de 60 s | sem cache, mas 1 chamada por execução (igual Shopee); backoff em 429 |
| Credenciais | `PLATFORMS` usado em caminhos de conversão | auditoria + teste (Etapa 2) |
| Fila de revisão (desligada por padrão) | `discoverReviewItems` também busca | coberta pela Etapa 4 (mesmo `resolveOffers`) |
| Textos "Shopee" | oferta Lomadee saindo com "Shopee" | Etapa 4 + teste de snapshot |
| **Memória (REGRA #1)** | — | **Sem processo PM2 novo, sem cache, sem worker, sem Redis: impacto de RAM ≈ 0.** Só uma chamada HTTP a mais por execução |
| Banco | migration | só coluna com default; staging antes de prod |
| Cobrança/Plano | — | mantém PRO/Trial já existente |

## 6. Ordem de PRs sugerida

1. Etapa 0 (script + RCA com dados reais) — desbloqueia o resto.
2. Etapas 1+2 (coluna + credencial + auditoria de `PLATFORMS`).
3. Etapa 3 (adaptador + testes, ainda sem ligar).
4. Etapa 4 (providers + dispatcher/review/rota) — PR mais crítico, revisão extra.
5. Etapas 5+6 (tela + flag).
6. Etapa 7 (diag + docs/AGENTS.md índice).

Todos: branch a partir de `develop`, PR contra `develop`, staging, depois `main`.

## 7. Critérios de aceite da v1

- Cliente com token Lomadee cria automação, vê o preview, e o grupo recebe oferta
  com loja, preço, imagem e link Lomadee corretos.
- Automação Shopee existente segue idêntica (testes + comparação de texto).
- Sem token, o painel explica o que falta; nada quebra silenciosamente.
- Nenhum token aparece em log.
- RAM do VPS inalterada (conferir swap após 48 h).

## 8. Perguntas em aberto para a Etapa 0

Endpoint/versão atual (v2 ainda vigente?); paginação; ordenação; campos de
desconto; lojas disponíveis; expiração do link; limite de requisições; diferença
sandbox × produção; se o cadastro da cliente exige aprovação por loja.

## 9. Fora da v1 → v2 (conversão de links)

Usar a API de Deeplink (`_create`) para converter links coladas/espelhadas de
lojas que a Lomadee cobre. Impactos a planejar então: entra em
`src/converters/`, `conversionScheduler`, `mirrorLinkGuard` (não converteu →
não envia), `PLATFORMS`/"Minhas credenciais" nos caminhos de conversão, ordem de
prioridade frente ao afiliado direto (Amazon/ML/Magalu), ROI/relatórios de
comissão, cache de deeplinks e limite de taxa (aqui o volume é muito maior que
nas ofertas automáticas → **avaliar RAM/cache com a REGRA #1**). Não começar
antes da v1 validada em produção.
