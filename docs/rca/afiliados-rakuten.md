# afiliados-rakuten — regras e decisões

> Integração com a rede de afiliados **Rakuten Advertising** (2026-09-30).
> **v1 = ofertas automáticas**: promoções e cupons do feed de ofertas da
> Rakuten como ORIGEM das ofertas automáticas, no mesmo desenho da Awin
> (`docs/rca/afiliados-awin.md`). **v2 = conversão de links (2026-10-01, seção abaixo).**
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
| Conversão de links: lojas aprovadas, reconhecer, deep link | `src/integrations/rakuten/storeMatcher.js`, `conversionContext.js`, `src/converters/rakuten.js`; prioridade entre redes em `src/detector.js` |
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
`prisma/schema.prisma` está em `WORKER_CODE_PATHS_RE`
(`scripts/deploy_safe_*.sh`): **deploy com migration reinicia o
`bot-supervisor` e reconecta TODAS as sessões — anunciar antes.** Desde a
conversão de links (2026-10-01) **`src/integrations/rakuten/` também está
nessa lista** (o robô carrega o reconhecimento de lojas): mudança ali
reinicia o supervisor. Só `src/offerAutomation/` continua sem reiniciar.

## Conversão de links pela Rakuten (2026-10-01 — não regredir)

Decisões da dona do produto (2026-09-30): **mesma regra da Awin** (espelhamento,
"Converter links", "Criar oferta"; loja não aprovada → link apagado; chave
"Rakuten" por grupo) e **ordem fixa quando a loja está em mais de uma rede:
Awin > Rakuten > Lomadee** (Lomadee entra quando tiver conversão). OK de
memória dado: poucos KB por cliente, sem processo novo, reinício do supervisor
no deploy.

Como funciona:

1. **Lojas aprovadas:** o sync de hora em hora lê o Link Locator
   (`/linklocator/1.0/getMerchByAppStatus/approved`, XML) → `RakutenProgramme`.
   Domínio = site da loja (`/v2/advertisers/{id}` → `url`; guardado, só loja
   nova gasta chamada, até 30 por hora). Loja que sai da lista é apagada;
   falha ou resposta estranha nessa chamada não apaga nada nem derruba as
   promoções.
2. **`id` dos links dela** (`RakutenAccount.linkId`): tirado do `clickurl` das
   promoções do feed (`id=`). **Sem promoção nenhuma no feed, a conta não tem
   `linkId` e NÃO converte** (o link não teria como ser dela).
3. **Reconhecer** (`src/integrations/rakuten/storeMatcher.js`): link é
   `rakuten` quando o domínio é de loja aprovada ou é
   `click.linksynergy.com` que já é dela, ou de outra pessoa **com `murl`**
   (página) de loja aprovada. `fs-bin/click` de outra pessoa (sem página) é
   apagado: **nunca abrimos link da Rakuten** — ao contrário do `tidd.ly`, o
   `click.linksynergy.com` já conta o clique ao ser aberto.
4. **Prioridade entre redes** (`AFFILIATE_NETWORK_PRIORITY` em
   `src/detector.js`): lojas fixas (Shopee, ML, Amazon, Magalu, SHEIN,
   AliExpress) sempre ganham; depois Awin; depois Rakuten. Awin desligada no
   grupo, sem conta Awin ou loja não aprovada na Awin → a Rakuten assume. Link
   de rastreio fica na rede dele (link da Rakuten nunca vira Awin).
5. **Converter** (`src/converters/rakuten.js`): deep link
   `click.linksynergy.com/deeplink?id=<dela>&mid=<loja>&murl=<página>`,
   **montado sem chamada** (sem cota, sem espera, sem cache no banco). Página
   limpa: saem `utm_*`, `gclid`… e `ranMID/ranEAID/ranSiteID/siteID` (o site
   de quem clicou antes). Link que já é dela fica. Loja da página OU do `mid`
   (igual à Awin).
6. **Nunca abrir o link de clique:** foto (`fetchProductImage('rakuten')`) e
   "Criar oferta" (`offerEngine`) usam só a página do `murl`; sem ela, sem foto.
   **Prévia automática do WhatsApp:** sem `linkPreview` no envio, o Baileys
   abre o 1º link do texto pelo servidor — mesmo com prévia "desligada".
   `buildMonitoredMessagePayload` agora manda `linkPreview: null` quando esse
   1º link é da Rakuten (a oferta sai como texto, sem card). Isso também fecha
   o risco residual das ofertas automáticas sem logo (seção de Regras).
7. **Motivo no painel:** `skip:no_valid_conversions:rakuten_store_not_joined`
   ("loja da Rakuten sem aprovação"); no "Converter links", o código
   `RAKUTEN_STORE_NOT_JOINED`.
8. **Chave por grupo:** `rakuten` entrou em `BotConfig.platforms` (migration
   `20261001120000_rakuten_link_conversion` liga para todas as configs). Grupo
   com lista própria (`allowedPlatforms`) não ganhou sozinho — liga na tela
   Espelhamento.

✅ **Medido em 2026-10-03** (`docs/revisao-rakuten-2026-10-03.md`): (a) o
formato do Link Locator bate com o leitor; (b) o `id` do `clickurl` é o mesmo
do deep link gerado pela API oficial `POST /v1/links/deep_links`, no mesmo
formato que montamos. Pedir token novo não derruba o anterior. A mesma
revisão lista os gaps abertos (R1–R18) e o plano de correção.

Texto original: ⚠️ **Hipóteses a medir antes de ir para produção** (`diag-rakuten.mjs
<email> --rakuten`): (a) formato do XML do Link Locator (`<ns1:return>` com
`<ns1:mid>`/`<ns1:name>`; se vier `FORMATO DESCONHECIDO`, o parser precisa de
ajuste e nada converte — nada quebra); (b) o `id` do `clickurl` é o mesmo do
deep link: abrir o `deep_link_exemplo` **no navegador** (nunca pelo servidor)
e conferir que cai na loja e o clique aparece no painel da Rakuten.

Fora (v1): link de uma rede virando link de OUTRA rede (ex.: `tidd.ly` de
concorrente para loja que ela só tem na Rakuten → apagado, como hoje); link da
Rakuten escrito sem `https://`; loja da Rakuten com domínio de rastreio próprio
(fora de `linksynergy.com`); o desembrulho de "site próprio de grupo" ainda
pode abrir `click.linksynergy.com` de quem NÃO tem conta Rakuten (vale medir
antes de bloquear: hoje isso também recupera links da AliExpress).

## Revisão crítica de 2026-10-03 — não regredir

Detalhes e testes: `docs/revisao-rakuten-2026-10-03.md`, `test/rakuten-revisao.test.js`.

- **Prazo cobre o corpo** (`client.js` `send()`): a requisição inteira, leitura
  incluída, fica dentro do prazo. Teto de 10 MB por resposta. A sync tem prazo
  total de 5 min por conta (conferido entre uma chamada e outra), e o agendador
  segue mesmo com um tick preso há mais de 30 min.
- **"Dados recusados" = só `invalid_client`** no pedido de token. 401/403 em
  pedido de dados é `access_denied` (passageiro, tenta de novo em 15 min); a
  conta só vira `invalid_credential` na 3ª execução seguida assim.
- **Conta recusada segue convertendo por 7 dias** desde a última sync
  (`RAKUTEN_REFUSED_GRACE_MS`): o deep link não usa credencial.
- **Feed vazio e lista de lojas vazia só valem na 2ª vez seguida** (contador em
  memória da API; reinício só atrasa a limpeza).
- Gravação de promoções em lotes de 100 por transação.
- "Atualizar agora" espera no máximo 20 s; depois responde 202 e a sync segue
  em segundo plano.
- `click.linksynergy.com/...` sem `https://` é pego pela rede de segurança
  final (`mirrorLinkGuard`), para toda cliente.
- Loja achada só pelo `mid` com página de **loja fixa** (Amazon etc.) → link
  apagado. Domínio desconhecido continua seguindo pelo `mid`.
- O robô usa a última leitura boa da Rakuten (até 10 min) quando a carga falha.
- O cupom da promoção nunca some: modelo sem `{descrição}` ganha a linha do
  cupom antes do link (só a origem Rakuten).
- Automação **Rakuten** que pulou por falta de promoção espera 15 min no cron.
  Shopee e Awin não mudaram.
- Logo só `https` e host público.
- Conta que passa a recusada → e-mail `rakuten_dados_recusados` (uma vez,
  janela de 7 dias; conta parada é barrada pelo motor, como os outros avisos).
- Cliente sem acesso (plano vencido há mais de 3 dias, banida/suspensa) não
  sincroniza: a conta é reagendada para 6 h depois. Sem data de vencimento,
  continua.
- Seleção com as correções F5/F6/F7 da Awin: revezamento entre execuções,
  candidatas por loja e memória de enviados podada pelo que está ativo.
- Sem promoção no feed, o `id` dos links vem do deep link oficial
  (`POST /v1/links/deep_links`, 1 chamada só enquanto não há `id`).

## Diagnóstico

```bash
node scripts/diag-rakuten.mjs <email>            # só banco
node scripts/diag-rakuten.mjs <email> --rakuten  # + token, 1ª página do feed e lojas aprovadas (Link Locator)
```
