# Origem "Fila · <nome>" nos logs de envio + renomear aba "Na fila" — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mensagens enviadas pelas filas de ofertas (/painel/filas) devem aparecer no histórico de /painel/envios com origem "Fila · <nome da fila>" (hoje aparecem como "Manual"), e a aba "Na fila" do histórico deve ser renomeada para "Em processamento" para não colidir com a funcionalidade Filas.

**Architecture:** O dispatcher das filas passa `source: 'offerQueue'` + `queueId` nas options do `sendBroadcast` (mesmo padrão já usado por `offerAutomation`). O bot-worker grava `sourceGroup = 'offerQueue:<queueId>'` no `MessageLog` (sem migration — `sourceGroup` é `String` livre). A rota `/api/logs` resolve o nome da fila em `sourceGroupName` (igual já faz com `groupMap`), sobrevivendo a rename da fila e degradando para "removida" se a fila for excluída. O painel desktop já renderiza `sourceGroupName` por fallback; o mobile ganha um caso explícito.

**Tech Stack:** Node.js ESM, `node --test`, Prisma/SQLite (sem mudança de schema), Fastify, Next.js (dashboard).

**Branch:** `claude/inspiring-mendel-3av4xw` (a partir de `develop`). PR ao final vai contra `develop`, nunca `main`.

**Fora de escopo:** mudar tabelas/schema; mexer na página /painel/filas; agregar itens de fila em "Próximos envios"; o rótulo "Na fila" de `UpcomingSends.js` (lá se refere a `ScheduledMessage.status='queued'` e o contexto é outro); bump de `PROTOCOL_VERSION` no supervisor (a mudança é aditiva dentro do objeto `options`, que já trafega íntegro por `src/supervisor/client.js:146`).

---

## Mapa de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/offerQueue/sourceTag.js` | Criar | Helper puro: monta/parseia o `sourceGroup` `offerQueue:<id>` e classifica options de broadcast |
| `test/offer-queue-source-tag.test.js` | Criar | Testes do helper |
| `src/offerQueue/dispatcher.js` | Modificar (linha 47) | Passar `source`/`queueId` no `sendBroadcast` |
| `test/offer-queue-dispatcher.test.js` | Modificar (teste da linha 31) | Asserir as novas options |
| `src/bot-worker.js` | Modificar (linha 2138) | Usar `broadcastSourceGroup(msg.options)` |
| `src/api/routes/logs.js` | Modificar (GET `/` e GET `/summary`) | Resolver `offerQueue:<id>` → `Fila · <nome>` |
| `dashboard/lib/painel/logsCopy.js` | Modificar | Renomear rótulos de `queued` |
| `dashboard/app/painel/envios/SendHistory.js` | Modificar | Fallback de rótulo "Fila" + copy do in-flight |
| `dashboard/lib/mobileLogs.js` | Modificar | Caso `offerQueue` no item mobile |
| `test/mobile-logs.test.js` | Modificar | Teste do caso mobile |

Contrato central (usado em todas as tasks): `sourceGroup` de broadcast vindo de fila = `` `offerQueue:${queueId}` ``. Rótulo exibido = `` `Fila · ${nome}` `` (fallback `Fila · removida` quando a fila não existe mais).

---

### Task 1: Helper `sourceTag` (puro, testável, fonte única do prefixo)

**Files:**
- Create: `src/offerQueue/sourceTag.js`
- Test: `test/offer-queue-source-tag.test.js`

- [ ] **Step 1: Escrever o teste que falha**

```js
// test/offer-queue-source-tag.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  OFFER_QUEUE_SOURCE_PREFIX,
  buildOfferQueueSource,
  parseOfferQueueSourceId,
  broadcastSourceGroup,
} from '../src/offerQueue/sourceTag.js'

test('buildOfferQueueSource e parseOfferQueueSourceId são inversos', () => {
  const source = buildOfferQueueSource('q123')
  assert.equal(source, 'offerQueue:q123')
  assert.equal(source.startsWith(OFFER_QUEUE_SOURCE_PREFIX), true)
  assert.equal(parseOfferQueueSourceId(source), 'q123')
})

test('parseOfferQueueSourceId rejeita valores que não são de fila', () => {
  assert.equal(parseOfferQueueSourceId('manual'), null)
  assert.equal(parseOfferQueueSourceId('offerAutomation'), null)
  assert.equal(parseOfferQueueSourceId('offerQueue:'), null)
  assert.equal(parseOfferQueueSourceId('123@g.us'), null)
  assert.equal(parseOfferQueueSourceId(null), null)
  assert.equal(parseOfferQueueSourceId(undefined), null)
})

test('broadcastSourceGroup classifica options de broadcast', () => {
  assert.equal(broadcastSourceGroup({ source: 'offerAutomation' }), 'offerAutomation')
  assert.equal(broadcastSourceGroup({ source: 'offerQueue', queueId: 'q1' }), 'offerQueue:q1')
  // offerQueue sem queueId não pode gerar prefixo órfão — cai em manual
  assert.equal(broadcastSourceGroup({ source: 'offerQueue' }), 'manual')
  assert.equal(broadcastSourceGroup({}), 'manual')
  assert.equal(broadcastSourceGroup(undefined), 'manual')
})
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `node --test test/offer-queue-source-tag.test.js`
Expected: FAIL — `Cannot find module '.../src/offerQueue/sourceTag.js'`

- [ ] **Step 3: Implementar o helper**

```js
// src/offerQueue/sourceTag.js
/* Fonte única do formato de MessageLog.sourceGroup para envios originados
 * das filas de ofertas: 'offerQueue:<queueId>'. Guardamos o ID (não o nome)
 * para sobreviver a renomes; a rota /api/logs resolve o nome na leitura. */

export const OFFER_QUEUE_SOURCE_PREFIX = 'offerQueue:'

export function buildOfferQueueSource(queueId) {
  return `${OFFER_QUEUE_SOURCE_PREFIX}${queueId}`
}

export function parseOfferQueueSourceId(sourceGroup) {
  if (typeof sourceGroup !== 'string' || !sourceGroup.startsWith(OFFER_QUEUE_SOURCE_PREFIX)) return null
  const id = sourceGroup.slice(OFFER_QUEUE_SOURCE_PREFIX.length)
  return id || null
}

export function broadcastSourceGroup(options) {
  if (options?.source === 'offerAutomation') return 'offerAutomation'
  if (options?.source === 'offerQueue' && options.queueId) return buildOfferQueueSource(options.queueId)
  return 'manual'
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `node --test test/offer-queue-source-tag.test.js`
Expected: PASS (3 testes)

- [ ] **Step 5: Commit**

```bash
git add src/offerQueue/sourceTag.js test/offer-queue-source-tag.test.js
git commit -m "feat(offer-queue): helper sourceTag para identificar origem de fila no MessageLog"
```

---

### Task 2: Dispatcher passa a origem no `sendBroadcast`

**Files:**
- Modify: `src/offerQueue/dispatcher.js:47`
- Test: `test/offer-queue-dispatcher.test.js:31-39`

- [ ] **Step 1: Estender o teste existente (falha primeiro)**

No teste `'drainQueueOnce envia um item FIFO com receita de imagem e marca sucesso'`, adicionar duas asserções após a linha `assert.equal(calls.sent[0][3].imageUrl, ...)`:

```js
test('drainQueueOnce envia um item FIFO com receita de imagem e marca sucesso', async () => {
  const { queue, calls, deps } = setup()
  const result = await drainQueueOnce(queue, deps)
  assert.deepEqual(result, { sent: 'i1' })
  assert.equal(calls.sent.length, 1)
  assert.deepEqual(calls.sent[0][2], ['grupo@g.us'])
  assert.equal(calls.sent[0][3].imageUrl, 'https://img.test/item.jpg')
  assert.equal(calls.sent[0][3].source, 'offerQueue')
  assert.equal(calls.sent[0][3].queueId, 'q1')
  assert.equal(calls.transaction.length, 2)
})
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `node --test test/offer-queue-dispatcher.test.js`
Expected: FAIL — `source` é `undefined`

- [ ] **Step 3: Implementar no dispatcher**

Em `src/offerQueue/dispatcher.js`, trocar a linha 47:

```js
// antes
await sendBroadcast(queue.userId, item.text, JSON.parse(item.targetJids), { imageUrl: item.imageUrl ?? undefined, imageRefererUrl: item.imageRefererUrl ?? undefined })
// depois
await sendBroadcast(queue.userId, item.text, JSON.parse(item.targetJids), { imageUrl: item.imageUrl ?? undefined, imageRefererUrl: item.imageRefererUrl ?? undefined, source: 'offerQueue', queueId: queue.id })
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `node --test test/offer-queue-dispatcher.test.js`
Expected: PASS (todos os testes do arquivo)

- [ ] **Step 5: Commit**

```bash
git add src/offerQueue/dispatcher.js test/offer-queue-dispatcher.test.js
git commit -m "feat(offer-queue): dispatcher identifica fila de origem no sendBroadcast"
```

---

### Task 3: bot-worker grava `sourceGroup` da fila no MessageLog

**Files:**
- Modify: `src/bot-worker.js:2138` (handler `msg?.type === 'broadcast'`) + bloco de imports no topo

Nota: `src/bot-worker.js` não tem teste unitário próprio para este handler (ele sobe socket Baileys); a lógica nova vive em `broadcastSourceGroup`, já coberta pela Task 1. Aqui é só a troca da expressão inline pelo helper. As options chegam intactas nos dois modos (`inline`: `src/core/sessionCore.js:128` envia `{ text, jids, options }` via IPC; `remote`: `src/supervisor/client.js:146` envia o mesmo shape via BullMQ — mudança aditiva, sem bump de `PROTOCOL_VERSION`).

- [ ] **Step 1: Adicionar o import**

No topo de `src/bot-worker.js`, junto aos demais imports de `./` (procurar o bloco existente de imports relativos):

```js
import { broadcastSourceGroup } from './offerQueue/sourceTag.js'
```

- [ ] **Step 2: Trocar a expressão inline pelo helper**

Em `src/bot-worker.js:2138`:

```js
// antes
sourceGroup: msg.options?.source === 'offerAutomation' ? 'offerAutomation' : 'manual',
// depois
sourceGroup: broadcastSourceGroup(msg.options),
```

- [ ] **Step 3: Verificar que o worker ainda parseia (sem subir socket)**

Run: `node --check src/bot-worker.js`
Expected: sem saída, exit code 0

- [ ] **Step 4: Rodar a suíte para garantir que nada regrediu**

Run: `node --test test/`
Expected: PASS em tudo (mesma contagem de antes; nenhum teste novo aqui)

- [ ] **Step 5: Commit**

```bash
git add src/bot-worker.js
git commit -m "feat(bot-worker): registra fila de origem no sourceGroup de broadcasts"
```

---

### Task 4: Rota `/api/logs` resolve nome da fila em `sourceGroupName`

**Files:**
- Modify: `src/api/routes/logs.js` (handler GET `/` linhas ~52-142 e GET `/summary` linhas ~243-256)

Nota: `logsRoutes` importa `db` direto (sem injeção como `offerQueueRoutes`), então não há teste de rota viável sem refactor — fora de escopo. O parsing está coberto pela Task 1; a resolução de nome será validada manualmente em staging (Task 7). Não introduzir refactor de injeção aqui (YAGNI).

- [ ] **Step 1: Adicionar import no topo de `src/api/routes/logs.js`**

```js
import { parseOfferQueueSourceId } from '../../offerQueue/sourceTag.js'
```

- [ ] **Step 2: GET `/` — resolver nomes de fila no mapeamento dos logs**

Substituir o bloco de retorno (linhas 131-142). O lookup roda **depois** do `findMany` e só busca as filas que de fato aparecem na página (≤100 linhas → consulta pequena por `id IN (...)`, escopada por `userId`):

```js
    const queueIds = [...new Set(logs.map((log) => parseOfferQueueSourceId(log.sourceGroup)).filter(Boolean))]
    const queueNameMap = queueIds.length
      ? Object.fromEntries(
          (await db.offerQueue.findMany({ where: { userId, id: { in: queueIds } }, select: { id: true, name: true } }))
            .map((queue) => [queue.id, queue.name]),
        )
      : {}

    const sourceGroupNameFor = (sourceGroup) => {
      if (sourceGroup === 'offerAutomation') return 'Oferta automática'
      const queueId = parseOfferQueueSourceId(sourceGroup)
      if (queueId) return `Fila · ${queueNameMap[queueId] || 'removida'}`
      return groupMap[sourceGroup] || sourceGroup
    }

    return {
      total,
      page: pageNum,
      limit: limitNum,
      statusCounts,
      statusCountsTotal,
      logs: logs.map(log => ({
        ...log,
        sourceGroupName: sourceGroupNameFor(log.sourceGroup),
        destGroupName: groupMap[log.destGroup] || log.destGroup,
      })),
    }
```

(A linha antiga `sourceGroupName: log.sourceGroup === 'offerAutomation' ? ... : (groupMap[...] || ...)` é absorvida por `sourceGroupNameFor`.)

- [ ] **Step 3: GET `/` — busca textual encontra logs pelo nome da fila**

No mesmo handler, o `searchWhere` (linhas 73-91) já cobre `sourceGroup contains query`, mas o usuário busca pelo **nome** da fila, não pelo ID. Logo após a construção de `matchingGroupJids` (linha 71), adicionar:

```js
    const matchingQueueSources = query
      ? (await db.offerQueue.findMany({ where: { userId, name: { contains: query } }, select: { id: true } }))
          .map((queue) => `offerQueue:${queue.id}`)
      : []
```

E dentro do `OR` do `searchWhere`, junto aos spreads existentes:

```js
            ...(matchingQueueSources.length ? [{ sourceGroup: { in: matchingQueueSources } }] : []),
```

- [ ] **Step 4: GET `/summary` — `topSources` com nome de fila**

Substituir as linhas 243-251 (resolução de nomes dos top lists):

```js
    // Resolve nomes amigáveis dos grupos e filas para os top lists.
    const groups = await db.group.findMany({ where: { userId } })
    const groupMap = Object.fromEntries(groups.map(g => [g.waJid, g.name]))
    const summaryQueueIds = [...new Set(Array.from(sourceAgg.keys()).map((key) => parseOfferQueueSourceId(key)).filter(Boolean))]
    const summaryQueueNames = summaryQueueIds.length
      ? Object.fromEntries(
          (await db.offerQueue.findMany({ where: { userId, id: { in: summaryQueueIds } }, select: { id: true, name: true } }))
            .map((queue) => [queue.id, queue.name]),
        )
      : {}
    const nameFor = (jid) => {
      if (jid === 'offerAutomation') return 'Oferta automática'
      const queueId = parseOfferQueueSourceId(jid)
      if (queueId) return `Fila · ${summaryQueueNames[queueId] || 'removida'}`
      return groupMap[jid] || jid
    }
```

(`topSources`/`topDestinations` nas linhas seguintes continuam usando `nameFor` sem mudança.)

- [ ] **Step 5: Verificar sintaxe e suíte**

Run: `node --check src/api/routes/logs.js && node --test test/`
Expected: exit 0 e suíte verde

- [ ] **Step 6: Commit**

```bash
git add src/api/routes/logs.js
git commit -m "feat(logs): resolve nome da fila de ofertas em sourceGroupName e na busca"
```

---

### Task 5: Painel desktop — rótulo "Fila · nome" e renomear aba "Na fila"

**Files:**
- Modify: `dashboard/lib/painel/logsCopy.js:37-52`
- Modify: `dashboard/app/painel/envios/SendHistory.js:24-29` e `:167`
- Modify: `src/api/routes/logs.js:53-60` (alias de busca por status)

Não há testes de componente para essas duas UIs (padrão do repo: páginas do painel sem teste unitário; QA manual em staging). Mudanças são de copy/rótulo.

- [ ] **Step 1: Renomear rótulos de `queued` em `logsCopy.js`**

```js
export const STATUS_TAG = {
  success: { cls: 'is-success', label: 'enviado' },
  error: { cls: 'is-error', label: 'falhou' },
  skipped: { cls: 'is-skip', label: 'ignorado' },
  queued: { cls: 'is-flight', label: 'em processamento' },
  sending: { cls: 'is-flight', label: 'enviando' },
}

export const STATUS_TABS = [
  ['all', 'Todos'],
  ['success', 'Enviados'],
  ['skipped', 'Ignorados'],
  ['error', 'Falhas'],
  ['queued', 'Em processamento'],
  ['sending', 'Enviando'],
]
```

- [ ] **Step 2: `logOriginLabel` reconhece fila em `SendHistory.js`**

A rota já devolve `sourceGroupName = 'Fila · <nome>'` (cai no fallback da última linha), mas o caso explícito protege contra resposta sem `sourceGroupName` (ex.: erro parcial) e documenta o contrato:

```js
function logOriginLabel(log) {
  if (log?.sourceGroup === 'offerAutomation') return 'Oferta automática'
  if (typeof log?.sourceGroup === 'string' && log.sourceGroup.startsWith('offerQueue:')) return log.sourceGroupName || 'Fila'
  if (log?.sourceGroup === 'manual') return 'Manual'
  if (log?.sourceGroup === 'scheduled') return 'Agendamento'
  return log?.sourceGroupName || log?.sourceGroup || '—'
}
```

- [ ] **Step 3: Copy do contador in-flight em `SendHistory.js:167`**

```js
// antes
{inFlight > 0 && <p className="pnl-card-note" style={{ marginTop: 12 }}>{inFlight} {inFlight === 1 ? 'mensagem' : 'mensagens'} em vôo (na fila/enviando).</p>}
// depois
{inFlight > 0 && <p className="pnl-card-note" style={{ marginTop: 12 }}>{inFlight} {inFlight === 1 ? 'mensagem' : 'mensagens'} em vôo (em processamento/enviando).</p>}
```

- [ ] **Step 4: Alias de busca por status na API**

Em `src/api/routes/logs.js:53-60`, o usuário que digitar "processamento" na busca precisa encontrar `queued` (e "fila" continua funcionando para histórico/hábito):

```js
    const statusSearchMap = {
      sucesso: 'success',
      enviado: 'success',
      erro: 'error',
      falha: 'error',
      fila: 'queued',
      processamento: 'queued',
      enviando: 'sending',
    }
```

- [ ] **Step 5: Build do dashboard para validar**

Run: `cd dashboard && npm run build` (voltar com `cd ..`)
Expected: build verde, sem erro de lint/compilação

- [ ] **Step 6: Commit**

```bash
git add dashboard/lib/painel/logsCopy.js dashboard/app/painel/envios/SendHistory.js src/api/routes/logs.js
git commit -m "feat(painel): origem 'Fila · nome' no histórico e aba 'Na fila' vira 'Em processamento'"
```

---

### Task 6: Visão mobile dos logs reconhece origem de fila

**Files:**
- Modify: `dashboard/lib/mobileLogs.js:42-48` e `:97-118`
- Test: `test/mobile-logs.test.js`

Sem o caso explícito, `offerQueue:<id>` não contém `@` → `isRealMobileLogGroup` retorna false → o item cairia em `source: 'manual'` com `de: 'Você criou'` (errado).

- [ ] **Step 1: Escrever o teste que falha**

Adicionar em `test/mobile-logs.test.js`:

```js
test('log mobile de fila de ofertas mostra origem Fila com nome resolvido', () => {
  const item = toMobileLogItem({
    id: '9',
    status: 'success',
    sentAt: '2026-06-11T10:00:00.000Z',
    messageText: 'Oferta da fila',
    platform: 'amazon',
    sourceGroup: 'offerQueue:q1',
    sourceGroupName: 'Fila · Relâmpago',
    destGroup: '123@g.us',
    destGroupName: 'Grupo VIP',
    originalUrl: 'https://amazon.test/p',
    convertedUrl: 'https://amzn.to/x',
  }, new Date('2026-06-11T12:00:00.000Z'))

  assert.equal(item.source, 'offerQueue')
  assert.equal(item.de, 'Fila · Relâmpago')
  assert.equal(item.para, 'Grupo VIP')
})

test('log mobile de fila sem nome resolvido degrada para rótulo Fila', () => {
  const item = toMobileLogItem({
    id: '10',
    status: 'success',
    sentAt: '2026-06-11T10:00:00.000Z',
    messageText: 'Oferta da fila',
    platform: 'amazon',
    sourceGroup: 'offerQueue:q1',
    destGroup: '123@g.us',
    originalUrl: 'https://amazon.test/p',
  }, new Date('2026-06-11T12:00:00.000Z'))

  assert.equal(item.source, 'offerQueue')
  assert.equal(item.de, 'Fila')
})
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `node --test test/mobile-logs.test.js`
Expected: FAIL — `item.source` é `'manual'` e `item.de` é `'Você criou'`

- [ ] **Step 3: Implementar em `dashboard/lib/mobileLogs.js`**

Logo após `isOfferAutomationLog` (linha 44), adicionar:

```js
export function isOfferQueueLog(log = {}) {
  return typeof log?.sourceGroup === 'string' && log.sourceGroup.startsWith('offerQueue:')
}
```

Em `toMobileLogItem`, trocar as linhas 102 e 111:

```js
// linha 102 — antes
const source = isOfferAutomationLog(log) ? 'offerAutomation' : (isRealMobileLogGroup(log.sourceGroup) ? 'auto' : 'manual')
// depois
const source = isOfferAutomationLog(log) ? 'offerAutomation' : isOfferQueueLog(log) ? 'offerQueue' : (isRealMobileLogGroup(log.sourceGroup) ? 'auto' : 'manual')
```

```js
// linha 111 — antes
de: source === 'offerAutomation' ? 'Oferta automática' : (source === 'auto' ? (log.sourceGroupName || log.sourceGroup) : 'Você criou'),
// depois
de: source === 'offerAutomation' ? 'Oferta automática' : source === 'offerQueue' ? (log.sourceGroupName || 'Fila') : (source === 'auto' ? (log.sourceGroupName || log.sourceGroup) : 'Você criou'),
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `node --test test/mobile-logs.test.js`
Expected: PASS (testes antigos + 2 novos)

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/mobileLogs.js test/mobile-logs.test.js
git commit -m "feat(mobile): logs reconhecem origem de fila de ofertas"
```

---

### Task 7: Verificação final, push e validação em staging

**Files:** nenhum novo.

- [ ] **Step 1: Suíte completa**

Run: `node --test test/`
Expected: tudo verde (incluindo `test/offer-queue-source-tag.test.js`, `test/offer-queue-dispatcher.test.js`, `test/mobile-logs.test.js`)

- [ ] **Step 2: Build do dashboard (se ainda não rodou após a Task 6)**

Run: `cd dashboard && npm run guard:config-page && npm run build && cd ..`
Expected: verde

- [ ] **Step 3: Push da branch**

```bash
git push -u origin claude/inspiring-mendel-3av4xw
```

(Se falhar por rede, retry com backoff 2s/4s/8s/16s.)

- [ ] **Step 4: PR contra `develop`** (somente com aprovação da usuária — fluxo canônico do repo)

- [ ] **Step 5: QA manual em staging (`http://178.105.54.0:3006`) após o autodeploy**

Roteiro:
1. Criar uma fila em /painel/filas com nome reconhecível (ex.: "Fila QA"), adicionar 1 item via "Adicionar itens", ativar a fila com bot conectado.
2. Em /painel/envios (Histórico), confirmar que a linha do envio mostra origem **"Fila · Fila QA"** (não "Manual").
3. Conferir a aba renomeada **"Em processamento"** (antes "Na fila") e a tag das linhas em vôo.
4. Buscar "Fila QA" no campo de busca → a linha do envio deve aparecer.
5. Renomear a fila e recarregar o histórico → rótulo acompanha o novo nome. Excluir a fila → rótulo vira "Fila · removida".
6. No card Resumo, com envios de fila no período, `topSources` (se exibido) mostra o nome da fila.

**Observação de compatibilidade:** logs antigos de fila (gravados antes desta mudança) continuam como `sourceGroup: 'manual'` — sem backfill (não há como saber de qual fila vieram). Só envios novos ganham o rótulo.

---

## Self-Review (executada)

- **Cobertura do spec:** origem "Fila" com nome da fila → Tasks 1-4 (gravação + resolução) e 5-6 (exibição desktop/mobile); rename da aba → Task 5. ✔
- **Placeholders:** nenhum "TBD"/"similar à Task N"; todo step com código tem o código. ✔
- **Consistência de tipos/nomes:** `buildOfferQueueSource`/`parseOfferQueueSourceId`/`broadcastSourceGroup` usados com a mesma assinatura nas Tasks 1, 2, 3 e 4; prefixo `offerQueue:` idêntico no server e nos dois pontos do dashboard (dashboard não importa de `src/` — pacote separado — por isso o prefixo aparece literal em `SendHistory.js` e `mobileLogs.js`). ✔
