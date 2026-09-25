# envio-e-filas — regras e RCAs

> Movido do `AGENTS.md` em 2026-09-23 para economizar tokens. Conteúdo sem alteração.
> Leia este arquivo ANTES de mexer no assunto. Referências a "AGENTS.md" em
> comentários de código/testes apontam para as seções abaixo.

## Fila travava inteira quando UM item falhava (RCA 2026-07-20, não regredir)

Cliente reportou "as filas não estão funcionando, não enviando mensagens".
Achado: duas filas tinham um `for` sequencial sem isolamento por item — uma
exceção em UM item abortava o `for` inteiro, perdendo o progresso já feito e
travando a fila até intervenção manual/restart:

1. **`runAutomation` (`src/offerAutomation/dispatcher.js`)**: o
   `await sendBroadcastFn(...)` dentro do loop de `toSend` não tinha
   try/catch. Uma falha pontual num item (timeout de IPC pro worker, bot sem
   socket no instante exato) lançava e pulava o bloco de persistência
   inteiro logo após o loop (`sentLogRows`/`sentItemIds`/`page`) — mesmo os
   itens JÁ enviados com sucesso ANTES da falha perdiam o registro. Sem
   `sentItemIds`/`page` avançarem, o próximo tick do cron tentava o MESMO
   lote de novo — se a causa fosse persistente (não transitória), a
   automação ficava presa reenviando o mesmo lote pra sempre sem nunca
   progredir.
2. **`checkScheduledMessages` (`src/bot-worker.js`)**: o
   `db.messageLog.create()` por `jid` dentro do loop de mensagens agendadas
   não tinha try/catch (só o `try` de fora, que envolve TODAS as mensagens
   `pending` do tick). Uma falha de escrita (ex.: `SQLITE_BUSY` pontual)
   abortava o processamento dos jids restantes DESSA mensagem, de TODAS as
   outras mensagens agendadas pendentes no mesmo tick, e deixava `msg` presa
   em `status='queued'` para sempre — a query de pending só busca
   `status='pending'`, e `markInterruptedSendLogs()` (que resgataria
   `queued`/`sending` órfãos) só roda uma vez, no boot do worker.

**Fix**: cada item do loop agora tem seu próprio try/catch — loga e
`continue` para o próximo item em vez de deixar o erro escapar pro `for`
inteiro. `runAutomation` retorna `{ sent, failed, failures }` quando há
falhas parciais; o item que falhou fica de fora de `sentItemIds` (reentra
candidato no próximo tick). Não regredir: não remover o try/catch por-item
desses dois loops — a AUSÊNCIA dele é exatamente o que travava a fila
inteira por causa de um item só. Teste:
`test/offer-automation.test.js` ("falha pontual num item do lote não aborta
os demais").

## "A fila não envia para um grupo" (RCA 2026-09-11 — não regredir)

Cliente (`julianepumuceno16@gmail.com`) abriu chamado dizendo que a fila `09/08`
não enviava para o `Maternidade Econômica #5`. **Não havia defeito na fila**: o
grupo entrou na lista de destinos dela naquele mesmo dia, e o primeiro envio da
fila para ele saiu às 12:09:41 — 10 ofertas na sequência. Os outros destinos
tinham 165 envios em 7 dias porque estavam na fila há 7 dias.

O que custou a investigação inteira:

- **O painel não dizia em lugar nenhum que um grupo de destino estava fora de
  todas as filas.** A fila aparecia ativa, drenando e enviando; o grupo aparecia
  cadastrado; e nada ligava as duas coisas. Descobrir exigia comparar na mão a
  lista de destinos de cada fila com a lista de grupos de postagem.
  `findDestinationsWithoutQueue` (`dashboard/lib/painel/queueCoverage.js`) faz
  essa conta e a tela de Filas mostra o aviso.
- **O aviso NÃO pode dizer que o grupo está sem receber nada.** O espelhamento
  continua entregando nele — foi exatamente essa confusão que gerou o chamado.
  Lista de destinos vazia numa fila significa TODOS os grupos de postagem
  (legado) e zera o aviso; fila pausada conta como cobertura (pausa já tem
  indicação própria; somar as duas geraria alarme duplo); sem fila nenhuma não
  avisa. Cálculo puro sobre dados que a página já carregou: **nenhuma chamada
  nova à API, nenhuma consulta nova ao banco, zero impacto de RAM.**
- **A lista de destinos fica CONGELADA dentro de cada `OfferQueueItem`.** Marcar
  o grupo na fila agora não alcança item já enfileirado — só os próximos.
- **`status='success'` significa "entreguei ao WhatsApp", não "apareceu no
  grupo".** Antes de procurar defeito, compare com o espelhamento: se ele chega
  no mesmo grupo, o robô está lá e com permissão, e o assunto é a fila.

Diagnóstico reutilizável (read-only): `scripts/diag-fila-grupo.mjs <email>
[jid|nome] [--dias=7]` — cruza filas, itens, destinos, `blockReason` e o
histórico por destino, e mostra o dia a dia do grupo separando fila de
espelhamento. Teste: `test/painel-fila-grupo-sem-fila.test.js`.

### Emoji cortado ao meio derrubava a reserva de `SendDedupKey` (mesma investigação)

Achado secundário, defeito real e independente. O `bot.log` de produção trazia
`Reserva SendDedupKey falhou; seguindo com dedup local/global` com
`unexpected end of hex escape at line 1 column 304`.

A chave era montada com `sanitizeMessageForLog(texto).slice(0, 80)`. O
sanitizador já trunca por **code point** justamente para não partir emoji ao
meio (ver `src/messageLogSanitizer.js`) — e o `.slice` aplicado DEPOIS, que
conta code **units** UTF-16, reintroduzia a metade solta do par surrogate. O
motor do Prisma recusa a gravação inteira nesse caso, então a **reserva atômica
cross-worker** (a camada que fecha a corrida de milissegundos entre dois
workers) simplesmente deixava de existir para essas mensagens, em silêncio —
a proteção contra envio duplicado caía para as camadas local/Redis.

Conserto em duas camadas: `truncateByCodePoints` (`messageLogSanitizer.js`,
puro) no ponto de corte, e limpeza de surrogate solto dentro de
`buildMirrorDedupKeys` (`src/core/mirrorDedupKey.js`), que é a fonte ÚNICA da
chave e protege qualquer chamador futuro. **Não voltar a usar `.slice` em texto
que vira chave de banco** — o teste reproduz o corte antigo e falha se ele
voltar. Teste: `test/mirror-dedup-key-surrogate.test.js`.

## Agregação de duplicatas em `MessageLog.dedupHits`

Em vez de criar N linhas de `skip:dedup_recent_link` quando a mesma
oferta cai no mesmo destino ao longo do dia (várias automações/canais-fonte
apontando pro mesmo grupo, ou a fonte republicando), agregamos no contador
`dedupHits` da linha mais recente do mesmo `(userId, destGroup,
convertedUrl)`. Implementado em `registerDedupBlock()` no `bot-worker.js`:

1. Procura a linha mais recente dentro de `linkDedupWindowMs` (default
   120min, override via env `DEDUP_LINK_WINDOW_MS`) filtrando por `userId`,
   `destGroup` e `convertedUrl OR originalUrl`.
2. Se achar → `UPDATE` com `dedupHits = dedupHits + 1`.
3. Senão (estado dessincronizado, fallback raro) → cria linha
   `status='skipped'` com `errorMsg='skip:dedup_recent_link'`.

O painel (`dashboard/app/dashboard/logs/page.js`) renderiza um chip
`+N repetições bloqueadas` ao lado do status quando `dedupHits > 0`,
inclusive em linhas de sucesso (uma promoção que saiu e foi tentada
novamente N vezes pelos canais-fonte mostra ambos: "✓ Enviado +3
repetições bloqueadas").

O endpoint `/api/logs/summary` soma `dedupHits` em vez de contar
linhas, garantindo que o card "Bloqueadas por repetição" reflita o
número real de tentativas bloqueadas e não o número de linhas no
banco. Índice composto `(userId, destGroup, convertedUrl, sentAt)`
suporta o lookup em volume.

## Taxonomia canônica de `MessageLog.errorMsg`

Toda escrita final em `MessageLog.errorMsg` passa por `classifyError()`
em `src/errorTaxonomy.js`. O painel e o endpoint `/api/logs/summary`
agregam contagens via `categorizeErrorMsg()` lendo o prefixo. Prefixos
canônicos (não inventar novos sem atualizar `errorTaxonomy.js` E o
tradutor `explainErrorMsg` em `dashboard/app/dashboard/logs/page.js`):

| Prefixo                          | Categoria          | Significado                                                  |
|----------------------------------|--------------------|--------------------------------------------------------------|
| `skip:dedup_recent_link`         | DEDUP              | Mesma oferta já enviada ao destino dentro da janela de dedup (per-dest) |
| `skip:dedup_recent_link_global`  | DEDUP              | Idem, via Redis global                                       |
| `skip:blocked_keyword`           | CONFIG_BLOCK       | Palavra-chave bloqueada pelo usuário                         |
| `skip:title_mismatch`            | CONFIG_BLOCK       | Caption não bate com og:title raspado                        |
| `skip:text_too_large`            | CONFIG_BLOCK       | Mensagem acima de MAX_INCOMING_MESSAGE_CHARS                 |
| `skip:no_valid_conversions`      | CONFIG_BLOCK       | Nenhum link convertido com sucesso                           |
| `skip:policy:<...>`              | CONFIG_BLOCK       | Política de encaminhamento do grupo bloqueou                 |
| `skip:decrypt_failed:<detail>`   | DECRYPT            | libsignal: Bad MAC / counter / key issues                    |
| `skip:incoming_error:<detail>`   | INCOMING_ERROR     | Erro genérico no processamento de incoming                   |
| `timeout:send:<destJid>`         | TIMEOUT            | `SEND_MESSAGE_TIMEOUT` após retries                          |
| `timeout:incoming`               | TIMEOUT            | `MSG_QUEUE_TIMEOUT_MS` no preparo da mensagem                |
| `error:queue_full`               | QUEUE_FULL         | Fila interna de envios cheia ou worker encerrando            |
| `error:worker_restart`           | WORKER_RESTART     | Bot reiniciou antes de drenar a fila                         |
| `error:channel_forbidden`        | CHANNEL_FORBIDDEN  | Canal-destino sem permissão (403)                            |
| `error:channel_throttled`        | CHANNEL_THROTTLED  | Canal pediu para esperar                                     |
| `error:baileys:<statusCode>`     | BAILEYS            | Boom/Baileys com `output.statusCode`                         |
| `error:conversion:<motivo>`      | CONVERSION         | Falha de conversão de afiliado                               |
| `error:other:<detail>`           | OTHER              | Catch-all classificado pelo classifyError                    |

Regras de status (`MessageLog.status`):
- `skip:*` → `status='skipped'` (decisão de não enviar; proteção/config)
- `timeout:*` → `status='error'` (tentamos e não conseguimos a tempo)
- `error:*` → `status='error'`
- Sucesso → `status='success'`
- Em vôo → `status='queued'` ou `'sending'`

Strings históricas livres caem em categoria `UNKNOWN` — `categorizeErrorMsg`
é tolerante. Para mudanças destrutivas (renomear prefixo) considerar
backfill via SQL antes do deploy.

## Fila entupida por UM destino derrubando a vazão de todos (RCA 2026-07 — não regredir)

**Sintoma:** conta em produção com **489 envios parados na fila** e mensagem
publicada à meia-noite saindo às 14h.

**Medição (não suposição):** entravam **~111 envios/hora** e saíam **~52/hora**.
O `bot.log` mostrava cadência travada em **68–71s entre QUALQUER envio**,
inclusive para destinos com `minIntervalSec=3`. O log de `Smart delay antes do
envio` trazia `delayMs: 60000` em 17 dos 20 últimos envios.

**Causa 1 — o freio progressivo media a fila TOTAL.**
`buildQueuePressureDelayMs` (`src/bot-worker.js`) usa
`calculateProgressiveDelayMs`: `degraus = floor((fila - 20)/20) + 1`,
`atraso = min(60s, degraus × 5s)`. A fila de envio é **única e serial**
(`concurrency: 1`), então um destino com cadência apertada (`burstCap=1` a cada
`600s` → teto de 6 envios/hora) acumulava centenas de itens, mantinha a fila
acima de 240 (onde o freio **satura**) e fazia **todos os outros destinos**
pagarem 60s por envio. Espiral: fila grande → vazão menor → fila maior.

Hoje a pressão é medida **por destino** (`getSendBackendQueueSizeForDest` →
`getQueueSizeByDest` no backend memory) e **recalculada no dequeue**, não mais
congelada no enqueue com o número global. Jobs adiados (`notBefore`) vivem fora
da fila (em `scheduled`), então já não contam como pressão — correto, não estão
disputando o consumidor. **Não voltar a chamar `buildQueuePressureDelayMs()` sem
argumento nos sites de enqueue.** Backend BullMQ não tem contagem por destino e
cai no total (comportamento antigo).

**Causa 2 — espera inline de até 90s congelava o consumidor.**
`THROTTLE_INLINE_WAIT_MAX_MS` era 90s: um destino com `minIntervalSec=100`
fazia `await sleep` de ~90s **dentro** da fila serial (medido: `waitMs` 87693,
89241, 89449, 89668) e nesse tempo nenhum outro destino recebia nada. Default
passou para **5s** — o que exceder vai para o caminho de re-enfileiramento com
`notBefore`, que não bloqueia. Como a preservação é por destino, a espera de um
destino não pode virar espera de todos.

**Descarte por idade na fila (`queueMaxAgeMin`) — configurável pela usuária.**
Se entra mais oferta do que o destino aceita, a fila cresce para sempre e a
oferta sai velha (preço/estoque já mudaram). Cada destino agora tem um teto de
espera na Preservação: `PreservationPreset.queueMaxAgeMin` (NOT NULL, default
**300 min = 5h**) + override nulável em `Group.queueMaxAgeMin`. Decisão pura em
`src/core/queueExpiry.js` (`shouldDropExpiredQueueJob`), aplicada em
`processSendJob` **antes** do smart delay — não faz sentido dormir 60s para
depois jogar a mensagem fora. A idade vem de `job.enqueuedAt` (preservado pelos
re-enfileiramentos de defer).

- `0` desliga o descarte (fila volta a crescer sem limite) — escape hatch.
- Sem `enqueuedAt` confiável **não descarta** (fail-safe: descartar por dúvida
  perderia oferta legítima).
- Linha vira `status='skipped'` com `skip:queue_expired:age=<n>min:max=<n>min`
  (categoria `CONFIG_BLOCK` em `errorTaxonomy.js`, tradução leiga em
  `dashboard/lib/painel/logsCopy.js`). Não é erro de envio: é decisão de
  configuração.
- UI: campo "Descartar oferta que esperou mais de (minutos)" em
  `PreservationLimitsForm`, junto dos demais limites anti-ban.

**Ordem canônica dentro de `processSendJob` (não reordenar):** resolver a
preservação do destino → descartar por idade → smart delay (freio por destino +
rest) → gate de throttle → tentativas de envio.

Testes: `test/queue-pressure-and-expiry.test.js`,
`test/core/preservationConfig.test.js`.

### Horário de envio × limite de espera: a oferta da noite nunca sobrevivia (RCA 2026-09-24 — não regredir)

Medido em produção (frota inteira, não uma conta): **45 de 48** modelos padrão
(`PreservationPreset.isDefault`) têm horário de envio ligado, 8h–22h
`America/Sao_Paulo`, e `queueMaxAgeMin=300`. Oferta que chega entre 22h e 8h
fica adiada (`deferSendJob`/`notBefore`) até as 8h; às 8h o bloco de descarte
por idade acima joga fora tudo com mais de 5h: **547** `skip:queue_expired`
às 11h UTC em 23/09 e **855** em 24/09. Com janela fechada de 10h e limite de
5h, **nenhuma** oferta da noite tinha como sair — e a cliente só via, de
manhã, uma parede de linhas vermelhas "esperou tempo demais". Foi a causa 1
do chamado "o espelhamento parou, só o Criar oferta funciona".

Decisão da dona do produto (opção A): **descartar na hora**, com motivo
próprio. `src/core/sendWindow.js` (`shouldDropOutsideSendWindow`, puro) roda
em `processSendJob` logo depois do descarte por idade: destino fora do
horário **e** `idade na fila + tempo até abrir > queueMaxAgeMin` → linha
`skip:outside_send_window:hours=8-22:max=300min` (categoria `CONFIG_BLOCK`,
tradução leiga em `logsCopy.js`/`mobileLogs.js`, citando o horário e o
Anti-banimento). A fila não guarda por horas uma oferta que vai morrer às 8h.

**O painel inteiro passa a dizer quando o robô está esperando o
Anti-banimento** (pedido da dona do produto no mesmo dia: "não fica claro para
o cliente quando o robô está parado esperando o tempo configurado por ele").
`SendPauseBanner` no `PainelShell` (vale em QUALQUER página, `pnl-note-box
is-warn`) monta o aviso com a regra pura de
`src/domain/painel/sendPauseStatus.js` (`buildSendPauseNotice`), sempre com o
botão "Mudar esse tempo no Anti-banimento" → `/painel/anti-banimento?parte=ritmo`:

| Situação | Como decide | O que a cliente lê |
|---|---|---|
| todos os destinos fora do horário | `describeSendPause` sobre `GET /groups` (que agora devolve `sendWindow` efetivo por destino, via `attachSendWindow` → `resolveDestinationPreservation`) | "Envio pausado agora: fora do horário (8h–22h)… voltam a sair às 8h" |
| limite diário batido | linhas `queued` cujo motivo leigo (`deferReasonMessage`) fala em limite diário | "O robô está segurando ofertas: limite diário atingido… voltam amanhã" |
| pausa por segurança | idem, "pausou os envios" | "O robô pausou os envios por segurança… volta sozinho" |
| intervalo / rajada / intervalo entre destinos | idem | "O robô está esperando o tempo que você definiu no Anti-banimento… N ofertas na fila (a mais antiga há X min)" |

Prioridade: horário > limite diário > segurança > ritmo (do mais longo para o
mais curto). Robô desconectado → sem aviso (o assunto é a conexão). Linha
`queued` SEM motivo é envio normal em vôo e não conta. Rota
`GET /api/logs/send-pause` (só classifica `queued`, cache de 30s); a shell a
consulta no MESMO tick de 20s em que já carrega grupos e status — uma consulta
leve a mais por aba aberta, nenhum processo novo.

**Não regredir:** a classificação lê o TEXTO gravado por `deferReasonMessage`
(bot-worker) — o teste extrai as frases de lá e exige que cada uma caia num
tipo conhecido; frase nova sem tipo = aviso sumindo em silêncio. E toda frase
do aviso leva o caminho para mudar o tempo.

**Não regredir:**
- **Limite de espera desligado (`queueMaxAgeMin` 0) nunca descarta por aqui**
  — a oferta espera até abrir, comportamento histórico.
- **Fila com horário próprio (`ignoreGlobalQuietHours`) não passa pelo
  horário do destino**, igual ao gate.
- **Destino sem horário conta como aberto** no aviso: ele envia 24h, parte
  das ofertas sai, e o aviso mentiria.
- `sendWindow.js` **não importa `channelThrottle.js`** (que arrasta `db.js`),
  porque a tela também o consome; o teste garante que `sendWindowState`
  concorda com `operatingHoursState` em 48 horários.
- Ordem canônica de `processSendJob` passa a ser: preservação do destino →
  descartar por idade → **descartar fora do horário** → smart delay → gate →
  envio.

⚠️ Em modo `remote` o deploy da API não recarrega os bot-workers: o descarte
na hora só vale nos bots depois do restart do `bot-supervisor` (o deploy faz
isso sozinho porque `src/core/` e `bot-worker.js` estão em
`WORKER_CODE_PATHS_RE`; reconecta TODAS as sessões — anunciar antes).

Teste: `test/horario-envio-x-descarte.test.js`.

## Timeouts no pipeline de mensagens

| Constante                       | Default | Onde     | O que faz                                                          |
|---------------------------------|---------|----------|--------------------------------------------------------------------|
| `PRODUCT_TITLE_FETCH_TIMEOUT_MS`| 3s      | scraper  | Aborta scrape de og:title (`AbortSignal.timeout`); retorna `null`. |
| `MSG_QUEUE_TIMEOUT_MS`          | **25s** | incoming | Aborta `processIncomingMessage` inteiro. `errorMsg=timeout:incoming`. |
| `MSG_QUEUE_WATCHDOG_MS`         | 40s     | incoming | Libera slot travado mesmo após timeout (safety net).               |
| `SEND_MESSAGE_TIMEOUT_BY_ATTEMPT_MS` | [90,60,45]s | send | Por tentativa: 1ª paciente, retries rápidas. Override uniforme via `SEND_MESSAGE_TIMEOUT_MS` (vazio = usa array). |

Defaults foram subidos em 2026-05 (15→25s incoming, 60→90/60/45s send)
após observar timeouts excessivos com Amazon BR lenta (HTML ~1.3MB).
**Não desligar os timeouts** — sem eles, um socket Baileys silenciosamente
morto trava a fila serial inteira até reinício do worker.

## "Atraso entre canais" (`channelStaggerJitterMs`) — default 90s → 20s (RCA 2026-07-28)

**Sintoma:** cliente relatou mensagens "muito tempo na fila" **mesmo sem
preservação configurada**. Na conta de dev, `preservationEnabled=0`,
`channelThrottleEnabled=0` e preset com `throttleEnabled=0` — nenhum gate de
throttle agindo — e ainda assim os envios saíam com 88-125s de intervalo.

**Causa raiz:** `BotConfig.channelStaggerJitterMs` (campo "🎲 Atraso entre
canais", em Preservação → Configurações) estava em 120000ms. Para o 2º destino
em diante que seja canal, `bot-worker.js` sorteia `0..channelStaggerJitterMs` e
guarda no `job.delayMs`; `processSendJob` faz `await sleep(delayMs)` **dentro da
fila serial de envio**. Ou seja, não espaça só os canais: **congela todos os
envios do usuário**, inclusive para grupos e de outras fontes. Medição no
`bot.log` de staging: média **60,4s** de espera por mensagem (máx 119,5s); ao
zerar o campo, o intervalo entre envios caiu para **8-14s**.

**Duas armadilhas de diagnóstico:**
- o campo é **desacoplado** dos toggles de preservação (comentário em
  `bot-worker.js:3368`: "aplica sempre que houver jitter configurado") — logo
  "preservação desligada" **não** significa "sem atraso";
- `BotConfig.channelMinIntervalSec` continua gravado mas é **campo morto**: o
  gate lê `destPreservation` (preset por destino), e `checkAndReserve` ignora o
  botConfig (`_botConfig`). Não perder tempo investigando esse valor.

**Mudança aplicada:** default 90000 → **20000** em `prisma/schema.prisma` +
migration DML `20260728120000_channel_stagger_default_20s` que troca **só as
linhas ainda em 90000**. Quem escolheu valor próprio (inclusive `0`) mantém a
escolha — é config de preservação, sobrescrever decisão do cliente seria pior
que o atraso. Testes: `test/migrations-channel-stagger-default.test.js`.

**Pendências conhecidas — CORRIGIDAS em 2026-09-23/24, ver seção
"Anti-banimento — unificação da proteção do número" logo abaixo:** (1) o
atraso aplicar mesmo com a preservação desligada; (2) o `sleep` rodar dentro do
consumidor serial em vez de adiar o job. As duas eram verdade até esta seção
ser escrita — não as trate como estado atual.

**Diagnóstico rápido** (o atraso aparece no log com nome próprio):
```bash
grep '"msg":"Smart delay antes do envio"' $BOT_LOG_DIR/bot.log | tail -100 \
 | sed -n 's/.*"time":\([0-9]*\).*"baseDelayMs":\([0-9]*\).*/\1 \2/p' \
 | awk -v now=$(date +%s) '{ printf "%.1f min atras base=%.1fs\n", (now-$1/1000)/60, $2/1000 }'
```

## Anti-banimento — unificação da proteção do número (2026-09-23/24, specs/018-unificar-protecao-anti-ban)

**As duas "pendências conhecidas" da seção acima (2026-07-28) foram
CORRIGIDAS aqui — não regredir.** O nome comercial único do recurso é
**"Anti-banimento"** (decisão da dona do produto, 2026-09-23): antes eram três
telas soltas ("Monitoramento", "Preservação por grupo e canal", "Configurações
avançadas"), sem nome coerente e com dois defeitos de comportamento
conhecidos havia dois meses e nunca corrigidos.

| Peça | Onde |
|---|---|
| Correção do "atraso entre canais" (vira "Intervalo entre destinos") | `src/core/destinationSpacing.js` |
| Gate de plano — fonte única | `canUseAdvancedPreservation` (`src/billing/plans.js`) |
| Tela única | `dashboard/app/painel/anti-banimento/*` (substitui as 3 antigas) |

### Piso de 3 campos fixos — REMOVIDO por completo (2026-09-25, não reintroduzir sem pedido novo)

Entre 2026-09-23 e 2026-09-25 existiu um "piso anti-banimento": `burstCap`
(fixo 6), `burstWindowSec` (fixo 600s) e `throttleEnabled` (fixo ligado) saíam
da tela mas continuavam agindo por baixo — o efetivo lido pelo robô sempre
aplicava o mais conservador entre o valor gravado e esses três fixos, e
`throttleEnabled=false` era revertido para `true` com os campos voltando ao
padrão do sistema.

**A cliente pediu a remoção total** ("essas outras não devem existir mais
para ninguém") assim que percebeu que só 3 dos 5 campos apareciam na tela e
descobriu que os outros dois viravam regra fixa por baixo. Removido:

- `src/core/antiBanFloor.js` — apagado.
- O gate de rajada em `decideDestination`/`reserve` (`src/core/channelThrottle.js`)
  — não existe mais `DEFER_REASON.BURST_CAP`.
- `burstCap`/`burstWindowSec` saíram de `FIELDS`/`HARD_DEFAULT_PRESERVATION`
  (`src/core/preservationConfig.js`), da validação e do `SELECT` da API
  (`src/api/routes/preservation.js`), e das etiquetas "Ritmo mais
  cuidadoso"/"recomeçou do padrão" na tela (`RitmoPart.js`).
- `scripts/diag-antiban-valores.mjs`, `diag-antiban-parados-agora.mjs` e
  `diag-quem-parou-antiban.mjs` — apagados (existiam só para medir/depurar o
  piso).
- As colunas `burstCap`/`burstWindowSec` em `Group`/`PreservationPreset`
  **continuam no banco** (sem migration) — ficam inertes, ninguém lê nem
  escreve nelas pela aplicação.

**O que vale hoje:** só três campos governam o ritmo de envio —
`minIntervalSec`, `dailyCap` e `queueMaxAgeMin` — exatamente como a cliente
grava na tela, sem nenhum piso por cima. `throttleEnabled=false` desliga os
limites de verdade (não existe caminho de UI para isso hoje, mas o campo
responde caso alguém grave via API).

**Não reintroduzir esse mecanismo sem pedido novo e explícito** — inclusive
qualquer variante ("piso mais frouxo", "aviso em vez de trava").

### "Intervalo entre destinos" — correção de causa raiz do "Atraso entre canais" (RCA 2026-07-28, fechado)

As duas pendências da seção anterior — (1) o atraso valer mesmo com a
preservação desligada e (2) o `sleep` rodar **dentro** do consumidor serial em
vez de adiar o job — foram corrigidas juntas:

- `src/core/destinationSpacing.js` (módulo puro) decide a espera entre
  destinos **diferentes** — grupo ou canal, os dois — via `decideDestinationSpacing`
  + `combineGateDecisions` (junta com a decisão do próprio destino, sempre a
  de **maior** `deferUntil`, nunca soma os dois atrasos). O sorteio antigo
  (`staggerMs = random(0, jitter)` gravado em `job.delayMs`) **não existe
  mais** — o campo continua se chamando `channelStaggerJitterMs` no banco
  (nenhum alias novo), mas virou um intervalo **fixo**, não sorteado.
- **Toda espera decidida pelo espaçamento vira `deferSendJob`** (o mecanismo
  de `notBefore` que já existia e não estava sendo usado aqui) — nunca
  `await sleep()` dentro da fila. Uma mensagem esperando não trava a fila para
  os outros destinos/fontes. Guarda estrutural:
  `test/bot-worker-destination-spacing-wiring.test.js`.
- O destino reserva a vaga (rajada/limite diário) só quando a decisão
  **combinada** (destino + espaçamento) libera — sem isso, o destino queimaria
  rajada/limite diário à toa enquanto espera o espaçamento (`channelThrottle.js`,
  peek sem reservar + `checkAndReserve`).
- Motivo leigo próprio no painel (`deferReasonMessage`, `bot-worker.js`):
  "Esperando o intervalo entre destinos que você definiu no Anti-banimento." —
  **nenhum** motivo de defer (burst_cap, daily_cap, min_interval, horário,
  saúde) pode citar tela antiga ou termo técnico; motivo desconhecido nunca
  expõe o código cru nem a palavra "throttle".
- Escape hatch: `DESTINATION_SPACING=off` (só o valor exato `off`; qualquer
  outro valor mantém ligado) — nunca volta ao `sleep` antigo, só desliga o
  espaçamento.

⚠️ **O valor do intervalo entre destinos continua PROVISÓRIO em 20s**
(migration `20260728120000_channel_stagger_default_20s`). `scripts/diag-antiban-valores.mjs`
mede, por conta, quantos destinos ela tem, o atraso projetado da última saída,
a vazão teórica × observada, e a proximidade com o descarte por idade da fila
(`queueMaxAgeMin`) — mas **rodar o script e aprovar o valor final é ação
exclusiva da dona do produto**, com a saída em mãos (staging e produção). Não
foi rodado em staging/produção ainda; não tratar 20s como valor confirmado.

### Gate de plano — fonte única

A tela antiga tinha uma checagem PRÓPRIA (`canAccessAdvancedPreservation` em
`dashboard/lib/plan.js`) que **esquecia o Premium** e mostrava upsell indevido
para quem já tinha acesso — removida. Hoje tela e backend usam a MESMA função
(`canUseAdvancedPreservation`, `src/billing/plans.js`), liberando **PRO,
Premium e Trial ativo**. Guarda: `test/anti-banimento-gate-fonte-unica.test.js`
falha se qualquer função própria de checagem de plano voltar a existir fora de
`src/billing/plans.js`.

### Perder o plano NUNCA reseta nada (FR-019)

`resolveDestinationPreservation` e `destinationSpacing.js` nunca leem
`plan`/`accessExpiresAt` — perder o acesso bloqueia só a TELA e a GRAVAÇÃO
(API recusa com "O Anti-banimento é um recurso do plano PRO.", 402/403
conforme a rota, sem alterar nenhuma linha). Os valores gravados continuam
sendo usados pelo robô no envio, sempre com o piso. Reassinar reencontra a
configuração exatamente como foi deixada.

### A tela única substitui as três antigas

`dashboard/app/painel/anti-banimento/*` substitui "Monitoramento",
"Preservação por grupo e canal" e "Configurações avançadas" (três itens de
menu soltos, sem nome coerente). Os quatro endereços antigos (`/painel/preservacao`
e as 3 subpáginas) viram redirects preservando `?destino=`, para link salvo em
e-mail/favorito continuar funcionando. Menu (`nav.js`) troca o grupo
"Preservação avançada" por um único item "Anti-banimento" (`pro: true`), logo
após "Conexão WhatsApp".

### Linguagem leiga obrigatória

Nenhum destes termos pode chegar à tela, ao upsell, à mensagem de erro de
plano ou ao motivo de adiamento que aparece no painel: burst, rajada, janela
de rajada, throttle, jitter, preset, cap, anti-flood, shadowban, hash,
snapshot, score, mutação, stagger, "atraso entre canais", "Preservação
avançada", "Módulo de Preservação", "Preservação Pro", "Preservação por
grupo", "Preservação por destino". Nenhuma frase promete que o número não
será banido. Guarda: `test/anti-banimento-linguagem.test.js`.

Testes: `test/anti-ban-floor.test.js`, `test/anti-ban-floor-chokepoint.test.js`,
`test/destination-spacing.test.js`, `test/destination-spacing-chokepoint.test.js`,
`test/bot-worker-destination-spacing-wiring.test.js`,
`test/defer-reason-destination-spacing.test.js`,
`test/anti-banimento-gate-fonte-unica.test.js`,
`test/anti-banimento-rotas-antigas.test.js`,
`test/anti-banimento-rotas-compat.test.js`,
`test/anti-banimento-linguagem.test.js`,
`test/anti-banimento-textos-atualizados.test.js`,
`test/painel-ritmo-mais-cuidadoso.test.js`,
`test/anti-banimento-tela-bloqueada.test.js`,
`test/anti-banimento-selo-pro.test.js`,
`test/anti-banimento-api-recusa-sem-gravar.test.js`,
`test/anti-banimento-plano-nao-reseta.test.js`,
`test/painel-intervalo-entre-destinos.test.js`,
`test/anti-banimento-variacao-imagem-inalterada.test.js`,
`test/diag-antiban-valores.test.js`.

⚠️ Em modo `remote` o deploy de `main` **reinicia o `bot-supervisor`**
(reconecta TODAS as sessões WhatsApp de uma vez), porque a feature toca
`src/core/preservationConfig.js`, `src/core/channelThrottle.js`, os dois
módulos novos e `src/bot-worker.js` — todos em `WORKER_CODE_PATHS_RE`.
Anunciar às clientes antes, nunca às cegas (mesma regra de sempre).

## Fila de envio (BullMQ + DLQ)

Cada bot-worker tem uma fila própria de envio (`wabot-send-<userId>`) e
uma DLQ correspondente (`wabot-send-<userId>-dlq`). Configuração via env:

| Env                 | Default                       | Efeito |
|---------------------|-------------------------------|--------|
| `QUEUE_BACKEND`     | `memory`                      | `'memory'` (default) força in-process; `'bullmq'` opt-in via Redis. Vazio = memory. |
| `REDIS_URL`         | (vazio)                       | Necessário **apenas** quando `QUEUE_BACKEND=bullmq`. Sem ele, BullMQ cai em memory-fallback. |
| `BULLMQ_QUEUE_NAME` | `wabot-send-${userId}`        | Nome da fila principal; DLQ é `<name>-dlq`. |
| `SEND_MAX_ATTEMPTS` | 3                             | Retries in-process antes do job ser declarado falha definitiva. |

**Default é `memory` — BullMQ é opt-in explícito.** Já tentamos
auto-ligar BullMQ quando `REDIS_URL` está presente e isso quebrou o
envio de imagem em staging: o payload do job pode carregar `image.buffer`
(Buffer real) ou o proto de relay; BullMQ persiste via `JSON.stringify`,
e Buffer vira `{type:'Buffer', data:[...]}` na deserialização — o Baileys
não reconhece como mídia e a oferta sairia **sem foto**.

**Backend híbrido (P1-2, roteamento por serializabilidade):** o wrapper em
`createSendBackend` (bot-worker.js) hoje roteia **por job**, não desligando
mais BullMQ inteiro:
- Job com `payloadRecipe`/`payload` puro (broadcast, oferta automática,
  agendado) → **BullMQ**: persiste e sobrevive a restart do worker. No
  dequeue, `processSendJob` reconstrói a mídia via `buildPayloadFromRecipe`
  (fetch por URL) e atualiza o `MessageLog` sozinho.
- Job com closure `buildPayload`, proto de relay ou `image.buffer`
  (envio monitorado de mídia "original") → **fila em memória**
  (memory-only): não é serializável sem corromper a mídia. Sai **com foto**
  normalmente; só não persiste em restart (aceitável: está atrelado a estado
  efêmero da mensagem ao vivo). A decisão usa `findUnserializableField`.

Logo, ligar `QUEUE_BACKEND=bullmq` **não** faz mais oferta com imagem sair
como texto — no pior caso ela vai pela fila em memória. Limitação conhecida:
um job recipe-based que sobrevive a restart perde o callback `onDone`
(analytics best-effort), mas o envio e a atualização de status do log
acontecem mesmo assim. Validar em staging antes de tornar default.

**DLQ:** quando `processSendJob` lança após esgotar `SEND_MAX_ATTEMPTS`,
o BullMQ marca o job como `failed`. Um listener no Worker copia o payload
para a DLQ (`<queueName>-dlq`) com `removeOnComplete: false`. A DLQ **não
tem worker**, então os jobs ficam em `waiting` até ação manual ou poda.
Inspeção via:

- `GET  /api/admin/send-dlq/:userId?limit=100` — lista jobs
- `POST /api/admin/send-dlq/:userId/retry/:jobId` — reenfileira na principal
- `DEL  /api/admin/send-dlq/:userId/job/:jobId` — descarta
- `POST /api/admin/send-dlq/:userId/purge` — drena toda a DLQ

Helpers programáticos: `src/jobs/sendDlq.js`. Todas as ações destrutivas
gravam `AdminAuditLog`.

**Retenção (P2-1):** como a DLQ nunca processa jobs, `removeOnComplete/Fail`
não os limpa (nunca completam). A poda é por idade: `pruneDlqOlderThan()`
remove entradas mais velhas que `SEND_DLQ_RETENTION_MS` (default 30 dias) via
`failedAt`. Pensado para rodar no cron de manutenção. Sem isso a DLQ cresce
indefinidamente. **Retry seguro (P2-3):** `retryDlqJob` reenfileira com um
`jobId` único (`dlq-retry:<logId>:<dlqJobId>`), nunca reusando o `logId` cru —
senão um `add` com jobId já presente no histórico (`removeOnComplete:500`)
seria descartado em silêncio e o retry se perderia.

### Fail-mode da dedup global vs. rate-limit (`REDIS_DEDUP_FAIL_MODE`)

O `bot-worker.js` tem duas camadas que dependem do Redis quando em modo
`remote`/global: o **rate-limit por destino** e a **dedup global de envio**
(cross-instância). Quando o Redis pisca, o comportamento desejado nas duas é
**diferente**, por isso o fail-mode foi desacoplado:

| Env                     | Default                  | Governa     | Na falha de Redis                                              |
|-------------------------|--------------------------|-------------|---------------------------------------------------------------|
| `REDIS_FAIL_MODE`       | `open`                   | rate-limit (e fallback da dedup) | `open` deixa passar; `closed` lança e estanca o envio. |
| `REDIS_DEDUP_FAIL_MODE` | herda `REDIS_FAIL_MODE`  | só a dedup global | `open` pode **DUPLICAR** um envio (risco de ban); `closed` derruba só aquela mensagem (oferta perdida, recuperável). |

Por que separar: fazer o rate-limit `closed` trava a fila serial inteira num
blip de Redis (ruim). Já a dedup `closed` só aborta a mensagem corrente no
pipeline de incoming (o `throw` é por-mensagem, **não** trava a fila de envio).
Como o pior cenário do produto é **ban por envio duplicado**, em prod o
recomendado é `REDIS_DEDUP_FAIL_MODE=closed` — mas, por ser mudança de
semântica fail-open/closed, **validar em staging primeiro** (vide
`docs/sprint-0-baseline-and-dod.md`). Default herda `REDIS_FAIL_MODE`, então
sem setar nada o comportamento é idêntico ao histórico. A camada local de
dedup (em disco, por worker) continua sendo a primeira linha e independe do
Redis.
