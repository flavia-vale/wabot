# Plano técnico — integração Rakuten Advertising

> Revisado em 2026-09-30. A 1ª versão tratava a Rakuten como 2ª origem depois
> da Shopee e ignorava que a **Awin já existe** (`docs/rca/afiliados-awin.md`).
> Agora a Rakuten segue o padrão da Awin, item a item.
> **V1 = só ofertas automáticas** (promoções e cupons). **V2 = conversão de links.**
> Regras de operação da V1 (o que não regredir): `docs/rca/afiliados-rakuten.md`.

Legenda de impacto: 🟢 baixo · 🟡 médio · 🔴 alto.

## 0. Decisões da dona do produto (2026-09-30)

1. Fazer **como na Awin**: conta por cliente em "Minhas credenciais", sync de
   hora em hora para o banco, envio só lê do banco.
2. Fonte da V1 = **só promoções** (feed de ofertas da Rakuten), igual à Awin.
   Busca de produtos por palavra ficou de fora (medição abaixo).

## 1. Medição com a conta real (passo 0) — feito

| Pergunta | Resposta medida |
|---|---|
| Como autentica? | `POST /token` com `Bearer base64(Client ID:Client Secret)` e `scope=<SID>`; token vale 1 h |
| Dá para saber qual dado está errado? | Não: SID errado (401) e segredo errado (400) dão o mesmo `invalid_client` |
| Limite | 100 chamadas/min |
| Promoções (feed `/coupon/1.0`, rede Brasil) | XML; só lojas aprovadas; **3 ofertas** (Netshoes), 1 com cupom |
| Produtos (`/productsearch/1.0`) | 27 mil "tênis", preço BRL e foto, mas **~1% com preço promocional**; "air fryer" = 0 |
| Link | `click.linksynergy.com/...?id=<id da cliente>&offerid=...` — já sai com o ID dela |
| Foto | Promoção não tem foto; o **logo da loja** (`/v2/advertisers/{id}`) serve e baixá-lo não conta clique |

## 2. V1 — item a item (implementado)

| # | Item | Arquivo(s) | Impacto |
|---|---|---|---|
| 1 | Cliente HTTP: token com cache (1 por conta, renova 5 min antes), repete 1× em token recusado, ≤60/min por conta, erros sem segredo | `src/integrations/rakuten/client.js`, `errors.js` | 🟢 memória: ~1 KB por conta |
| 2 | Leitor do feed XML sem dependência nova | `src/integrations/rakuten/translate.js` | 🟢 nada de `fast-xml-parser` (política de memória) |
| 3 | Conta Rakuten: SID + Client ID + Client Secret, cifrados, só de escrita, até 10 por cliente, "Testar conexão" | `accountService.js`, `src/api/routes/rakuten.js` | 🟡 nunca 401 para o painel (desloga a cliente) |
| 4 | Sync de hora em hora (agendador na `api`, `RAKUTEN_SYNC_ENABLED`) + logo/site da loja | `syncService.js`, `scheduler.js`, `src/api/server.js` | 🟢 sem processo novo; < 5 MB de pico |
| 5 | Banco: `RakutenAccount`, `RakutenPromotion`, `RakutenSyncRun`; `OfferAutomation.rakutenAccountId/rakutenAdvertiserIds` | `prisma/schema.prisma`, migration `20260930150000_rakuten_promotions` | 🟡 só acréscimos com default; **passa por staging antes** |
| 6 | Origem `rakuten` nas ofertas automáticas, mesma regra da Awin (uma vez por automação, reveza lojas, vence antes sai antes, nunca < 1h) | `src/offerAutomation/rakutenOffers.js`, `dispatcher.js` (`PROMOTION_SOURCES`), `reviewDiscoveryService.js`, `reviewDeliveryService.js`, `src/api/routes/offerAutomation.js` | 🔴 mexe no caminho de envio de TODAS as automações → Shopee e Awin cobertas pelos testes existentes, sem mudar asserts |
| 7 | Mensagem: modelo "Promoção (sem preço)" + `🎟️ Use o cupom: X`; validade só se vence em até 60 dias | `rakutenOffers.js` | 🟢 |
| 8 | Clique falso vindo da VPS: logo como foto, referer = site da loja, nunca o link | `rakutenOffers.js` | 🔴 residual: logo que falha → WhatsApp abre o link 1× pelo servidor (`diag-rakuten.mjs` mostra `sem_logo`) |
| 9 | Telas: card "Rakuten" em Minhas credenciais; "Promoções e cupons das lojas da Rakuten" em Ofertas automáticas (conta, lojas, textos próprios de "não enviou") | `RakutenCredentialsCard.js`, `rakutenCopy.js`, `ofertas-automaticas/page.js`, `offerAutomationForm.js`, `api.js` | 🟢 reaproveita as classes visuais da Awin (sem padrão novo no design system) |
| 10 | Testes (sem rede) + teste de linguagem leiga | `test/rakuten-*.test.js`, `test/fixtures/rakuten-coupons-page.xml` | 🟢 |
| 11 | Diagnóstico read-only | `scripts/diag-rakuten.mjs` | 🟢 |
| 12 | Documentação: RCA + linha no índice e no mapa de sintomas do `AGENTS.md` | `docs/rca/afiliados-rakuten.md`, `AGENTS.md` | 🟢 |

Plano: conta e sync no **Basic**; ofertas automáticas no **PRO** (trava de sempre).

Fora da V1: Instagram Stories, cupons da cliente (`useCoupons`), desconto
mínimo, busca de produtos, link curto.

## 3. Implantação

1. PR contra `develop` → deploy automático em staging.
2. ⚠️ **`prisma/schema.prisma` mudou → o deploy reinicia o `bot-supervisor`
   (staging e depois produção) e reconecta todas as sessões. Anunciar antes.**
3. Staging (`http://178.105.54.0:3006`): conectar a conta Rakuten em Minhas
   credenciais → "Atualizar agora" (esperado: 3 promoções da Netshoes) → criar
   automação "Promoções e cupons das lojas da Rakuten" num grupo de teste →
   "Enviar agora" → conferir logo, cupom e link.
4. No painel da Rakuten, conferir que não apareceu clique vindo da VPS.
5. Produção: PR `develop` → `main`, backup antes (`scripts/backup_prod.sh`).
6. Depois de produção: atualizar as páginas públicas que dizem "não cobrimos
   Rakuten" (`dashboard/app/_comparisonContent.js`,
   `dashboard/lib/competitors-data.js`) e pôr as URLs na leva 🔝 de
   reindexação de `docs/marketing/ACOES_FLAVIA_2026-09-11.md`.

Rollback: `RAKUTEN_SYNC_ENABLED=false` (para o sync) e desligar as
automações Rakuten; as tabelas novas podem ficar.

## 4. V2 — conversão de links (implementada em 2026-10-01)

> Feito como desenhado abaixo, com duas mudanças: deep link **montado sem
> chamada** (formato público, sem Deep Links API nem cache no banco) e
> conflito com a Awin resolvido pela **ordem fixa Awin > Rakuten** (decisão
> da dona do produto). Regras e hipóteses a medir:
> `docs/rca/afiliados-rakuten.md` → "Conversão de links pela Rakuten".


1. **Lojas aprovadas** 🟡: `GET /linklocator/1.0/getMerchByAppStatus/approved`
   (medido: Netshoes WL `43984`, Cruzeiro Store `54198`) → tabela
   `RakutenProgramme` no sync; domínio de cada loja pelo `url` de
   `/v2/advertisers/{id}`.
2. **Reconhecer o link** 🔴: domínio de loja aprovada ou link da própria
   Rakuten (`click.linksynergy.com`, `linksynergy.*`). As lojas fixas
   (Shopee, ML, Amazon, Magalu, SHEIN, AliExpress) sempre ganham; conflito com
   a Awin (mesma loja nas duas redes) precisa de regra da dona do produto.
3. **Converter** 🟡: Deep Links API da Rakuten ou o formato
   `click.linksynergy.com/deeplink?id=&mid=&murl=`; link já dela fica; loja
   não aprovada é apagada (regra da Awin / `mirrorLinkGuard`).
4. **Guardas** 🔴: `detector.js`, `mirrorLinkGuard`, `conversionFailureReason`,
   chave por grupo em `BotConfig.platforms`, "Converter links", "Criar oferta"
   (`offerEngine.js`) — todos passam a conhecer `rakuten`.
5. **Robô** 🔴: conversão roda no `bot-worker` → `src/integrations/rakuten/`
   entra em `WORKER_CODE_PATHS_RE`; lojas por cliente na memória do robô
   (poucos KB) e cache de links no banco, nunca em memória (REGRA #1).
6. **Criar oferta** 🟡: nome/preço/foto da página da loja (`murl`), nunca
   abrindo o link de rastreio.
