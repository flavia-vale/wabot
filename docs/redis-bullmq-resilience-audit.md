# Auditoria de resiliência — Redis & BullMQ (wabot)

> Data: 2026-06-18. Escopo: revisão de toda a superfície Redis/BullMQ com foco
> em resiliência do bridge API↔supervisor (drenagem de jobs velhos, TTL nos
> comandos), robustez e escalabilidade. **Relatório — nenhum código foi
> alterado.**

Versões: `bullmq ^5.76.10`, `ioredis ^5.10.1`.

## 1. Inventário (onde Redis/BullMQ são usados)

| # | Arquivo | Papel | Conexão | TTL / retenção | Fail-mode |
|---|---------|-------|---------|----------------|-----------|
| 1 | `src/supervisor/protocol.js` | Contrato (filas, canais, timeouts, `PROTOCOL_VERSION=1`) | — | — | — |
| 2 | `src/supervisor/client.js` | API → supervisor: enfileira comandos + assina eventos | Queue+QueueEvents (`maxRetriesPerRequest:null, enableReadyCheck:false`) + 2 ioredis (subscriber, publisherCheck) | job: complete 60s / fail 600s; `attempts:1` | erro logado, rota não cai |
| 3 | `src/supervisor/index.js` | App `bot-supervisor`: consome `supervisor-commands`, publica eventos, heartbeat | Worker (`maxRetriesPerRequest:null`, concurrency 8) + 1 ioredis (publisher) | heartbeat key TTL 30s, renova 10s | falha logada, não mata |
| 4 | `src/manager.js` | Fachada inline/remote; singleton do client | — | — | — |
| 5 | `src/bot-worker.js` | Dedup global + rate-limit global + fila de envio | 1 ioredis runtime (`maxRetriesPerRequest:null`) | dedup `PX` dinâmico; rate-limit `PSETEX 2×janela` | `REDIS_FAIL_MODE` / `REDIS_DEDUP_FAIL_MODE` |
| 6 | `src/sendQueueBackend.js` | Fila de envio BullMQ + DLQ | Queue/Worker `{url}` (concurrency 1) | principal: 500 complete/fail; DLQ: **nunca expira** | fallback memory |
| 7 | `src/jobs/sendDlq.js` | Inspeção/retry/purge da DLQ | Queue efêmera por chamada | — | — |
| 8 | `src/supervisor/operationalCounters.js` | Contadores por shard via SCAN | 1 ioredis por scrape (cache 15s, `maxRetriesPerRequest:1`) | chaves persistem | graceful |
| 9 | `src/core/probeSessions.js` | Snapshot de sessão probe (HASH) + pub/sub | 2 ioredis persistentes (sem `maxRetriesPerRequest`) | key TTL 10min | graceful |
| 10 | `src/core/tokenRevocationStore.js` | JTIs revogados | 1 ioredis (`maxRetriesPerRequest:null, enableReadyCheck:true`) | key TTL = exp do JWT | fallback memory |

## 2. O que já está bom (não regredir)

- **Lazy init + fallback memory**: API/worker sobem sem Redis; client usa `initPromise` singleton; `manager.js` cria um único client remoto.
- **Guard de serialização** (`findUnserializableField`) impede o regressão "oferta sem foto" do BullMQ.
- **Fail-mode desacoplado** rate-limit vs dedup (`REDIS_DEDUP_FAIL_MODE`).
- **Versionamento de evento** com `decodeEvent` tolerante (não derruba o assinante por payload malformado).
- **Heartbeat** com margem 3× (TTL 30s / renova 10s) e `envGuard` que aborta supervisor no diretório/Redis-DB errado (pegadinha #9).
- **Boot resiliente**: resume de sessões guardado por `try/catch` por sessão.

## 3. Achados, por prioridade

### P0 — Risco direto de incidente em produção

**P0-1. Comandos sem TTL/freshness real + sem drenagem no boot.**
`client.js:111` grava `_enqueuedAt: Date.now()` no payload, **mas o handler do
worker (`index.js:269-282`) nunca o verifica**. Quando a API estoura o timeout
(START_BOT 5s, etc.), o job **continua em `wait`/`active`**. Se o supervisor
processa tarde — após restart, backlog, ou o incidente da pegadinha #9 — ele
**executa um comando obsoleto**. Para `SEND_BROADCAST` isso é um **envio
duplicado tardio (risco de ban)**; para START/STOP é race de ciclo de vida.
Nada no boot dá `drain`/`obliterate` na fila (confirmado: nenhum
`obliterate`/`drain`/`getActive` no código do supervisor).
**Ação:** (a) no handler, descartar job cujo `Date.now() - _enqueuedAt >
COMMAND_TIMEOUTS_MS[name]` (retornar erro "stale"); (b) no boot do supervisor,
drenar comandos pendentes antes de abrir o Worker (ou validar idade de cada um).

**P0-2. Sem tratamento explícito de stalled jobs em comandos de efeito colateral.**
O Worker de comandos roda com defaults do BullMQ (`lockDuration` 30s,
`maxStalledCount` 1). Se o supervisor morre com `SEND_BROADCAST` em `active`, o
job é **reentregue e re-executado** ao voltar → duplicação. `attempts:1` não
protege de stall (stall ≠ retry de falha).
**Ação:** tornar handlers idempotentes (idempotency-key por comando) e/ou
descartar stalled de comandos não-idempotentes; ajustar `lockDuration` ciente
do `SEND_BROADCAST` (30s) e logar stalled.

### P1 — Alto

**P1-1. Comentário enganoso em `bot-worker.js:648-651`.**
Afirma "quando vazio e REDIS_URL setado, default vira 'bullmq'". O código
(`resolveBackendMode`) retorna **`memory`** nesse caso — e isso é o correto
(AGENTS.md). Risco: alguém "alinha" o código ao comentário e **reintroduz o bug
da oferta-sem-foto**.
**Ação:** corrigir o comentário para refletir "default = memory; bullmq é opt-in".

**P1-2. Backend `memory` default = perda de envios em qualquer restart.**
Em prod, sends enfileirados em memória somem em restart de worker/supervisor/
deploy. O BullMQ persistente está bloqueado pelo Buffer de imagem no payload.
**Ação:** priorizar o refactor "payload lazy / receita" (persistir URL+flags+texto,
reconstruir mídia pós-dequeue) — destrava `QUEUE_BACKEND=bullmq` com segurança e
elimina a perda. É o item estrutural de maior retorno.

**P1-3. Dedup global fail-open (default) pode duplicar → ban.**
`REDIS_DEDUP_FAIL_MODE` herda `open`. Já instrumentado (`ops_dedup_fail_open`).
**Ação:** validar em staging e setar `REDIS_DEDUP_FAIL_MODE=closed` em prod.

**P1-4. Pub/sub de QR/status é fire-and-forget.**
Restart da API ou janela de reconexão do subscriber perde QR/status (o próprio
código admite em `client.js:158-161`). Mitigado em parte por `GET_LAST_QR` e
pelo hash TTL do probe — mas status geral não tem last-value.
**Ação:** cachear último QR/status em key Redis com TTL (padrão do probe) e
reidratar no `subscribe`, em vez de depender só de pull ativo.

### P2 — Médio / higiene

- **P2-1. DLQ sem limite/expiração** (`removeOnComplete/Fail:false`): cresce
  indefinidamente. Expor `getDlqSize()` no `/metrics` + alerta por threshold +
  retenção configurável.
- **P2-2. `PROTOCOL_VERSION` mismatch silencioso:** em rolling deploy, eventos de
  versão diferente são descartados **sem log**, e comando novo vira throw
  "Comando desconhecido". Logar o mismatch (WARN) e documentar ordem de deploy
  (supervisor + API juntos; nunca versões divergentes em regime permanente).
- **P2-3. `retryDlqJob` com colisão de `jobId`:** reusa `logId` como `jobId`; se a
  linha ainda está no histórico da principal (`removeOnComplete:500`), o `add` é
  **silenciosamente ignorado** e o retry se perde. Usar `jobId` único no retry.
- **P2-4. Proliferação/heterogeneidade de conexões ioredis:** cada módulo abre as
  suas, com opções divergentes (probe sem `maxRetriesPerRequest`, sem
  `retryStrategy` padronizado). Centralizar num factory com opções canônicas
  (`maxRetriesPerRequest`, `retryStrategy`, `connectTimeout`, nome p/ logs).
- **P2-5. `operationalCounters` SCAN + GET por chave (N+1):** cacheado 15s e
  `/metrics` sem auth — aceitável hoje; trocar por `pipeline`/`MGET` antes de
  escalar shards.

## 4. Ordem de execução recomendada

1. **P0-1 + P0-2** (freshness/TTL de comando + drenagem no boot + idempotência) — ataca diretamente os incidentes pós-migração. Validar em staging com teste de aceitação: matar supervisor com `SEND_BROADCAST` em vôo e confirmar que **não** há reenvio.
2. **P1-1** (corrigir comentário) — trivial, evita regressão futura.
3. **P1-3** (`REDIS_DEDUP_FAIL_MODE=closed` em prod) — config, baixo risco com validação.
4. **P1-4** (last-value de QR/status) — robustez do painel.
5. **P1-2** (refactor payload lazy → bullmq persistente) — maior esforço, maior retorno em durabilidade.
6. **P2-*** — higiene/observabilidade.

## 5. Testes de aceitação sugeridos (staging primeiro)

- Matar `bot-supervisor-staging` com comando em `active` → comando não reexecuta indevidamente.
- Enfileirar comando, derrubar API antes do `waitUntilFinished`, subir supervisor 1min depois → job **stale descartado**, não executado.
- Derrubar Redis durante envio com `REDIS_DEDUP_FAIL_MODE=closed` → mensagem some (recuperável), **sem duplicar**.
- DLQ: encher, `retryDlqJob` de um `logId` ainda no histórico → retry não some.
