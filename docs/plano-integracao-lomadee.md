# Plano técnico — Integração LOMADEE (v1: só ofertas automáticas)

> Status: **PLANO, nada implementado.** Revisado em 2026-09-29 depois de ler a
> integração Awin que já está em `develop` (`docs/rca/afiliados-awin.md`).
> v1 = Lomadee como **nova origem** das Ofertas automáticas (direto + fila de
> revisão). v2 (depois) = conversão de links. Ver seção 10.

## 0. Aviso sobre a API

A documentação oficial (`developer.socialsoul.com.vc`) estava fora do ar (503).
Confirmado só por busca: a API de Ofertas usa **app-token + sourceId**; há também
API de Cupons e de Deeplink (`https://api.lomadee.com/v2/{app-token}/deeplink/_create`).
Tudo marcado **(⚠️ confirmar)** é hipótese e vira a Etapa 0.

## 1. O que já existe (a Awin abriu o caminho)

Ofertas automáticas **não são mais só Shopee**. Hoje:

- `OfferAutomation.source` = `shopee` (padrão) | `awin`. Lista em
  `AUTOMATION_SOURCES` (`src/offerAutomation/dispatcher.js`); origem desconhecida
  **pula** a automação (`invalid_source`), nunca cai em Shopee. A origem **não
  muda** depois de criada.
- **Shopee** = busca ao vivo por palavra (`fetchOffers` → `resolveOffers`),
  oferta com preço/desconto/foto, credencial na tabela `Credential`.
- **Awin** = **sync para o banco** (`AwinAccount`, `AwinPromotion`, agendador na
  API, limitador 15/min por token) e o envio só **lê do banco**
  (`src/offerAutomation/awinOffers.js`). Sem preço/foto; link curto e foto
  entram na hora do envio (`awinEnrich.js`). Sem Stories, sem cupom, sem desconto
  mínimo. Awin **fica fora de `PLATFORMS`** de propósito (não é `Credential`).
- Pontos com `if source === 'awin'`: `dispatcher.js` (carga, Story, cupom,
  `formatOfferMessage`, `automationOfferProduct`), `reviewDiscoveryService.js`,
  `reviewDeliveryService.js` (valida validade/preço), `routes/offerAutomation.js`
  (`isAwin` em POST/PATCH), tela `ofertas-automaticas/page.js` (`changeSource`,
  `AWIN_SKIP_LABELS`), migration `20260929120000_awin_promotions`.
- Dedup: `productDedupKey` aceita `offer.dedupKey` (Awin usa
  `awin:<conta>:<loja+página>`); `OfferAutomationSentLog` por grupo; `sentItemIds`
  por automação.

**Consequência:** a Lomadee entra como **`source = 'lomadee'`**, seguindo o
padrão da Awin. Não é "trocar o provedor da Shopee".

## 2. Decisão de arquitetura (recomendada)

**Lomadee = busca ao vivo com preço (modelo Shopee), credencial própria no
modelo Awin (tabela separada, fora de `PLATFORMS`).**

| Ponto | Escolha | Por quê |
|---|---|---|
| Origem | `source = 'lomadee'` | mesmo mecanismo da Awin; sem tocar nas automações atuais |
| Como busca | ao vivo, por palavra, no envio (como Shopee) | a Lomadee tem API de **ofertas com preço**; sync em banco só se a Etapa 0 mostrar limite de taxa apertado |
| Credencial | tabela nova `LomadeeAccount` (rótulo, `appToken` cifrado, `sourceId`, últimos 4, status) — igual `AwinAccount` | várias contas por cliente; **fora de `PLATFORMS`**, então **não** entra em nenhum caminho de conversão de link na v1 (o risco que o plano anterior tinha) |
| Formato da oferta | adaptador devolve nós no formato Shopee (`itemId`, `productName`, `price`, `priceDiscountRate`, `imageUrl`, `offerLink`) + `source:'lomadee'`, `storeName` real, `dedupKey` | reaproveita `filterOffers`, `dedupeOffersByProduct`, template com preço, Story, fila de revisão |
| Limitador | 1 limitador por token, no processo da API (padrão `rateLimiter.js` da Awin) | vários automações do mesmo token no mesmo minuto |

Alternativa mais pesada (só se a Etapa 0 exigir): sync para `LomadeeOffer` no
banco com agendador, igual Awin. **Custo de RAM/processo → REGRA #1 do
AGENTS.md** (sinalizar e pedir OK antes).

## 3. Decisões que dependem da usuária (antes de codar)

1. Credencial **por cliente** (recomendado; comissão da cliente, igual Awin/Shopee)
   ou token único da plataforma?
2. Quais lojas da Lomadee entram? Há **sobreposição com a Awin** (ex.: Kabum,
   Magalu) e com afiliado próprio (ML, Amazon, AliExpress, SHEIN). Sugestão v1:
   sem filtro, mas **lista de exclusão por env** e aviso na tela.
3. Plano: manter **PRO/Trial** (`canUseOfferAutomations`), sem plano novo. Cadastro
   da conta Lomadee: **Basic** (como a Awin, pensando na v2)?
4. Liberar para todas ou por lista de contas no início? Sugestão: lista.

## 4. Passo a passo (1 PR pequeno por etapa, todos contra `develop`)

### Etapa 0 — Medir a API (sem código de produção)
- `scripts/diag-lomadee.mjs` (somente leitura, padrão `diag-awin.mjs`; mascara
  token; pede credencial de teste). Saída REAL registrada em
  `docs/rca/afiliados-lomadee.md` (arquivo novo + 1 linha no índice do AGENTS.md).
- Decide: endpoint/versão vigente; parâmetros de busca por palavra, ordenação,
  página e tamanho; se vem **preço antigo/desconto**; foto (tamanho); **loja** do
  produto; o link já é o de afiliado (rastreio por `sourceId`)? **expira?**;
  limite de taxa; sandbox × produção; se há aprovação por loja; se **cupons**
  vêm juntos.
- Sem isso as etapas 3+ ficam bloqueadas.

### Etapa 1 — Banco (staging antes de prod)
- Migration nova `…_lomadee_accounts`: tabela `LomadeeAccount` (userId com
  `onDelete: Cascade`, isolamento por `userId` em toda consulta).
- `OfferAutomation`: `lomadeeAccountId String?` (o resto reaproveita `keyword`,
  `minDiscountPct`, `sortType`, `page`). **Sem** mudar `source` default.
- Só cria tabela/coluna nulável → nada muda para automações existentes.
- Conferir `COUNT(*)` de `OfferAutomation` antes/depois no staging; backup diário
  já existe.
- `src/domain/lgpd/dataRequest.js`: incluir `lomadeeAccount` (cascade cobre a
  exclusão; exportação precisa listar).

### Etapa 2 — Conta Lomadee (cadastro)
- `src/integrations/lomadee/` no molde de `integrations/awin/`: `client.js`
  (transporte, `fetch` injetável, timeout 10 s), `errors.js`, `rateLimiter.js`,
  `accountService.js` (teste de conexão, máscara `••••1234`, frases leigas).
- Rotas `/api/lomadee/*` no molde de `routes/awin.js` (**nunca 401 por causa da
  Lomadee**, senão o painel desloga a cliente → 400 com frase leiga).
- **Token vai no caminho da URL** (`/v2/{app-token}/…`) → nunca logar URL nem
  erro cru do axios/fetch; `errors.js` sem token. Teste que varre logs/erros.
- Cifra com `encryptCredential`; campo vazio na edição = mantém.
- Tela: cartão dentro de "Minhas credenciais" no molde de `AwinCredentialsCard.js`
  + `dashboard/lib/painel/lomadeeCopy.js` com teste de linguagem leiga (como
  `awin-linguagem.test.js`): "código de acesso", nunca "token/API/sourceId" sem
  explicar. Seguir `docs/design-system/design-system-v2.html`.

### Etapa 3 — Adaptador de busca `lomadeeOffers.js`
- `fetchLomadeeOffers({ keyword, minDiscountPct, limit, excludeItemIds, account, sortType, page })`
  → `{ offers, rawCount, dropped }`.
  - `itemId = 'lomadee:<id>'` (evita colisão com Shopee em `sentItemIds`/`SentLog`);
  - `dedupKey = 'lomadee:<loja>:<produto normalizado>'`;
  - `offerLink` = link Lomadee **sem reescrever nem encurtar**;
  - `storeName` = loja real; `source: 'lomadee'`; `sales`/`ratingStar` nulos;
  - reaproveita `filterOffers` (preço ausente, desconto mínimo, já enviada) e o
    contador de descartes `OFFER_DROP_REASON`.
- Erro da API **lançado**, nunca disfarçado de `no_offers_found`.
- **Sem cache** de ofertas (a doc da Lomadee desaconselha).
- `sortType`: só as ordens que a Lomadee tiver (⚠️ confirmar); tela mostra só essas.
- Testes `test/lomadee-offers.test.js` (fetch mockado, sem rede).

### Etapa 4 — Ligar a origem no fluxo (PR mais crítico)
- `AUTOMATION_SOURCES` ganha `'lomadee'`. **Refatorar os `if source === 'awin'`
  para um registro por origem** (`src/offerAutomation/sources.js`: `load`,
  `credentialGate`, `supportsStories`, `supportsCoupons`, `skipLabels`), em vez de
  um terceiro `else if` espalhado. Comportamento de `shopee` e `awin` **idêntico**
  (testes atuais `offer-automation`, `awin-offer-automation` rodam sem edição).
- `dispatcher.js` (`runAutomation`): ramo lomadee = carrega conta do dono
  (`userId`), decifra, busca, segue o caminho de envio com preço. Ajustes:
  - `automationOfferProduct`: `title` padrão e `storeName` vêm de `offer.storeName`
    (hoje "Produto Shopee"/`'Shopee'` fixos);
  - Story do Instagram: `storeName` dinâmico. Lomadee tem foto e preço →
    **liberar Stories** (diferente da Awin) **ou** deixar fora da v1 (decidir na
    Etapa 0 conforme a foto);
  - cupom: `chooseCoupon({ platform: 'shopee' })` é fixo → **`useCoupons=false`
    para Lomadee na v1** (cupom é por loja);
  - `nextOfferPage` (rotação de página) vale.
- `reviewDiscoveryService.js` e `reviewDeliveryService.js`: mesmo ramo; entrega
  exige `priceCents > 0` (já vale) e, se o link expirar (Etapa 0), revalidar.
- `routes/offerAutomation.js`: `source='lomadee'` exige `lomadeeAccountId` **do
  próprio usuário**, palavra obrigatória (como Shopee), `listType/prioritizeAMS/
  isKeySeller` ignorados; PATCH não troca `source`; `search-preview` por origem.
- Códigos de skip novos: `no_lomadee_account`, `invalid_lomadee_credentials`,
  `lomadee_api_error`; textos em `LOMADEE_SKIP_LABELS` (padrão `AWIN_SKIP_LABELS`)
  — **o texto "A Shopee trouxe produtos…" já causou confusão na Awin (RCA
  2026-09-29): cada origem tem o seu**.
- Flag (Etapa 6) barra criar/rodar quando desligada.

### Etapa 5 — Tela (`ofertas-automaticas/page.js`)
- "De onde vêm as ofertas?" ganha a 3ª opção **Lomadee** (Shopee | Awin | Lomadee);
  `changeSource` ajusta modelo padrão (Lomadee usa o modelo com preço) e esconde
  controles só da Shopee (`listType`, AMS, vendedor-chave).
- Trocar os avisos "só na Shopee" (linhas ~301 e ~529) por texto por origem.
- Sem conta Lomadee: aviso "Conecte sua conta em Minhas credenciais".
- Nome da automação na lista: "Lomadee · <palavra>".

### Etapa 6 — Liberação gradual
- `LOMADEE_OFFERS_ENABLED` + `LOMADEE_OFFERS_USER_IDS` (molde de `reviewFlags.js`).
  Desligada: rota recusa criar, cron pula com log. Mudar env exige `pm2 delete`
  + `start`.

### Etapa 7 — Diagnóstico e docs
- `scripts/diag-lomadee.mjs` (já da Etapa 0) ganha modo banco (automações,
  contas, últimos skips). Atalho novo no "Mapa de sintomas" do AGENTS.md
  (respeitar o teto de 40 KB: `test/agents-md-enxuto.test.js`).

### Etapa 8 — Staging → produção
1. `node --test` dos arquivos afetados + suíte inteira.
2. PR → `develop` → deploy automático em staging (`inline`).
3. Validar em `http://178.105.54.0:3006`: conectar conta, preview, envio direto,
   fila de revisão, dedup entre 2 automações no mesmo grupo, **automações Shopee e
   Awin antigas inalteradas**.
4. PR `develop → main`. Cron roda na API: em `remote` o deploy da API basta;
   `bot-supervisor` só se mexer em `bot-worker.js`/`core/` (não é o caso) —
   confirmar em `docs/rca/deploy-e-infra.md`.
5. Liberar por lista; observar 48 h; ampliar.

## 5. Impactos e riscos

| Área | Risco | Mitigação |
|---|---|---|
| Shopee e Awin em produção | regressão ao mexer no `dispatcher` | refatoração para registro por origem em PR próprio; testes atuais sem edição; `source` padrão intacto |
| Origem desconhecida | deploy velho lendo automação `lomadee` | `invalid_source` já pula (nunca publica por engano) |
| Vazamento de token | app-token no caminho da URL cai em log/PM2 | mascarar URL e erros; teste dedicado |
| Isolamento | cliente usar conta de outra | toda consulta filtra `userId`; teste como `awin-routes.test.js` |
| Duplicata entre redes | mesmo produto/loja em **Awin e Lomadee** (Kabum, Magalu) sai duas vezes no grupo | `dedupKey` por loja+produto; medir na Etapa 0 e no staging; aceitar na v1 se raro |
| Comissão | loja também coberta por Awin/afiliado próprio | decisão 3.2; lista de exclusão |
| Desconto mínimo | Lomadee sem preço antigo → tudo filtrado | Etapa 0 mede; se faltar, `minDiscountPct` fica oculto para Lomadee |
| Imagem | miniatura pequena/hotlink bloqueado | `imageRefererUrl` + `previewImageFallbackPolicy`; medir |
| Link | expirar/perder rastreio | não reescrever; testar clique real no staging |
| Taxa | N automações × tick de 60 s | 1 chamada por execução; limitador por token; 429 → pula o tick |
| Fila de revisão (desligada por padrão) | `discoverReviewItems` também busca | coberta na Etapa 4 |
| Textos | "Shopee" aparecendo em oferta Lomadee | `storeName` dinâmico + teste de snapshot |
| Stories/cupom | `platform:'shopee'` fixo | cupom desligado; Story decidido na Etapa 0 |
| `PLATFORMS`/conversão | Lomadee vazar para caminho de conversão | tabela própria fora de `PLATFORMS` (padrão Awin); teste que falha se aparecer |
| Banco | migration | só tabela/coluna nulável; staging antes de prod |
| **Memória (REGRA #1)** | busca ao vivo: **~0** (sem processo, worker, Redis ou cache; 1 HTTP a mais por execução; limitador = poucos KB). Se virar sync em banco: `setInterval` + página de resposta, **< 5 MB** de pico como a Awin — **pedir OK antes** | — |

## 6. Ordem dos PRs

1. Etapa 0 (script + `docs/rca/afiliados-lomadee.md` com dados reais).
2. Etapa 1 (migration + LGPD).
3. Etapa 2 (conta + rotas + tela de credencial).
4. Etapa 3 (adaptador + testes, ainda sem ligar).
5. Etapa 4a: refatoração para registro por origem, **sem** Lomadee (prova que
   Shopee/Awin não mudam).
6. Etapa 4b: origem Lomadee no fluxo + rota.
7. Etapas 5+6 (tela + flag).
8. Etapa 7 (diag + índice).

## 7. Aceite da v1

- Cliente conecta a conta, cria automação Lomadee, vê o preview e o grupo recebe
  oferta com loja, preço, foto e link corretos.
- Automações Shopee e Awin existentes: mesmos envios, mesmos textos.
- Sem conta/token, a tela diz o que falta em português simples.
- Nenhum token em log. RAM/swap inalterados após 48 h.

## 8. Perguntas para a Etapa 0

Endpoint vigente (v2?); paginação; ordenação; campos de desconto; lojas
disponíveis e sobreposição com Awin; expiração do link; limite de requisições;
sandbox × produção; aprovação por loja; cupons no mesmo endpoint.

## 9. Testes a escrever

`lomadee-offers` (adaptador), `lomadee-routes` (isolamento, 7 rotas),
`lomadee-linguagem` (frases leigas), `offer-automation-sources` (registro por
origem; Shopee/Awin idênticos), `lomadee-offer-automation` (dispatcher +
revisão), teste de que `lomadee` não está em `PLATFORMS` nem em caminho de
conversão, teste de redação de token.

## 10. Fora da v1 → v2 (conversão de links)

Entraria em `src/converters/index.js` ao lado do conversor `awin`
(`src/converters/awin.js`, lojas aprovadas por cliente, `storeMatcher`,
`AwinLink` como cache no banco). Impactos: **ordem de prioridade** entre Awin,
Lomadee e afiliado direto (uma loja pode estar nas três), `mirrorLinkGuard`
(não converteu → não envia), `CONVERSION_FAILURE`, "Converter links", "Criar
oferta", cache de deeplinks (no banco, como `AwinLink`, não em memória),
limite de taxa bem maior que o das ofertas, e ROI/comissão. Revisitar o
`PLATFORMS`/`BotConfig.platforms` só aí. **Não começar antes da v1 validada em
produção.**
