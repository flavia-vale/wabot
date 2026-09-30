# Plano — Mercado Livre e Amazon nas Ofertas automáticas

> Status: **PLANO, nada implementado.** Data: 2026-09-28.
> Nenhuma decisão abaixo vale antes da **Fase 0** (medição a partir do IP da
> VPS). Onde está escrito "hipótese", é hipótese.

Leituras que embasam o plano: `docs/rca/ofertas-automaticas-e-criar-oferta.md`,
`docs/rca/lojas-conversao.md` (preço Amazon/buy box, tag na `longUrl`),
`docs/rca/imagem-e-preview.md` (muro anti-robô do ML), `docs/rca/planos-basic-pro.md`,
`docs/rca/memoria-e-capacidade.md`; código em `src/offerAutomation/*`,
`src/converters/{offerEngine,mercadolivre,amazon,index}.js`,
`src/core/mirrorLinkGuard.js`, `prisma/schema.prisma` (`OfferAutomation`).

Referência externa: Promobot (`enzostana/Promobot`, **sem licença**) — lido só
como mapa da abordagem. **Nenhuma linha dele entra no repositório**; tudo é
reescrito em JS a partir da descrição abaixo.

---

## 0. O que existe hoje (fatos do código)

| Ponto | Onde | Acoplamento à Shopee |
|---|---|---|
| Busca | `shopeeOffers.js#fetchOffers` (GraphQL `productOfferV2`) | total |
| Credencial | `dispatcher.js#runAutomation` e `reviewDiscoveryService.js` leem `platform: 'shopee'` | `no_shopee_credentials`, `invalid_shopee_credentials` |
| Link | `offer.offerLink` **já vem de afiliado** da própria API da Shopee | nenhuma conversão acontece hoje |
| Nome da loja | `automationOfferProduct` → `storeName: 'Shopee'`; Story → `storeName: 'Shopee'`; título padrão `'Produto Shopee'` | 3 lugares |
| Cupom | `chooseCoupon({ platform: 'shopee' })` | 1 lugar |
| Preço | `resolveShopeeOfferPrice` (`priceMin` → `price` → `priceMax`) | lê `price` também, serve para outra loja |
| Preço antigo | recalculado a partir de `priceDiscountRate` inteiro | arredonda — ruim quando a loja dá o "de" real |
| Página | `nextOfferPage` avança até `OFFER_AUTOMATION_MAX_PAGE` | semântica de API paginada |
| Dedup por automação | `sentItemIds` (JSON, últimos 200, `String(itemId)`) | aceita qualquer string |
| Dedup cruzada | `OfferAutomationSentLog.productKey` = nome normalizado (`productDedupKey`) + exceção por `priceCents` | **independe de loja** |
| Onde roda | `startOfferAutomationCron()` dentro do processo **`api`** (`src/api/server.js`) | tick de 60 s com trava `running` |
| Plano | `canUseOfferAutomations` (PRO/Trial/Premium) | já cobre a feature inteira |

---

## 1. Modelo de dados

**Decisão proposta: coluna nova `store` em `OfferAutomation`, não tabela nova.**

```prisma
store String @default("shopee")   // 'shopee' | 'mercadolivre' | 'amazon'
```

- Por que coluna: agenda, destinos (WhatsApp/Instagram), template, cupons, fila
  de revisão, `sentItemIds`, `page`, `publicationMode` — **tudo é igual** entre
  lojas. Tabela nova duplicaria rotas, cron, revisão e tela.
- Migration SQLite: `ALTER TABLE "OfferAutomation" ADD COLUMN "store" TEXT NOT NULL DEFAULT 'shopee';`
  Toda automação existente vira `shopee` — **comportamento idêntico**
  (grandfathering, invariante do RCA). Sem backfill, sem tocar em outra coluna.
  Passa por staging antes de prod (regra do AGENTS.md).
- **Loja é imutável depois de criada** (`PUT` recusa troca com 400). Motivo:
  `sentItemIds` e `page` de uma loja não significam nada na outra. Trocar de
  loja = criar outra automação.
- Valor de `store` desconhecido → a automação é **PULADA** (`skipped:
  'loja_desconhecida'`), nunca cai em `shopee` — mesmo padrão de
  `publicationMode` desconhecido.

**Campos específicos da Shopee em outras lojas:**

| Campo | Shopee | ML / Amazon |
|---|---|---|
| `sortType` | como hoje | gravado com o default (2), **ignorado** pela fonte; tela não mostra |
| `listType` | já dormente (`searchListType.js`) | ignorado |
| `prioritizeAMS` | legado, só desligar | rota recusa `true` (400) — não existe comissão extra |
| `isKeySeller` | sempre `false` | ignorado |
| `page` | rotação da API | ML: página da vitrine (`?page=N`, teto medido na Fase 0); Amazon: sempre 1 (a Amazon ignora `startIndex`) |
| `keyword` | obrigatória | ver §3 |

Nenhuma coluna Shopee é apagada nem renomeada (sem migration destrutiva).

**Dedup com ASIN e MLB:**

- `sentItemIds`: guarda `String(itemId)`. Cada automação tem **uma** loja, então
  ASIN (`B0XXXXXXXX`) e MLB (`MLB123…`) não colidem com o `itemId` numérico da
  Shopee. **Sem mudança.**
- `OfferAutomationSentLog`: `productKey` continua o nome normalizado (não mexer
  em `productDedupKey` — a regra existe porque a Shopee repete o produto sob
  itemIds diferentes; o ML faz o mesmo com anúncio × catálogo). `itemId` passa
  a guardar ASIN/MLB. Exceção por preço (`priceCents`) vale igual.
- Efeito colateral aceito: o mesmo produto, com o mesmo nome e preço, vindo de
  Shopee **e** ML para o **mesmo grupo** na janela de 120 min sai uma vez só.
  É o que a regra quer ("uma não conhecia o que a outra mandou").
- Testes novos: dedup cruzada com ASIN e com MLB; mesmo nome em lojas
  diferentes e preço diferente → passa; mesmo preço → bloqueia.

---

## 2. Arquitetura — interface "fonte de ofertas"

```
src/offerAutomation/sources/
  index.js          getOfferSource(store) → fonte | null   (registro único)
  shopeeSource.js   embrulha shopeeOffers.fetchOffers SEM transformar nada
  mercadoLivreSource.js
  amazonSource.js
  vitrineCache.js   cache em memória da vitrine (ML/Amazon), 1 fetch por loja por ciclo
  vitrineParse.js   PURO: html → ofertas normalizadas (testável com fixture)
  titleMatch.js     PURO: palavra-chave × título (§3)
```

Contrato de cada fonte:

```js
{
  store: 'mercadolivre',
  label: 'Mercado Livre',            // vai para storeName, título padrão, Story
  credentialPlatform: 'mercadolivre',
  needsLinkConversion: true,         // Shopee: false (offerLink já é afiliado)
  hasSortChoice: false,              // Shopee: true
  async fetchCandidates({ automation, page, creds, excludeItemIds, minDiscountPct, limit })
    // → { offers: Offer[], rawCount, dropped, sourceHealth }
}
```

Oferta normalizada — **usa os MESMOS nomes de campo que o dispatcher já lê**, e
só acrescenta campos opcionais:

| Campo | Shopee (vem da API, inalterado) | ML / Amazon |
|---|---|---|
| `itemId` | itemId numérico | `MLB…` / ASIN |
| `productName` | ✓ | título do card |
| `price` / `priceMin` | ✓ | `price` (número em reais) |
| `priceDiscountRate` | inteiro | `round((1 - price/originalPrice) * 100)` ou selo da Amazon |
| `imageUrl` | ✓ | foto do card (§5) |
| `offerLink` | link de afiliado | **preenchido só depois da conversão** (§4) |
| `originalPrice` (novo, opcional) | ausente | "de" real, só se `> price` |
| `productUrl` (novo) | ausente | link canônico sem rastreio (`/dp/<ASIN>`, `…/MLB…`) |
| `store` (novo) | ausente → `'shopee'` | ✓ |

**Por que isso não muda a Shopee:** `shopeeSource` devolve os `nodes` crus
exatamente como `fetchOffers` devolve hoje; os campos novos são opcionais e só
são lidos quando existem. Onde o dispatcher tem literal `'Shopee'`/`'shopee'`,
ele passa a ler `source.label`/`source.credentialPlatform` — que valem
`'Shopee'`/`'shopee'` para a Shopee. `automationOfferProduct` só usa
`originalPrice` quando presente; ausente, cai na conta de hoje.

**`resolveOffers` continua o chokepoint** (envio direto, fila de revisão e
`search-preview`). O ramo `prioritizeAMS` fica **dentro** de `shopeeSource`.
`skipped` de credencial: Shopee mantém `no_shopee_credentials` /
`invalid_shopee_credentials` (a tela e os testes dependem do texto); lojas
novas ganham `no_mercadolivre_credentials` / `no_amazon_credentials`.

### Testes que travam a Shopee (Fase 1)

Existentes, devem passar **sem editar asserção**:
`test/offer-automation.test.js`, `test/offer-automation-extended.test.js`,
`test/offer-automation-form.test.js`, `test/offer-automation-review-*.test.js`
(cron, delivery, discovery, state), `test/ofertas-automaticas-escolha-da-busca.test.js`,
`test/ofertas-automaticas-link-espelhamento.test.js`,
`test/painel-ofertas-automaticas-cards.test.js`, `test/diag-busca-shopee.test.js`.
(Hoje alguns leem o fonte de `dispatcher.js` por texto, ex.: "`automation.listType`
não pode voltar" — a checagem continua válida, e se algum teste apontar o
arquivo errado depois do refactor, ajusta o **caminho**, nunca a regra.)

Novos (escritos **antes** do refactor, rodando verde no código atual):

1. **Golden da Shopee:** fixture fixa de `nodes` → captura (a) os argumentos
   passados a `fetchOffersFn` (keyword, sortType, listType, page, isAMSOffer,
   isKeySeller, excludeItemIds), (b) texto e opções de cada `sendBroadcastFn`,
   (c) payload do Story, (d) `sentLogRows`, (e) o `update` final
   (`sentItemIds`, `page`). Depois do refactor: byte a byte igual. Um caso com
   `prioritizeAMS: true` e um com cupom.
2. Automação **sem** campo `store` (linha antiga em memória) → trata como
   Shopee. `store: 'xpto'` → `skipped: 'loja_desconhecida'`, zero fetch.
3. Fila de revisão e `searchOffersPreview` com a Shopee: mesmo resultado antes
   e depois.
4. `shopeeSource` nunca chama `convertLink` (o link já é de afiliado).

---

## 3. Semântica da palavra-chave

`/ofertas` e `/deals` **são vitrines, não busca**. A palavra só pode filtrar o
que a vitrine já mostra. Em nicho pequeno ("mesa desmontável") vai render zero
na maior parte dos dias.

Proposta:

- **Casamento:** título sem acento e minúsculo, **todas** as palavras da
  palavra-chave presentes (em qualquer ordem). Mais previsível para a cliente
  que o "trecho exato" do Promobot ("fone bluetooth" casa "Fone de Ouvido
  Bluetooth"). Função pura `titleMatch.js`, com teste.
- **Várias palavras-chave numa automação?** Não nesta entrega (hoje é um campo
  só). Fica como pergunta para a dona do produto.
- **Palavra-chave opcional só em ML/Amazon** ("Todas as ofertas da vitrine",
  filtradas pelo desconto mínimo). ⚠️ **Decisão da dona do produto** — a coluna
  é `NOT NULL`, então vazio seria `''`, sem migration. Sem o OK, fica
  obrigatória como na Shopee.
- **ML: várias páginas.** O cache da vitrine busca as páginas 1..N (N medido na
  Fase 0: só vale enquanto a página seguinte traz item novo). A automação filtra
  sobre o conjunto inteiro, não por página.
- **Amazon: uma página (~30 produtos).** Nada a paginar.
- **Tela avisa, sempre** (texto em §8): "o robô não pesquisa, ele olha as
  ofertas do dia da loja". Não prometer ordenação.
- **"Ver o que sairia agora"** (reaproveita `POST /search-preview`, que já
  existe e nenhuma tela chama): mostra quantas ofertas da vitrine atual casam
  com a palavra. É o jeito de a cliente descobrir que a palavra é estreita
  **antes** de esperar dias.
- **Sem "mínimo de resultados" automático** (ampliar a palavra sozinho seria o
  produto decidir pela cliente). No lugar: motivo próprio no card —
  `nenhuma_oferta_da_vitrine_casou` — separado de `all_offers_filtered`
  (desconto) e de `loja_indisponivel` (§6).

---

## 4. Fluxo do link

```
vitrine (cache) → filtro (palavra, desconto, sentItemIds, dedup cruzada)
  → para cada candidata, em ordem, até completar offersPerSend:
      convertLink(store, productUrl, credentialsMap)       ← conversor que já existe
      resultado precisa ser conversão REAL (converted && !passthrough)
      ✓ → offer.offerLink = link da cliente → mensagem (template atual)
      ✗ → pula a candidata (não envia, não entra em sentItemIds), tenta a próxima
  → teto de tentativas: 3 × offersPerSend por execução
```

- **ML:** `productUrl` canônico com MLB → `resolveToCleanProductUrl` não vai à
  rede → `createLink` com o `ssid` da cliente (cooldown e lock que já existem em
  `mercadolivre.js`). O `/p/MLB…` de catálogo é aceito por
  `buildCanonicalCandidates`. Fase 0 conta quantos links da vitrine vêm como
  `/p/MLB`, `MLB-…`, `MLBU` ou link de clique com redirecionamento.
- **Amazon:** `/dp/<ASIN>` → `convert()` → `amzn.to` pelo SiteStripe com a tag
  **dentro** da `longUrl`, ou fallback `?tag=` (RCA de julho — não regredir).
  O fallback `?tag=` **é** conversão real (credita a cliente).
- **Chamada com `__onCredentialPatch`** igual à do robô, para o cookie rotacionado
  do ML/Amazon ser gravado — senão a automação envenena a credencial que o
  espelhamento usa. Reaproveitar o mesmo montador de `credentialsMap` do
  `offerEngine` (`buildCredentialsMap`), não escrever outro.
- **Converter só o que vai sair.** Conversão é cara e tem cota/cooldown; nunca
  converter a vitrine inteira.
- **Sem credencial da loja:** automação `skipped: 'no_<loja>_credentials'`
  **antes** de ler a vitrine (custo zero). A tela não deixa criar (§8).
- **Credencial existe mas conversão falha em tudo:** nada é enviado
  (`skipped: 'conversao_falhou'`), mesmo espírito do `mirrorLinkGuard` ("se não
  converteu, não envia"). Nunca publicar `productUrl` cru: seria oferta sem
  comissão para a cliente. Teste trava isso.
- Não usar `buildScrapedOffer` aqui: ele também **scrapeia a página do produto**
  (título/preço), o que no ML bate no muro por IP e na Amazon no CAPTCHA — e o
  card da vitrine já trouxe título/preço/foto. O que é compartilhado (converter
  + montar credenciais) vem das mesmas funções que o `offerEngine` usa;
  nenhuma lógica de scrape é duplicada.

---

## 5. Foto e preço

**Foto — o card basta (a confirmar na Fase 0):**

- ML: `pictures[0].id` → `buildMlPictureUrl(id)` (já existe em
  `mercadolivre.js`, variante 1080×1080; o RCA de imagem mediu que a CDN
  `http2.mlstatic.com` **não** está bloqueada, só a página do produto).
- Amazon: `image.hiRes.baseUrl + extension` (CDN `m.media-amazon.com`).
- Card sem foto → **fallback** para `fetchProductImage(store, productUrl)`
  (`imageScrapers.js`, já existe). Sem foto nenhuma → envia como hoje sai
  qualquer oferta sem foto (card de preview) e registra o motivo.
- `imageRefererUrl` = `productUrl` (página da loja), não o link encurtado.

**Preço — riscos:**

- ML: `current_price.value` e `previous_price` são números estruturados no JSON
  do card. Risco baixo. Fase 0 confere 3 exemplos contra a página.
- Amazon: `priceToPay` do JSON de `/deals` (preço a pagar). Riscos, à luz do
  RCA de preço (buy box):
  - **"De" (`basisPrice`)** pode ser preço de tabela. Regra do RCA: "De" só sai
    se `> price`; na dúvida, sem "De".
  - **Selo de desconto sem `basisPrice`**: usa o % só para filtrar, **não**
    inventa preço antigo.
  - **Oferta relâmpago muda de preço**: vitrine com mais de 60 min não é usada
    para enviar (TTL do cache). Depois do deploy em staging, medir com
    `scripts/diag-amazon-preco.mjs <email> --days=1` (já existe): `MUDOU`
    concentrado em envios recentes = defeito nosso.
  - Preço de Prime/assinatura/"com cupom": Fase 0 imprime exemplos crus para
    ver se aparece. Se aparecer, descartar a oferta, não publicar.
- Oferta sem título ou sem preço → descartada na fonte (`dropped.sem_preco`),
  igual `filterOffers` da Shopee. Nunca `{preço}` cru (RCA 2026-09-19).
- `automationOfferProduct` usa `originalPrice` quando existir, em vez de
  recalcular pelo % arredondado.

---

## 6. Riscos de raspagem e desligamento sozinho

| Risco | Como aparece | Resposta |
|---|---|---|
| Anti-bot ML (muro por IP, já medido na página de produto) | 200 + `suspicious-traffic` / `account-verification`, 0 cards | `isAntiBotWallHtml` (já existe) → `sourceHealth: 'muro'` |
| CAPTCHA Amazon (IP de datacenter, já visto no scraper) | 200 com página de CAPTCHA, ou 503 | reusar o detector de `productInfoScraper.js` (exportar `isAmazonBlockedHtml`) |
| HTML mudou | 200, sem muro, 0 ofertas parseadas | `sourceHealth: 'formato_mudou'` |
| IP da VPS bloqueado de vez | falha em todos os ciclos | disjuntor abaixo |
| Termos de uso | — | ⚠️ ML e Amazon restringem acesso automatizado; o contrato de Associados da Amazon tem regras sobre exibir preço fora das ferramentas deles (PA-API). **Hipótese a confirmar lendo o contrato antes da Fase 3**; risco é a conta de afiliada da cliente, não só a nossa. Decisão da dona do produto. |

**Isolamento da Shopee (obrigatório):**

- O fetch da vitrine **não roda dentro do tick** do cron (que tem a trava
  `running` — um retry de 30 s da Amazon atrasaria todas as automações da
  Shopee). `vitrineCache` tem timer próprio (`unref`), um fetch por loja por
  ciclo (padrão 30 min, com jitter), sequencial, timeout 15 s, no máximo 3
  tentativas espaçadas de 10 s **só** quando o sinal é muro/CAPTCHA.
- O tick só **lê** o cache. Cache vazio ou velho → `skipped:
  'vitrine_indisponivel'` para aquela automação; Shopee segue.
- **Um fetch por loja para o servidor inteiro**, não por automação: 100
  automações de ML = 1 requisição por ciclo. É o que mantém o tráfego baixo.

**Detecção e disjuntor:**

- Cada ciclo grava contagem: `status`, `bytes`, `parseados`, `sourceHealth`.
- `parseados === 0` → `AnalyticsEvent` `ops_offer_source_empty` com
  `{ store, status, health }` (mesmo padrão dos `ops_*` existentes).
- 3 ciclos seguidos com 0 → loja **pausada** com espera crescente
  (1 h → 2 h → 4 h … teto 24 h); automações dela saem com
  `skipped: 'loja_indisponivel'` e o card diz "O Mercado Livre não deixou o robô
  ver as ofertas agora. Tentamos de novo sozinhos."
- Primeiro ciclo com ofertas volta ao normal.
- **Chave de desligar sem deploy:** `OFFER_SOURCE_MERCADOLIVRE_ENABLED` e
  `OFFER_SOURCE_AMAZON_ENABLED`, **padrão desligado** até validar em staging.
  Desligada: a opção some da tela e as automações da loja pulam. Lembrete da
  pegadinha: mudar env exige `pm2 delete` + `start`.
- Diagnóstico read-only para depois: o próprio script da Fase 0.

---

## 7. Custo (RAM e CPU) — ⚠️ SUPER SINALIZAR (REGRA #1)

**Só HTTP, sem navegador headless.** Nenhum processo PM2 novo, nenhum worker,
nenhuma fila nova, nenhuma dependência nova (axios e regex/JSON já existem).

Estimativa (hipótese — a Fase 0 **mede** tamanho do HTML e variação de RSS):

| Item | Onde | Estimativa |
|---|---|---|
| HTML do ML por página (~1–2 MB, ×2 em string JS) | processo `api` | pico transitório ~5–10 MB por página, liberado após o parse |
| HTML da Amazon `/deals` (~1–3 MB) | processo `api` | pico transitório ~5–15 MB |
| Cache normalizado (≈ N×50 + 30 ofertas × ~1 KB) | processo `api` | **< 1 MB permanente** |
| Espelho em staging (`api-staging`) | idem | o mesmo, se a chave estiver ligada lá |
| CPU | `api` | dezenas de ms de parse por ciclo de 30 min |
| Conversão (createLink / SiteStripe) | `api` | igual a uma conversão do "Criar oferta" por oferta enviada |

- **Impacto no VPS (30,6 GB, ~24 vagas de folga pela política):** desprezível
  frente a 0,35 GB por robô. Não muda o teto de vagas.
- Fetches **sequenciais** (nunca ML e Amazon ao mesmo tempo), com
  `maxContentLength` (ex.: 8 MB) para uma página anômala não inflar o heap da
  `api`.
- ⚠️ **Se a Fase 0 mostrar que só com navegador headless funciona: PARAR.**
  Chromium custa ~300–500 MB por instância e vira processo novo — exige
  SUPER SINALIZAR com número medido e OK explícito da usuária antes de qualquer
  linha.
- **Alternativas mais leves (REGRA #2):**
  1. Parar de ler o corpo assim que o JSON embutido fechar (stream), sem
     guardar a página inteira.
  2. Ciclo maior (60 min) → metade das idas à loja.
  3. Rodar a leitura da vitrine só se existir automação ligada daquela loja.
  4. Só ML primeiro; Amazon só se a Fase 0 mostrar que vale.

---

## 8. Painel

Tela: `dashboard/app/painel/ofertas-automaticas/page.js`. Segue
`docs/design-system/design-system-v2.html` (tokens, Figtree, cartões, botões);
nenhum padrão visual novo sem entrar antes no design system.

- **Primeira pergunta do formulário: "Em qual loja o robô vai garimpar?"** —
  três cartões selecionáveis (Shopee já marcada). ML/Amazon aparecem só com a
  chave da loja ligada (§6).
- **Sem credencial da loja:** cartão desabilitado com "Cadastre seu ID de
  afiliada do Mercado Livre primeiro" e link para a tela de IDs de afiliada.
  A rota `POST` também recusa (backend é a autoridade).
- **Na edição, a loja aparece só para leitura** ("Loja: Mercado Livre — para
  trocar, crie outra automação").
- **ML/Amazon escondem "O que você quer que apareça primeiro?"** e mostram no
  lugar:
  > "No Mercado Livre o robô não pesquisa: ele olha as ofertas do dia da loja e
  > escolhe as que têm a sua palavra no nome. Palavra muito específica pode
  > passar dias sem oferta. Use 'Ver o que sairia agora' para conferir."
- Botão **"Ver o que sairia agora"** → `search-preview` com a loja.
- **Card:** etiqueta da loja; linha "Busca: ofertas do dia da loja" (a busca
  aparece SEMPRE, regra do RCA); motivos novos em linguagem simples:
  - `no_mercadolivre_credentials` → "Falta cadastrar seu ID de afiliada do Mercado Livre."
  - `nenhuma_oferta_da_vitrine_casou` → "Hoje nenhuma oferta do dia da loja tinha a sua palavra no nome."
  - `loja_indisponivel` → "A loja não deixou o robô ver as ofertas agora. Tentamos de novo sozinhos."
  - `conversao_falhou` → "Não conseguimos gerar o seu link de afiliada; nada foi enviado."
- Sem jargão (`vitrine` só no código; na tela "ofertas do dia da loja"). Teste
  de texto trava isso, igual ao da Shopee.
- Trocar as duas frases "busca produtos só na Shopee" (linhas ~301 e ~529) —
  **só quando a loja estiver ligada em produção**.
- **Cadeado PRO:** nada novo. A feature inteira já é PRO
  (`canUseOfferAutomations`); o ProGate atual cobre. Atualizar a linha do plano
  "Garimpo automático (ofertas automáticas, só Shopee)" em
  `DEFAULT_LANDING_PLANS` (`dashboard/lib/marketing-content.js`) + `pricing.md`
  + `llms.txt` **depois** do deploy em `main`; se a página pública já estiver
  no Google, entra na leva 🔝 de reindexação de
  `docs/marketing/ACOES_FLAVIA_2026-09-11.md`.

---

## 9. Fatiamento

Cada fase: branch a partir de `develop` → PR contra `develop` → staging
(`http://178.105.54.0:3006`) → só depois `develop` → `main`.

| Fase | Entrega | Muda comportamento? | Validação em staging | Porta para a próxima |
|---|---|---|---|---|
| **0** | `scripts/diag-ofertas-ml-amazon.mjs` (read-only) + fixtures reais salvas em `test/fixtures/` + teste do parser | Não | usuária roda 1 comando na VPS | tabela de decisão abaixo |
| **1** | Interface de fonte + `shopeeSource`; testes golden antes; **zero migration** | Não (Shopee idêntica) | 24 h de automações Shopee em staging: mesmos `skipped`/`sent` do dia anterior | golden verde + staging sem diferença |
| **2a** | Migration `store` (default `shopee`) + rota aceita `store` + `PUT` recusa troca | Não (todas `shopee`) | `SELECT store, COUNT(*) FROM OfferAutomation GROUP BY store` = só `shopee` | contagem bate com a de antes |
| **2b** | Fonte ML + cache + disjuntor + conversão; chave `OFFER_SOURCE_MERCADOLIVRE_ENABLED` **desligada** em prod | Só com a chave | chave ligada só em staging, conta da dona do produto: oferta chega com `meli.la`/link dela, foto, preço | 3 dias sem `loja_indisponivel` em staging |
| **2c** | Tela (escolha de loja, aviso, prévia, motivos) | Só com a chave | navegação real no painel de staging | OK visual da dona do produto |
| **3** | Amazon (mesmo trilho de 2b + 2c) | Só com a chave | idem + `diag-amazon-preco.mjs` e `diag-amazon-shortlink-tag.mjs` nos envios | preço sem `MUDOU` recente; tag dentro do `amzn.to` |
| **4** | Copy pública, planos, `docs/rca/ofertas-automaticas-e-criar-oferta.md` (tirar "100% Shopee"), linha no mapa de sintomas do AGENTS.md | Texto | — | — |

Riscos de memória só nas fases 2b/3 (sinalizados em §7).

---

## 10. FASE 0 — medição obrigatória (nada por suposição)

### O script: `scripts/diag-ofertas-ml-amazon.mjs`

- **Read-only:** não lê credencial, não converte link, não grava banco, não
  envia nada. Só `GET` público nas duas páginas, com cabeçalho de navegador
  comum (`User-Agent` de Chrome, `Accept-Language: pt-BR`).
- Parser escrito em JS no mesmo arquivo que as fases seguintes vão usar
  (`src/offerAutomation/sources/vitrineParse.js`, PURO) — script que
  reimplementa o parser passa a discordar do produto em silêncio (mesma regra
  do `diag-busca-shopee.mjs`).
- Opções: `--desconto=20` (padrão 20), `--paginas=3` (ML, padrão 3),
  `--palavra="air fryer"` (opcional), `--salvar` (grava o HTML em
  `/tmp/diag-ofertas-*.html` para virar fixture de teste).

Imprime, **por loja**:

| Linha | Para quê |
|---|---|
| status HTTP, bytes, tempo (ms), URL final (depois de redirecionar) | bloqueio × lentidão × redirecionamento para login |
| muro/CAPTCHA detectado (sim/não) | separa bloqueio de HTML que mudou |
| ofertas parseadas (ML: pelo JSON embutido e pelo HTML dos cards, separado) | se a fonte principal quebrar, a outra segura? |
| ML: itens novos por página (p1, p2, p3…) | quantas páginas vale buscar |
| Amazon: 2ª leitura 10 s depois — quantos iguais à 1ª | a vitrine muda ou é fixa |
| com preço / com preço antigo / com foto | o card basta para montar a oferta? |
| passam no desconto ≥ X | rendimento real |
| casam com `--palavra` (se passada) | o quanto a palavra estreita |
| formas de link (ML: `/p/MLB`, `MLB-`, `MLBU`, clique/redirect; Amazon: com ASIN) | a conversão vai aceitar? |
| 3 exemplos: título, preço, "de", desconto, foto, link | conferir na mão contra a loja |
| RSS e heap antes/depois | número real para a REGRA #1 |

### Comando único para a usuária (na VPS, depois do merge da Fase 0 em `develop`)

```bash
cd ~/wabot-staging && node scripts/diag-ofertas-ml-amazon.mjs --desconto=20 --paginas=3 2>&1 | tail -n 60
```

Roda no diretório de staging porque o script chega lá pelo deploy de `develop`
e usa o parser do repositório; é o **mesmo IP** da produção, então o resultado
vale para os dois. Não precisa o staging estar ligado no PM2 (é só `node`),
não toca em produção nem no banco.

### O que cada resultado decide

| Resultado | Decisão |
|---|---|
| **ML 200, ≥ 20 ofertas, sem muro** | Segue Fase 1 → 2 (ML). |
| **ML 200, 0 ofertas, muro = sim** | IP bloqueado. **Plano B:** medir se é intermitente, com a mesma lógica do `diag-ml-muro-taxa.mjs` (rodadas espaçadas por 12 h). Intermitente → ciclo mais espaçado + disjuntor. Permanente → **ML fica fora**. Não usar cookie da cliente para raspar nem proxy pago sem decisão da dona do produto. |
| **ML 200, 0 ofertas, muro = não** | HTML diferente do mapeado. Salvar com `--salvar`, reescrever o parser sobre o HTML real; nada de implementar antes. |
| **ML 403/429** | Bloqueio explícito → mesmo Plano B. |
| **ML página 2 = mesmos itens da 1** | Paginação não funciona: N = 1. |
| **Amazon 200, ~30 ofertas, sem CAPTCHA** | Segue Fase 3 (depois do ML). |
| **Amazon CAPTCHA ou 503 nas 2 leituras** | IP de datacenter barrado. **Plano B:** PA-API (exige chaves de API por cliente e conta de Associados com vendas qualificadas — pesado para a cliente) ou **Amazon fica fora**. Decisão da dona do produto. |
| **Amazon 2ª leitura = 1ª** | Vitrine fixa por horas: ciclo de 60 min basta; esperar poucas ofertas novas por dia. |
| **< 5 ofertas passam no desconto de 20%** | Palavra-chave vai render quase nada: priorizar "Todas as ofertas" (§3) e o aviso na tela. |
| **< 50% com foto** | Foto não vem do card: plano passa a depender de `fetchProductImage` (que no ML bate no muro) → reavaliar antes da Fase 2. |
| **Preço vazio ou "de" menor que "por" em algum exemplo** | Parser de preço precisa de regra a mais antes de publicar qualquer coisa. |
| **HTML > 8 MB ou RSS +50 MB** | Refazer §7 com leitura em stream antes de seguir. |

A usuária manda **só a saída filtrada** (`tail -n 60`). Com ela, este plano é
revisado (seção "Decisões da Fase 0" a acrescentar aqui) antes da Fase 1.

---

## 11. Perguntas abertas para a dona do produto

1. Palavra-chave opcional em ML/Amazon ("Todas as ofertas")? (§3)
2. Aceita o risco de termos de uso / contrato de Associados da Amazon? (§6)
3. Se o ML bloquear o IP: ML fora, ou avaliar alternativa paga? (§10)
4. Ordem das lojas depois da Fase 0 (ML antes da Amazon é a sugestão, porque o
   parse do ML é por JSON estruturado e a conversão ML já é a mais usada).
