# afiliados-awin — regras e decisões

> Integração com a rede de afiliados **Awin** (2026-09-29). Dois usos:
> **promoções** (não cupons) como origem das **ofertas automáticas**, e
> (2026-09-30) **conversão de links** das lojas em que a cliente foi aprovada
> no espelhamento, no "Converter links" e no "Criar oferta".

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
| Lojas aprovadas → "de qual loja é este link?" (puro) | `src/integrations/awin/storeMatcher.js` |
| Contas + lojas + cache de links de UMA cliente | `src/integrations/awin/conversionContext.js` |
| Conversor (curto guardado → longo como plano B) | `src/converters/awin.js` (plataforma `awin` em `src/converters/index.js`) |
| Detector/sanitizador com lojas da cliente | `detectLinks(text, { awin })`, `isOfferUrl(url, { awin })` em `src/detector.js`; `sanitizeInviteLinks(text, { awin })` |
| Motivo "loja da Awin sem aprovação" | `CONVERSION_FAILURE.AWIN_STORE_NOT_JOINED` + texto em `src/credentialBlockAlert/message.js` |
| Diagnóstico (só leitura) | `scripts/diag-awin.mjs <email> [--awin]` |
| Tabelas | `AwinAccount`, `AwinPromotion`, `AwinSyncRun` + `OfferAutomation.source/awinAccountId/awinAdvertiserIds` (migration `20260929120000_awin_promotions`); `AwinProgramme`, `AwinLink` + `awin` em `BotConfig.platforms` (migration `20260930090000_awin_link_conversion`) |

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
  (`sentItemIds` com `awin:c:<loja>:u:<hash da página da loja>`); **revezando lojas**; dentro da loja
  **vence antes primeiro**; **nunca com menos de 1h para vencer** nem antes de
  começar; filtro opcional por lojas e palavra (título/descrição, sem acento).
- Sem preço: modelo padrão `promocao_awin` (título, `{loja}`,
  `{descrição}`, `{validade}`, link). Modelos da Shopee também funcionam: a
  linha de preço some (limpeza de variável vazia do compositor).
- **Link curto e foto (2026-09-29, `src/offerAutomation/awinEnrich.js`).**
  No staging a v1 saiu com o `cread.php` comprido e sem foto (a prévia do
  WhatsApp do link `awin1.com` quase nunca traz imagem — H7 confirmada como
  ruim). Agora, **só na hora do envio e só das que vão sair**: link curto do
  gerador oficial (`generateLink` com `shorten: true` → `tidd.ly`) e foto lida
  da página da loja (`AwinPromotion.url`) por `fetchProductImage` (o mesmo
  leitor das outras lojas). Guardados em `shortUrl`/`imageUrl`; `enrichedAt`
  marca a tentativa e uma falha só é tentada de novo após 24h. Qualquer falha
  → sai como antes (link comprido, sem foto); nunca segura o envio. Fila de
  revisão faz o mesmo ao montar a fila (só as que entram). Não fica em
  `awinOffers.js` porque aquele arquivo é importado pelo painel.
  **Hipóteses a medir:** cota diária de links curtos da conta
  (https://help.awin.com/apidocs/quota — o valor não está na doc) e lojas que
  bloqueiam leitura da página (`diag-awin.mjs` mostra `sem_foto loja=...`).
- Dedup cruzada por grupo continua valendo (`productKey` =
  `awin:<conta>:<promotionId>`, `priceCents` 0).
- Fora da v1 para Awin: **Instagram Stories** (sem foto/preço), **cupons**
  (catálogo é por loja), desconto mínimo.
- **Fila de revisão:** item vence junto com a promoção (`expiresAt` = menor
  entre 48h e `endDate`); na entrega, se a promoção venceu/sumiu, o item vira
  `expired` sem enviar.
- `sentItemIds` guarda os 200 últimos (regra antiga). Promoção de vários dias
  pode voltar a sair depois de 200 envios da mesma automação — aceitável hoje.

### Promoções "repetidas" da Awin (RCA 2026-09-29 — não regredir)

- **Sintoma:** automação de 3 por envio mandou 3 liquidificadores Arno —
  duas vezes, mesmo depois da 1ª correção.
- **Causa real (medida no staging, com os títulos):** a Arno publica o
  **mesmo produto uma vez por voltagem** ("…LN63 127V" e "…LN63 220V"), com
  números diferentes e **a mesma página da loja** (`url`). A 1ª leitura
  ("4 promoções idênticas") estava errada: o comando não mostrava o título.
  A 1ª correção (loja + título) por isso não pegou nada.
- **Por que só liquidificadores:** as outras lojas já tinham saído todas
  (C&A 7/7, Kabum 3/3, Mizuno 1/1). Todas as da Arno vencem na mesma hora e o
  desempate era o número da Awin — que a Arno cadastra em sequência por
  linha de produto (4118874..4118893 = liquidificadores).
- **Correção (`awinOffers.js`):**
  - identidade = **loja + página da loja** (`awinContentKey`, host+caminho
    sem `www.`, query ou barra final); sem página, cai no título;
  - "já saiu" aceita os três formatos de id (`awin:c:<loja>:u:<hash>`, o da
    1ª correção por título e o antigo `awin:<número>`), e bloqueia tudo que
    tem o mesmo conteúdo (a outra voltagem);
  - **desempate** de validade igual por hash do número: varia a linha de
    produto e é sempre o mesmo. A regra aprovada continua: vence antes, sai
    antes. Testes com os títulos reais em `test/awin-offer-automation.test.js`.
- Mesma página em OUTRA loja é outra oferta.
- Efeito colateral aceito: produto republicado no dia seguinte (mesma
  página) não sai de novo pela mesma automação enquanto estiver entre os 200
  últimos `sentItemIds`.

### "A Shopee trouxe produtos…" numa automação Awin (2026-09-29 — não regredir)

- A tela usava o mesmo texto de `all_offers_filtered` para toda origem. Na
  Awin esse código quer dizer **"todas as promoções válidas já saíram"**
  (medido: 91 ativas → 53 produtos distintos, 68 envios, sobrando 0) — não é
  defeito. Texto próprio em `AWIN_SKIP_LABELS` (`dashboard/lib/painel/awinCopy.js`),
  escolhido pela origem da automação. Teste em `test/awin-linguagem.test.js`.

## Plano

Cadastro de conta e sync: **Basic** (pensando na conversão de links futura).
Ofertas automáticas (inclusive com promoções Awin): **PRO** — mesma trava de
sempre (`canUseOfferAutomations`).

## Memória

Conversão de links (2026-09-30): nada novo em processo/fila. Cada robô guarda
as lojas da cliente (12 lojas × ~3 domínios ≈ poucos KB) e relê junto com a
config (1 query a mais por minuto). Cache de links fica no banco (`AwinLink`,
~0,5 KB por produto), não em memória.

Nenhum processo, worker, Redis ou fila novos. Um `setInterval` + `unref` a
mais na `api`. Pico: 1 página de até 200 promoções (~0,5–1 MB) + mapa do
limitador (poucos KB). Estimativa **< 5 MB de pico, ~0 em repouso**. Banco:
~2–3 KB por promoção.

## Conversão de links pela Awin (2026-09-30 — não regredir)

Decisões da dona do produto (2026-09-30): converter no **espelhamento**, no
**Converter links** e no **Criar oferta**; **link curto guardado, caindo para o
longo**; **uma chave "Awin"** por grupo; link de loja **não aprovada é
apagado** (a oferta não sai com o link de outra pessoa).

Medido em staging (conta 2701264, 2026-09-30): `GET /publishers/{id}/programmes
?relationship=joined&countryCode=BR` → **12 lojas** (C&A, Nike, Vivara,
Olympikus, KaBuM, Decathlon, Stanley, PUMA…), todas com `validDomains`
preenchido e `deeplinkEnabled=true`. Cota de link curto
(`/linkbuilder/quota`): **200 por dia por conta** (50 já usados pelas
promoções). Produção, 7 dias: **63 links `tidd.ly`** de concorrente apagados
como loja não suportada.

Como funciona:

1. **Lojas:** o sync de hora em hora grava as lojas aprovadas em
   `AwinProgramme` (1 chamada a mais). Loja que sai da lista é apagada; falha
   só nessa chamada não derruba as promoções e mantém as lojas antigas.
2. **Reconhecer:** o robô relê as lojas a cada carga de config (1 min).
   Link é `awin` quando o domínio é de loja aprovada **ou** é link da própria
   Awin (`awin1.com/cread.php|awclick.php|pclick.php`, `tidd.ly`). As lojas
   fixas (Shopee, ML, Amazon, Magalu, SHEIN, AliExpress) **sempre ganham**.
   **Sem conta Awin, nada muda**: sem `{ awin }` o detector é o de antes.
   **Chave "Awin" desligada no grupo = igual a sem conta** (link apagado, o
   resto da oferta segue) — NÃO travar a oferta inteira por loja desligada.
   Loja **não aprovada** também é apagada (e o resto segue), nunca trava:
   `cread.php` se decide sem rede (`awinmid`/`ued`/dono); `tidd.ly` é aberto
   ANTES do sanitizador (`refineAwinOptionsForText`, só o `Location`, até 5
   por mensagem, cache de 2.000 links curtos). O mesmo conjunto vale nas 4
   pontas do robô: desembrulho de site próprio, sanitizador, detector e rede
   de segurança final (`findUnconvertedStoreLinks`).
3. **Converter** (`src/converters/awin.js`):
   - `tidd.ly` → lê só o `Location` (nunca segue até a loja);
     `cread.php` → `ued` = página, `awinmid` = loja, `awinaffid` = dono;
   - link já dela (`awinaffid` = conta dela) → fica como está, sem chamada;
   - loja não aprovada que escapou do passo 2 (raro) → `stripFromMessage` +
     `awinReason=awin_store_not_joined` →
     `skip:no_valid_conversions:awin_store_not_joined` (etiqueta cinza "loja da
     Awin sem aprovação"); no "Converter links" vira o código
     `AWIN_STORE_NOT_JOINED` com o texto de como se inscrever;
   - página limpa (sai `utm_*`, `awc`, `gclid`…) → cache `AwinLink`
     (conta+loja+hash da página) → Link Builder com `shorten` e
     **`noWait`** (sem vaga no limitador = plano B na hora, nunca segura a
     oferta);
   - sem vaga / Awin fora / erro → **link longo `cread.php` montado aqui**,
     sem guardar (a próxima tenta o curto de novo). Awin respondeu sem curto
     (cota no fim) → guarda o longo e só tenta o curto de novo após 24 h;
   - cache sem uso há 90 dias é apagado no sync.
4. **Criar oferta:** nome/preço/foto saem da **página da loja** (`destinationUrl`),
   nunca do `tidd.ly` (não conta clique). Página crua ou link de outra pessoa
   sai com o link DELA; link colado que já é dela fica.
5. **Chave por grupo:** `awin` entrou em `BotConfig.platforms` (migration liga
   para todas as configs, mesmo caminho da AliExpress). Grupo com lista própria
   (`allowedPlatforms`) não ganhou a Awin sozinho — liga na tela Espelhamento.
6. **Deploy:** `src/integrations/awin/` entrou em `WORKER_CODE_PATHS_RE` (o robô
   carrega esses arquivos): mudança ali reinicia o `bot-supervisor`.

**Mesma loja na Awin e na Rakuten (2026-10-01):** sai pela **Awin** (ordem
fixa `AFFILIATE_NETWORK_PRIORITY` em `src/detector.js`, decisão da dona do
produto). Awin desligada no grupo/sem conta/sem aprovação → a Rakuten assume.
Detalhes: `docs/rca/afiliados-rakuten.md`.

### Oferta espelhada com `tidd.ly` saiu sem foto (RCA 2026-09-30 — não regredir)

Sintoma: ofertas da KaBuM espelhadas com `tidd.ly` corretos, mas sem imagem.
Causa (código + medição): a foto era buscada com a URL ORIGINAL do link
(`resolveMonitoredImage`/`buildManualLinkPreview` → `fetchProductImage('awin',
tidd.ly)`), ou seja, abrindo o redirecionador da Awin, que não tem `og:image`
do produto (e ainda conta clique para o dono do link). A página da loja
(`kabum.com.br/produto/645897`) devolve a foto em ~1 s. Correção:
`fetchProductImage` troca o link Awin pela página da loja ANTES do cache
(`awinStorePageUrl`: tidd.ly → só o Location, com cache; cread.php → `ued`,
sem rede). Teste em `test/awin-link-conversion.test.js`.

### Oferta AUTOMÁTICA da Awin saindo sem foto (RCA 2026-09-30 — não regredir)

Sintoma: promoções da KaBuM nas ofertas automáticas saíam só com texto
(MessageLog `platform=broadcast`, 02:02 UTC). NÃO era o espelhamento — as
correções anteriores (tidd.ly → página da loja) eram de outro caminho.
Dados (staging): `diag-awin.mjs` → `enviadas_com_busca=109 com_foto=49`,
`sem_foto Kabum BR=51`, `C&A BR=9`; as 51 da KaBuM eram `/produto/<id>`.
As mesmas páginas devolvem a foto fora do servidor (medido).
Causa: (1) a foto das promoções vinha SÓ do og:image da página da loja, que
falhou no servidor; (2) falhou uma vez → `enrichedAt` travava a foto por 24h;
(3) sem foto não havia plano B — oferta automática sem `imageUrl` sai texto
puro (`buildBroadcastImageRecipe` devolve null).
Correção (3 camadas, a oferta nunca sai só com texto):
1. **KaBuM:** consulta pública `servicespub.prod.api.aws.grupokabum.com.br/
   descricao/v1/descricao/produto/<id>` (`fotos[]`) ANTES da página
   (`src/converters/kabumImage.js`, ligado em `fetchProductImage`). Download
   pede 1000px primeiro (`_gg`, `/xlarge/`; medido: `_m`=200, `_g`=395,
   `/medium/`=200, `/large/`=400).
2. Página da loja (og:image), como antes.
3. **Logo da loja** (`AwinProgramme.logoUrl`, vem do sync `/programmes`).
   Não é gravada como foto: a foto do produto segue sendo tentada.
Foto tenta de novo em **1h** (`AwinPromotion.imageTriedAt`, separado de
`enrichedAt`, que continua marcando o link curto em 24h). As 51 promoções já
travadas se curam sozinhas no próximo envio (tentativa > 1h). Migration
`20261001090000_awin_programme_logo`. Testes: `test/kabum-image.test.js`,
`test/awin-enrich.test.js`.

### Revisão crítica 2026-09-30 — casos de borda corrigidos (não regredir)

| # | Falha | Efeito | Correção |
|---|---|---|---|
| F1 | Link Awin de concorrente SEM página (`cread.php` sem `ued`) | oferta inteira descartada | vira link dela para a página inicial da MESMA loja; página de outro site nunca vai junto |
| F2 | Programa listando sufixo público (`*.com.br`) ou plataforma compartilhada (whatsapp, linktr.ee, bit.ly…) | QUALQUER link .com.br passaria como "loja Awin" | `normalizeStoreDomain` recusa sufixo público (`THREE_LABEL_SUFFIXES`) e `SHARED_HOSTS` |
| F3 | `tidd.ly/…` / `awin1.com/…` sem `https://` | link do concorrente saía clicável | `findUnconvertedStoreLinks` pega Awin sem protocolo (toda cliente) |
| F4 | Site próprio de grupo que leva a loja Awin | oferta perdida (`garimpeiros.com.br` 304/semana em loja não suportada) | desembrulho enxerga lojas Awin da cliente; cache separado (`awin|url`) |
| F5 | Revezamento só DENTRO da execução | com 1 oferta/envio, a loja que vence antes monopolizava | abre a loja que saiu há mais tempo (`storeLastSentOrder`); fim só desempata |
| F6 | Teto global de 1000 por fim | loja com fim mais tarde ficava de fora; "acabou" com promoções no banco | carga por loja (`distinct advertiserId`, 300 cada) |
| F7 | Memória de enviados = últimos 200 | a mesma promoção voltava após ~200 envios | poda pelo que está ativo (`pruneAwinSentIds`) + teto 3000 para promoções |
| F8 | Promoções diferentes para a PÁGINA INICIAL | a 1ª enviada bloqueava todas as outras para sempre | página inicial usa o título como identidade |
| F9 | Logo da Awin 120×60 < piso de 120 px do download | a "última camada" da foto falhava → só texto | `fetchSmallImageAsCard`: imagem ≥ 32 px em quadro branco 800 px (oferta automática) |

Efeito colateral conhecido de F8: uma promoção de página inicial que já tinha
saído pode sair UMA vez de novo (a identidade antiga era a página).

Fora (v1): link de loja Awin escrito sem `https://` não é visto pela rede de
segurança (os domínios são por cliente); `clickref` por grupo; loja que recusa
link direto (`deeplinkNotPermitted`) cai no longo (a Awin leva à página inicial
da loja, ainda com comissão) — todas as 12 medidas aceitam.

### Revisão de riscos 2026-10-03 — fila, robô e reenvio em massa (não regredir)

| # | Risco | Efeito | Correção |
|---|---|---|---|
| R1 | Awin devolve lista vazia/menor por instabilidade = "leitura completa" | TODAS as promoções venciam e voltavam como novas → reenvio em massa | `syncService`: só vence por ausência se a leitura viu ≥ 50% das ativas (`absenceSkipped` no resultado); lista de lojas vazia não apaga as lojas guardadas |
| R1 | Memória de enviados podada só pelas ATIVAS | promoção vencida que volta a valer saía de novo | `awinOffers.knownPromotions`: poda pelo que existe no banco (ativa ou vencida); sai da memória só quando a vencida é apagada (retenção) |
| R2 | Vários links Awin na mesma mensagem + Awin lenta (8 s cada) | estourava os 25 s da fila → oferta sumia | teto de 10 s por mensagem (`AWIN_MESSAGE_BUDGET_MS`, `deadline` do bot-worker); gerar 4 s; tidd.ly 3 s para TODOS os saltos; tidd.ly que falhou fica guardado 5 min |
| R7 | Awin fora do ar / código recusado | cada link esperava o tempo inteiro | disjuntor por conta: 3 falhas seguidas (tempo, rede, 5xx) → 5 min só link longo, sem chamada; 401/403 → 30 min. Limite por minuto e 4xx de um link não contam |
| R3 | Corpo da resposta do tidd.ly nunca lido | conexão presa até o GC | `response.body.cancel()` |
| R4 | KaBuM bloqueia o IP do servidor (403) | consulta + página da KaBuM em toda oferta até o tempo esgotar | 403/429 da consulta → nenhuma chamada à KaBuM por 30 min (`kabumIsBlocked`, diagnóstico `kabum_bloqueada`); sai o logo, como antes |
| R5 | Quadro de imagem pequena valia para qualquer foto | foto de produto que falhou (Shopee…) era baixada 2× | `fetchSmallImageAsCard` só para logo de loja (`ui.awin.com`, `merchant.linksynergy.com`) |
| R6 | Guarda do `tidd.ly` sem protocolo vale para toda cliente | — | mantido; medir em produção antes de mexer |

Estado em memória (disjuntor, cache do tidd.ly, trava da KaBuM) é por
processo do robô e some no restart — de propósito: sem banco, sem RAM
relevante (< 1 MB).

## Diagnóstico

```bash
# só banco (status, execuções, promoções por loja, automações):
node scripts/diag-awin.mjs <email>
# (mostra também lojas_aprovadas e links_convertidos_guardados curtos/longos)
# + 2 chamadas leves à Awin (código vale? chaves, total, link com o ID):
node scripts/diag-awin.mjs <email> --awin
```
