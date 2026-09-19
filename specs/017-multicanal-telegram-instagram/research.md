# Phase 0 — Research: arquitetura multicanal de entrega

**Feature**: 017-multicanal-telegram-instagram | **Data**: 2026-09-17

Este documento resolve as incógnitas técnicas do plano. Tudo que ficou **sem** resolução está em "Questões em aberto" no `plan.md` — nada foi inventado aqui.

Base factual: `scratchpad/levantamento-multicanal.md` (HEAD `66bc013`), `AGENTS.md` e as leituras de código citadas abaixo.

---

## R0.1 — Onde executar o Telegram

**Decisão**: duas passadas `setInterval` + `unref()` dentro do processo `api` já existente (`src/api/server.js`), single-flight, no mesmo padrão de `startCredentialExpirySweep`, `startSessionCapacityAlertSweep` e `startLifecycleEmailSweep`.

**Racional**:
- O Telegram é **Bot API por HTTP**, sem sessão pareada e sem socket persistente. Não há nada que exija um processo por conta — e o robô é **único do produto** (decisão D1 da spec), então nem há multiplicidade a acomodar.
- A política de memória do projeto está com folga zero (15,6 GB, 36 robôs, 329 MB/robô, teto 40, limite seguro 35). O padrão que o repositório usa para não criar processo é exatamente a passada in-process.
- Manter o Telegram fora do `bot-worker` é o que impede o modo de falha do RCA "fila entupida por UM destino": um `await` de rede dentro do consumidor serial congela os envios de WhatsApp daquela conta.
- Manter o Telegram fora do worker também significa que **conserto de Telegram nunca exige `pm2 restart bot-supervisor`**, que reconecta todas as sessões.

**Alternativas consideradas**:
| Alternativa | Custo | Por que foi rejeitada |
|---|---|---|
| Dentro do `bot-worker` | 0 MB | Recria o RCA da fila serial; e todo conserto passaria a reconectar todas as sessões. |
| Dentro do `bot-supervisor` | ~0 MB | É o processo deliberadamente NÃO reiniciado no deploy para preservar sessões. Código que muda com frequência ali é o pior dos dois mundos. |
| App PM2 dedicado | **+90–120 MB** (o `bot-supervisor`, de porte comparável, mede 120 MB em produção) | REGRA #2 (alternativa mais leve existe). Fica como plano B se a API deixar de ser instância única. |

**Descoberta que sustenta a decisão**: `ecosystem.config.cjs` declara `api` com `exec_mode: 'fork'` e `instances: 1`. Isso importa porque o `getUpdates` do Telegram admite **um consumidor só** — dois pollers do mesmo robô recebem `409 Conflict`. Com instância única a passada in-process é segura; registrado como **condição**, não como suposição.

---

## R0.2 — Como entregar num destino de Telegram sem tocar o caminho do WhatsApp

**Decisão**: caixa de saída durável (`DeliveryOutbox`) + drenador in-process. O worker, ao encontrar um destino não-WhatsApp, **escreve uma linha e segue** — nunca faz HTTP.

**Racional**:
- FR-021/R5 exigem que a lentidão de uma rede não segure as outras. Escrever numa tabela é O(1) e local; chamar o Telegram não é.
- FR-040 exige que a oferta **espere sem se perder** quando o robô está fora. Durabilidade é requisito, não conveniência.
- O drenador fora do worker é onde cabem o rodízio entre clientes (FR-039) e o orçamento global (R14) — coisas que só fazem sentido vendo **todas** as contas de uma vez, e que o worker, sendo por conta, não consegue enxergar.

**Alternativas consideradas**:
- **Fila só em memória**: perde tudo num deploy da API. Viola FR-040.
- **BullMQ/Redis**: `REDIS_URL` é **opcional** no modo `inline` (AGENTS.md), então a garantia "nunca perder" passaria a depender de infraestrutura opcional. Rejeitada como fonte da verdade; pode entrar depois como aceleração, com o banco continuando sendo o registro.
- **Enviar direto do worker**: rejeitada por R5 e R9 (ver R0.1).

---

## R0.3 — Como o Telegram, sendo ORIGEM, publica num destino de WhatsApp

**Decisão**: usar `sendBroadcast(userId, texto, jids, { imageUrl, imageRefererUrl, source })` do `src/manager.js`. **Nenhum comando novo, nenhuma alteração em `src/supervisor/protocol.js`, nenhum bump de `PROTOCOL_VERSION`.**

**Racional**: esse caminho já é o usado, hoje, de fora do worker, por `src/offerAutomation/dispatcher.js` (linha 266) e `src/offerQueue/dispatcher.js` (linha 132) para publicar oferta **com imagem** em grupo de WhatsApp. É comando existente, com timeout existente, e já carrega o isolamento de falha por item que o RCA de 2026-07-20 deixou montado.

**Consequência**: R2 e FR-036 deixam de ter conteúdo — não existem duas pontas para ficarem em versões divergentes, porque o contrato não muda.

**Alternativa considerada**: comando novo `DELIVER_NEUTRAL` no protocolo. Rejeitada: `protocol.js` é [PROTECTED_CORE], exigiria deploy casado de supervisor e API, e em modo `remote` o supervisor não é reiniciado no deploy — exatamente a divergência que R2 descreve. Somar risco a um caminho que já existe e funciona não se justifica.

---

## R0.4 — Unicidade de destino entre redes

**Decisão**: o identificador de destino/origem que **não é WhatsApp** nasce com prefixo de rede (`tg:<chatId>`), e `Group.deliveryNetwork` (coluna nova, nulável) é a verdade declarada. O índice `@@unique([userId, waJid, role])` **não é alterado**.

**Racional**: nenhum endereço de WhatsApp tem o formato prefixado (`@g.us` / `@newsletter`), então colisão entre redes é impossível por construção e a unicidade que R10 pede já está garantida pelo índice atual. Mexer em índice único sobre tabela com dados vivos é risco que não precisa ser corrido.

**Alternativa considerada**: `@@unique([userId, waJid, role, deliveryNetwork])`. Rejeitada: exigiria recriar o índice, é DDL sobre tabela quente (pegadinha #8) e pode recusar linhas já gravadas se algum valor vier nulo de formas inesperadas — exatamente o que R10 adverte.

---

## R0.5 — Por qual rede a mensagem saiu, sem colidir com "loja"

**Decisão**: `MessageLog.deliveryNetwork String?` e `MessageLog.deliveryReductions String?` (ambas nuláveis). `MessageLog.platform` continua significando **loja** e não é tocada.

**Racional**: `null` lê como `whatsapp` via `resolveDeliveryNetwork`, o que atende FR-027 (registro antigo aparece como WhatsApp, sem lacuna e sem "desconhecido") **sem backfill** e sem migration destrutiva. É o mesmo padrão que o repositório já usa em `deliveryKind` e `originImageBytes`: coluna nula significa "não sabemos / linha antiga", e isso é uma resposta honesta.

---

## R0.6 — Reaproveitamento da blindagem de entrada

**Decisão**: reusar sem alterar `src/core/incomingFreshness.js`, `src/core/mirrorDedupKey.js`, `src/messageQueue.js` (ordem por origem) e `src/core/destinationRouting.js`; criar apenas o normalizador (`incomingEnvelope.js`) e a tabela de dedup durável (`DeliveryInboxSeen`).

**Racional por item**:
- `shouldProcessIncomingMessage` já decide por **idade** e por **reentrega**. O update do Telegram traz `message.date` sempre; o normalizador o converte e chama a função existente. Não tocar nesse módulo é importante: ele é código de worker, e alterá-lo arrastaria o WhatsApp para dentro do risco.
- `buildMirrorDedupKeys` já monta a chave de repetição a partir do **destino**; com destinos namespaceados por rede (R0.4), FR-023 e FR-060 saem de graça.
- `createMessageQueue({ orderKey })` já entrega ordem por origem **e** o isolamento de mensagem travada, incluindo a correção de 2026-08-28 (o elo da corrente é o fim do job na fila, não o fim da função). Reimplementar isso seria repetir um incidente já pago.
- **O que precisa nascer**: dedup **durável** por `(rede, origem, idMensagem)`. O `update_id` do Telegram sozinho não basta — um restart da API pode reprocessar, e FR-055 exige um espelhamento só "mesmo quando chegam por processos diferentes".

---

## R0.7 — Cliente HTTP do Telegram

**Decisão**: `fetch` nativo, sem biblioteca nova.

**Racional**: `package-lock.json` está em `WORKER_CODE_PATHS_RE`, então **acrescentar dependência é caminho de código de worker** e arrastaria um reinício de supervisor por causa de uma biblioteca. A Bot API é HTTP/JSON simples e o repositório já consome APIs de terceiros assim nos conversores de loja. Menos dependência, menos superfície, menos reinício.

---

## R0.8 — Escopo do Instagram nesta rodada

**Decisão**: rede **declarada e indisponível** (FR-034); o contrato é provado **hoje** por uma rede fictícia de publicação, só em teste.

**Racional**: a spec já fundamenta a exclusão (publicação ≠ mensageria; texto vira sobreposição; mídia obrigatória em endereço público; autorização que vence). O acréscimo desta pesquisa é **como tornar "preparado" verificável**: a rede fictícia declara destino único, imagem obrigatória, sem botão e sem leitura de origem — as quatro divergências que o Instagram trará — e roda de ponta a ponta. Isso substitui promessa por prova (SC-009).

---

## R0.9 — Padrão de interruptor de rollout

**Decisão**: `DELIVERY_NETWORKS_ENABLED`, lista separada por vírgula, **default `whatsapp`**, lida **fora do worker** (em `buildEntitledGroupConfig`).

**Racional**: é o padrão que o repositório já usa (`COUPON_LINK_CONVERT`, `GROUP_IMAGE_MODE`, `WA_CHAT_SCOPE_MODE`, `SHEIN_SHORTLINK_ENABLED`): env única, default seguro, desligar não quebra nada e não exige redeploy.

**O detalhe que faz diferença**: se o **worker** lesse a env, ligar ou desligar exigiria reiniciar o supervisor — e reconectar todas as sessões. Lendo na API, a config nova chega ao worker por `reloadConfig`, e o rollback é `pm2 delete` + `start` da API (pegadinha #1). Essa é a razão técnica de o interruptor morar onde mora, e há teste estrutural travando isso.

---

## R0.10 — Direito de plano

**Decisão**: `FEATURE_CODES.MULTI_NETWORK = 'multi_network'`, com `canUseMultiNetwork` seguindo a forma de `canUseChannels`.

**Racional**: FR-046 proíbe explicitamente reaproveitar `channels`, que já significa Canal do WhatsApp. `src/billing/plans.js` já tem a forma pronta (`getPlanEntitlements` → `canUse*`) e `buildFeatureGateError` já tem o lugar do texto leigo por recurso.

⚠️ **O valor** de `canUseMultiNetwork` (a fronteira de plano) é **questão em aberto Q1** — a própria spec marca a suposição "Pro ou teste grátis ativo" como não confirmada. A forma está decidida; o valor não.
