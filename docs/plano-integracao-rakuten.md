# Plano técnico — integração Rakuten Advertising

> Status: **PLANO** (nada implementado). Data: 2026-09-30.
> Escopo **V1 = só Ofertas automáticas** (busca por palavra-chave → envio no grupo).
> Escopo **V2 = conversão de links** (espelhamento, Converte links, Criar oferta).
> Ler junto: `docs/rca/ofertas-automaticas-e-criar-oferta.md`,
> `docs/rca/lojas-conversao.md`, `docs/rca/credenciais-e-seguranca.md`,
> `docs/rca/memoria-e-capacidade.md`.

Legenda de impacto: 🟢 baixo · 🟡 médio · 🔴 alto.

---

## 0. O que já sabemos do código (base do plano)

| Peça | Onde | Por que importa para a Rakuten |
|---|---|---|
| Busca de ofertas | `src/offerAutomation/shopeeOffers.js` (`fetchOffers`, `filterOffers`, `productDedupKey`) | Hoje é **só Shopee** e o formato da oferta é o da Shopee (`itemId`, `productName`, `offerLink`, `priceDiscountRate`...). |
| Disparo | `src/offerAutomation/dispatcher.js` (`runAutomation`, `resolveOffers`, `searchOffersPreview`, `automationOfferProduct`) | Busca a credencial `platform: 'shopee'` fixo; textos "Produto Shopee", `storeName: 'Shopee'`, cupom `platform: 'shopee'` fixos. |
| Fila de revisão | `src/offerAutomation/reviewDiscoveryService.js` | Também lê credencial Shopee fixo. Desligada por padrão, mas precisa seguir o mesmo caminho. |
| Cron | `src/offerAutomation/cron.js`, iniciado em `src/api/server.js` | Roda **dentro da API**. Deploy da API já recarrega o código da V1 — **não precisa** `pm2 restart bot-supervisor`. |
| Rotas | `src/api/routes/offerAutomation.js` (valida `listType/sortType` da Shopee, `search-preview` com credencial Shopee fixa) | Precisa aceitar `platform`. |
| Tabela | `OfferAutomation` (`prisma/schema.prisma` + `schema.postgres.prisma`) | Não tem coluna de loja. Campos `listType/sortType/prioritizeAMS/isKeySeller` são só da Shopee. |
| Dedup | `OfferAutomationSentLog (productKey, priceCents, itemId)` + `sentItemIds` | Serve para a Rakuten sem mudar a tabela, desde que o `itemId` seja único entre lojas (ver passo 5). |
| Credenciais | `Credential (userId, platform, data criptografado)` + `src/credentialHealth.js` (`PLATFORMS`, `REQUIRED_FIELDS`, `FIELD_LABELS`) | `PLATFORMS` é usado no resumo de lojas, em `credentials.js` e em `coupons.js`. **Adicionar lá muda telas** (ver passo 2). |
| Tela | `dashboard/app/painel/ofertas-automaticas/page.js`, `dashboard/app/painel/ids-afiliada/page.js` | Textos dizem "busca produtos só na Shopee". |
| Páginas públicas | `dashboard/app/_comparisonContent.js`, `dashboard/lib/competitors-data.js` | Hoje dizem **"não cobrimos Rakuten"**. |

## 1. Passo 0 — Spike de API (antes de qualquer código de produto) 🔴

**Por quê:** nada de implementar por suposição. Hoje só temos dados públicos
parciais da Rakuten; o que falta medir decide se a V1 vale a pena.

O que se sabe (fonte pública, a confirmar):
- Portal: `developers.rakutenadvertising.com`. Credenciais: **Client ID + Client Secret** (portal) + **SID** (ID do site do publisher = `scope` do token).
- Token OAuth com validade curta (≈ 1 h) e refresh token.
- **Product Search API** (`productsearch/1.0`): **só XML**, até ~5.000 resultados por busca, paginação por `pagenumber`/`max`, ~**100 chamadas/min** por conta.
- **Deep Links API** existe (usada na V2).

O que o spike precisa **medir** com uma conta real (script read-only
`scripts/diag-rakuten-busca.mjs`, modelo do `diag-busca-shopee.mjs`):
1. Endpoint e formato exatos do token (header, body, validade, refresh).
2. A busca devolve produtos de **anunciantes brasileiros**? Quantos? (lojas BR sem feed = V1 sem conteúdo.)
3. Devolve só anunciantes **com parceria aprovada** do publisher? (muda o texto de ajuda da tela.)
4. Campos por item: `price`, `saleprice`, moeda, `linkurl` (já é link de afiliado?), `imageurl`, `sku`, `mid`, `merchantname`.
5. `saleprice < price` aparece com frequência? (sem isso, o filtro de desconto mínimo zera tudo — mesmo sintoma do `all_offers_filtered` da Shopee.)
6. Ordenação disponível (`sort`) e se existe algo parecido com "mais vendidos".
7. Resposta de erro (401, 429, token expirado) — formato e códigos.

**Critério de seguir/parar:** se em 5 palavras-chave típicas das clientes
(ex.: "tênis", "fone", "air fryer") vierem < 10 produtos BR com desconto,
**parar e reavaliar** antes do passo 1.

**Impacto:** 🟢 zero em produção (script local/staging, read-only).
**Entregável:** tabela de medições anexada neste documento + fixtures XML reais (sem dados sensíveis) em `test/fixtures/rakuten/`.

## 2. Credencial "Rakuten" (armazenamento) 🟡

**O que fazer**
1. `src/credentialHealth.js`: adicionar `rakuten: 'Rakuten'` em `PLATFORM_LABELS`, `REQUIRED_FIELDS.rakuten = ['clientId', 'clientSecret', 'sid']`, rótulos amigáveis em `FIELD_LABELS` e validação de formato em `getFormatWarnings` (SID numérico etc.).
2. Criptografia: continua via `credentialCrypto.js` (mesmo caminho das outras lojas). Nunca logar `clientSecret` nem token.
3. `src/api/routes/credentials.js`: endpoint `GET /rakuten/session` (sondagem ativa, igual `/shopee/session`) — gera token e faz 1 busca mínima; responde `alive: true/false` + motivo em português.

**Impactos a checar (todos consumidores de `PLATFORMS`)**
- 🟡 Resumo de lojas / "Faltou cadastrar a loja" (`credentialHealth.js:333`, `logsCopy.js`): a Rakuten **não pode** aparecer como "loja faltando" para quem não usa — na V1 ela não converte link. Marcar como **opcional** / fora do cálculo de pendência.
- 🟡 `coupons.js` usa `PLATFORMS` para validar cupom: ok aceitar `rakuten`, mas `clientCouponPolicy.KNOWN_PLATFORMS` **não** muda na V1 (cupom fora da V1, ver passo 7).
- 🟢 `credentialExpiry/policy.js` (`EXPIRY_ALERT_PLATFORMS`): **não** incluir na V1 — o token é renovado sozinho; só alertar se a chave for recusada (passo 9).
- 🟢 `groups.js:238` (whitelist de plataformas de conversão por grupo): **não** incluir na V1.

## 3. Cliente HTTP da Rakuten (`src/offerAutomation/rakutenOffers.js`) 🟡

**O que fazer**
1. `getAccessToken(creds)`: pede token; cache **em memória** por `userId` até 5 min antes de vencer; em 401 renova uma vez e repete.
2. `fetchRakutenOffers({ keyword, minDiscountPct, limit, excludeItemIds, creds, page })`: chama a Product Search, faz parse do XML e **normaliza cada item no mesmo formato de oferta que o dispatcher já usa**:
   - `itemId` = `rakuten:${mid}:${sku}` (prefixo evita colisão com `itemId` da Shopee na dedup)
   - `productName`, `imageUrl`, `offerLink` = `linkurl` (link de afiliado)
   - `price` = `saleprice` (ou `price` se não houver promoção), `priceMin`/`priceMax` iguais
   - `priceDiscountRate` = `round((price - saleprice) / price * 100)`
   - `storeName` = `merchantname` (ex.: "Nike"), `platform: 'rakuten'`
   - `sales`/`ratingStar`/`commissionRate` = vazios (a Rakuten não dá — o texto já omite linha vazia)
3. Reaproveitar `filterOffers` (já descarta sem preço e abaixo do desconto) e os contadores de descarte (`OFFER_DROP_REASON`).
4. Erros: API que responde erro vira `throw new Error('rakuten_api_error: ...')` (mesma lição da Shopee: erro não pode se disfarçar de "não achei oferta").
5. Descartar item com moeda ≠ BRL (evita preço em dólar no grupo).
6. Timeout 10 s, sem retry em loop; 429 = pular esta execução e registrar.

**Dependência nova:** parser de XML. Recomendo `fast-xml-parser` (JS puro, sem binário nativo, ~100 KB). Alternativa mais leve: parse manual por regex — **não recomendo** (XML com CDATA/entidades quebra fácil).

**Impactos**
- 🟢 Memória: cache de token = poucos bytes por cliente com Rakuten. Sem processo novo, sem fila nova, sem worker. **Estimativa: < 1 MB mesmo com 100 clientes** → dentro da política, mas fica registrado aqui (REGRA #1).
- 🟡 Limite de 100 chamadas/min é **por conta da cliente** (cada uma usa a própria chave), então não somamos clientes num limite só. Ainda assim o cron roda automações em sequência — ok.
- 🔴 **Clique falso:** `linkurl` é link de rastreio. **Nenhum código nosso pode dar GET nele** (scraper de imagem, preview, verificador de link). Cliques vindos do IP da VPS podem ser marcados como fraude pela Rakuten e prejudicar a conta da cliente. Ver passo 6.

## 4. Camada "fonte de ofertas" no dispatcher 🔴 (maior risco de regressão)

**O que fazer**
1. Criar `src/offerAutomation/offerSources.js` com um mapa:
   `{ shopee: { credentialPlatform: 'shopee', fetch: fetchOffers, validateCreds }, rakuten: { credentialPlatform: 'rakuten', fetch: fetchRakutenOffers, validateCreds } }`.
2. `dispatcher.js` (`runAutomation`, `resolveOffers`, `searchOffersPreview`) e `reviewDiscoveryService.js`: trocar o `platform: 'shopee'` fixo por `automation.platform ?? 'shopee'`.
3. Motivos de pulo passam a ser por loja: `no_rakuten_credentials`, `invalid_rakuten_credentials` (manter os da Shopee com o mesmo nome — a tela e logs antigos dependem deles).
4. `resolveOffers`: o ramo AMS/`prioritizeAMS` e `listType/sortType` só valem para Shopee; na Rakuten, chamada única.
5. `automationOfferProduct`/`formatOfferMessage`: `storeName` e o título de reserva vêm da oferta (`offer.storeName ?? 'Shopee'`) em vez de `'Shopee'` fixo.

**Impactos**
- 🔴 Mexe no caminho de **todas** as automações Shopee existentes. Regra: com `platform = 'shopee'` o comportamento tem que ser **byte a byte o mesmo**. Proteção: rodar `test/offer-automation.test.js` e testes da fila de revisão **antes e depois** sem alterar asserts da Shopee.
- 🟡 Textos de pulo novos precisam entrar na tela (`page.js` linhas ~56-59) — senão aparece o código cru.

## 5. Banco (migration) 🟡

**O que fazer** (SQLite + Postgres, em `prisma/migrations` e `schema.postgres.prisma`)
1. `OfferAutomation.platform String @default("shopee")`.
2. `OfferAutomation.rakutenAdvertiserIds String @default("[]")` — opcional: limitar a busca a lojas específicas (`mid`). Na V1 pode ficar só no banco, sem tela, se o spike mostrar que a busca aberta já é boa.
3. **Não** mexer em `OfferAutomationSentLog` / `ReviewItem`: `itemId` com prefixo `rakuten:` e `productKey` por nome já separam as lojas.

**Impactos**
- 🟢 `DEFAULT 'shopee'` = automações existentes continuam iguais sem backfill.
- 🟡 Dedup cruzada por nome (`productDedupKey`): o **mesmo produto** vindo da Shopee e da Rakuten no mesmo grupo vira um envio só dentro da janela de 120 min. É o comportamento desejado (não repetir produto no grupo), mas registrar no RCA.
- Regra do repo: migration passa por staging antes de prod; conferir contagem de `OfferAutomation` antes/depois.

## 6. Link e imagem (sem clique falso) 🔴

**O que fazer**
1. Usar `imageurl` da Rakuten direto como `imageUrl`; **não** passar `linkurl` como `imageRefererUrl` (hoje é `offer.offerLink`) — para Rakuten mandar `null` ou a URL do produto na loja, se o spike mostrar que ela vem no XML.
2. Garantir que o envio (`sendBroadcast`) não gera preview buscando o `linkurl` no servidor. Conferir em `buildManualLinkPreview` / `src/core/previewImageFallbackPolicy.js` que, com `imageUrl` preenchido, não há fetch da página do link; se houver, desligar o fallback de scraping quando `platform = 'rakuten'`.
3. Imagem da Rakuten às vezes vem `http://` ou pequena: reaproveitar a política de fallback de imagem existente; se a imagem falhar, enviar só texto (nunca buscar a página do link).
4. Link longo (`click.linksynergy.com/...`): V1 envia como está. Encurtador fica fora da V1.

**Impactos**
- 🔴 Se errar aqui: cliques do IP da VPS → risco de bloqueio da conta de afiliado da cliente. Teste obrigatório: mock de `axios` falhando se qualquer URL `linksynergy` for chamada durante `runAutomation`.
- 🟡 Card sem foto: sintoma conhecido (`docs/rca/imagem-e-preview.md`); o diagnóstico `diag-preview-sem-imagem.mjs` deve aceitar a origem Rakuten.

## 7. O que fica FORA da V1 (de propósito) 🟢

- Cupons da cliente (`useCoupons`): `chooseCoupon` é por loja e o catálogo não conhece "Rakuten" (que agrupa várias lojas). Na V1, `useCoupons` fica desligado/escondido quando `platform = 'rakuten'`.
- Instagram Stories para automação Rakuten: funciona pelo mesmo caminho, mas **testar antes de liberar**; se não der tempo, esconder na V1.
- Fila de revisão: segue o mesmo flag atual (desligada por padrão); com o passo 4 ela já funciona.
- Coupon API da Rakuten, relatórios de comissão, encurtador.

## 8. API das rotas 🟡

`src/api/routes/offerAutomation.js`
1. Aceitar `platform` em criar/editar (`'shopee' | 'rakuten'`, padrão `'shopee'`). **Não** permitir trocar a loja de uma automação existente (evita `sentItemIds` misturado) — para trocar, cria outra.
2. Validar `listType/sortType/prioritizeAMS/isKeySeller` **só** quando `platform = 'shopee'`; para Rakuten ignorar/zerar.
3. `search-preview`: escolher a credencial pela loja pedida.
4. Plano: mesmo gate atual (`FEATURE_CODES.OFFER_AUTOMATIONS` = PRO). Nenhum código de plano novo.
5. Liberação controlada: env `OFFER_AUTOMATION_RAKUTEN_USERS` (lista de userIds, padrão vazio = ninguém), no molde de `reviewFlags.js`. A rota recusa `platform = 'rakuten'` fora da lista.

**Impacto:** 🟡 Mudar env exige `pm2 delete` + `start` (não `restart --update-env`) — ver `docs/rca/deploy-e-infra.md`.

## 9. Telas (seguir `docs/design-system/design-system-v2.html`) 🟡

1. **IDs de afiliada** (`dashboard/app/painel/ids-afiliada/page.js`): card "Rakuten" com 3 campos (Client ID, Client Secret, SID), botão "Testar chave" usando `/credentials/rakuten/session`, passo a passo curto de onde achar cada dado.
2. **Ofertas automáticas** (`dashboard/app/painel/ofertas-automaticas/page.js`):
   - escolha de loja no topo do formulário (Shopee / Rakuten), só visível para quem está na lista de liberação;
   - para Rakuten esconder controles exclusivos da Shopee (lista/ordem/AMS/cupons);
   - trocar o texto "busca produtos só na Shopee" (linhas ~301 e ~529);
   - mensagens novas de pulo (`no_rakuten_credentials`, etc.) em português simples;
   - lista de automações mostra a loja de cada uma.
3. Sem padrão visual novo; se precisar de algum, decidir com a dona do produto e registrar no design system **antes**.

**Impacto:** 🟢 só visual; nada muda para quem não está na lista.

## 10. Testes (node:test, sem rede) 🟡

1. `test/rakuten-offers.test.js`: parse do XML real do spike, normalização (desconto, preço, moeda ≠ BRL descartada, item sem preço descartado), `itemId` com prefixo, erro da API vira exceção.
2. Token: cache, renovação em 401, sem vazar segredo em mensagem de erro.
3. `test/offer-automation.test.js`: automação sem `platform` = Shopee igual a hoje; automação Rakuten usa a credencial certa; motivos de pulo novos; dedup cruzada Shopee × Rakuten.
4. Teste "nenhum GET em `linksynergy`" durante o envio (passo 6).
5. Rotas: `platform` inválido → 400; Rakuten fora da lista de liberação → 403; campos da Shopee ignorados para Rakuten.
6. `test/agents-md-enxuto.test.js` continua passando (não colar RCA no AGENTS.md).

## 11. Observabilidade 🟢

1. `scripts/diag-rakuten-busca.mjs` (read-only): roda a busca com a chave de uma cliente e mostra quantos vieram, quantos descartados por motivo.
2. Log `[rakuten-offers]` com contagem por motivo de descarte (igual Shopee), **sem** token/segredo.
3. Nova seção em `docs/rca/ofertas-automaticas-e-criar-oferta.md` + linha no "Mapa de sintomas" do `AGENTS.md` (curta).

## 12. Implantação (fluxo canônico) 🟡

1. Branch a partir de `develop` → PR contra `develop` (nunca push direto).
2. Sugestão de PRs pequenos, nesta ordem (cada um sem mudar nada para a cliente sozinho):
   1. Spike + fixtures + diag script.
   2. Migration `platform` + camada `offerSources` (Shopee só refatorada; testes iguais).
   3. Cliente Rakuten + credencial + rota `session`.
   4. Rotas + telas + flag de liberação.
3. Staging (`http://178.105.54.0:3006`): criar automação Rakuten com a conta de teste, validar envio real num grupo de teste, conferir no painel da Rakuten que **não** apareceu clique vindo da VPS.
4. Produção: liberar para 1-3 clientes piloto via `OFFER_AUTOMATION_RAKUTEN_USERS`; observar 1 semana.
5. Liberar geral (esvaziar a regra da flag ou trocar por "todos").
6. Depois do deploy em `main` e liberação geral: atualizar páginas públicas que dizem "não cobrimos Rakuten" (`_comparisonContent.js`, `competitors-data.js`, listas de lojas) e colocar as URLs na leva 🔝 de reindexação em `docs/marketing/ACOES_FLAVIA_2026-09-11.md`.

**Impactos do deploy**
- 🟢 V1 roda na API (cron): deploy da API basta; **não** reinicia robôs WhatsApp.
- 🟡 Migration em prod: backup antes (`scripts/backup_prod.sh`), conferir contagem.

## 13. Rollback

- Esvaziar `OFFER_AUTOMATION_RAKUTEN_USERS` → rotas recusam e o cron pula automações Rakuten (`skipped: 'rakuten_disabled'`). Sem mexer no banco.
- A coluna `platform` com default `'shopee'` pode ficar; não precisa reverter migration.

---

## V2 — Conversão de links (depois da V1 estável)

Só listar agora, para a V1 não fechar portas.

1. **Descobrir a loja pelo link** 🔴: a Rakuten não é uma loja, é uma rede com vários anunciantes. Precisamos de um mapa **domínio → `mid`** por cliente, vindo da Advertiser Search API (só anunciantes com parceria aprovada), com cache (em banco, renovado 1×/dia — não em memória de cada robô, por RAM).
2. **Converter** 🟡: `src/converters/rakuten.js` usando a **Deep Links API** (ou o formato `click.linksynergy.com/deeplink?id=&mid=&murl=`); registrar em `src/converters/index.js` e `linkKind.js`.
3. **Conflito de loja** 🔴: a mesma loja pode estar na Rakuten e em outra rede/converter nosso (ex.: loja que também é Magalu/Amazon marketplace). Regra de prioridade precisa ser decidida com a dona do produto.
4. **Guardas existentes** 🔴: `mirrorLinkGuard` (não enviar link do concorrente), "Faltou cadastrar a loja"/`skip:no_valid_conversions`, `conversionScheduler`, `groups.js` (whitelist), `clientCouponPolicy.KNOWN_PLATFORMS`, `credentialExpiry` — todos passam a conhecer `rakuten`.
5. **Robôs** 🔴: conversão roda no `bot-worker` → em modo `remote` só vale após `pm2 restart bot-supervisor --update-env` (reconecta TODAS as sessões; anunciar antes). Cache de token/mapa **não** pode ir para memória de cada worker sem estimativa de RAM (REGRA #1).
6. **Criar oferta** 🟡: aceitar link Rakuten no motor único `src/converters/offerEngine.js` (não duplicar lógica).
7. **Link de concorrente já com rastreio Rakuten** (`click.linksynergy.com` de outra pessoa) 🔴: extrair `murl` e reconverter para a cliente; se não der, não enviar (regra do `mirrorLinkGuard`).

---

## Decisões que dependem da dona do produto

1. V1 com busca aberta em todas as lojas parceiras, ou cliente escolhe lojas (`mid`)? (depende do spike)
2. Nome na tela: "Rakuten" ou "Rakuten Advertising"?
3. Liberação: piloto com quais clientes?
4. V2: prioridade quando a mesma loja existe na Rakuten e em outro converter.

## Referências

- Product Search API: https://pubhelp.rakutenadvertising.com/hc/en-us/articles/5949953174029-Product-Search-API
- Advertiser Search API: https://pubhelp.rakutenadvertising.com/hc/en-us/articles/5949801688717-Advertiser-Search-API
- Developer Portal: https://pubhelp.rakutenadvertising.com/hc/en-us/articles/5949692220813-Developer-Portal-Overview
