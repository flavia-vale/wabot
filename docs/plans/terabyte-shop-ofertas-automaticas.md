# Plano técnico — Terabyte Shop nas Ofertas Automáticas (V1)

Status: **proposta, nada implementado**. Escopo V1 = **só ofertas automáticas**.
Conversão de links (colados / espelhados / "Criar oferta") = **V2**, fora daqui.

## 0. O que sabemos e o que NÃO sabemos (dado x hipótese)

**Dado (lido no código, 2026-09-30):**
- Toda a ofertas automáticas é **Shopee-only**, fixa em 7 pontos:
  1. `runAutomation` busca só a credencial `platform: 'shopee'` (`src/offerAutomation/dispatcher.js`).
  2. `discoverReviewItems` idem (`reviewDiscoveryService.js`).
  3. `fetchOffers` chama a `productOfferV2` GraphQL da Shopee (`shopeeOffers.js`).
  4. `automationOfferProduct` grava `storeName: 'Shopee'` e título default `'Produto Shopee'`.
  5. `chooseCoupon({ platform: 'shopee' })` — cupom fixo em Shopee.
  6. Story do Instagram: `storeName: 'Shopee'`.
  7. Rota `search-preview` exige credencial Shopee (`src/api/routes/offerAutomation.js`).
- `OfferAutomation` não tem campo de loja; `sentItemIds` guarda só o id.
- `productDedupKey` = **nome do produto normalizado, sem loja** → o mesmo nome em duas lojas colidiria.
- `PLATFORMS` (`src/credentialHealth.js`) e `BotConfig.platforms` (default string) não conhecem Terabyte.
- Não há nenhuma menção a Terabyte no código de produto (só em páginas de comparação com concorrentes).

**Dado (web):** a Terabyte tem *Programa de Parceiros* próprio, com cadastro por formulário e
**aprovação manual**. O link leva o código do parceiro no parâmetro **`p=`**; vínculo de **72 h**
com renovação por navegação; painel com Vendas, Comissões, Links e Campanhas.
Fontes: [landing de parceiros](https://landing.terabyteshop.com.br/parceiros/),
[regras do programa](https://www.terabyteshop.com.br/site/regras-programa-de-parceiros).

**NÃO sabemos (hipóteses — precisam de verificação antes de codar):**
- H1. Existe API/feed de produtos para parceiros? **A busca não achou nenhum.** A Shopee tem API
  de ofertas; a Terabyte, até prova em contrário, não.
- H2. O site permite leitura automatizada (Cloudflare/anti-bot)? Um fetch nosso à página de regras
  levou **403** (pode ser só a ferramenta, não prova nada sobre o robô no VPS).
- H3. Os termos do programa permitem divulgação automatizada / por bot, e exigem algo do tipo
  de mostrar preço, prazo de validade ou proibir cupom próprio? (Não consegui ler as regras.)
- H4. O código `p=` vale em qualquer URL de produto ou só em links gerados no painel (encurtados)?
- H5. Comissão varia por categoria/campanha? (Afeta se vale priorizar algo.)

**Consequência:** a maior incerteza do V1 **não é a integração, é a FONTE das ofertas**.
Sem API, a fonte seria raspagem do próprio site — frágil e com risco de bloqueio. Por isso a
Fase 0 abaixo é um *spike* que decide se o V1 é viável e por qual caminho.

---

## Fase 0 — Spike de viabilidade (sem código de produto)

Objetivo: responder H1–H4 com dado. Saída = 1 página `docs/rca/terabyte.md` com a decisão.

| # | Passo | Como | Decide |
|---|---|---|---|
| 0.1 | **Flavia** lê as regras do programa logada (403 pra mim) e confirma H3/H4/H5 | ler o texto e colar aqui as regras de "divulgação automatizada", cupom e preço | se pode automatizar; se o `p=` vale em URL de produto |
| 0.2 | **Flavia** olha no painel de parceiro se há "API", "feed", "XML", "Google Shopping" ou "lista de produtos" | print/menu | H1: se existir feed, caminho A; senão B |
| 0.3 | Do VPS, 1 comando: `curl -sI -A "Mozilla/5.0" https://www.terabyteshop.com.br/busca?str=ssd \| head -n 15` | status + `server`/`cf-ray` | H2: 200 = ok; 403/503 + `cf-` = bloqueio |
| 0.4 | Se 0.3 = 200: script read-only `scripts/diag-terabyte-busca.mjs` (a criar) que busca 3 palavras-chave e imprime nome/preço à vista/preço de/URL/imagem de 5 itens | rodar no VPS | se dá pra extrair título, preço e "de/por" de forma estável (JSON-LD/`__NEXT_DATA__`/HTML) |
| 0.5 | Rodar o 0.4 três vezes, com 10 min de intervalo | comparar | estabilidade da estrutura e taxa de bloqueio |

**Critério de parada:** se 0.1 proibir automação **ou** 0.3/0.5 mostrar bloqueio recorrente e não
houver feed (0.2) → **não seguir**; registrar no `docs/rca/terabyte.md` e voltar ao backlog.

Caminhos possíveis para a fonte (escolhido na Fase 0):
- **A. Feed/API oficial** (preferido, se existir).
- **B. Leitura das páginas públicas** (busca/categoria/ofertas) com `axios` + parser leve. Já usamos esse
  padrão em `productInfoScraper.js`/`imageScrapers.js`. Sem navegador headless.
- **C. Lista curada** (cliente/admin cola URLs de produtos; robô só lê preço). Fallback barato e legal, mas
  não é "oferta automática por palavra-chave".

⚠️ **Não usar Playwright/Chromium no worker** para contornar bloqueio: RAM (regra #1 do AGENTS.md).

---

## Fase 1 — Modelo de dados e "loja" como conceito (sem mudar comportamento da Shopee)

Princípio: tudo com **default `shopee`** → automação existente não muda 1 byte.

| # | Passo | Arquivo | Impacto / cuidado |
|---|---|---|---|
| 1.1 | `OfferAutomation.store String @default("shopee")` (migration aditiva) | `prisma/schema.prisma` | Migration passa por **staging antes de prod**. Backfill = default. Conferir contagem antes/depois. |
| 1.2 | `OfferAutomationSentLog.store String @default("shopee")` **ou** prefixar `productKey` só para lojas ≠ shopee (`terabyte:<nome>`) | schema + `shopeeOffers.js` | **Recomendado: prefixar** (sem migration extra e sem mexer nas linhas antigas). Sem isso, mesmo nome em Shopee e Terabyte colide na dedup do grupo. |
| 1.3 | `sentItemIds` da Terabyte: usar o **SKU/slug** da Terabyte como id (string) | dispatcher | Não colide com id numérico da Shopee, e ainda assim fica por automação. |
| 1.4 | Registrar `terabyte` em `PLATFORM_LABELS`/`REQUIRED_FIELDS` (`partnerCode`) e em `ACCESS_CODE_RULES` se houver validação | `src/credentialHealth.js` | ⚠️ `PLATFORMS` é usado por `Object.keys` em várias telas/diagnósticos (mapa de credenciais, `basic-sem-recursos`, "faltou cadastrar a loja"). Auditar cada uso ANTES: Terabyte **não** pode aparecer como "faltando" para quem nunca a quis. |
| 1.5 | `BotConfig.platforms` (string default): **não** incluir `terabyte` no default | schema | Evita ligar loja sozinha para todo mundo. |
| 1.6 | Guard de plano: decidir com a dona do produto se Terabyte é **Basic ou PRO** | `src/billing/plans.js`, `docs/rca/planos-basic-pro.md` | Decisão de produto; se PRO → `FEATURE_REQUIRES_PRO` na rota. |

## Fase 2 — Camada de fonte de ofertas (o coração)

Hoje `resolveOffers` chama `fetchOffersFn` da Shopee direto. Extrair um **contrato de loja**:

```
StoreOfferSource {
  store: 'shopee' | 'terabyte'
  credentialPlatform: string
  fetchOffers({ keyword, minDiscountPct, limit, excludeItemIds, creds, sortType, page }) -> { offers, rawCount, dropped }
  // offer normalizada: { itemId, productName, imageUrl, offerLink, price, priceDiscountRate, originalPrice?, ... }
}
```

| # | Passo | Arquivo | Impacto / cuidado |
|---|---|---|---|
| 2.1 | Criar `src/offerAutomation/stores/index.js` com o registro; `shopee` = adaptador fino de `shopeeOffers.js` | novo | **Refatoração sem mudar Shopee**: teste de caracterização primeiro (`test/offer-automation.test.js` já existe). |
| 2.2 | `resolveOffers`, `runAutomation`, `discoverReviewItems`, `searchOffersPreview` passam a escolher a fonte por `automation.store` | `dispatcher.js`, `reviewDiscoveryService.js` | Trocar a busca de credencial fixa `'shopee'` por `source.credentialPlatform`. Mensagens de skip: `no_terabyte_credentials`, `invalid_terabyte_credentials`. |
| 2.3 | `src/offerAutomation/stores/terabyte.js`: `fetchOffers` (caminho da Fase 0) | novo | Timeout 10 s como a Shopee; **erro nunca vira `no_offers_found`** (mesma lição do RCA da Shopee: erro disfarçado de "sem oferta"). Retornar `Error('terabyte_source_error: …')`. |
| 2.4 | Normalização de preço: **preço à vista (Pix/boleto)** vs **parcelado**. Escolher UM e rotular | `terabyte.js` | ⚠️ Risco nº 1 de "preço errado" (ver `lojas-conversao.md`, RCA de preço Amazon). Decisão: publicar o **à vista** com a palavra "no Pix" no texto; nunca misturar. Sem preço confiável → descarta (padrão `OFFER_DROP_REASON.NO_PRICE`). |
| 2.5 | "De/por": `minDiscountPct` só funciona com preço original. Sem preço original ⇒ não filtra por desconto; documentar que desconto mínimo > 0 pode zerar resultados | `terabyte.js` | Se a fonte não trouxer "de", `filterOffers` descartaria tudo por `BELOW_DISCOUNT`. Separar contador `sem_preco_original`. |
| 2.6 | `sortType`: a Terabyte terá subconjunto (relevância, menor/maior preço). Mapear ou esconder as opções que a fonte não suporta | `dashboard/lib/offerAutomationSearch.js` | Não prometer "mais vendidos"/"maior comissão" se a fonte não tem. Textos em linguagem leiga. |
| 2.7 | `storeName` e título default vindos da loja (`'Terabyte'`, `'Produto Terabyte'`) | `dispatcher.js` (`automationOfferProduct`, Story) | Hoje fixo `'Shopee'` — 3 lugares. |
| 2.8 | Cupom: `chooseCoupon({ platform: automation.store })`. V1: **cupom desligado para Terabyte** (`useCoupons` ignorado) até a cliente poder cadastrar cupom Terabyte | `dispatcher.js`, `clientCouponPolicy.js` | `ClientCoupon.platform` e `COUPON_LINK_DOMAINS` não conhecem a loja; ligar sem isso publica cupom errado. |

## Fase 3 — Link de afiliado da Terabyte

| # | Passo | Cuidado |
|---|---|---|
| 3.1 | Credencial `terabyte` = `{ partnerCode }` (o valor de `p=`), guardada e **criptografada** como as outras (`docs/rca/credenciais-e-seguranca.md`) | Nunca logar o código. |
| 3.2 | `buildTerabyteAffiliateUrl(productUrl, partnerCode)`: função **pura** que acrescenta/substitui `p=`, preserva o resto da query, e **recusa** host ≠ `terabyteshop.com.br` | Evita publicar link de outro domínio ou sem comissão. |
| 3.3 | **Guard de não-publicar-sem-link**: se o link final não contém `p=<código>` → não envia (mesma filosofia de `mirrorLinkGuard`) | Sem isso, a oferta sai e a cliente não recebe comissão, sem ninguém notar. |
| 3.4 | Confirmar H4 na Fase 0: se `p=` só vale em link gerado pelo painel, o caminho muda (ficamos em "C. lista curada") | — |
| 3.5 | Vínculo de 72 h ⇒ nada a fazer no código, mas **avisar na tela** que a comissão depende do clique no link oficial | Copy leiga. |

## Fase 4 — API e Painel (linguagem leiga, design system v2)

| # | Passo | Arquivo | Cuidado |
|---|---|---|---|
| 4.1 | Rotas `POST/PUT /offer-automations` aceitam `store` (validar contra a lista; default `shopee`); `search-preview` usa a fonte da loja | `src/api/routes/offerAutomation.js` | Validação de servidor, não só da tela. Rejeitar `store` desconhecida com 400. |
| 4.2 | Formulário: seletor "Loja" (Shopee / Terabyte). Terabyte sem credencial ⇒ mostrar o mesmo aviso "Faltou cadastrar a loja" com atalho | `dashboard/app/painel/ofertas-automaticas/page.js` | Tokens do design system v2; nenhum hex solto. Terabyte é loja nova → **se exigir componente visual novo, entra no design-system-v2 antes**. |
| 4.3 | Tela de credenciais: campo "Código de parceiro Terabyte" com ajuda de onde achar (Painel do parceiro → Links) | telas de credenciais + `FIELD_LABELS` | Copy leiga. |
| 4.4 | Logs/`logsCopy.js`: traduzir skips novos (`no_terabyte_credentials`, `terabyte_source_error`) | `dashboard/lib/logsCopy.js` | Sem texto técnico para a cliente. |
| 4.5 | Fila de revisão: `materializeAutomationOffer` já carrega `productSnapshot` — garantir `storeName` e o link Terabyte ali | `dispatcher.js` | Item aprovado depois não pode voltar a `'Shopee'`. |

## Fase 5 — Testes

- **Caracterização Shopee** (antes de refatorar): rodar `npm test` e congelar o comportamento atual.
- Unit: `buildTerabyteAffiliateUrl` (com/sem query, host errado, `p=` já existente), normalização de preço à vista, filtro de desconto sem "de", chave de dedup prefixada.
- `runAutomation` com fonte fake da Terabyte: sem credencial → skip; erro da fonte → `{ error }` (não `no_offers_found`); sucesso grava `OfferAutomationSentLog` com chave prefixada.
- Regressão: automação Shopee existente produz **texto idêntico** (snapshot).
- Diagnóstico read-only: `scripts/diag-terabyte-busca.mjs` (já da Fase 0) fica como ferramenta de suporte.
- Staging: 1 automação Terabyte real, grupo de teste, 24 h, conferindo clique no link e aparecimento em "Minhas Vendas/Links" do painel Terabyte.

## Fase 6 — Rollout

1. Branch a partir de `develop` → PR contra `develop` (nunca push direto) → deploy automático em **staging** (`3006`).
2. **Feature flag** `OFFER_AUTOMATION_TERABYTE_ENABLED` (default off). Ligada só para 1–2 contas piloto (env exige `pm2 delete` + `start`, não `restart --update-env`).
3. Validar 48 h em staging; só então PR `develop → main`.
4. Prod em modo `remote`: mudança em `src/offerAutomation` roda no **cron da API** (deploy da API basta); mudança em `bot-worker.js`/`core/` exigiria `pm2 restart bot-supervisor` (reconecta todas as sessões — anunciar). **A V1 foi desenhada para não tocar `bot-worker.js`.**
5. Monitorar: taxa de `terabyte_source_error`, `all_offers_filtered`, latência do cron, HTTP 403/429 da Terabyte.

---

## Impactos e riscos (resumo)

| Risco | Gravidade | Mitigação |
|---|---|---|
| Sem API ⇒ raspagem frágil / bloqueio | **Alta** | Fase 0 decide; critério de parada; caminho C como fallback |
| Termos do programa proíbem automação | **Alta** | 0.1 antes de qualquer código |
| Preço errado (à vista × parcelado) | Alta | 2.4: um preço só, rotulado; sem preço confiável descarta |
| Link sem `p=` ⇒ cliente sem comissão | Alta | 3.3 guard; teste de unidade |
| Colisão de dedup entre lojas | Média | 1.2 chave prefixada |
| `PLATFORMS` novo aparece como "faltando" p/ todos | Média | 1.4 auditar usos; flag |
| Regressão na Shopee (refator 2.x) | Média | teste de caracterização + snapshot |
| Cupom Shopee aplicado a oferta Terabyte | Média | 2.8 cupom off na V1 |
| RAM | **Baixa** | Sem processo novo, sem headless, sem cache grande; `axios` no cron existente. Mesmo assim: sinalizar se a Fase 0 exigir algo mais pesado. |
| Carga/ban no site deles | Média | 1 requisição por execução de automação, `User-Agent` honesto, respeitar `robots.txt`, backoff em 429/403, teto de páginas |
| Dono do produto: Basic × PRO, copy, design | Baixa | Decisões listadas em "Perguntas" |

## Fora do V1 (V2 — conversão de links)

- Registrar `terabyte` em `CONVERTERS` (`src/converters/index.js`), `linkKind.js`
  (`PRODUCT_ID_DETECTORS`/`EXTRACTORS`: id/slug do produto na URL) e `productInfoScraper.js`/`imageScrapers.js`.
- Reconhecer host `terabyteshop.com.br` no espelhamento (`mirrorLinkGuard`, `customDomainLinkResolver`).
- "Criar oferta" via `buildScrapedOffer()` (não duplicar lógica — regra do `offerEngine.js`).
- Reaproveita da V1: `buildTerabyteAffiliateUrl`, credencial, normalização de preço.
  Por isso 3.2 e 2.4 são escritas como funções puras e independentes do cron.

## Perguntas para a dona do produto (bloqueiam a Fase 0/1)

1. Você já é parceira aprovada da Terabyte? Tem o código `p=`?
2. Terabyte no **Basic** ou só **PRO**?
3. Aceita o V1 ter só "menor/maior preço/relevância" (sem "mais vendidos")?
4. Se não houver feed nem leitura permitida, aceita o fallback "lista curada de URLs" no V1?
