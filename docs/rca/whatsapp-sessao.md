# whatsapp-sessao — regras e RCAs

> Movido do `AGENTS.md` em 2026-09-23 para economizar tokens. Conteúdo sem alteração.
> Leia este arquivo ANTES de mexer no assunto. Referências a "AGENTS.md" em
> comentários de código/testes apontam para as seções abaixo.

## Status honesto da sessão WA no painel: nem falso-offline, nem "conectando" eterno (2026-07)

Dois bugs relacionados, resolvidos juntos, no eixo "o que o cliente vê no painel
enquanto o socket Baileys pisca":

**1. Falso "desconectado" durante reconexão automática.** O heartbeat periódico
do worker (`persistWorkerHeartbeat`, `src/bot-worker.js`) calculava seu próprio
status olhando só `activeSock`/`pendingSock` — e no intervalo real entre um
close transitório e o próximo `startBot()` reconectar de fato (5s no caso
comum, até 5min em cooldowns de flap/quedas-estáveis/replaced), os dois ficam
`null`. Isso sobrescrevia para `disconnected` o `connecting` que
`buildCloseSessionPatch` (`src/core/sessionPersistencePolicy.js`) já grava de
propósito em qualquer close não-terminal. Fix: `scheduleReconnect()` centraliza
todo `setTimeout(startBot, ...)` marcando `reconnectDeadlineMs`; o heartbeat só
reporta `idle` se NÃO há reconexão agendada.

**2. Válvula de segurança contra loop escondido do cliente.** O fix acima
sozinho criava um risco oposto: cooldowns encadeados (flap → replaced →
stable-close) mantêm `hasReconnectScheduled=true` continuamente, então o
cliente NUNCA veria "desconectado" mesmo preso num loop por dezenas de
minutos. `disconnectedSinceMs` (`src/bot-worker.js`) marca a 1ª vez que a
sessão sai de `connected` (não reseta a cada retry dentro do mesmo episódio) e
o heartbeat "desiste" de esconder depois de `WA_HEARTBEAT_MAX_RECONNECTING_MS`
(default **2min** desde 2026-07 — era 5min; `DEFAULT_MAX_RECONNECTING_MS` /
`computeHeartbeatState` em `sessionPersistencePolicy.js`) — reportando
`idle`→`disconnected` mesmo com reconexão ainda agendada. O worker
CONTINUA tentando reconectar sozinho (essa válvula só afeta o que é mostrado,
não a lógica de retry); se reconectar depois do teto, o próximo `open` volta a
marcar `connected` normalmente.

**Importante — durante qualquer cooldown de reconexão o bot está DE FATO fora
do ar** (sem socket ativo, nada é recebido nem espelhado), não é só um detalhe
de status no painel. Por isso `RECONNECT_STABLE_CLOSE_COOLDOWN_MS` (o cooldown
para quedas "tipo relógio" de sessão estável) foi reduzido 30min → 5min → e hoje
**1min** (2026-07, prioridade de alta disponibilidade / issue #1216): enquanto o
cooldown corre a sessão fica DE FATO fora do ar, e a promessa de robô 24h não
tolera minutos de indisponibilidade só para conter uma notificação de re-sync
que aparece apenas no celular do dono (não afeta os grupos). Threshold de stable
close subiu 3 → **4** e o de flap 5 → **8** (`RECONNECT_FLAP_THRESHOLD`), com
`RECONNECT_FLAP_COOLDOWN_MS` 2min → **30s** — na prática a proteção anti-spam
virou residual, deliberadamente. Quem precisar de postura conservadora sobe via
env (rollback do handoff em `docs/reconnect-cooldown-ha-review-handoff-2026-07-08.md`).
O alinhamento antigo "cooldown == heartbeat == 5min de propósito" **deixou de
valer**: agora o cooldown (1min) é menor que o teto do heartbeat (2min) — durante
o cooldown o painel ainda mostra "conectando" (vai reconectar em 1min) e só expõe
`disconnected` após 2min de reconexão genuinamente presa. `RECONNECT_REPLACED_DELAY_MS`
(double-possession) segue em `RECONNECT_MAX_MS` (5min) — caso conservador preservado.

**3. Painel não pode mascarar o status honesto.** `dashboard/app/painel/whatsapp/page.js`
tinha `isBootstrappingSession = isRunning && !isConnected && status === 'disconnected'`
renderizando "Conectando…" — isso escondia exatamente o sinal que os dois fixes
acima existem para mostrar. Removido: `isAwaitingConnectStart` (estado local do
clique em "Conectar") já cobre a corrida legítima de boot; `status==='disconnected'`
agora sempre renderiza "Desconectado" no painel.

**4. "Reconectando" ≠ "desconectado real" — tranquilizar sem mascarar (issue #1216, item #3).**
Baixar o teto do heartbeat para 2min fez o painel expor "Desconectado" cedo
durante uma reconexão que o robô recupera sozinho — alarme falso que leva o
cliente a re-parear à toa (o oposto da meta 24h). Fix SEM violar o item 3 acima:
`buildHeartbeatSessionPatch` (`sessionPersistencePolicy.js`, puro/testado) mantém
`status='disconnected'` (honesto) mas, quando o heartbeat reporta `idle` **e ainda
há reconexão agendada** (worker tentando sozinho), grava `lifecycle='reconnecting'`.
O `GET /status` (`src/api/routes/session.js`) expõe `lifecycle`, e
`dashboard/app/painel/whatsapp/page.js` mostra uma sub-linha ("O robô está
tentando reconectar sozinho — você não precisa fazer nada") **abaixo** do
"Desconectado", sem trocar a linha de status. `idle` SEM reconexão agendada =
parada real → `lifecycle='disconnected'`. Invariante preservada: `idle` nunca
vira "conectando"/"conectado".

## badSession (500): auto-apagar auth é o único gatilho de re-pareamento sob nosso controle (issue #1216, item #2)

Apagar `auth_info` (→ QR novo no celular do cliente) quebra a promessa de
"conectar 1× e rodar liso", então o wipe por `badSession` (500) passa por
`shouldResetAuthForBadSession` (`src/core/reconnectPolicy.js`, puro/testado) com
camadas de proteção, e o RCA "Loop de retry-receipt travado" abaixo avisa que
**500 é o fallback do Baileys para stream-error de motivo desconhecido — nem
sempre é credencial corrompida**. Regras:

- Um 500 que carrega `stuckMsgId` (mensagem travada) **nem entra na contagem** de
  badSession — é o loop de retry-receipt, não corrupção. Trata-se pelo
  `msgRetryCounterCache` + `ops_wa_stuck_message_retry`, não apagando auth.
- `hadStableOpen` (a queda atual foi de sessão estável) → 500 transitório, não apaga.
- **Flag `BADSESSION_KEEP_ESTABLISHED_AUTH` (default OFF).** Quando ON, uma sessão
  que JÁ conectou de forma estável alguma vez neste worker (`everHadStableOpen`,
  escopo de módulo em `bot-worker.js`, persiste reconexões) **nunca** tem auth
  apagado por rajada de 500 — o único gatilho legítimo de re-pareamento passa a
  ser `loggedOut` (401). Default OFF preserva o comportamento histórico; ligar só
  após validar em staging. Rollback sem redeploy (desligar a env).

Testes: `test/reconnect-policy.test.js` (`shouldResetAuthForBadSession`),
`test/session-persistence-policy.test.js` (`buildHeartbeatSessionPatch`,
`computeHeartbeatState`).

## Auto-heal de grupo com sender-key dessincronizada (issue #1216, Camada 3)

Investigação de produção (jul/2026, cliente `julianepumuceno16@gmail.com`) achou um grupo
**não-monitorado** (`120363407732632868@g.us`, spam/pouco relevante) com a sender-key do
Signal dessincronizada gerando **345 falhas de decrypt** e derrubando a sessão em cadência
de ~50min — o mesmo mecanismo do "Loop de retry-receipt travado" abaixo, só que a fonte era
um GRUPO inteiro reofertando mensagens indecifráveis repetidamente, não uma mensagem isolada.
Curar manualmente (grepar o `bot.log` pra achar o JID culpado, pedir refresh ou pedir pra
cliente sair do grupo) não escala por cliente.

**Auto-remediação (não-destrutiva, sempre):**

- `instrumentBaileysLoggerForHealth` (`src/bot-worker.js`) já intercepta toda linha de log
  que bate `SESSION_HEALTH_SIGNAL_RE` (Bad MAC / SessionError / MessageCounterError / "sent
  retry receipt"). Agora, além de contar pro indicador de saúde, `handleGroupDecryptSignal`
  tenta extrair o `remoteJid` dos args brutos do logger via `extractRemoteJidFromLogArgs`
  (`src/core/reconnectPolicy.js`, puro/testado — busca em largura, rasa e limitada, já que a
  lib não garante posição fixa do campo na árvore de contexto do erro).
- Quando o MESMO grupo cruza `WA_GROUP_DESYNC_THRESHOLD` (default 5) falhas de decrypt em
  `WA_GROUP_DESYNC_WINDOW_MS` (default 30min), dispara **sozinho** um
  `triggerWaGroupsRefresh()` — a MESMA função por trás do endpoint manual `/refresh-wa-state`
  (`groupFetchAllParticipating()` no socket já conectado). **Não fecha o WebSocket, não gera
  QR, não pede nada da cliente** — o robô continua enviando/recebendo durante e depois.
  `WA_GROUP_DESYNC_REFRESH_COOLDOWN_MS` (default 5min) evita martelar o mesmo grupo.
- Evento durável `ops_wa_group_desync_autoheal` a cada disparo (allowlist em
  `src/analytics.js` + mapeamento em `src/observability/operationalSignals.js`).

**Escalonamento — NUNCA automático além do refresh.** Se o auto-refresh disparar
`WA_GROUP_DESYNC_ESCALATE_THRESHOLD` (default 3) vezes pro MESMO grupo dentro de
`WA_GROUP_DESYNC_ESCALATE_WINDOW_MS` (default 3h) sem as falhas pararem, emite
`ops_wa_group_desync_unresolved` (só visibilidade — decisão de sair do grupo fica **sempre**
com humano/cliente, o sistema nunca sai de grupo sozinho).

**Escopo de módulo (não regredir):** `groupDecryptTimestamps`, `groupAutoRefreshTimestamps` e
`groupLastAutoRefreshAtByJid` vivem fora de `startBotInner` (mesma lição do RCA do
`msgRetryCounterCache` abaixo) — precisam sobreviver a reconexões dentro do MESMO worker,
senão o contador zera a cada `open`/close e o threshold nunca é cruzado.

Testes: `test/reconnect-policy.test.js` (`extractRemoteJidFromLogArgs`).

## Ignorar grupos NÃO-monitorados no socket — fix de causa raiz do desync (RCA 2026-07, cliente `vanessascar12@gmail.com`)

**Investigação:** cliente com robô caindo a cada ~50min o dia inteiro (~30
quedas/dia), recuperando sozinho em ~6s, `0 ações manuais` no painel admin — só
ela, diferente dos outros. `WaConnectionEvent`: `disconnect|500` com
`stuckMsg:true`/`badSession:true` em cadência de relógio. `AnalyticsEvent`:
`ops_wa_group_desync_autoheal` + `ops_wa_stuck_message_retry` recorrentes. No
`bot.log`, as falhas de decrypt do worker dela concentravam-se num **único grupo
`@g.us` que ela participa mas o robô NEM monitora** (não estava nas fontes
monitor/post dela). É o mesmo mecanismo do "Loop de retry-receipt travado" e do
"Auto-heal de grupo" acima, mas o auto-heal (refresh de sender-keys) **não cura**
esse caso: o refresh re-emite chaves pra frente, mas não cancela a mensagem já
enfileirada que o WhatsApp reoferece — a fonte segue viva.

**Causa raiz de segundo nível:** o robô só espelha grupos monitorados, mas o
Baileys tenta decifrar (e por isso manda retry-receipt) mensagens de **qualquer**
grupo que a conta participa. Grupo-lixo dessincronizado → decrypt fail → retry
receipt → WhatsApp reoferece → `stream:error 500` → queda. O robô estava brigando
por mensagem que nunca vai usar.

**Fix (prevenção na origem) — `WA_IGNORE_UNMONITORED_GROUPS` (default OFF):**
liga a opção `shouldIgnoreJid` do `makeWASocket` (`src/bot-worker.js`) via
`shouldIgnoreChatJid` (`src/core/ignoredJidPolicy.js`, puro/testado). Confirmado
na FONTE do Baileys (`Socket/messages-recv.js → handleMessage`): quando
`shouldIgnoreJid(from)` é `true`, a mensagem é **ACKada e descartada ANTES** de
`decrypt()` e `sendRetryRequest()` → sem Bad MAC, sem retry receipt → o WhatsApp
não reoferece → **o stream não cai**. Blast radius mínimo DE PROPÓSITO: só entram
na regra jids de **grupo `@g.us` fora do allowlist**; `@newsletter` (Canais que
sigo), DMs (`@s.whatsapp.net`), `status@broadcast` e o próprio número **nunca**
são ignorados. O allowlist (`allowedChatJids`, escopo de módulo) = monitor +
destino + canal-botão, repopulado a cada `getConfig()`; `ready`-guard evita
ignorar mensagem legítima enquanto a config não carregou (default seguro no boot).
Mensagem travada de `@newsletter` continua coberta pela blindagem do
`msgRetryCounterCache` (limite 5/mensagem). **Rollout seguro:** default OFF,
reversível sem redeploy; **validar em staging** (o gate é confirmar em campo que
o retry-receipt some com um grupo real dessincronizado) antes de ligar em prod.
Teste: `test/ignored-jid-policy.test.js`.

**Visibilidade admin (Part B):** como a regra é **NUNCA sair de grupo sozinho**,
a "cura" (cliente decide sair) tem que ser barata — antes exigia grepar 1.4GB de
log. Agora os eventos `ops_wa_group_desync_autoheal`/`unresolved` carregam o
**nome** do grupo (`groupSubjectByJid`, cacheado no `groupFetchAllParticipating`),
e o detalhe do painel admin online (`buildAdminOnlineUserDetail` +
`summarizeDesyncGroups` em `src/adminLogSummary.js`) devolve `desyncGroups`
(nome + jid + nº de refresh + flag `unresolved`), renderizado numa seção do drawer
em `dashboard/app/admin/online/page.js`. Teste: `test/admin-desync-groups.test.js`.

**Não regredir:** não ler `group.imageMode`/config fora do chokepoint não muda
aqui, mas não mover `allowedChatJids`/`groupSubjectByJid` pra dentro de
`startBotInner` (precisam sobreviver a reconexões, mesma lição do
`msgRetryCounterCache`); não ampliar o `shouldIgnoreChatJid` para ignorar
newsletter/DM sem revalidar Canais/pareamento; manter o default OFF até validação
explícita em staging.

## Cega e caindo: a conta pior é a que nenhum alarme enxergava (RCA 2026-09-14)

Cliente (`viviloppes@gmail.com`) reportou que o espelhamento parou. Medido em
produção: o espelhamento dela caiu de **1.099 envios no dia 10/09 para zero a
partir de 12/09**, e o worker dela tinha **ZERO** linhas `mensagem recebida` em
11h de vida — enquanto os outros 37 workers do host somavam 13.505. Não era um
grupo: ela estava **100% cega**, sem receber nada de chat nenhum.

O painel mostrou **"conectado"** o tempo todo, e **nenhuma** das redes de
segurança acusou: `ops_wa_reception_blind` nunca saiu, a auto-cura de recepção
nunca rodou, o vigia de silêncio nunca rodou.

**A causa da invisibilidade é aritmética, e vale para qualquer conta assim.**
Tudo era medido a partir da **conexão atual**, e a conexão dela reiniciava a
cada ~50min (queda 500 com `stuckMsg:true`, **29 vezes em 24h**, todas com
`hadStableOpen`). Com os defaults:

| Rede de segurança | Por que nunca rodou |
|---|---|
| `computeReceptionState` → `blind` | carência de 20min devolve `ok` aconteça o que acontecer; a rajada de decrypt acontece no **dreno da fila offline** (`offline:"1"`) nos minutos 0-2, e a janela do contador é de **10min** — no minuto 20 já foi podada |
| `computeReceptionState` → `starved` | exige **120min** de conexão; a dela morria aos ~50 |
| `shouldSelfHealReception` | `lastAcceptedAtMs == null` → "nunca recebeu nada nesta sessão"; a conta totalmente cega é a única que a auto-cura não cobre |
| `monitorSilenceWatchdog` | `!hasActive` → com **todos** os monitores calados ele desiste; a falha total era o único estado invisível |

Ou seja: **quanto pior o estado, mais invisível ele ficava.** Reconexão
frequente não é só sintoma — era o que impedia qualquer diagnóstico.

**A correção é medir a cegueira num relógio que NÃO reseta na reconexão**
(`evaluateBlindAcrossReconnects`, em `src/core/receptionHealth.js`):
`observedSinceMs` (última aceitação, ou o boot do worker) + contadores
**cumulativos** `failuresSinceLastAccepted` / `stableDropsSinceLastAccepted`,
zerados **só** em `markMessageAccepted`. A regra roda **antes da carência** de
propósito — é a carência que escondia o caso.

**Não regredir:**

- **Os contadores vivem em escopo de módulo e só zeram quando uma mensagem é
  ACEITA.** Dentro de `startBotInner` eles zerariam a cada reconexão e a
  cegueira volta a ser invisível (mesma lição do `msgRetryCounterCache`).
- **`observedSinceMs` nunca pode vir de `connectionOpenedAt`** — é literalmente
  a troca de relógio que causava o bug.
- **Silêncio sozinho NUNCA vira alarme.** Exige evidência de que a sessão está
  ocupada e mesmo assim não aceita nada (falhas de decrypt **ou** quedas de
  sessão estável). Sem evidência, madrugada continua sendo madrugada.
- **Fail-safe em todo caminho**: sem `observedSinceMs` confiável, cegueira curta
  demais, ou sessão desconectada → **não acusa**.
- **Só avisa — não reconecta.** A auto-cura existente fecha o socket, e isso
  seria inútil aqui (ela já reconecta 29×/dia) e **prejudicial**: reconexão
  repetida é o padrão que o WhatsApp associa a robô. Quem decide o próximo passo
  é gente.
- O vigia de silêncio passou a cobrir a falha total, **exigindo a mesma
  evidência** quando todos os monitores estão calados.

O painel já sabia falar disso: `clientVisibleSessionState` traduz
`receptionState === 'blind'` em `NOT_RECEIVING`. **Faltava só o classificador
chegar a essa conclusão** — agora que chega, a tela para de dizer "conectado"
para quem não está recebendo nada.

Rollback sem redeploy: `WA_BLIND_ACROSS_RECONNECTS_MS=0` desliga só a regra
nova. Testes: `test/reception-health.test.js` (com os números reais da conta),
`test/bot-worker-reception-blindness-wiring.test.js` (guarda estrutural).

**Todo worker agora diz no boot quais filtros de recepção está aplicando**
(`'Filtros de recepção deste robô'`). `WA_IGNORE_UNMONITORED_GROUPS` descarta
mensagem antes do decrypt e **não escrevia nada em lugar nenhum** — nem no boot,
nem ao ignorar (`ignoredJidPolicy.js` não tem logger). Ligada em produção em
14/09, não havia como responder "pegou nos robôs?": qualquer grep dava zero com
a flag ligada ou desligada. Em modo `remote` o worker só relê a env quando o
supervisor reinicia, que é exatamente quando a pergunta aparece — e de fato os
38 workers estavam rodando desde antes da mudança, sem terem lido a flag.
⚠️ **A ordem importa:** o log cita constantes de escopo de módulo e, se subir
acima de qualquer uma delas, o módulo estoura ReferenceError (TDZ) no load e
**todo worker morre no boot**. Guarda em
`test/bot-worker-reception-blindness-wiring.test.js`.

**Varrer a frota inteira procurando o mesmo quadro** (read-only, roda no
diretório do ambiente e **não depende deste conserto estar no ar**):

```bash
cd ~/wabot && node scripts/diag-frota-cega.mjs
```

Ele mapeia cada processo de robô para a conta (`BOT_USER_ID` em
`/proc/<pid>/environ`), conta as linhas `mensagem recebida` **daquele pid** no
`bot.log` (que é compartilhado por todas as contas — o pid é o que separa) e
cruza com o banco. **"Cega" exige as duas evidências**: a conta espelhava antes
E não recebe nada agora. Sem isso, conta parada e madrugada acusariam igual.
Envio com `destGroup='broadcast'` (fila/garimpo) **não** conta como
espelhamento: ele continua saindo com a recepção morta e esconderia o caso.

⚠️ **O que este conserto NÃO faz: curar a causa da cegueira dela.** A poluição
vinha de chats que o robô **nem monitora** — os retry receipts dela saíam com
`retryCount: 5` para mensagens de DM na fila offline. O remédio de causa raiz
para esse quadro já existe e está **DESLIGADO**: `WA_IGNORE_UNMONITORED_GROUPS`
(ver "Ignorar grupos NÃO-monitorados no socket"). Ligar isso reconecta todas as
sessões e é decisão humana, anunciada antes.

⚠️ **Armadilha de diagnóstico desta investigação:** `42172350988530@lid` aparecia
em `ops_wa_group_desync_autoheal`/`unresolved` como "o grupo culpado", e a
escalação recomendava "a cliente sair e reentrar no grupo". No log bruto esse
jid é o **`recipient`** dos retry receipts, com `notify:"Viviane"` e
`peer_recipient_pn` de um telefone — ou seja, **o endereço da própria conta
dela**, não um grupo do qual ela possa sair. O auto-refresh disparou ~10×/dia
contra isso, devolvendo 91 grupos, sem nunca curar nada. Investigar
separadamente antes de agir sobre esse sinal.

## Conectado e sem receber: o robô refaz a conexão sozinho (RCA 2026-08-28)

Terceira parada da mesma cliente (`cynthiatceles@gmail.com`) em quatro dias.
Os eventos de conexão contam a história inteira:

```
17:23 → 18:27   sem enviar nada, ZERO eventos de conexão no meio
18:27:14        ela clica em Conectar
18:27:15        volta a enviar
18:27 → 19:33   para de novo, de novo sem nenhum evento de conexão
19:31:41        ela clica em Conectar
19:33           volta a enviar
```

O socket não caiu, o heartbeat não falhou, o painel ficou verde — e nada
entrava. **Só a ação manual dela resolvia**, duas vezes, em paradas de 64 e 66
minutos. A conta recebe de **4 a 14 mensagens por minuto** quando saudável.

**Não precisamos saber a causa para agir.** A ação certa é a mesma que ela faz
na mão: refazer a conexão. `src/core/receptionSelfHeal.js`
(`shouldSelfHealReception`, puro) decide pela linha de base **da própria
conta** — não por número fixo, senão conta que naturalmente recebe pouco
dispararia à toa.

Dispara quando: sessão **conectada**, silêncio de `WA_SELF_HEAL_SILENCE_MS`
(30min) **e** a conta recebeu ao menos `WA_SELF_HEAL_MIN_BASELINE` (30)
mensagens na janela `WA_SELF_HEAL_BASELINE_WINDOW_MS` (6h). Tetos:
`WA_SELF_HEAL_COOLDOWN_MS` (1h) e `WA_SELF_HEAL_MAX_PER_DAY` (2).

**A ação é só fechar o socket** — o caminho normal de reconexão sobe de novo,
com todo o backoff e as guardas existentes. **NÃO apaga credencial, NÃO gera
QR.** Há teste estrutural que falha se `rm(AUTH_DIR)`, `auth_reset` ou
`requestPairingCode` aparecerem nesse caminho: auto-cura que vira
re-pareamento seria muito pior que o problema.

Os tetos são a parte mais importante: reconexão repetida é o padrão que o
WhatsApp associa a robô (ver o RCA do teto de tentativas). Rollback:
`WA_SELF_HEAL_MAX_PER_DAY=0`. Sinal `ops_wa_reception_self_heal` — cada evento
é uma vez que a cliente **não** precisou clicar.

### A fila de entrada travava a origem inteira por causa de uma mensagem

Achado na mesma investigação, defeito real e independente. A fila serializa por
origem (`orderKey` = jid) para não espelhar fora de ordem. O elo da corrente era
a promessa da tarefa anterior, que só resolvia quando a **função** do job
terminava — e o timeout da fila **não cancela a função**: ele solta o slot e
segue. Uma mensagem que trave para sempre deixava a corrente pendurada e **toda
mensagem seguinte daquela origem nunca rodava**. O watchdog soltava o slot, não
a corrente.

Agora a corrente avança quando a **fila** termina de esperar pelo job
(concluído, com erro ou por timeout). **Não regredir:** o elo é o fim do job na
FILA, nunca o fim da função. Teste:
`test/message-queue-order-stall.test.js`.

### O alerta de recepção não pegava nada disso

`markMessageAccepted` roda **antes** da fila: com a fila travada, o marcador
continuava fresco e estava tudo verde. A fila passa a registrar quando um job
saiu pela última vez (`lastCompletedAt`), e `computeReceptionState` trata "tem
mensagem esperando e nada sai há mais que a janela" como cegueira.

## Teto de tentativas de reconexão sem sucesso (RCA 2026-08-28 — não regredir)

Três contas somaram **281 das ~380 quedas de 12h** — 94, 94 e 93 tentativas com
**zero** conexões bem-sucedidas, nenhuma delas com mensagem travada. Eram
sessões que tentavam a cada ~8min e o WhatsApp nunca aceitava.

O gatilho foi a correção da ressurreição (RCA 2026-08-27): antes essas sessões
morriam e ficavam quietas; depois passaram a ser levantadas de volta e a
martelar. Medido nas três: de **0,6-1,9 quedas/h para 7-8/h**. Trocar "morta em
silêncio" por "loop de reconexão" é pior — reconexão repetida é o padrão que o
WhatsApp associa a robô, e o preço é chip restringido.

`src/core/reconnectGiveupPolicy.js` (puro) resolve **desacelerando**, não
parando:

| Situação | Regra | Efeito |
|---|---|---|
| Sessão que **já abriu** alguma vez e caiu | `WA_RETRY_GIVEUP_ATTEMPTS` (12) falhas seguidas → passa a tentar a cada `WA_RETRY_SLOW_INTERVAL_MS` (15min) | queda de rede/WhatsApp continua se recuperando sozinha; exposição cai ~75% |
| Sessão que **nunca abriu** nesta credencial | `WA_RETRY_NEVER_CONNECTED_MAX` (10) → **para** e marca `lifecycle='disconnected'` | sem credencial válida o WhatsApp nunca aceita; quem resolve é a cliente lendo o QR |

**Quem já conectou NUNCA é parada** — só desacelerada. Parar sessão de cliente
pagante quebraria a promessa de robô 24h; a política de alta disponibilidade do
projeto prefere indisponibilidade curta, e por isso o ritmo lento é 15min e não
30. Qualquer `open` zera o contador, então a frota saudável nunca chega ao teto
(hoje ninguém passa de 16 quedas/12h, todas com 100% de recuperação).

**Não regredir:** o contador (`consecutiveFailedReconnects`) e `everOpened`
vivem em escopo de módulo — dentro de `startBotInner` zerariam a cada
reconexão e o teto nunca seria atingido (mesma lição do `msgRetryCounterCache`).
`everOpened` é de propósito mais frouxo que `everHadStableOpen`: para a PARADA
definitiva só vale "nunca chegou a abrir", não "abriu e não ficou estável". O
teto age só no close genérico — pareamento e `replaced` têm caminhos próprios.
Sinais `ops_wa_retry_slowed` e `ops_wa_retry_giveup`. Rollback:
`WA_RETRY_GIVEUP_ATTEMPTS=0` e `WA_RETRY_NEVER_CONNECTED_MAX=0`.
Teste: `test/reconnect-giveup-policy.test.js`.

Parar uma sessão à mão (marca como parada de propósito, não gera aviso de robô
caído): `node scripts/parar-sessao.mjs <email>`.

## Olhar só o que foi escolhido (`WA_CHAT_SCOPE_MODE`, default OFF)

A regra acima (`WA_IGNORE_UNMONITORED_GROUPS`) é uma **lista de exceções**, e
listas de exceções envelhecem mal: começou cobrindo grupo, veio o incidente de
**canal** (`@newsletter`, conta `cynthiatceles@gmail.com`, 2026-08-25) e a
medição de 26/08 mostrou que o MAIOR balde nem era grupo — eram as **conversas
diretas pessoais da própria cliente** (538 de 1.082 eventos de dessincronização,
15 contas), que o robô tenta decifrar e **descarta na linha seguinte**
(`monitorGroups: []`). Cada incidente descobria um balde novo depois que a
cliente reclamava.

`src/core/chatScopePolicy.js` inverte: a lista passa a ser do que **olhar**.
Modo em degraus via `WA_CHAT_SCOPE_MODE`:

| Modo | Ignora, fora da lista de escolhidos |
|---|---|
| `off` (default) | nada — comportamento histórico |
| `dm` | conversa direta (`@lid`, `@s.whatsapp.net`) |
| `dm+group` | soma grupo `@g.us` |
| `strict` | soma canal `@newsletter` (**só após a validação da Fase 3**) |

**Tudo falha para o lado de DEIXAR PASSAR** (não afrouxar): modo desligado,
config ainda não carregada (`ready=false`), **lista de escolhidos vazia**, freio
acionado, tipo de endereço desconhecido, jid vazio — nada disso filtra. Lista
vazia é sinal de config incompleta, não autorização para ignorar tudo.

**Nunca ignorados, em nenhum modo:** o que está na lista (fontes monitoradas,
destinos de postagem, canal do botão), a **identidade da própria conta**
(número e `@lid`, preenchidos no `open`) e `status@broadcast`.

⚠️ **Por que destinos e `status@broadcast` precisam estar na lista** (conferido
na fonte do Baileys 6.7.23 — não é escolha estética): o MESMO gancho
`shouldIgnoreJid` é consultado em quatro caminhos —
`handleMessage` (`messages-recv.js:611`, o que queremos),
`handleReceipt` (`:512`, **confirmação de entrega das nossas mensagens**),
`handleNotification` (`:580`, **entrada em grupo → mensagem de boas-vindas**) e
`handlePresenceUpdate` (`chats.js:543`). Ignorar um destino quebraria a
boas-vindas e o recibo. A descoberta de "Canais que sigo" **não** passa por aí
(vem de `messaging-history.set` / `chats.upsert`), então ignorar canal
não-monitorado não apaga o picker.

**Freio de emergência (`shouldAutoDisableChatScope`) — não remover.** Se a conta
ESTAVA recebendo, parou por completo por `WA_CHAT_SCOPE_PANIC_MS` (default
30min) e o contador de ignoradas continua subindo, a regra **se desliga sozinha**
naquele worker e tudo volta a passar até o próximo restart, com
`ops_wa_chat_scope_auto_disabled`. É a rede contra o cenário que não conseguimos
prever — em especial a migração do endereçamento de grupo para `@lid`, que faria
um grupo monitorado deixar de casar com a lista e sair do ar **em silêncio**.
Conta que nunca recebeu (nova) e silêncio sem nada sendo ignorado **não**
acionam o freio.

**Observabilidade obrigatória:** contagem por tipo, amostra de log limitada
(`WA_CHAT_SCOPE_LOG_SAMPLE`, primeiros N endereços distintos por tipo) e sinal
durável **agregado por janela** `ops_wa_chat_scope_filtered`
(`WA_CHAT_SCOPE_SIGNAL_INTERVAL_MS`, default 1h) — **nunca por mensagem**. Sem
isso trocaríamos um problema visível por um invisível: com o filtro ativo a
mensagem some antes do nosso log, e foi justamente uma linha de log
(`"mensagem recebida" jid: ...@lid, monitorGroups: []`) que permitiu diagnosticar
o incidente.

Aplicar a env exige `pm2 delete` + `start` (pegadinha #1) **e**, em modo
`remote`, restart do `bot-supervisor` para os workers pegarem o código — o que
reconecta TODAS as sessões (anunciar antes). Rollback: `WA_CHAT_SCOPE_MODE=off`.
Testes: `test/chat-scope-policy.test.js`, `test/bot-worker-chat-scope-wiring.test.js`.
Plano completo: `docs/plano-recepcao-whatsapp-2026-08-26.md`.

## Loop de retry-receipt travado derrubando sessão a cada ~50min (RCA 2026-07)

**Sintoma:** cliente reportou queda "de novo hoje". Investigação encontrou uma
sessão caindo em cadência de relógio quase exata (a cada ~50min, por DIAS),
código `500` no close. Antes de investigar fundo parecia o mesmo padrão do
Trilho B (init-queries 408) — mas `init408=0` pra essa sessão (o bump do
Baileys já tinha resolvido aquele sintoma). Causa raiz é outra e mais
específica.

**Causa raiz confirmada:** uma mensagem EDITADA de um canal (`@newsletter`)
seguido pela conta ficou com a sessão de chave dessincronizada — o Baileys não
conseguia decifrá-la e mandava `sendRetryRequest` ("sent retry receipt") pra
pedir reenvio. O WhatsApp reoferecia a mesma mensagem periodicamente; toda vez
que a oferta não era aceita (ack rejeitado), o servidor mandava
`stream:error` com o node de ack daquela mensagem embutido — e o Baileys
**desconhece esse motivo específico**, então cai no default `DisconnectReason.badSession`
(`500`) em `getErrorCodeFromStreamError` (só `"conflict"` tem mapeamento
próprio; qualquer outro motivo vira 500). Ou seja: **`500` não significa
necessariamente sessão corrompida — é o fallback do Baileys pra motivo
desconhecido.** Sempre inspecionar o campo `node` bruto da linha `"stream
errored out"` (não só o `code`) antes de assumir que é badSession de verdade.

**Por que o loop nunca se resolvia sozinho:** o Baileys tem um limite
embutido (`maxMsgRetryCount`, default 5) — depois de 5 tentativas de retry
pra uma mensagem, ele desiste e limpa o contador (`msgRetryCache.del(key)`).
Mas esse contador (`msgRetryCounterCache`) é criado **do zero a cada
`makeWASocket()`** a menos que seja passado explicitamente na config — ou
seja, a cada reconexão. Como a própria mensagem travada estava CAUSANDO a
reconexão (via `stream:error`), o contador nunca sobrevivia até a próxima
tentativa: sempre voltava a 0, nunca chegava a 5, o Baileys nunca desistia, o
WhatsApp nunca parava de reoferecer. Loop que se autoalimenta indefinidamente
— sem outra intervenção, teria continuado pra sempre (a sessão real ficou
presa nisso por pelo menos 3+ dias antes de ser detectada).

**Fix (`src/bot-worker.js`):** `msgRetryCounterCache` e `placeholderResendCache`
(a segunda evita reconsultar `requestPlaceholderResend` pra mensagem que já
pediu) agora são criados **uma vez em escopo de módulo** (`NodeCache` de
`@cacheable/node-cache`, mesma lib que o Baileys usa internamente — já vinha
como dependência transitiva, promovida a dependência direta) e passados
explicitamente pro `makeWASocket()`. A cache comum sobrevive às reconexões do
MESMO processo worker.

**Correção complementar (RCA 2026-08, Cynthia):** isso ainda era insuficiente.
O próprio Baileys apaga o contador ao atingir `maxMsgRetryCount`, e um restart
manual recriava a cache vazia. Uma mídia envenenada de `@newsletter` voltou por
horas e deixou a sessão com heartbeat verde, mas sem novos envios. Ao segundo
`stream:error` do mesmo `msgId`, `createDurableStuckMessageRetryCache` grava
`stuck-message-quarantine.json` dentro do `AUTH_DIR` da conta. Para esse id, a
cache devolve o limite ao Baileys e recusa o `del`: ele ACKa/descarta sem mandar
outro retry-receipt. A quarentena dura 7 dias, sobrevive a restart do worker e
some junto com o auth em logout/reset. Para recuperar um id já confirmado no
node `stream:error`, antes de reiniciar apenas o worker da conta, use
`node scripts/quarantine-wa-message.mjs <userId> <msgId>`. Nunca usar por
palpite: o id precisa vir do log.

**Não é sobre decrypt/crypto em si.** As falhas de "failed to decrypt
message" (`Bad MAC`/`SessionError`/`MessageCounterError`) que aparecem em
volta são RUÍDO SECUNDÁRIO da mesma mensagem travada tentando decifrar de
novo a cada ciclo — não são a causa da queda, e resetar a sessão inteira da
conta (ou pedir pro cliente reescanear o QR) NÃO ataca a causa raiz. Cuidado
ao diagnosticar: a correlação temporal entre "decrypt failure" e "close" pode
enganar — só a inspeção do `node` bruto do `stream:error` revelou a mensagem
específica travada.

**Não regredir:** não remover `msgRetryCounterCache`/`placeholderResendCache`
do config do `makeWASocket()`, e não recriá-los dentro de `startBotInner()`
(precisam ficar em escopo de módulo, fora da função que roda a cada
reconexão) — senão o bug volta. Guardado por teste estrutural em
`test/bot-worker-retry-cache-wiring.test.js` (lê o source e falha se a
declaração for movida pra dentro de `startBotInner` ou sumir da config do
`makeWASocket`).

**Blindagem contra recorrência (mesmo por causa raiz diferente):** o fix acima
resolve o mecanismo específico encontrado, mas não impede que uma OUTRA causa
volte a travar uma mensagem em loop de reentrega no futuro. Por isso, além do
fix, `src/bot-worker.js` agora rastreia `stuckMessageTimestamps` (Map por
messageId) via `extractAckMessageIdFromStreamErrorNode` +
`registerStuckMessageAndDecide` (`src/core/reconnectPolicy.js`, puras/
testadas): se o MESMO `messageId` aparecer no ack de um `stream:error` 2+
vezes (`WA_STUCK_MSG_THRESHOLD`, default 2) dentro de 2h
(`WA_STUCK_MSG_WINDOW_MS`), coloca o id na quarentena durável e emite
`logger.error` + `AnalyticsEvent ops_wa_stuck_message_retry`. Assim a próxima
conexão deixa de pedir retry da mensagem culpada em vez de apenas avisar.

## Quedas 500 crônicas: mensagem de CANAL confirmada com `<receipt>` (RCA 2026-09-24 — não regredir)

~600 quedas 500/dia há ≥10 dias (85% com `stuckMsg:true`, ~1 por conta por
hora, 60 ids diferentes). A quarentena durável do RCA acima disparava (o
mesmo id voltava 2×) e **não resolvia**: ela age no retry-receipt, e aqui a
mensagem decifra bem — não há retry nenhum.

**Medido no `bot.log` de produção (400 MB), cruzando o `<ack>` de cada
`stream:error` com a recepção do MESMO id no MESMO pid:**

| | |
|---|---|
| `stream:error` com `<ack>` | 344 |
| tipo de chat do id | **canal (`@newsletter`): 223 (65%)** · `@lid`: 72 · sem linha: 49 |
| forma do ack recusado | `class=message type=media/text`, sem `error` — o ack que o servidor ESPERAVA |
| histórico do id antes da queda | cadeias "descartada como reentrega > descartada > quarentena > descartada…" |

Ou seja: a mesma mensagem de canal era reentregue a cada reconexão porque
nunca era confirmada do jeito que o servidor aceita.

**Causa raiz (na fonte do Baileys 6.7.23, `lib/Socket/messages-recv.js`,
`handleMessage`):** depois de decifrar, TODA mensagem — canal incluído —
recebia `sendReceipt(remoteJid, participant, [id], type)` →
`<receipt to=…@newsletter type=inactive>`. O servidor recusa esse receipt com
`<stream:error><ack class="message" …/></stream:error>` (o ack que ele
esperava), o Baileys não conhece esse motivo e cai no default
`badSession` (500), a conexão fecha, a fila offline reentrega a mensagem na
volta e o ciclo repete. O 7.x corrigiu no commit `f46e8b1` ("handle
newsletter and unavailable message acks", nov/2025): canal recebe
`sendMessageAck(node)` e **nunca** `sendReceipt`. A linha 6.7 nunca recebeu o
conserto — `6.7.24` (a `legacy` do npm) é byte a byte igual à 6.7.23 fora o
JSON de versão.

**Hipóteses derrubadas com dado (não repetir):** `WA_IGNORE_UNMONITORED_GROUPS`
(ligado em 14/09) — zero ids de grupo nos acks recusados; "ack sem `from`" —
o servidor recusa o receipt, não o ack; mensagem "envenenada" — são 60 ids
diferentes; migrar de biblioteca "por via das dúvidas".

**Conserto: patch de 10 linhas no pacote instalado**
(`patches/@whiskeysockets+baileys+6.7.23.patch`, aplicado por `patch-package`
no `postinstall`, antes do `prisma generate`): espelha o ramo do 7.x —
`else if (isJidNewsletter(remoteJid)) await sendMessageAck(node)` antes do
ramo genérico de `sendReceipt`. Sem migrar para 7.x: o 7.x converte as
sessões Signal para LID sem volta e exige `getMessage` — mudança grande que
não é necessária para esta causa.

**Não regredir:**
- `test/baileys-newsletter-ack-patch.test.js` falha se o patch não estiver
  aplicado no `node_modules` em uso, se o nome do patch não bater com a versão
  instalada (subir o Baileys exige refazer o patch, ou confirmar que a versão
  nova já confirma canal com `<ack>`), se o `postinstall` deixar de rodar
  `patch-package` primeiro, ou se `patches/` sair de `WORKER_CODE_PATHS_RE`.
- `patches/` está em `WORKER_CODE_PATHS_RE` dos dois scripts de deploy: mudar
  um patch do Baileys reinicia o `bot-supervisor` (senão o conserto fica
  dormente nos robôs — mesma família do RCA "código novo não carregado").
- `class=status` (10 acks de `status@broadcast`) e `@lid` (72, DMs com
  "failed to decrypt", o retry-receipt do RCA acima) **não** são cobertos por
  este patch — são os baldes seguintes, muito menores; medir de novo depois.

**Medição de aceite (staging 24h, depois produção):** a razão
`500 / conexões` por dia tem que cair para perto de zero, e as cadeias
"descartada > descartada > quarentena" de ids de canal têm que sumir do
`bot.log`. Rodar de novo o script de cruzamento (`/tmp/ack.js` do
relatório de 24/09) e conferir que `canal` deixa de ser o balde dominante.

⚠️ Em modo `remote` o deploy da API não recarrega os bot-workers: o patch só
vale nos robôs depois do restart do `bot-supervisor` (o deploy faz isso
sozinho porque `package-lock.json` e `patches/` estão em
`WORKER_CODE_PATHS_RE`) — reconecta TODAS as sessões, anunciar antes.

## `failure 405` derrubando TODAS as sessões: versão do WA Web cortada (RCA 2026-07-28)

**Sintoma:** cliente reporta "não consigo reconectar meu WhatsApp"; o painel
mostra `Falha na conexão / Falha ao solicitar código de pareamento` e
`Desconectado`. Investigação mostrou que **não era o número dela**: em produção,
**todas** as sessões estavam caídas com `code: 405` (1254 eventos em 48h,
começando 2026-07-27 ~20:24 BRT), e em staging idem.

**Causa raiz:** `405` **não existe** no `DisconnectReason` do Baileys — vem cru
do `<failure reason="405">` do servidor do WhatsApp (`ws.on('CB:failure')` em
`Socket/socket.js`), ou seja, é **recusa de login/registro**. O que estava sendo
recusado era a **versão do WA Web anunciada no handshake**:
`fetchLatestBaileysVersion()` busca o arquivo de versão do **repositório do
Baileys**, que ficou preso em `2.3000.1035194821` — build que **não existe** na
lista real de versões do WA Web (`wppconnect-team/wa-version`). Quando o
WhatsApp expirou a faixa antiga, todo login passou a receber 405. Bumpar o
pacote não resolve: `baileys@7.0.0-rc13` hardcoda exatamente a mesma versão.

**Armadilha de diagnóstico (não repetir):** com a sessão registrada, um 405 se
parece com queda genérica; com auth limpo, o log diz `not logged in, attempting
registration...` e some — dá a impressão de bloqueio do número. Dois sinais
separam de verdade: (1) o incidente atinge **todas as contas ao mesmo tempo** —
sempre conferir `WaConnectionEvent` de prod antes de culpar um chip; (2) o nó
bruto de failure (`lastDisconnect.error.data`), que **era descartado** e hoje é
logado.

**Resolução da versão (`src/core/waVersion.js`, puro/testado)** — ordem:
1. **`WA_WEB_VERSION`** (ex.: `2.3000.1044015310`) — pin manual. É o botão de
   emergência: quando o WhatsApp cortar a versão de novo, fixar no `.env` +
   `pm2 delete/start` (pegadinha #1) resolve **sem redeploy**.
2. Registro público de versões reais (`WA_VERSION_REGISTRY_URL`, default
   `wppconnect-team/wa-version`), que espelha o próprio web.whatsapp.com.
   Builds com `expire` vencido são descartadas — usar build expirada é
   exatamente o que produz o 405. `''` desliga a fonte.
3. `fetchLatestBaileysVersion()` — comportamento histórico, agora penúltimo
   recurso em vez de fonte única.
4. Última versão boa deste processo (cache em memória).

A versão escolhida e a fonte aparecem no `bot.log` (`Versão do WhatsApp Web
resolvida para o handshake`) — sem isso é impossível auditar um incidente
depois. Sinal durável `ops_wa_version_rejected` (allowlist em `src/analytics.js`
+ `src/observability/operationalSignals.js`).

**Não regredir:** não voltar a usar `fetchLatestBaileysVersion()` como fonte
única; não remover o corte de sufixo de canal (`-alpha`) no parse — sem ele a
versão vigente é descartada e caímos na fonte velha; não escolher build com
`expire` vencido. Testes: `test/wa-version.test.js`, `test/errors-map-infra.test.js`.

### Pareamento NUNCA pode apagar a credencial antes da hora (mesmo RCA)

O que transformou um incidente recuperável em **sessão travada** foi um bug
nosso: o handler de `requestPairingCode` (`src/bot-worker.js`) fazia
`rm -rf AUTH_DIR` **assim que a cliente clicava em conectar**, antes de saber se
o WhatsApp aceitaria o pareamento. Com o WA recusando (405), a credencial válida
era destruída e o close pré-código **não reagendava reconexão** — a sessão saía
de "caiu mas volta sozinha" para "sem credencial e sem reconexão". Cada nova
tentativa da cliente repetia a destruição.

Hoje `createPairingAuthBackup` (`src/core/pairingAuthBackup.js`, I/O injetado,
testado) transforma o `rm` em `rename` para `<AUTH_DIR>.pairing-backup`:
- **restore** nos quatro caminhos de falha pré-código (erro no socket,
  expiração da janela de pareamento, `startBot` falhando, close não-515 sem
  código entregue). No caso do close, a sessão **volta a reconectar sozinha**
  com a credencial antiga;
- **discard** só quando o WhatsApp aceita o pareamento (close `515`
  restartRequired), ponto em que a credencial nova é a boa;
- backup órfão de um pareamento interrompido é descartado antes do próximo;
- falha inesperada de `rename` degrada para o comportamento histórico
  (AUTH_DIR limpo), nunca para "pareamento impossível".

**Não regredir:** não voltar a apagar `AUTH_DIR` no início do pareamento; não
remover o `restore` de nenhum dos quatro caminhos; não descartar o backup antes
do `515`. Teste: `test/pairing-auth-backup.test.js`.

### Mensagem honesta para a cliente

`mapInfraError` (`src/errors.js`) jogava cinco erros distintos do worker no
catch-all `WA_PAIRING_FAILED` ("Falha ao solicitar código de pareamento") — a
cliente lia uma falha genérica e re-pareava sem parar, destruindo a credencial a
cada tentativa, sem nenhuma chance de sucesso. O 405 agora tem código próprio
`WA_VERSION_REJECTED` (503, retryable) e texto que diz o que é: recusa do
WhatsApp por versão desatualizada, **não** problema do número dela. Segue a
regra de linguagem leiga — nenhum jargão (`405`, `socket`, `handshake`,
`pairing`) pode chegar à tela, e há teste que falha se voltar.

## Loop de init-queries 408 derrubando sessões (RCA 2026-07 — Trilho B)

**Causa raiz confirmada (docs/rca-sessoes-whatsapp-caindo-2026-07.md):** cada
sessão de cliente em prod caía ~11-12x/dia. Toda conexão (`opened connection
to WA`) era seguida ~60s depois de `unexpected error in 'init queries'`
(statusCode 408, `executeInitQueries → fetchProps → waitForMessage` sem
resposta do WA) → o WA encerrava o stream (500/428) → reconexão → repete.
Correlação perfeita: `open == init408` nas sessões estabelecidas. Não é
deploy, memória/GC, dupla-posse nem versão de fetch (`fetchLatestBaileysVersion`
respondia normalmente). Interação `@whiskeysockets/baileys` ↔ protocolo WA.

**Fix aplicado (menor risco primeiro, por `docs/handoff-sonnet-execucao-sessoes-whatsapp.md`):**
bump de `@whiskeysockets/baileys` de `^6.7.16` para `^6.7.23` (última da linha
6.7.x — a lib foi renomeada para `baileys` no npm a partir da 6.17.x/7.x, mas
migrar de pacote é mudança maior e fica para uma 2ª rodada se o bump patch não
resolver). **Ainda não validado em staging/prod** — pendente:
1. Merge `develop` → autodeploy staging → rodar a ferramenta de medição do
   handoff (`ratio 408/open` e `quedas`) por ≥60min. Se staging estiver
   `remote`, reiniciar `bot-supervisor-staging --update-env` para carregar o
   código novo; se `inline`, o deploy já recarrega sozinho.
2. Se `408/open` não cair a ~0 em staging, próxima alavanca é fixar uma versão
   WA conhecida-boa em vez do `fetchLatestBaileysVersion()` (`fetchVersionCached`,
   `src/bot-worker.js`), ou migrar para o pacote `baileys` (renomeado).
3. Só depois de aprovado em staging: PR `develop → main` e, **passo manual
   obrigatório**, `pm2 restart bot-supervisor --update-env` em prod — só assim
   os workers já-rodando carregam a lib nova (deploy da API sozinho não toca
   nos workers em modo `remote`). Essa reinicialização reconecta **todas** as
   sessões de uma vez — anunciar/agendar antes, não fazer às cegas.

**Higiene (não afeta a causa raiz):** `unexpected error in 'init queries'` é
rebaixado de `error` para `debug` em `instrumentBaileysLoggerForHealth`
(`src/bot-worker.js`) só para não inflar `bot.log` (~14k linhas/dia
observadas) — não muda a lógica de reconexão nem a métrica de saúde
(`SESSION_HEALTH_SIGNAL_RE`), que continuam olhando o fechamento real da
conexão, não a linha de log.
