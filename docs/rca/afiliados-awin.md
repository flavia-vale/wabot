# afiliados-awin — regras e decisões

> Integração com a rede de afiliados **Awin** (2026-09-29). Primeiro uso:
> **promoções** (não cupons) como origem das **ofertas automáticas**. Fase
> futura (NÃO implementada): converter links pela Awin em outros pontos do
> produto — o cliente HTTP já foi desenhado para isso.

## Onde mora cada peça

| Peça | Arquivo |
|---|---|
| Cliente HTTP (só transporte, `fetch` injetável, timeout, limitador por token) | `src/integrations/awin/client.js` |
| Limitador por token (janela de 60s, 15/min) | `src/integrations/awin/rateLimiter.js` |
| Erros tipados (sem token na mensagem) | `src/integrations/awin/errors.js` |
| Tradutor puro resposta → registro | `src/integrations/awin/translate.js` |
| Teste de conexão, máscara, frases leigas | `src/integrations/awin/accountService.js` |
| Sync de UMA conta | `src/integrations/awin/syncService.js` |
| Agendador (setInterval + unref na API) | `src/integrations/awin/scheduler.js`, ligado em `src/api/server.js` |
| Rotas `/api/awin/*` | `src/api/routes/awin.js` |
| Origem "awin" nas ofertas automáticas | `src/offerAutomation/awinOffers.js` + `dispatcher.js`, `reviewDiscoveryService.js`, `reviewDeliveryService.js` |
| Tela (dentro de Minhas credenciais) | `dashboard/components/painel/AwinCredentialsCard.js`, textos em `dashboard/lib/painel/awinCopy.js` |
| Tela (ofertas automáticas: "De onde vêm as ofertas?") | `dashboard/app/painel/ofertas-automaticas/page.js` |
| Diagnóstico (só leitura) | `scripts/diag-awin.mjs <email> [--awin]` |
| Tabelas | `AwinAccount`, `AwinPromotion`, `AwinSyncRun` + `OfferAutomation.source/awinAccountId/awinAdvertiserIds` (migration `20260929120000_awin_promotions`) |

## Fonte de verdade (doc oficial) e o que medimos

- Base `https://api.awin.com`, **20 chamadas/min por usuário**, só HTTPS —
  https://help.awin.com/apidocs/introduction-1
- Token é do **usuário** Awin (vale para todas as contas de publisher dele),
  cabeçalho `Authorization: Bearer <token>`; mudança de acesso leva até 10 min —
  https://help.awin.com/apidocs/api-authentication
- `POST /publisher/{publisherId}/promotions`, corpo `{filters, pagination:{page,pageSize}}` —
  https://help.awin.com/apidocs/promotions
- `GET /accounts?type=publisher` —
  https://help.awin.com/apidocs/returns-information-about-accounts-for-a-given-user
- Deep link `cread.php?awinmid=&awinaffid=&ued=` (Central de Ajuda, não a doc
  da API) — https://success.awin.com/articles/en_US/Knowledge/What-does-an-affiliate-link-look-like
- Link Builder oficial (fase futura) — https://help.awin.com/apidocs/generatelink

**Medido em 2026-09-29 na conta 2701264 (difere ou completa a doc):**

| Ponto | Doc | Real |
|---|---|---|
| Token | especificação lista `accessToken` na URL como obrigatório | **só o cabeçalho basta** (200). Nunca pôr token na URL |
| Envelope `/accounts` | não documentado | `{ userId, accounts: [...] }` |
| Envelope promoções | `"type":"object"` | `{ data: [...], pagination: { page, pageSize, total } }` |
| Datas | `YYYY-MM-DDT00:00:00.000` UTC, sem fuso | **com fuso**: `2026-09-28T03:00:00+00:00`. `parseAwinDate` aceita os dois |
| `urlTracking` | não diz se leva o ID | **208/208 com `awinaffid=<publisher>`** — usamos direto, sem gerar link |
| Volume | — | 208 promoções, 4 lojas, 2 páginas; amostra Kabum = promoções de **1 dia** (00:00–23:59 de Brasília) |

## Regras (não regredir)

- **Zero credencial Awin global.** Nada em env, nada em código, sem fallback.
  Cada cliente cadastra as próprias contas (várias). Isolamento = toda consulta
  filtra por `userId` (teste `test/awin-routes.test.js` cobre as 7 rotas).
- **Código de acesso só de escrita.** Cifrado com `encryptCredential` (v1:...),
  sai como `••••1234`, campo vazio na edição = mantém. Nunca logar corpo das
  rotas, nunca pôr o token em mensagem de erro (`errors.js`).
- **Nossas rotas nunca devolvem 401 por causa da Awin** (o painel desloga a
  cliente em 401). Código recusado pela Awin → 400 com frase leiga.
- **Filtros fixos do sync:** `type=promotion` (cupom fora), `membership=joined`
  (só lojas aprovadas), `regionCodes=["BR"]`, status `active` + `upcoming`
  (as do dia seguinte chegam antes da meia-noite).
- **Vencer por ausência só com leitura completa.** Se o sync falhou no meio ou
  bateu o teto de páginas, só vencem as que passaram do `endDate`.
- **401/403 → `invalid_credential`**: para de agendar até a cliente salvar um
  código novo (a tela mostra "O código de acesso venceu"). **429 → reagenda**
  (≥5 min). Outro erro → tenta de novo em 15 min. Uma conta nunca trava outra.
- **Limite por token:** ≤15/min (folga dos 20 da Awin), fila sequencial por
  token no processo da API. Staging e produção são processos diferentes: se a
  mesma cliente usar o mesmo token nos dois, os limites somam (até 30/min) —
  por isso a folga.
- Sync de hora em hora (`syncIntervalMinutes` 60); agendador olha a cada 5 min.
  Desligar sem deploy: `AWIN_SYNC_ENABLED=false` (exige `pm2 delete` + `start`).
- Retenção: promoção vencida some após 30 dias; histórico guarda 50 execuções
  por conta.

## Ofertas automáticas com origem Awin

- `OfferAutomation.source` = `shopee` (padrão, histórico) ou `awin`. Origem
  desconhecida **pula** a automação (nunca cai em Shopee). A origem não muda
  depois de criada.
- O envio **não chama a Awin**: lê `AwinPromotion` do banco.
- **Regra de envio (aprovada 2026-09-29):** mesmo ritmo da Shopee (intervalo e
  quantas por envio); **cada promoção sai uma vez por automação**
  (`sentItemIds` com `awin:<promotionId>`); **revezando lojas**; dentro da loja
  **vence antes primeiro**; **nunca com menos de 1h para vencer** nem antes de
  começar; filtro opcional por lojas e palavra (título/descrição, sem acento).
- Sem preço e sem foto: modelo padrão `promocao_awin` (título, `{loja}`,
  `{descrição}`, `{validade}`, link). Modelos da Shopee também funcionam: a
  linha de preço some (limpeza de variável vazia do compositor). WhatsApp
  mostra a prévia do link (hipótese H7 — conferir no staging).
- Dedup cruzada por grupo continua valendo (`productKey` =
  `awin:<conta>:<promotionId>`, `priceCents` 0).
- Fora da v1 para Awin: **Instagram Stories** (sem foto/preço), **cupons**
  (catálogo é por loja), desconto mínimo.
- **Fila de revisão:** item vence junto com a promoção (`expiresAt` = menor
  entre 48h e `endDate`); na entrega, se a promoção venceu/sumiu, o item vira
  `expired` sem enviar.
- `sentItemIds` guarda os 200 últimos (regra antiga). Promoção de vários dias
  pode voltar a sair depois de 200 envios da mesma automação — aceitável hoje.

## Plano

Cadastro de conta e sync: **Basic** (pensando na conversão de links futura).
Ofertas automáticas (inclusive com promoções Awin): **PRO** — mesma trava de
sempre (`canUseOfferAutomations`).

## Memória

Nenhum processo, worker, Redis ou fila novos. Um `setInterval` + `unref` a
mais na `api`. Pico: 1 página de até 200 promoções (~0,5–1 MB) + mapa do
limitador (poucos KB). Estimativa **< 5 MB de pico, ~0 em repouso**. Banco:
~2–3 KB por promoção.

## Fase futura: converter links pela Awin

Desenho no topo de `client.js`: `generateLink` / `generateLinks` (Link
Builder oficial, avisa loja que não aceita `deeplinkNotPermitted`),
`getLinkQuota`, e o `cread.php` montado localmente como plano B só para loja
em que a cliente foi aprovada. `clickref` (até 6) serve para marcar de qual
grupo veio a venda. Reconhecer link colado do KaBuM:
`kabum.com.br/produto/<id>/<slug>` (o número da loja vem das lojas aprovadas,
nunca fixo no código).

## Diagnóstico

```bash
# só banco (status, execuções, promoções por loja, automações):
node scripts/diag-awin.mjs <email>
# + 2 chamadas leves à Awin (código vale? chaves, total, link com o ID):
node scripts/diag-awin.mjs <email> --awin
```
