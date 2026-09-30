# Plano técnico — Integração LOMADEE (v1: só ofertas automáticas)

> Status: **PLANO, nada implementado.** Revisado em 2026-09-29 depois de ler a
> integração Awin que já está em `develop` (`docs/rca/afiliados-awin.md`).
> v1 = Lomadee como **nova origem** das Ofertas automáticas (direto + fila de
> revisão). v2 (depois) = conversão de links. Ver seção 10.

> ⚠️ **CORREÇÃO DE RUMO (2026-09-30) — leia a seção 13 primeiro.** A "oferta" da
> Lomadee que a cliente publica é uma **campanha do tipo Oferta** (título, loja,
> validade, link), **sem preço e sem foto** — o mesmo formato das promoções da
> Awin, e não um produto com preço. A seção 13 **substitui** o desenho de busca
> ao vivo de produtos das seções 2, 4 (Etapas 3–5) e 11 onde houver conflito.

## 0. API (medida em 2026-09-30 — ver seção 11)

A API que vale é a **nova**: `https://api.lomadee.com.br`, autenticação pelo
header `x-api-key` (docs: `docs.lomadee.com.br`, OpenAPI em
`/api-reference/openapi.json`). **Não** é a v2 antiga (`app-token` + `sourceId`
na URL). Onde este plano dizia "app-token/sourceId", leia **chave da API** e
**ID do canal**. Itens ainda não medidos seguem marcados **(⚠️ confirmar)**.

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

## 3. Decisões tomadas (2026-09-29, pela dona do produto)

1. **Token por cliente.** Cada cliente cadastra a própria conta Lomadee; a
   comissão é dela. Nenhuma credencial global (mesma regra da Awin).
2. **Lojas = as que a afiliada tem vínculo.** Igual à Awin (`membership=joined`):
   só entram lojas em que **aquela conta** foi aprovada/vinculada, e a cliente
   pode filtrar por loja na automação. Sem lista de exclusão global por env.
   ⚠️ Depende da Etapa 0: a API da Lomadee precisa **dizer quais lojas a conta
   tem vínculo** (ou aceitar filtrar a busca por elas). Se não disser, plano B:
   a cliente marca as lojas manualmente na tela (menos confiável) — decidir com
   a dona do produto **antes** da Etapa 3.
3. **Cadastro da conta Lomadee: Basic. Ofertas automáticas com Lomadee: PRO**
   (`canUseOfferAutomations`, a trava de sempre). Cliente Basic conecta a conta
   (preparando a v2) mas a automação Lomadee fica com cadeado PRO.
4. **Liberação para todas as contas** (sem lista). Como não há liberação
   gradual, o **interruptor de emergência** `LOMADEE_OFFERS_ENABLED` continua
   (desliga sem deploy: `pm2 delete` + `start`) e o staging precisa cobrir mais
   cenários antes do `main`.

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
- `OfferAutomation`: `lomadeeAccountId String?` e `lomadeeStoreIds String @default("[]")`
  (filtro por lojas vinculadas, como `awinAdvertiserIds`); o resto reaproveita
  `keyword`, `minDiscountPct`, `sortType`, `page`. **Sem** mudar `source` default.
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
- A chave vai no **header `x-api-key`** (não na URL, como na API antiga): nunca
  logar headers nem o objeto de erro cru do axios/fetch; `errors.js` sem chave.
  Teste que varre logs/erros.
- Cifra com `encryptCredential`; campo vazio na edição = mantém.
- Lojas vinculadas da conta: `GET /api/lomadee/accounts/:id/stores` (só as com
  vínculo; molde de `awinAccountAdvertisers`). Cadastro de conta = **Basic**
  (sem `ProGate`); só criar a automação exige PRO.
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
- Filtro opcional "Só destas lojas" (lojas com vínculo da conta, como o da Awin).
- Nome da automação na lista: "Lomadee · <palavra>". Opção Lomadee com cadeado PRO
  para Basic (`ProGate`), conforme design system.

### Etapa 6 — Interruptor de emergência (sem liberação gradual)
- Liberado para **todas as contas** desde o primeiro deploy em `main`.
- `LOMADEE_OFFERS_ENABLED` (padrão ligado) só como **desligamento de
  emergência**: desligada, a rota recusa criar e o cron pula as automações
  Lomadee com log claro. Mudar env exige `pm2 delete` + `start`.
- Como todas as contas ganham de uma vez: a Etapa 8 exige staging com conta
  real, teste de carga do limitador (várias automações no mesmo token) e
  observação de 48 h **em staging** antes do PR para `main`.

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
5. Liberar para todas; observar logs/swap por 48 h com o interruptor à mão.

## 5. Impactos e riscos

| Área | Risco | Mitigação |
|---|---|---|
| Shopee e Awin em produção | regressão ao mexer no `dispatcher` | refatoração para registro por origem em PR próprio; testes atuais sem edição; `source` padrão intacto |
| Origem desconhecida | deploy velho lendo automação `lomadee` | `invalid_source` já pula (nunca publica por engano) |
| Vazamento da chave | chave no header `x-api-key` cai em log/PM2 se o erro do axios for impresso cru | nunca logar headers/erro cru; teste dedicado |
| Isolamento | cliente usar conta de outra | toda consulta filtra `userId`; teste como `awin-routes.test.js` |
| Duplicata entre redes | mesmo produto/loja em **Awin e Lomadee** (Kabum, Magalu) sai duas vezes no grupo | `dedupKey` por loja+produto; medir na Etapa 0 e no staging; aceitar na v1 se raro |
| Comissão | loja também coberta por Awin/afiliado próprio | só lojas com vínculo da conta (decisão 3.2); medir sobreposição na Etapa 0 |
| Liberação para todas | erro atinge todas as contas de uma vez | interruptor de emergência + 48 h em staging + teste do limitador |
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

**A mais importante:** a API lista as lojas em que a conta tem vínculo (ou filtra a
busca por elas)? 
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

## 11. Medições da Etapa 0 (2026-09-30, com a conta real da Flavia)

Feitas com chamadas **somente leitura** (canais, lojas, produtos). A chave foi
passada só por variável de ambiente e **não está em nenhum arquivo do repo**.

**Confirmado**
- Chave `lmd_production_…` funciona: `GET /affiliate/channels` → 200.
- **Limite:** 60 chamadas / 60 s **por chave e por IP** (headers
  `x-ratelimit-*`). Bem mais folgado que a Awin (15/min). Limitador por chave no
  processo da API continua (padrão `rateLimiter.js` da Awin), com folga (ex. 40/min).
- **Canais:** `GET /affiliate/channels` devolve os canais da conta (`id`, `name`,
  `active`). A conta de teste tem 2 (SocialMedia e CouponSite). O "ID do canal"
  que a cliente cola é esse `id`. ⚠️ O UUID que veio junto da chave no teste é o
  `availableChannel.id` (tipo do canal), **não** o `id` do canal — a tela deve
  **listar os canais pela API e deixar a cliente escolher**, em vez de pedir para
  colar o UUID (menos erro; valida a chave ao mesmo tempo).
- **Lojas:** `GET /affiliate/brands` (máx. 20 por página) → 138 lojas na conta de
  teste, todas `active`, 134 públicas. Cada loja traz `channels[]` com `shortUrls`
  **por canal** (link de afiliado da loja), `commission` (`value`, `transfer`) e
  `site`. Não há campo "aprovada/vinculada" explícito: 133 de 138 têm link no canal.
  ⚠️ **Decisão 3.2 (só lojas com vínculo)** precisa de confirmação: usar
  "loja tem `shortUrls` no canal escolhido" como critério de vínculo, e confirmar
  com a Lomadee se lojas com candidatura pendente aparecem com ou sem link.
- **Produtos:** `GET /affiliate/products` (máx. 100), filtros `search`, `price`
  (`de:ate` em centavos), `organizationIds` (várias lojas separadas por vírgula —
  serve ao filtro por loja) e `isAvailable`. Produto: `name`, `url`, `images`,
  `options[].pricing[]` com `price` e `listPrice` **em centavos** (o desconto se
  calcula), `available`, `organizationId`. **Não há ordenação** (nem "mais
  vendidos"), nem vendas/avaliação → `sortType`, `listType`, AMS e vendedor-chave
  não se aplicam; a tela não mostra essas opções para a Lomadee.
- **Links de afiliado:** o `url` do produto é a página da loja (não é link de
  afiliado). O link vem de `POST /affiliate/shortener/url` (`organizationId`,
  `type: "Custom"`, `url` https) e devolve **um link curto por canal** da conta
  (`shortUrls`) — daí a necessidade do ID do canal. Custo: 1 chamada por oferta
  que vai sair (só as escolhidas), como o `awinEnrich.js`.

**Não medido (bloqueia a Etapa 3)**
- `GET /affiliate/products` deu **timeout sem nenhum byte** (30 s, 90 s e 60 s,
  com e sem `search`, `limit=2`), enquanto canais/lojas responderam na hora.
  Pode ser lentidão da API, do proxy deste ambiente ou do endpoint. **Repetir a
  medição da VPS** com o `scripts/diag-lomadee.mjs` (Etapa 0 do PR de código):
  mede tempo, campos reais de preço/desconto, imagem, e se o `search` acha os
  produtos das lojas com vínculo. Se a API for lenta demais para busca ao vivo no
  envio, a saída é **sincronizar produtos das lojas escolhidas para o banco**
  (modelo Awin) — isso pesa RAM/banco e exige o OK da REGRA #1.
- Se o link curto expira, tamanho das imagens, cota diária do encurtador.
- Se a busca por palavra respeita `isAvailable=true` sem pesar no tempo.

**Mudanças no desenho por causa das medições**
1. Credencial = **chave da API + ID do canal** (a tela lista os canais pela chave).
2. Lojas com vínculo = lojas com link no canal escolhido; filtro por loja usa
   `organizationIds`.
3. Sem ordenação: a rotação `page` continua, mas a ordem é a da Lomadee; a
   tela avisa "a Lomadee não permite escolher a ordem".
4. Desconto mínimo só funciona quando `listPrice > price`; sem isso, fica oculto.
5. Cada oferta enviada = 1 chamada de encurtador (dentro dos 60/min).

## 12. Textos para a tela de credenciais (definidos pela dona do produto)

Nome na tela: **Lomadee**. Campos: **Chave** e **ID do canal**.

- **Chave:** "Na sua conta da Lomadee, clique na sua conta (canto inferior
  esquerdo) → **Credenciais de API** → copie a **chave**."
- **ID do canal:** "Na Lomadee, abra a aba **Canais**, crie um **canal de
  divulgação** e copie o **ID** dele." (A tela também lista os canais da conta
  depois de salvar a chave, para escolher em vez de colar.)
- Vocabulário leigo: "chave" e "ID do canal"; nunca "token", "API key",
  "sourceId" ou "x-api-key". Teste de linguagem como `awin-linguagem.test.js`.
- A chave é de escrita: cifrada, exibida como `••••1234`, campo vazio na edição
  mantém. Aviso na tela: "não compartilhe sua chave com ninguém".

## 13. Correção de rumo: Lomadee = campanhas "Oferta", modelo Awin (2026-09-30)

**O que a dona do produto mostrou** (exemplo real de oferta para publicar):

> Malas, mochilas e acessórios com até 60% OFF · por Up4you · Válido até
> 12/10/2026 · Oferta · URL da página da loja · link curto `lmdee.link/…`

Isso é `GET /affiliate/campaigns` com `types=Offer`: `name` (título), `period.endAt`
(validade), `url` (página da loja), `organizationId` (loja), `description`,
`status` (`onTime` | `scheduled` | `expired`), `channels` (links por canal ⚠️
confirmar o formato) e `period = null` quando a campanha é permanente. **Não tem
preço, desconto em número nem foto.**

### 13.1 O que muda no desenho

| Ponto | Antes (seções 2/4/11) | Agora |
|---|---|---|
| Fonte | produtos com preço (`/affiliate/products`), busca ao vivo | **campanhas Oferta** (`/affiliate/campaigns`), **sincronizadas para o banco** |
| Modelo de envio | igual Shopee | **igual Awin**: o envio só **lê do banco**, nunca chama a Lomadee |
| Tabelas | `LomadeeAccount` | `LomadeeAccount` + `LomadeeCampaign` (+ `LomadeeSyncRun`, como a Awin) |
| Seleção | ordem da API, palavra, rotação de página | regra da Awin: **revezar lojas, vence antes primeiro, nunca com menos de 1 h para vencer nem antes de começar, cada oferta sai uma vez por automação** |
| Mensagem | preço, foto, desconto | título, loja, descrição curta, validade, link — modelo `promocao_awin` |
| Stories / cupom / desconto mínimo | possível | **fora da v1** (igual Awin) |
| Palavra-chave | obrigatória | **opcional** (filtra título/descrição, sem acento) |
| Ordem/`sortType`/`listType` | não se aplica | não se aplica |

Por que o modelo Awin: (1) é o formato real da oferta; (2) os endpoints de
campanhas e de produtos deram **timeout sem resposta** neste ambiente (canais e
lojas responderam na hora) — com o envio lendo do banco, uma API lenta atrasa só
o sync, nunca o envio; (3) o limite de 60 chamadas/min por chave sobra para um
sync de hora em hora; (4) reaproveita regras já testadas e "não regredir" da Awin
(`docs/rca/afiliados-awin.md`), inclusive a repetição de promoção "por voltagem".

### 13.2 Reaproveitar, não copiar

- Extrair o núcleo de `src/offerAutomation/awinOffers.js` (`selectAwinCandidates`,
  identidade por **loja + página**, desempate, revezamento, janela de 1 h) para um
  módulo neutro `promotionOffers.js`, usado por Awin **e** Lomadee.
  **PR de refatoração separado, sem Lomadee**, com os testes atuais
  (`test/awin-offer-automation.test.js`) rodando **sem edição** — prova que a Awin
  não mudou.
- `src/integrations/lomadee/` no molde de `integrations/awin/` (`client`,
  `errors`, `rateLimiter`, `translate`, `accountService`, `syncService`,
  `scheduler`), rotas `/api/lomadee/*` no molde de `routes/awin.js`.
- Dispatcher/fila de revisão/rota: o registro por origem (Etapa 4a) ganha a
  origem `lomadee` com as mesmas capacidades da `awin` (sem Story, sem cupom, sem
  desconto mínimo, validade obrigatória na entrega da fila).
- Link: usar o **link curto do canal** que a própria campanha traz (`lmdee.link`)
  quando existir; senão o encurtador (`POST /affiliate/shortener/url`,
  `type: "Offer"` com `featureId` = id da campanha, ou `Custom` com a `url`).
  ⚠️ confirmar na medição. Nunca reescrever o link.
- Nome da loja: `GET /affiliate/brands` (20 por página, ~7 páginas) guardado por
  conta e atualizado no sync — a campanha só traz `organizationId`.

### 13.3 Sync (novo, pesa pouco)

- Filtros fixos, como na Awin: `types=Offer`, status `onTime` + `scheduled`
  (as do dia seguinte chegam antes da meia-noite), só lojas com vínculo no canal
  escolhido (decisão 3.2: loja com link no canal), `limit=20` paginando.
- **Vencer por ausência só com leitura completa**; 401/403 → `invalid_credential`
  (para de agendar até salvar chave nova); 429 → reagenda (≥5 min); outro erro →
  tenta em 15 min; uma conta nunca trava outra. Timeout do sync maior que o da
  Awin (60 s) por causa do que medimos.
- Retenção: campanha vencida some após 30 dias. Sync de hora em hora; o tick de
  5 min do agendador é **compartilhado com o da Awin** (um só `setInterval` na
  API, dois provedores) para não somar processo/timer.
- **REGRA #1 (memória) — SINALIZAÇÃO:** sem processo PM2, worker, Redis ou cache
  novos. Estimativa como a Awin: **< 5 MB de pico, ~0 em repouso** (uma página de
  20 campanhas por chamada, mapa do limitador em KB), banco ~2–3 KB por campanha.
  Alternativa mais leve: sync só das lojas que a cliente escolheu na automação
  (em vez de todas as lojas do canal). **Peço OK explícito antes de ligar.**

### 13.4 Decisões da dona do produto (2026-09-30)

1. **Campanha permanente** (`period = null`): pode sair, **no máximo uma vez a
   cada 15 dias por automação**, **sem "validade" na mensagem**. Campanha com data
   de fim segue a regra normal (uma vez por automação, enquanto vale).
   - Consequência técnica: `sentItemIds` guarda só os últimos 200 ids, **sem data**
     — não serve para "15 dias". Precisa de registro com data: tabela pequena
     `OfferAutomationPromoSend (automationId, itemKey, sentAt)` (índice
     `automationId, itemKey`), gravada só para campanha permanente, com poda
     de linhas com mais de 15 dias a cada execução (tabela limitada).
     Candidata é elegível de novo quando `agora - sentAt ≥ 15 dias`.
   - O modelo `promocao_awin` tem `{validade}`; para permanente a variável fica
     vazia e some sozinha (limpeza de variável vazia do compositor) — teste
     garante que não sai "Válida até" nem linha ⏰ vazia.
   - A regra de 15 dias vale por automação; a dedup cruzada por grupo (janela de
     120 min) continua valendo por cima.
2. **Cupons:** fora da v1, como na Awin.
3. **Produtos com preço** (`/affiliate/products`): fora da v1.
4. ⏳ **Ainda sem resposta:** OK para reaproveitar o agendador da Awin no sync da
   Lomadee (REGRA #1, ver 13.3). Nada será ligado sem esse OK.

### 13.5 O que ainda precisa ser medido (da VPS)

Tempo de resposta de `/affiliate/campaigns` (`types=Offer&status=onTime`) e de
`/affiliate/brands`; o formato real de `channels` na campanha (traz o
`lmdee.link`?); quantas campanhas Oferta ativas a conta tem; se `status=scheduled`
traz as de amanhã; como vem `description` (HTML?); se o exemplo da Up4you aparece
com o mesmo `name`, `period.endAt = 12/10/2026` e `url` da página.
`scripts/diag-lomadee.mjs` (somente leitura, chave por variável de ambiente)
imprime tudo isso em uma saída curta.

### 13.6 Ordem dos PRs (substitui a seção 6)

1. `scripts/diag-lomadee.mjs` + `docs/rca/afiliados-lomadee.md` com a medição real.
2. Refatoração: núcleo de promoções neutro (`promotionOffers.js`), Awin idêntica.
3. Migration (`LomadeeAccount`, `LomadeeCampaign`, `LomadeeSyncRun`, `OfferAutomationPromoSend`,
   `OfferAutomation.lomadeeAccountId/lomadeeStoreIds`) + LGPD.
4. Integração `integrations/lomadee/` + rotas + cartão em Minhas credenciais.
5. Registro por origem + origem `lomadee` no dispatcher/revisão/rota.
6. Tela ("De onde vêm as ofertas?": Shopee | Awin | Lomadee) + interruptor
   `LOMADEE_OFFERS_ENABLED` + PRO na automação.
7. Índice do AGENTS.md (1 linha) e atalhos no mapa de sintomas.

### 13.7 Medição real da Etapa 0 — campanhas (2026-09-30, conta da Flavia)

Feita com `scripts/diag-lomadee.mjs` (somente leitura). **A oferta da Up4you
apareceu e bate com o que a dona do produto mostrou:**

- `name` = "Malas, mochilas e acessórios com até 60% OFF"; `type = Offer`,
  `offerType = Url`; `url` = página da coleção; `period.endAt =
  2026-10-13T02:30:00Z` (= **12/10 às 23:30 em Brasília** — converter para
  America/Sao_Paulo, como `formatAwinValidity`); `status = onTime`.
- **Link por canal:** `channels[].shortUrls[0]`. No canal **Cuponito**
  (CouponSite) é `https://lmdee.link/OVzB900HqJgQ` — exatamente o link que veio
  no exemplo; no outro canal (Grupo de Ofertas Fafaciane) é outro link. Ou seja:
  **o link depende do canal escolhido na conta** (confirma o campo "ID do
  canal" e a escolha do canal por lista). **Não precisa do encurtador** para
  campanha: o link curto já vem pronto.
- `mediaKit.banners[]` traz **imagem** da campanha (CDN da Lomadee) — foto
  disponível sem raspar a loja (melhor que a Awin). ⚠️ a usar como `imageUrl`
  após medir tamanho/qualidade.
- Campanhas **Oferta ativas: 317** (16 páginas de 20). **Agendadas: 0** (não
  precisa tratar `scheduled` na v1, mas o filtro fica). Cerca de 10–15% são
  **permanentes** (`period = null`; uma loja tem 9 de 10 permanentes) — a regra
  de 15 dias (13.4) vale bastante.
- `description` veio **vazia** na maioria; o título às vezes já leva o preço
  ("… (Por R$ 65,55)"). A mensagem usa só título + loja + validade + link (+ foto).
- `offerType = Spreadsheet` tem `url` de **planilha CSV** (não é página de
  loja) → o sync filtra `offerType = Url`.
- **Nome da loja** vem só como `organizationId`; o nome sai de `GET
  /affiliate/brands` (138 lojas, 7 páginas), guardado no sync.
- **Sobreposição com a Shopee:** a **Shopee aparece como loja da Lomadee**
  ("Mega Oferta Full…", `shopee.com.br/oficial`). Publicar essas campanhas por
  aqui duplica a origem Shopee. ⚠️ **Decisão pendente** (13.8, item 1).

**Latência e como listar (importante para o sync)**
- Canais ~0,5 s; lojas ~1–3 s; campanhas ~1–7 s **com filtro**.
- Listar campanhas **sem nenhum filtro travou** (6 tentativas × 45 s sem
  resposta) e depois respondeu em 3,7 s: **comportamento instável**. Nunca
  chamar sem filtro.
- Filtros que responderam sempre: `name` (a busca "Up4you" achou 5), `name=%`
  (curinga: 1898 campanhas no total; com `types=Offer&status=onTime` → 317),
  `organizationIds` repetido (várias lojas na mesma chamada), `types`, `status`.
  `name=%` **não está documentado** — usar como recurso do sync **somente se a
  Lomadee confirmar**; o caminho seguro é sincronizar **por lotes de lojas**
  (`organizationIds`, ~20 por chamada) só das lojas com vínculo no canal.
- Custo de um sync completo: ~16 chamadas de campanhas + 7 de lojas ≈ 23
  chamadas (limite 60/min por chave) e ~1–2 min. Timeout do sync: 60 s por
  chamada, com nova tentativa em 15 min (regra 13.3).
- Produtos: 1 chamada com `limit=1` respondeu em 0,3 s via Node (o `curl` deste
  ambiente havia travado); segue **fora da v1**.

### 13.8 Novas decisões para a dona do produto

1. **Campanhas da Shopee que a Lomadee lista:** excluir (a Shopee já é origem
   própria, com preço e foto) ou deixar entrar? Recomendo **excluir** as lojas que
   já têm origem/afiliado próprio (Shopee, e conferir ML/Amazon/AliExpress/Magalu).
2. **Foto:** usar `mediaKit.banners[0]` da campanha como foto do card (banner pode
   ser largo, não quadrado)? Recomendo testar 3–5 campanhas no staging e decidir
   pelo resultado; sem banner, sai só texto.
3. **Uma conta = um canal:** cada `LomadeeAccount` guarda **um** canal escolhido
   (a lista sai da API). Cliente com dois canais cadastra duas contas? Recomendo sim.

### 13.9 Como rodar o diagnóstico na VPS

```
cd ~/wabot-staging && LOMADEE_KEY='SUA_CHAVE' node scripts/diag-lomadee.mjs --nome="Up4you"
```

Só leitura, ~10 chamadas, não grava nada e não imprime a chave. Depois de
rodar, limpar do histórico do shell (`history -d` da linha) ou usar `read -s`.

### 13.10 Medição da VPS (staging, 2026-09-30) — confirma 13.7

Rodado por `scripts/diag-lomadee.mjs` no staging (chave válida; um primeiro
teste deu 401 por chave colada errada, não por defeito do script).

- **Todas as chamadas responderam 200 em 0,35–1,9 s**, inclusive a listagem de
  campanhas **sem filtro** (1,8 s) e produtos (0,35 s). Os travamentos de 45–90 s
  vistos no ambiente de desenvolvimento **não se repetiram na VPS**: eram do
  ambiente de teste (proxy), não da API. Mantemos filtro em toda chamada de
  campanhas por segurança, mas o timeout do sync pode voltar a 30 s.
- **Mesmos números da medição anterior:** 138 lojas (7 páginas), **317 campanhas
  Oferta ativas** (16 páginas), **0 agendadas**, 2 de 20 permanentes na 1ª página.
- **Up4you confirmada** no staging: "Malas, mochilas e acessórios com até 60% OFF",
  `status = onTime`, `period.endAt = 2026-10-13T02:30:00Z` (12/10 23:30 em
  Brasília), com `shortUrls` nos dois canais.
- **Campanha vencida não tem link:** as campanhas `expired` da busca vieram com
  `shortUrls: null` e um campo `message` no canal. Regra do sync: só entra
  campanha `onTime` **com `shortUrls` preenchido no canal escolhido**; sem link,
  ignorar (e contar como descartada por "sem link" no log do sync).
- **Nome da loja:** a 1ª página de lojas cobre só 20 das 138; o sync precisa ler
  as 7 páginas (o diagnóstico mostra o UUID quando a loja não está na página 1).
- **Shopee continua aparecendo como loja da Lomadee** ("Mega Oferta Full…") →
  decisão 13.8 item 1 segue pendente.
- Campanha "onTime" que vence em menos de 1 h (ex.: fim `2026-09-30T02:30Z`) é
  descartada pela regra da janela mínima de 1 h.

### 13.11 Respostas às decisões 13.8 (2026-09-30)

1. **Campanhas da Shopee que a Lomadee lista: EXCLUIR.** O sync ignora a loja
   Shopee (a Shopee já é origem própria, com preço e foto). Implementação:
   lista de lojas excluídas por origem própria, comparando o `site` da loja
   (`shopee.com.br`), não o nome. Conferir a mesma regra para ML, Amazon,
   AliExpress e Magalu quando aparecerem na lista de lojas da conta.
2. **Foto:** a dona do produto vai testar o banner (`mediaKit.banners[0]`) no
   staging antes de decidir. Até lá o envio da v1 sai **sem foto** (só texto), e
   o campo do banner é guardado no banco para uso futuro.
3. **Dois canais = duas contas Lomadee:** aprovado.
