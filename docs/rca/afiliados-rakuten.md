# afiliados-rakuten — regras e decisões

> Integração com a rede de afiliados **Rakuten Advertising** (2026-09-30).
> **v1 = só ofertas automáticas**: promoções e cupons do feed de ofertas da
> Rakuten como ORIGEM das ofertas automáticas, no mesmo desenho da Awin
> (`docs/rca/afiliados-awin.md`). **v2 (depois) = conversão de links.**
> Plano completo e impactos: `docs/plano-integracao-rakuten.md`.

## Onde mora cada peça

| Peça | Arquivo |
|---|---|
| Cliente HTTP (token, cache do token, renovação, timeout, limitador) | `src/integrations/rakuten/client.js` |
| Erros tipados (sem segredo na mensagem) | `src/integrations/rakuten/errors.js` |
| Leitor do feed XML → registro (puro) | `src/integrations/rakuten/translate.js` |
| Teste de conexão, máscara, frases leigas | `src/integrations/rakuten/accountService.js` |
| Sync de UMA conta (+ logo da loja) | `src/integrations/rakuten/syncService.js` |
| Agendador (setInterval + unref na API) | `src/integrations/rakuten/scheduler.js`, ligado em `src/api/server.js` |
| Rotas `/api/rakuten/*` | `src/api/routes/rakuten.js` |
| Origem "rakuten" nas ofertas automáticas | `src/offerAutomation/rakutenOffers.js` + `dispatcher.js` (`PROMOTION_SOURCES`), `reviewDiscoveryService.js`, `reviewDeliveryService.js`, `src/api/routes/offerAutomation.js` |
| Tela (Minhas credenciais) | `dashboard/components/painel/RakutenCredentialsCard.js`, textos em `dashboard/lib/painel/rakutenCopy.js` |
| Tela (ofertas automáticas) | `dashboard/app/painel/ofertas-automaticas/page.js`, `dashboard/lib/offerAutomationForm.js` |
| Diagnóstico (só leitura) | `scripts/diag-rakuten.mjs <email> [--rakuten]` |
| Tabelas | `RakutenAccount`, `RakutenPromotion`, `RakutenSyncRun` + `OfferAutomation.rakutenAccountId/rakutenAdvertiserIds` (migration `20260930150000_rakuten_promotions`) |

## O que medimos (2026-09-30, conta real SID 4640819)

| Ponto | Real |
|---|---|
| Token | `POST https://api.linksynergy.com/token`, `Authorization: Bearer base64(<Client ID>:<Client Secret>)`, corpo `scope=<SID>` → `{ access_token, refresh_token, expires_in: 3600 }` |
| Dados recusados | SID errado → **401**, segredo errado → **400**, os dois `invalid_client`. Não dá para saber qual dos três está errado → a frase pede para conferir os três |
| Token vencido | 401 `invalid_token` → o cliente pede outro token uma vez |
| Limite | **100 chamadas/min** (`x-ratelimit-limit-minute`). Usamos ≤60/min por conta |
| Feed de ofertas `/coupon/1.0?network=8` | **só XML**; só lojas **aprovadas** (Netshoes, Cruzeiro Store); **3 ofertas** na conta de teste, 1 com cupom (`BEMVINDO10`) |
| Datas | `2029-06-21T03:00Z` (UTC). A Rakuten usa 2029/2030 para "validade indeterminada" |
| Link | `clickurl` = `click.linksynergy.com/fs-bin/click?id=<id da cliente>&offerid=<programa.oferta>` — já sai com o ID dela; `offerid` é a identidade da oferta |
| Loja | `GET /v2/advertisers/{id}` → `url` e `logo_url` (`merchant.linksynergy.com/fs/logo/lg_<id>`, PNG 1000x300, baixar NÃO conta clique) |
| Busca de produtos `/productsearch/1.0` | existe (27 mil "tênis", preço BRL, foto), mas **~1% com preço promocional** → fora da v1 (decisão da dona do produto: "só promoções, igual Awin") |

## Regras (não regredir)

- **Zero credencial Rakuten global.** Cada cliente cadastra as próprias
  contas (até 10). Toda consulta filtra por `userId` (teste
  `test/rakuten-sync.test.js` cobre as 7 rotas).
- **Client ID e Client Secret só de escrita.** Cifrados com
  `encryptCredential`, saem como `••••1234`, campo vazio na edição = mantém.
  Nunca logar corpo das rotas nem pôr segredo/token em mensagem de erro ou URL.
- **Nossas rotas nunca devolvem 401 por causa da Rakuten** → 400 com frase leiga.
- **Dados recusados → `invalid_credential`**: para de agendar até salvar
  dados novos. **429 → reagenda (≥5 min).** Outro erro → 15 min.
- **Vencer por ausência só com leitura completa** (igual Awin).
- Sync de hora em hora; agendador olha a cada 5 min. Desligar sem deploy:
  `RAKUTEN_SYNC_ENABLED=false` (exige `pm2 delete` + `start`).
- Retenção: promoção vencida some após 30 dias; histórico guarda 50 execuções.
- **Clique falso vindo da VPS (🔴).** Nenhum código nosso pode abrir o
  `clickurl`. Por isso a oferta sai com o **logo da loja como foto**: sem
  foto, o WhatsApp (Baileys) monta a prévia abrindo o link a partir do
  servidor. `imageRefererUrl` é o site da loja (só vai como cabeçalho), nunca
  o link de rastreio. **Risco residual:** se o logo falhar ao baixar, a oferta
  cai no texto com prévia e o link é aberto uma vez pelo servidor.
  `diag-rakuten.mjs` mostra `sem_logo=`.

## Ofertas automáticas com origem Rakuten

- `OfferAutomation.source = 'rakuten'` + `rakutenAccountId` (conta da própria
  cliente) + `rakutenAdvertiserIds` (lojas; `[]` = todas). A origem não muda
  depois de criada. Origem desconhecida pula a automação.
- Mesma regra de envio da Awin: cada promoção sai **uma vez por automação**
  (`sentItemIds` com `rakuten:c:<loja>:<hash do título+cupom>` — o número da
  Rakuten não é a identidade, lição das "promoções repetidas" da Awin);
  **revezando lojas**; **vence antes, sai antes**; **nunca com menos de 1h**
  nem antes de começar; filtro opcional por lojas e palavra.
- Mensagem: modelo `promocao_awin` ("Promoção (sem preço)", o mesmo da Awin):
  título, loja, **`🎟️ Use o cupom: X`** quando há cupom (no lugar da
  descrição), validade **só se vence em até 60 dias** (data sem ano de 2029
  confundiria), link.
- Dedup cruzada por grupo continua valendo (`productKey` =
  `rakuten:<conta>:<conteúdo>`, `priceCents` 0).
- Fora da v1: Instagram Stories, cupons da cliente (`useCoupons`), desconto
  mínimo, busca de produtos, link curto.
- Fila de revisão: item vence junto com a promoção; na entrega, promoção
  vencida/sumida vira `expired` sem enviar.

## Plano

Cadastro de conta e sync: **Basic**. Ofertas automáticas: **PRO** (mesma
trava `canUseOfferAutomations`).

## Memória e deploy

Nada novo em processo/fila/Redis. Um `setInterval` + `unref` a mais na
`api`. Pico: 1 página do feed (até 500 ofertas, ~1 MB de XML) + cache de
token (~1 KB por conta). Estimativa **< 5 MB de pico, ~0 em repouso**.
Nenhum código do robô mudou (`bot-worker`, `core/`, `converters/`), MAS
`prisma/schema.prisma` mudou e está em `WORKER_CODE_PATHS_RE`
(`scripts/deploy_safe_*.sh`): **o deploy desta versão reinicia o
`bot-supervisor` e reconecta TODAS as sessões — anunciar antes.** Mudanças
futuras só em `src/integrations/rakuten/` ou `src/offerAutomation/` não
reiniciam o robô (o cron e o sync rodam na `api`).

## Diagnóstico

```bash
node scripts/diag-rakuten.mjs <email>            # só banco
node scripts/diag-rakuten.mjs <email> --rakuten  # + token e 1ª página do feed
```
