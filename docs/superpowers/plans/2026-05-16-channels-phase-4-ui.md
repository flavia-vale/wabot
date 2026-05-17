# Channels Phase 4 — UI no Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir cadastro e gerenciamento de canais (`@newsletter`) no dashboard com mesma UX de grupos, com badges de status (follow / admin), modal de cadastro via link de convite + lista de seguidos + JID manual, e follow imediato via IPC.

**Architecture:** Reusa o padrão IPC bidirecional existente em `sessionCore.js` (`requestWithTimeout` + handler `process.on('message')` no worker). Lógica de chamadas Baileys vive em `src/core/channelDirectory.js` (puro, sock injetado). Worker registra handlers IPC novos (`channel:metadata`, `channel:follow`, `channel:listFollowed`). API ganha 4 rotas. Dashboard ganha modal + badges + filtro.

**Tech Stack:** Node.js (ESM), Fastify, Prisma, Baileys 6.7.16, Next.js (App Router), Tailwind. Testes com `node:test`.

**Branch:** `feat/channels-phase-4-ui` (já existe, PR #496 aberta).
**Spec:** `docs/superpowers/specs/2026-05-16-channels-phase-4-ui-design.md`.

**Pré-requisitos mergeados em develop:** Fase 1 (`src/core/jid.js`, `Group.kind`), Fase 2 (`subscribeToMonitorChannels`), Fase 3 (`src/core/channelSend.js`).

---

## File Structure

**Novos arquivos**:
- `src/core/channelDirectory.js` — funções puras que recebem `sock`. Responsabilidade: metadata, follow imediato, lista de seguidos. Sem side-effects globais.
- `test/core/channelDirectory.test.js` — unitários do channelDirectory.
- `test/api/routes/groups.channel.test.js` — unitários das rotas novas.
- `dashboard/components/AddChannelModal.js` — modal com 3 abas.
- `dashboard/components/ChannelStatusBadges.js` — badges de tipo, follow, admin.

**Arquivos modificados**:
- `src/bot-worker.js` — handlers IPC para `channel:metadata`, `channel:follow`, `channel:listFollowed` no bloco `process.on('message')`.
- `src/core/sessionCore.js` — exports `channelMetadata(userId, ...)`, `followChannel(userId, jid)`, `listFollowedChannels(userId)`.
- `src/manager.js` — re-exports.
- `src/api/routes/groups.js` — 4 rotas novas: `POST /resolve-channel-invite`, `POST /:id/follow-now`, `POST /:id/refresh-admin`, `GET /wa/channels` (a última pode ir em `groups.js` mesmo, mesma autenticação).
- `dashboard/lib/api.js` — métodos novos do client.
- `dashboard/app/dashboard/grupos/page.js` — integrar modal, badges, filtro, banner.
- `dashboard/app/dashboard/DashboardClientLayout.js` (se necessário) — renomear item do menu "Grupos" → "Grupos e Canais".

---

## Task 1: `channelDirectory.getChannelMetadata` — função pura

**Files:**
- Create: `src/core/channelDirectory.js`
- Test: `test/core/channelDirectory.test.js`

- [ ] **Step 1: Write the failing tests**

Create `test/core/channelDirectory.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getChannelMetadata } from '../../src/core/channelDirectory.js'

function makeSock({ user = { id: '5511999999999:1@s.whatsapp.net' }, newsletterMetadata } = {}) {
  return { user, newsletterMetadata }
}

test('getChannelMetadata por jid retorna formato normalizado', async () => {
  const sock = makeSock({
    newsletterMetadata: async (type, key) => {
      assert.equal(type, 'jid')
      assert.equal(key, '123abc@newsletter')
      return { id: '123abc@newsletter', name: 'Canal X', owner: '5511999999999@s.whatsapp.net' }
    },
  })
  const result = await getChannelMetadata({ sock, jid: '123abc@newsletter' })
  assert.deepEqual(result, {
    jid: '123abc@newsletter',
    name: 'Canal X',
    owner: '5511999999999@s.whatsapp.net',
    isViewerOwner: true,
    picture: null,
  })
})

test('getChannelMetadata por inviteCode chama newsletterMetadata("invite", code)', async () => {
  const sock = makeSock({
    newsletterMetadata: async (type, key) => {
      assert.equal(type, 'invite')
      assert.equal(key, '0029Va123')
      return { id: 'xyz@newsletter', name: 'Outro', owner: 'someone@s.whatsapp.net' }
    },
  })
  const result = await getChannelMetadata({ sock, inviteCode: '0029Va123' })
  assert.equal(result.jid, 'xyz@newsletter')
  assert.equal(result.isViewerOwner, false)
})

test('getChannelMetadata normaliza owner com :device suffix do user atual', async () => {
  const sock = makeSock({
    user: { id: '5511999999999:7@s.whatsapp.net' },
    newsletterMetadata: async () => ({ id: 'a@newsletter', name: 'A', owner: '5511999999999@s.whatsapp.net' }),
  })
  const result = await getChannelMetadata({ sock, jid: 'a@newsletter' })
  assert.equal(result.isViewerOwner, true)
})

test('getChannelMetadata retorna null quando newsletterMetadata retorna null', async () => {
  const sock = makeSock({ newsletterMetadata: async () => null })
  const result = await getChannelMetadata({ sock, jid: 'a@newsletter' })
  assert.equal(result, null)
})

test('getChannelMetadata propaga erro do Baileys', async () => {
  const sock = makeSock({ newsletterMetadata: async () => { throw new Error('not-found') } })
  await assert.rejects(
    () => getChannelMetadata({ sock, jid: 'a@newsletter' }),
    /not-found/,
  )
})

test('getChannelMetadata exige jid OU inviteCode', async () => {
  const sock = makeSock({ newsletterMetadata: async () => ({}) })
  await assert.rejects(
    () => getChannelMetadata({ sock }),
    /jid ou inviteCode/,
  )
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/core/channelDirectory.test.js`
Expected: FAIL — `Cannot find module '.../channelDirectory.js'`.

- [ ] **Step 3: Implement `getChannelMetadata`**

Create `src/core/channelDirectory.js`:

```js
// Helpers puros pra interagir com canais via Baileys.
// sock é injetado — sem singleton, fácil de testar.

function normalizeJid(jid) {
  if (typeof jid !== 'string') return ''
  // remove device suffix (":N") antes do "@" pra comparar owner com user atual
  return jid.replace(/:\d+(?=@)/, '')
}

// Retorna { jid, name, owner, isViewerOwner, picture } ou null se WA não achou.
// Propaga erro do Baileys (rede, autenticação, etc).
export async function getChannelMetadata({ sock, jid, inviteCode }) {
  if (!jid && !inviteCode) throw new Error('getChannelMetadata: jid ou inviteCode obrigatório')
  if (!sock?.newsletterMetadata) throw new Error('getChannelMetadata: sock.newsletterMetadata indisponível')

  const meta = jid
    ? await sock.newsletterMetadata('jid', jid)
    : await sock.newsletterMetadata('invite', inviteCode)

  if (!meta) return null

  const owner = meta.owner ?? null
  const viewerId = normalizeJid(sock?.user?.id)
  const ownerNorm = normalizeJid(owner)
  const isViewerOwner = Boolean(owner && viewerId && ownerNorm === viewerId)

  return {
    jid: meta.id,
    name: meta.name ?? '',
    owner,
    isViewerOwner,
    picture: meta.picture?.url ?? null,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/core/channelDirectory.test.js`
Expected: 6/6 pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/channelDirectory.js test/core/channelDirectory.test.js
git commit -m "feat(channels): channelDirectory.getChannelMetadata — resolve via jid|inviteCode"
```

---

## Task 2: `channelDirectory.followChannel` — follow imediato idempotente

**Files:**
- Modify: `src/core/channelDirectory.js`
- Test: `test/core/channelDirectory.test.js`

- [ ] **Step 1: Add failing tests**

Append to `test/core/channelDirectory.test.js`:

```js
import { followChannel } from '../../src/core/channelDirectory.js'

test('followChannel chama newsletterFollow e marca followedSet', async () => {
  const calls = []
  const sock = {
    newsletterFollow: async (jid) => { calls.push(['follow', jid]) },
    subscribeNewsletterUpdates: async (jid) => { calls.push(['sub', jid]); return { duration: 86400 } },
  }
  const followedSet = new Set()
  const inFlight = new Set()
  const result = await followChannel({ sock, jid: 'a@newsletter', followedSet, inFlight })
  assert.deepEqual(result, { followed: 'new', duration: 86400 })
  assert.ok(followedSet.has('a@newsletter'))
  assert.equal(inFlight.has('a@newsletter'), false)
  assert.deepEqual(calls, [['follow', 'a@newsletter'], ['sub', 'a@newsletter']])
})

test('followChannel é idempotente — já seguido retorna "already" sem chamar Baileys', async () => {
  let called = false
  const sock = { newsletterFollow: async () => { called = true } }
  const followedSet = new Set(['a@newsletter'])
  const result = await followChannel({ sock, jid: 'a@newsletter', followedSet, inFlight: new Set() })
  assert.deepEqual(result, { followed: 'already' })
  assert.equal(called, false)
})

test('followChannel detecta concorrência via inFlight e aguarda sem duplicar chamada', async () => {
  let calls = 0
  const sock = {
    newsletterFollow: async () => { calls++ },
    subscribeNewsletterUpdates: async () => ({ duration: 0 }),
  }
  const followedSet = new Set()
  const inFlight = new Set()
  const [a, b] = await Promise.all([
    followChannel({ sock, jid: 'a@newsletter', followedSet, inFlight }),
    followChannel({ sock, jid: 'a@newsletter', followedSet, inFlight }),
  ])
  assert.equal(calls, 1, 'apenas uma chamada efetiva ao newsletterFollow')
  // O segundo deve ver inFlight e retornar 'in-flight' (ou 'already' após o primeiro terminar)
  const outcomes = [a.followed, b.followed].sort()
  assert.deepEqual(outcomes, ['in-flight', 'new'])
})

test('followChannel propaga erro de newsletterFollow e remove de inFlight', async () => {
  const sock = { newsletterFollow: async () => { throw new Error('forbidden') } }
  const inFlight = new Set()
  await assert.rejects(
    () => followChannel({ sock, jid: 'a@newsletter', followedSet: new Set(), inFlight }),
    /forbidden/,
  )
  assert.equal(inFlight.has('a@newsletter'), false, 'inFlight limpo mesmo em erro')
})

test('followChannel funciona quando subscribeNewsletterUpdates falha — só warn', async () => {
  const sock = {
    newsletterFollow: async () => {},
    subscribeNewsletterUpdates: async () => { throw new Error('subscribe-failed') },
  }
  const followedSet = new Set()
  const result = await followChannel({ sock, jid: 'a@newsletter', followedSet, inFlight: new Set() })
  assert.equal(result.followed, 'new')
  assert.equal(result.duration, null)
  assert.ok(followedSet.has('a@newsletter'))
})
```

- [ ] **Step 2: Run tests, expect failures**

Run: `node --test test/core/channelDirectory.test.js`
Expected: 5 novos testes FAIL — `followChannel is not a function`.

- [ ] **Step 3: Implement `followChannel`**

Append to `src/core/channelDirectory.js`:

```js
// Follow imediato idempotente. Reusa contratos de followedSet/inFlight da Fase 2.
// Retorna:
//  - { followed: 'already' } se já estava em followedSet
//  - { followed: 'in-flight' } se outra invocação já está processando (concorrência)
//  - { followed: 'new', duration } após follow+subscribe ok
// Propaga erro do newsletterFollow. subscribeNewsletterUpdates falhar não falha o todo.
export async function followChannel({ sock, jid, followedSet, inFlight, logger }) {
  if (!sock?.newsletterFollow) throw new Error('followChannel: sock.newsletterFollow indisponível')
  if (!jid) throw new Error('followChannel: jid obrigatório')
  if (followedSet?.has(jid)) return { followed: 'already' }
  if (inFlight?.has(jid)) return { followed: 'in-flight' }

  inFlight?.add(jid)
  try {
    await sock.newsletterFollow(jid)
    let duration = null
    try {
      const sub = await sock.subscribeNewsletterUpdates?.(jid)
      duration = sub?.duration ?? null
    } catch (err) {
      logger?.warn?.({ jid, err: err?.message }, 'followChannel: subscribe falhou; follow ok')
    }
    followedSet?.add(jid)
    return { followed: 'new', duration }
  } finally {
    inFlight?.delete(jid)
  }
}
```

- [ ] **Step 4: Run tests**

Run: `node --test test/core/channelDirectory.test.js`
Expected: 11/11 pass (6 anteriores + 5 novos).

- [ ] **Step 5: Commit**

```bash
git add src/core/channelDirectory.js test/core/channelDirectory.test.js
git commit -m "feat(channels): channelDirectory.followChannel — follow imediato idempotente"
```

---

## Task 3: `channelDirectory.listFollowedChannels` — lista a partir de followedSet

**Files:**
- Modify: `src/core/channelDirectory.js`
- Test: `test/core/channelDirectory.test.js`

- [ ] **Step 1: Add failing tests**

Append to `test/core/channelDirectory.test.js`:

```js
import { listFollowedChannels } from '../../src/core/channelDirectory.js'

test('listFollowedChannels resolve metadata em paralelo a partir de followedSet', async () => {
  const sock = {
    user: { id: 'me@s.whatsapp.net' },
    newsletterMetadata: async (type, key) => {
      assert.equal(type, 'jid')
      return { id: key, name: `Nome ${key}`, owner: 'me@s.whatsapp.net' }
    },
  }
  const followedSet = new Set(['a@newsletter', 'b@newsletter', 'c@newsletter'])
  const result = await listFollowedChannels({ sock, followedSet, concurrency: 2 })
  assert.equal(result.length, 3)
  assert.deepEqual(result.map(r => r.jid).sort(), ['a@newsletter', 'b@newsletter', 'c@newsletter'])
  for (const r of result) assert.equal(r.isViewerOwner, true)
})

test('listFollowedChannels tolera falha parcial — item com erro vira null', async () => {
  const sock = {
    user: { id: 'me@s.whatsapp.net' },
    newsletterMetadata: async (type, key) => {
      if (key === 'b@newsletter') throw new Error('boom')
      return { id: key, name: 'X', owner: 'someone@s.whatsapp.net' }
    },
  }
  const followedSet = new Set(['a@newsletter', 'b@newsletter'])
  const result = await listFollowedChannels({ sock, followedSet, concurrency: 5 })
  assert.equal(result.length, 1, 'item com erro é descartado')
  assert.equal(result[0].jid, 'a@newsletter')
})

test('listFollowedChannels com followedSet vazio retorna []', async () => {
  const sock = { newsletterMetadata: async () => { throw new Error('should-not-call') } }
  const result = await listFollowedChannels({ sock, followedSet: new Set() })
  assert.deepEqual(result, [])
})
```

- [ ] **Step 2: Run tests, expect failures**

Run: `node --test test/core/channelDirectory.test.js`
Expected: 3 novos FAIL — `listFollowedChannels is not a function`.

- [ ] **Step 3: Implement `listFollowedChannels`**

Append to `src/core/channelDirectory.js`:

```js
async function mapParallel(items, concurrency, fn) {
  const result = new Array(items.length)
  let next = 0
  async function worker() {
    while (true) {
      const i = next++
      if (i >= items.length) return
      try { result[i] = await fn(items[i]) } catch { result[i] = null }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  return result
}

// Lista canais já seguidos com metadata resolvida em paralelo limitado.
// Itens que falharem ao buscar metadata são descartados (sem quebrar a lista toda).
export async function listFollowedChannels({ sock, followedSet, concurrency = 5 }) {
  if (!followedSet || followedSet.size === 0) return []
  const jids = [...followedSet]
  const items = await mapParallel(jids, concurrency, async (jid) => {
    return getChannelMetadata({ sock, jid })
  })
  return items.filter(Boolean)
}
```

- [ ] **Step 4: Run tests**

Run: `node --test test/core/channelDirectory.test.js`
Expected: 14/14 pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/channelDirectory.js test/core/channelDirectory.test.js
git commit -m "feat(channels): channelDirectory.listFollowedChannels — paralelo limitado tolerante a falha"
```

---

## Task 4: Worker IPC handlers (`channel:metadata`, `channel:follow`, `channel:listFollowed`)

**Files:**
- Modify: `src/bot-worker.js` (bloco `process.on('message')` ~linha 1316)
- Test: manual (integração coberta via test da Task 5 + smoke em staging)

- [ ] **Step 1: Localizar o dispatcher**

Read `src/bot-worker.js` linhas 1316-1430 pra ver os handlers existentes (`listGroups`, `metrics`, `broadcast`, `requestPairingCode`). Eles seguem o padrão:
```js
if (msg?.type === 'XXX') {
  if (!activeSock) {
    process.send({ type: 'XXXResult', requestId: msg.requestId, error: 'Bot não conectado' })
    return
  }
  try {
    const data = await ...
    process.send({ type: 'XXXResult', requestId: msg.requestId, data })
  } catch (err) {
    process.send({ type: 'XXXResult', requestId: msg.requestId, error: err.message })
  }
}
```

- [ ] **Step 2: Add import for channelDirectory at top of bot-worker.js**

Find a near-existing import like `import { subscribeToMonitorChannels } from './core/channels.js'` (linha 27).

Replace it with:
```js
import { subscribeToMonitorChannels } from './core/channels.js'
import { getChannelMetadata, followChannel, listFollowedChannels } from './core/channelDirectory.js'
```

- [ ] **Step 3: Add three handlers inside `process.on('message')`**

Locate the existing `if (msg?.type === 'broadcast') { ... }` block (around line 1382). After it (still inside the `process.on('message')` arrow), insert:

```js
  if (msg?.type === 'channel:metadata') {
    if (!activeSock) {
      process.send({ type: 'channel:metadataResult', requestId: msg.requestId, error: 'Bot não conectado' })
      return
    }
    try {
      const data = await getChannelMetadata({
        sock: activeSock,
        jid: msg.jid,
        inviteCode: msg.inviteCode,
      })
      process.send({ type: 'channel:metadataResult', requestId: msg.requestId, data })
    } catch (err) {
      logger.warn({ err: err?.message, jid: msg.jid, inviteCode: msg.inviteCode }, 'channel:metadata falhou')
      process.send({ type: 'channel:metadataResult', requestId: msg.requestId, error: err.message })
    }
    return
  }

  if (msg?.type === 'channel:follow') {
    if (!activeSock) {
      process.send({ type: 'channel:followResult', requestId: msg.requestId, error: 'Bot não conectado' })
      return
    }
    try {
      const data = await followChannel({
        sock: activeSock,
        jid: msg.jid,
        followedSet: followedChannelJids,
        inFlight: inFlightChannelJids,
        logger,
      })
      process.send({ type: 'channel:followResult', requestId: msg.requestId, data })
    } catch (err) {
      logger.warn({ err: err?.message, jid: msg.jid }, 'channel:follow falhou')
      process.send({ type: 'channel:followResult', requestId: msg.requestId, error: err.message })
    }
    return
  }

  if (msg?.type === 'channel:listFollowed') {
    if (!activeSock) {
      process.send({ type: 'channel:listFollowedResult', requestId: msg.requestId, error: 'Bot não conectado' })
      return
    }
    try {
      const data = await listFollowedChannels({
        sock: activeSock,
        followedSet: followedChannelJids,
      })
      process.send({ type: 'channel:listFollowedResult', requestId: msg.requestId, data })
    } catch (err) {
      logger.warn({ err: err?.message }, 'channel:listFollowed falhou')
      process.send({ type: 'channel:listFollowedResult', requestId: msg.requestId, error: err.message })
    }
    return
  }
```

- [ ] **Step 4: Syntax check**

Run: `node --check src/bot-worker.js`
Expected: no output (sintaxe válida).

- [ ] **Step 5: Run full test suite — nada quebrou**

Run: `npm test`
Expected: 200/200+ pass (existing tests still green; channelDirectory novo soma 14).

- [ ] **Step 6: Commit**

```bash
git add src/bot-worker.js
git commit -m "feat(channels): handlers IPC channel:metadata|follow|listFollowed no worker"
```

---

## Task 5: Exports do `sessionCore` para channel operations

**Files:**
- Modify: `src/core/sessionCore.js`
- Modify: `src/manager.js`

- [ ] **Step 1: Add exports in sessionCore**

Locate `src/core/sessionCore.js` line 118 (após `requestPairingCode` export). Add:

```js
export const channelMetadata = (userId, { jid, inviteCode }) =>
  requestWithTimeout(userId, 'channel:metadata', { jid, inviteCode }, 15000, 'Timeout ao buscar metadata do canal')

export const followChannelImmediate = (userId, jid) =>
  requestWithTimeout(userId, 'channel:follow', { jid }, 15000, 'Timeout ao seguir canal')

export const listFollowedChannels = (userId) =>
  requestWithTimeout(userId, 'channel:listFollowed', {}, 20000, 'Timeout ao listar canais seguidos')
```

- [ ] **Step 2: IMPORTANT — atualizar dispatcher response em sessionCore**

`requestWithTimeout` (linhas 100-112) já trata qualquer mensagem com `requestId` corretamente no handler `proc.on('message')` (linhas 73-78) — qualquer tipo de resultado bate via `requestId`. Conferir e confirmar:

```js
// Linha 73-78 de sessionCore.js (existente):
if (msg.requestId) {
  const pending = pendingRequests.get(msg.requestId)
  if (!pending) return
  if (msg.error) pending.reject(new Error(msg.error)); else pending.resolve(msg.data ?? msg.code)
  pendingRequests.delete(msg.requestId)
}
```

Esse handler genérico cobre os `channel:*Result` automaticamente. Nada a mudar.

- [ ] **Step 3: Re-export no manager.js**

Edit `src/manager.js`. Trocar lista de exports por:

```js
export {
  startBot,
  stopBot,
  isRunning,
  onQR,
  onStatus,
  listGroups,
  sendBroadcast,
  requestPairingCode,
  getBotMetrics,
  reloadConfig,
  getLastQR,
  listRunningBots,
  stopAllBots,
  startSessionHealthMonitor,
  resumePersistedBots,
  channelMetadata,
  followChannelImmediate,
  listFollowedChannels,
} from './core/sessionCore.js'
```

- [ ] **Step 4: Syntax + test suite green**

Run: `node --check src/core/sessionCore.js src/manager.js && npm test`
Expected: tests ainda 200+/200+, build sintaticamente ok.

- [ ] **Step 5: Commit**

```bash
git add src/core/sessionCore.js src/manager.js
git commit -m "feat(channels): exports channelMetadata/followChannelImmediate/listFollowedChannels no sessionCore"
```

---

## Task 6: API route `POST /api/groups/resolve-channel-invite`

**Files:**
- Modify: `src/api/routes/groups.js`
- Test: `test/api/routes/groups.channel.test.js`

- [ ] **Step 1: Write failing test**

Create `test/api/routes/groups.channel.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'

async function buildApp({ channelMetadata, followChannelImmediate, listFollowedChannelsImpl, isRunning = () => true } = {}) {
  // Monkey-patch dos exports do manager via interceptação do import — usar approach simples:
  // injetar dependencies via decorate. Como groupsRoutes usa imports diretos, vamos testar
  // através da route registrada com mock global do módulo.
  // Para o teste, exportamos um factory alternativo. Ver Step 3.
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async (req) => { req.user = { sub: 'user-1' } })
  app.decorate('_test', { channelMetadata, followChannelImmediate, listFollowedChannelsImpl, isRunning })
  const { groupsRoutes } = await import('../../../src/api/routes/groups.js')
  await app.register(groupsRoutes, { prefix: '/api/groups' })
  return app
}

test('POST /resolve-channel-invite com URL válida retorna metadata', async () => {
  const app = await buildApp({
    channelMetadata: async (_uid, { inviteCode }) => ({
      jid: 'abc@newsletter',
      name: 'Canal X',
      owner: 'me@s.whatsapp.net',
      isViewerOwner: true,
      picture: null,
    }),
  })
  const res = await app.inject({
    method: 'POST',
    url: '/api/groups/resolve-channel-invite',
    payload: { url: 'https://whatsapp.com/channel/0029Va123' },
  })
  assert.equal(res.statusCode, 200)
  assert.equal(JSON.parse(res.body).jid, 'abc@newsletter')
  await app.close()
})

test('POST /resolve-channel-invite com URL inválida retorna 400', async () => {
  const app = await buildApp({ channelMetadata: async () => ({}) })
  const res = await app.inject({
    method: 'POST',
    url: '/api/groups/resolve-channel-invite',
    payload: { url: 'https://example.com/not-a-channel' },
  })
  assert.equal(res.statusCode, 400)
  await app.close()
})

test('POST /resolve-channel-invite com worker offline retorna 503', async () => {
  const app = await buildApp({ isRunning: () => false, channelMetadata: async () => ({}) })
  const res = await app.inject({
    method: 'POST',
    url: '/api/groups/resolve-channel-invite',
    payload: { url: 'https://whatsapp.com/channel/0029Va123' },
  })
  assert.equal(res.statusCode, 503)
  await app.close()
})

test('POST /resolve-channel-invite quando canal não existe retorna 404', async () => {
  const app = await buildApp({
    channelMetadata: async () => null,
  })
  const res = await app.inject({
    method: 'POST',
    url: '/api/groups/resolve-channel-invite',
    payload: { url: 'https://whatsapp.com/channel/0029Va999' },
  })
  assert.equal(res.statusCode, 404)
  await app.close()
})
```

- [ ] **Step 2: Run tests, expect failures**

Run: `node --test test/api/routes/groups.channel.test.js`
Expected: FAIL — rota não existe + dificuldade em mockar imports do groupsRoutes.

- [ ] **Step 3: Refactor groupsRoutes pra aceitar deps injetáveis (opcional mas recomendado para testabilidade)**

Modificar `src/api/routes/groups.js`. No topo, trocar imports diretos por defaults injetáveis:

```js
import db from '../../db.js'
import { trackAnalyticsEventSafe } from '../../analytics.js'
import { reloadConfig as _reloadConfig, channelMetadata as _channelMetadata, followChannelImmediate as _followChannelImmediate, listFollowedChannels as _listFollowedChannels, isRunning as _isRunning } from '../../manager.js'
import { ensureJid, detectKind, parseChannelInviteUrl, JID_KIND } from '../../core/jid.js'
import { FORWARD_MODE, NO_LINK_SCOPE, normalizeForwardingPolicy } from '../../forwardingPolicy.js'
```

E alterar a assinatura:
```js
export async function groupsRoutes(app, opts = {}) {
  const reloadConfig = opts.reloadConfig ?? _reloadConfig
  const channelMetadata = opts.channelMetadata ?? app._test?.channelMetadata ?? _channelMetadata
  const followChannelImmediate = opts.followChannelImmediate ?? app._test?.followChannelImmediate ?? _followChannelImmediate
  const listFollowedChannelsFn = opts.listFollowedChannels ?? app._test?.listFollowedChannelsImpl ?? _listFollowedChannels
  const isRunning = opts.isRunning ?? app._test?.isRunning ?? _isRunning
  // ... resto inalterado
```

- [ ] **Step 4: Implement the route**

Após `app.delete('/:id', ...)` (linha ~133), antes do fechamento da função:

```js
  app.post('/resolve-channel-invite', { onRequest: [app.authenticate] }, async (req, reply) => {
    const url = req.body?.url
    const inviteCode = typeof url === 'string' ? parseChannelInviteUrl(url) : null
    if (!inviteCode) return reply.code(400).send({ error: 'URL de convite de canal inválida' })
    if (!isRunning(req.user.sub)) return reply.code(503).send({ error: 'WhatsApp não está conectado. Conecte primeiro.' })
    try {
      const data = await channelMetadata(req.user.sub, { inviteCode })
      if (!data) return reply.code(404).send({ error: 'Canal não encontrado. Confira o link.' })
      return data
    } catch (err) {
      req.log.warn({ err: err.message, inviteCode }, 'resolve-channel-invite falhou')
      return reply.code(502).send({ error: err.message || 'Falha ao buscar canal' })
    }
  })
```

- [ ] **Step 5: Run tests**

Run: `node --test test/api/routes/groups.channel.test.js`
Expected: 4/4 pass.

- [ ] **Step 6: Run full suite**

Run: `npm test`
Expected: tudo verde.

- [ ] **Step 7: Commit**

```bash
git add src/api/routes/groups.js test/api/routes/groups.channel.test.js
git commit -m "feat(channels): rota POST /api/groups/resolve-channel-invite"
```

---

## Task 7: API route `POST /api/groups/:id/follow-now`

**Files:**
- Modify: `src/api/routes/groups.js`
- Test: `test/api/routes/groups.channel.test.js`

- [ ] **Step 1: Add failing test**

Append to `test/api/routes/groups.channel.test.js`:

```js
import db from '../../../src/db.js'

test('POST /:id/follow-now segue canal-monitor e retorna status', async (t) => {
  // Setup: cria user + group canal-monitor
  const userId = 'user-followtest'
  const group = await db.group.create({
    data: { userId, waJid: 'a@newsletter', name: 'Canal A', role: 'monitor', kind: 'channel', forwardMode: 'LINK_ONLY' },
  })
  t.after(async () => { await db.group.deleteMany({ where: { userId } }) })

  const app = await buildApp({
    followChannelImmediate: async (_uid, jid) => {
      assert.equal(jid, 'a@newsletter')
      return { followed: 'new', duration: 86400 }
    },
  })
  // Sobrescrever authenticate pra esse user
  app.authenticate = async (req) => { req.user = { sub: userId } }

  const res = await app.inject({
    method: 'POST',
    url: `/api/groups/${group.id}/follow-now`,
  })
  assert.equal(res.statusCode, 200)
  assert.equal(JSON.parse(res.body).followed, 'new')
  await app.close()
})

test('POST /:id/follow-now para grupo (não canal) retorna 400', async (t) => {
  const userId = 'user-followtest2'
  const group = await db.group.create({
    data: { userId, waJid: 'a@g.us', name: 'Grupo A', role: 'monitor', kind: 'group', forwardMode: 'LINK_ONLY' },
  })
  t.after(async () => { await db.group.deleteMany({ where: { userId } }) })

  const app = await buildApp({ followChannelImmediate: async () => ({}) })
  app.authenticate = async (req) => { req.user = { sub: userId } }
  const res = await app.inject({ method: 'POST', url: `/api/groups/${group.id}/follow-now` })
  assert.equal(res.statusCode, 400)
  await app.close()
})

test('POST /:id/follow-now com group inexistente retorna 404', async () => {
  const app = await buildApp({ followChannelImmediate: async () => ({}) })
  const res = await app.inject({ method: 'POST', url: '/api/groups/nonexistent/follow-now' })
  assert.equal(res.statusCode, 404)
  await app.close()
})
```

- [ ] **Step 2: Run tests, expect FAIL — rota não existe**

Run: `node --test test/api/routes/groups.channel.test.js`

- [ ] **Step 3: Implement route**

Adicionar em `src/api/routes/groups.js` após a rota da Task 6:

```js
  app.post('/:id/follow-now', { onRequest: [app.authenticate] }, async (req, reply) => {
    const group = await db.group.findFirst({ where: { id: req.params.id, userId: req.user.sub } })
    if (!group) return reply.code(404).send({ error: 'Grupo/canal não encontrado' })
    if (group.kind !== JID_KIND.CHANNEL) return reply.code(400).send({ error: 'follow-now só vale pra canais' })
    if (!isRunning(req.user.sub)) return reply.code(503).send({ error: 'WhatsApp não está conectado.' })
    try {
      const data = await followChannelImmediate(req.user.sub, group.waJid)
      return data
    } catch (err) {
      req.log.warn({ err: err.message, groupId: group.id }, 'follow-now falhou')
      return reply.code(502).send({ error: err.message || 'Falha ao seguir canal' })
    }
  })
```

- [ ] **Step 4: Run tests + full suite**

Run: `node --test test/api/routes/groups.channel.test.js && npm test`
Expected: tudo verde.

- [ ] **Step 5: Commit**

```bash
git add src/api/routes/groups.js test/api/routes/groups.channel.test.js
git commit -m "feat(channels): rota POST /api/groups/:id/follow-now"
```

---

## Task 8: API route `POST /api/groups/:id/refresh-admin`

**Files:**
- Modify: `src/api/routes/groups.js`
- Test: `test/api/routes/groups.channel.test.js`

- [ ] **Step 1: Add failing test**

Append to test:

```js
test('POST /:id/refresh-admin retorna isViewerOwner atualizado para canal', async (t) => {
  const userId = 'user-refresh'
  const group = await db.group.create({
    data: { userId, waJid: 'b@newsletter', name: 'Canal B', role: 'post', kind: 'channel', forwardMode: 'LINK_ONLY' },
  })
  t.after(async () => { await db.group.deleteMany({ where: { userId } }) })

  const app = await buildApp({
    channelMetadata: async (_uid, { jid }) => ({
      jid, name: 'Canal B', owner: 'me@s.whatsapp.net', isViewerOwner: true, picture: null,
    }),
  })
  app.authenticate = async (req) => { req.user = { sub: userId } }
  const res = await app.inject({ method: 'POST', url: `/api/groups/${group.id}/refresh-admin` })
  assert.equal(res.statusCode, 200)
  assert.equal(JSON.parse(res.body).isViewerOwner, true)
  await app.close()
})

test('POST /:id/refresh-admin para grupo (não canal) retorna 400', async (t) => {
  const userId = 'user-refresh2'
  const group = await db.group.create({
    data: { userId, waJid: 'b@g.us', name: 'Grupo B', role: 'post', kind: 'group', forwardMode: 'LINK_ONLY' },
  })
  t.after(async () => { await db.group.deleteMany({ where: { userId } }) })
  const app = await buildApp({ channelMetadata: async () => ({}) })
  app.authenticate = async (req) => { req.user = { sub: userId } }
  const res = await app.inject({ method: 'POST', url: `/api/groups/${group.id}/refresh-admin` })
  assert.equal(res.statusCode, 400)
  await app.close()
})
```

- [ ] **Step 2: Run tests, expect FAIL**

- [ ] **Step 3: Implement route**

```js
  app.post('/:id/refresh-admin', { onRequest: [app.authenticate] }, async (req, reply) => {
    const group = await db.group.findFirst({ where: { id: req.params.id, userId: req.user.sub } })
    if (!group) return reply.code(404).send({ error: 'Grupo/canal não encontrado' })
    if (group.kind !== JID_KIND.CHANNEL) return reply.code(400).send({ error: 'refresh-admin só vale pra canais' })
    if (!isRunning(req.user.sub)) return reply.code(503).send({ error: 'WhatsApp não está conectado.' })
    try {
      const data = await channelMetadata(req.user.sub, { jid: group.waJid })
      if (!data) return reply.code(404).send({ error: 'Canal não encontrado no WhatsApp' })
      return { isViewerOwner: data.isViewerOwner, owner: data.owner, name: data.name }
    } catch (err) {
      req.log.warn({ err: err.message, groupId: group.id }, 'refresh-admin falhou')
      return reply.code(502).send({ error: err.message || 'Falha ao verificar canal' })
    }
  })
```

- [ ] **Step 4: Run tests + full suite**

Expected: tudo verde.

- [ ] **Step 5: Commit**

```bash
git add src/api/routes/groups.js test/api/routes/groups.channel.test.js
git commit -m "feat(channels): rota POST /api/groups/:id/refresh-admin"
```

---

## Task 9: API route `GET /api/groups/wa/channels`

**Files:**
- Modify: `src/api/routes/groups.js`
- Test: `test/api/routes/groups.channel.test.js`

- [ ] **Step 1: Add failing test**

```js
test('GET /wa/channels retorna lista de canais seguidos', async () => {
  const app = await buildApp({
    listFollowedChannelsImpl: async () => [
      { jid: 'a@newsletter', name: 'Canal A', owner: 'me@s.whatsapp.net', isViewerOwner: true, picture: null },
      { jid: 'b@newsletter', name: 'Canal B', owner: 'other@s.whatsapp.net', isViewerOwner: false, picture: null },
    ],
  })
  const res = await app.inject({ method: 'GET', url: '/api/groups/wa/channels' })
  assert.equal(res.statusCode, 200)
  const list = JSON.parse(res.body)
  assert.equal(list.length, 2)
  assert.equal(list[0].jid, 'a@newsletter')
  await app.close()
})

test('GET /wa/channels com worker offline retorna 503', async () => {
  const app = await buildApp({ isRunning: () => false, listFollowedChannelsImpl: async () => [] })
  const res = await app.inject({ method: 'GET', url: '/api/groups/wa/channels' })
  assert.equal(res.statusCode, 503)
  await app.close()
})
```

- [ ] **Step 2: Run tests, expect FAIL**

- [ ] **Step 3: Implement**

```js
  app.get('/wa/channels', { onRequest: [app.authenticate] }, async (req, reply) => {
    if (!isRunning(req.user.sub)) return reply.code(503).send({ error: 'WhatsApp não está conectado.' })
    try {
      const data = await listFollowedChannelsFn(req.user.sub)
      return data ?? []
    } catch (err) {
      req.log.warn({ err: err.message }, 'wa/channels falhou')
      return reply.code(502).send({ error: err.message || 'Falha ao listar canais' })
    }
  })
```

- [ ] **Step 4: Run tests + full suite**

- [ ] **Step 5: Commit**

```bash
git add src/api/routes/groups.js test/api/routes/groups.channel.test.js
git commit -m "feat(channels): rota GET /api/groups/wa/channels"
```

---

## Task 10: Dashboard API client + tipos

**Files:**
- Modify: `dashboard/lib/api.js`

- [ ] **Step 1: Inspect existing client**

Read `dashboard/lib/api.js`. Identifique padrões de método (provavelmente algo como `groups: () => fetch(...).then(...)`).

- [ ] **Step 2: Add methods**

Adicione ao objeto `api`:

```js
  resolveChannelInvite: (url) =>
    fetch('/api/groups/resolve-channel-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    }).then(handleJson),

  followChannelNow: (id) =>
    fetch(`/api/groups/${id}/follow-now`, { method: 'POST' }).then(handleJson),

  refreshChannelAdmin: (id) =>
    fetch(`/api/groups/${id}/refresh-admin`, { method: 'POST' }).then(handleJson),

  waChannels: () => fetch('/api/groups/wa/channels').then(handleJson),
```

Onde `handleJson` é o helper já existente (verificar o nome real no arquivo; se for `parseRes` ou `json`, ajustar).

- [ ] **Step 3: Verify dashboard builds**

Run: `cd dashboard && npm run build 2>&1 | tail -20 && cd ..`
Expected: build success (ou ao menos sem erro nas linhas novas).

- [ ] **Step 4: Commit**

```bash
git add dashboard/lib/api.js
git commit -m "feat(channels): client api — resolveChannelInvite, followChannelNow, refreshChannelAdmin, waChannels"
```

---

## Task 11: Componente `ChannelStatusBadges`

**Files:**
- Create: `dashboard/components/ChannelStatusBadges.js`

- [ ] **Step 1: Inspect existing badges pattern**

Read `dashboard/components/` listing pra ver convenções (className, Tailwind tokens). Provavelmente já tem `Alert.js`, `HelpLink.js` — use mesma estética.

- [ ] **Step 2: Implement**

```js
'use client'

const STYLE = {
  base: 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
  green: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  yellow: 'bg-amber-50 text-amber-800 border border-amber-200',
  gray: 'bg-slate-100 text-slate-700 border border-slate-200',
  blue: 'bg-sky-50 text-sky-700 border border-sky-200',
  rose: 'bg-rose-50 text-rose-700 border border-rose-200',
}

export function TypeBadge({ kind }) {
  if (kind === 'channel') return <span className={`${STYLE.base} ${STYLE.blue}`}>Canal</span>
  return <span className={`${STYLE.base} ${STYLE.gray}`}>Grupo</span>
}

export function FollowBadge({ status }) {
  if (status === 'followed') return <span className={`${STYLE.base} ${STYLE.green}`}>Seguindo</span>
  if (status === 'pending') return <span className={`${STYLE.base} ${STYLE.yellow}`}>Seguindo em breve…</span>
  if (status === 'error') return <span className={`${STYLE.base} ${STYLE.rose}`}>Erro ao seguir</span>
  return <span className={`${STYLE.base} ${STYLE.gray}`}>Não verificado</span>
}

export function AdminBadge({ status, onRefresh, refreshing }) {
  let cls = STYLE.gray
  let label = 'Não verificado'
  if (status === 'owner') { cls = STYLE.green; label = 'Admin OK' }
  else if (status === 'not-owner') { cls = STYLE.yellow; label = 'Sem permissão confirmada' }
  else if (status === 'error') { cls = STYLE.rose; label = 'Erro ao verificar' }
  return (
    <button
      type="button"
      className={`${STYLE.base} ${cls} hover:opacity-80 cursor-pointer`}
      onClick={onRefresh}
      disabled={refreshing}
      title="Clique para re-verificar"
    >
      {refreshing ? 'Verificando…' : label}
    </button>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/components/ChannelStatusBadges.js
git commit -m "feat(channels): componente ChannelStatusBadges (TypeBadge, FollowBadge, AdminBadge)"
```

---

## Task 12: Componente `AddChannelModal`

**Files:**
- Create: `dashboard/components/AddChannelModal.js`

- [ ] **Step 1: Implement**

```js
'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'

const TABS = [
  { id: 'link', label: 'Colar link' },
  { id: 'followed', label: 'Canais que sigo' },
  { id: 'jid', label: 'JID manual' },
]

export function AddChannelModal({ open, onClose, onCreated }) {
  const [tab, setTab] = useState('link')
  const [url, setUrl] = useState('')
  const [jid, setJid] = useState('')
  const [preview, setPreview] = useState(null) // { jid, name, owner, isViewerOwner, picture }
  const [role, setRole] = useState('monitor')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [followedList, setFollowedList] = useState(null)
  const [loadingFollowed, setLoadingFollowed] = useState(false)
  const [confirmNonAdmin, setConfirmNonAdmin] = useState(false)

  useEffect(() => {
    if (!open) {
      setTab('link'); setUrl(''); setJid(''); setPreview(null); setRole('monitor')
      setBusy(false); setError(''); setFollowedList(null); setConfirmNonAdmin(false)
    }
  }, [open])

  useEffect(() => {
    if (tab !== 'followed' || followedList !== null) return
    setLoadingFollowed(true)
    api.waChannels()
      .then((list) => setFollowedList(Array.isArray(list) ? list : []))
      .catch((err) => setError(err.message))
      .finally(() => setLoadingFollowed(false))
  }, [tab, followedList])

  async function resolveLink() {
    setBusy(true); setError(''); setPreview(null)
    try {
      const data = await api.resolveChannelInvite(url.trim())
      setPreview(data)
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  async function resolveJid() {
    if (!jid.trim().endsWith('@newsletter')) { setError('JID deve terminar com @newsletter'); return }
    setBusy(true); setError(''); setPreview(null)
    try {
      // Reusa endpoint refresh-admin via Group temporário? Não — usa channelMetadata via uma rota dedicada?
      // Solução simples: rota resolve-channel-invite só aceita inviteCode. Para JID manual,
      // fazemos um POST /api/groups/resolve-channel-jid no backend. Adicionado no Task 13.
      const data = await api.resolveChannelJid(jid.trim())
      setPreview(data)
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  async function submit() {
    if (!preview) return
    if (role === 'post' && preview.isViewerOwner === false && !confirmNonAdmin) {
      setError('Confirme que você é admin desse canal antes de cadastrar como destino.')
      return
    }
    setBusy(true); setError('')
    try {
      const group = await api.createGroup({
        waJid: preview.jid, name: preview.name, role, kind: 'channel',
      })
      // Se monitor, dispara follow-now em background
      if (role === 'monitor') {
        api.followChannelNow(group.id).catch(() => {})
      }
      onCreated?.(group)
      onClose?.()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-lg font-semibold">Adicionar canal</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700">✕</button>
        </div>

        <Alert variant="info" className="mb-4">
          Canais funcionam diferente de grupos: para <strong>monitorar</strong> você precisa seguir o canal;
          para <strong>postar</strong> você precisa ser admin. Só cadastre canais onde você é admin como
          destino — tentar postar em canais alheios pode causar restrição na sua conta.
        </Alert>

        <div className="flex border-b mb-4">
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3 py-2 text-sm border-b-2 -mb-px ${tab === t.id ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
            >{t.label}</button>
          ))}
        </div>

        {tab === 'link' && (
          <div className="space-y-2">
            <label className="block text-sm">URL do convite</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://whatsapp.com/channel/0029Va..."
              className="w-full border rounded px-3 py-2"
            />
            <button type="button" onClick={resolveLink} disabled={busy || !url.trim()}
              className="px-3 py-1.5 bg-sky-600 text-white rounded text-sm disabled:opacity-50">
              {busy ? 'Buscando…' : 'Buscar canal'}
            </button>
          </div>
        )}

        {tab === 'followed' && (
          <div>
            {loadingFollowed && <p className="text-sm text-slate-500">Carregando…</p>}
            {!loadingFollowed && followedList?.length === 0 && (
              <p className="text-sm text-slate-500">Você não segue nenhum canal ainda.</p>
            )}
            <ul className="space-y-1 max-h-64 overflow-y-auto">
              {followedList?.map(c => (
                <li key={c.jid}>
                  <button
                    type="button"
                    onClick={() => setPreview(c)}
                    className={`w-full text-left px-3 py-2 rounded border ${preview?.jid === c.jid ? 'border-sky-500 bg-sky-50' : 'border-slate-200 hover:bg-slate-50'}`}
                  >
                    <div className="font-medium text-sm">{c.name}</div>
                    <div className="text-xs text-slate-500">{c.jid}</div>
                    {c.isViewerOwner && <span className="text-xs text-emerald-700">Você é dono</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === 'jid' && (
          <div className="space-y-2">
            <label className="block text-sm">JID do canal</label>
            <input
              type="text"
              value={jid}
              onChange={(e) => setJid(e.target.value)}
              placeholder="xxxxxxxxxxxx@newsletter"
              className="w-full border rounded px-3 py-2 font-mono text-sm"
            />
            <button type="button" onClick={resolveJid} disabled={busy || !jid.trim()}
              className="px-3 py-1.5 bg-sky-600 text-white rounded text-sm disabled:opacity-50">
              {busy ? 'Buscando…' : 'Buscar canal'}
            </button>
          </div>
        )}

        {preview && (
          <div className="mt-4 p-3 border rounded bg-slate-50">
            <div className="font-medium">{preview.name}</div>
            <div className="text-xs text-slate-500 font-mono">{preview.jid}</div>
            <div className="mt-2 text-sm">
              {preview.isViewerOwner
                ? <span className="text-emerald-700">✓ Você é dono deste canal</span>
                : <span className="text-amber-700">⚠ Você não consta como dono. Só prossiga se for admin.</span>}
            </div>

            <div className="mt-3">
              <label className="block text-sm font-medium mb-1">O que fazer com este canal?</label>
              <select value={role} onChange={(e) => setRole(e.target.value)} className="border rounded px-2 py-1">
                <option value="monitor">Monitorar (origem)</option>
                <option value="post">Postar (destino)</option>
              </select>
            </div>

            {role === 'post' && preview.isViewerOwner === false && (
              <label className="mt-3 flex gap-2 items-start text-sm text-amber-800">
                <input type="checkbox" checked={confirmNonAdmin} onChange={(e) => setConfirmNonAdmin(e.target.checked)} />
                <span>Confirmo que sou admin deste canal e quero prosseguir.</span>
              </label>
            )}
          </div>
        )}

        {error && <Alert variant="error" className="mt-4">{error}</Alert>}

        <div className="flex gap-2 justify-end mt-4">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm">Cancelar</button>
          <button type="button" onClick={submit} disabled={busy || !preview}
            className="px-3 py-1.5 bg-emerald-600 text-white rounded text-sm disabled:opacity-50">
            {busy ? 'Salvando…' : 'Cadastrar canal'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify dashboard builds**

Run: `cd dashboard && npm run build 2>&1 | tail -10 && cd ..`

- [ ] **Step 3: Commit**

```bash
git add dashboard/components/AddChannelModal.js
git commit -m "feat(channels): AddChannelModal com 3 abas (link / seguidos / JID)"
```

---

## Task 13: API route `POST /api/groups/resolve-channel-jid` (suporte ao tab "JID manual")

**Files:**
- Modify: `src/api/routes/groups.js`
- Modify: `dashboard/lib/api.js`
- Test: `test/api/routes/groups.channel.test.js`

- [ ] **Step 1: Add failing test**

```js
test('POST /resolve-channel-jid retorna metadata por jid', async () => {
  const app = await buildApp({
    channelMetadata: async (_uid, { jid }) => ({ jid, name: 'X', owner: 'o', isViewerOwner: false, picture: null }),
  })
  const res = await app.inject({ method: 'POST', url: '/api/groups/resolve-channel-jid',
    payload: { jid: 'abc@newsletter' } })
  assert.equal(res.statusCode, 200)
  assert.equal(JSON.parse(res.body).jid, 'abc@newsletter')
  await app.close()
})

test('POST /resolve-channel-jid rejeita jid não-@newsletter', async () => {
  const app = await buildApp({ channelMetadata: async () => ({}) })
  const res = await app.inject({ method: 'POST', url: '/api/groups/resolve-channel-jid',
    payload: { jid: 'abc@g.us' } })
  assert.equal(res.statusCode, 400)
  await app.close()
})
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement route**

```js
  app.post('/resolve-channel-jid', { onRequest: [app.authenticate] }, async (req, reply) => {
    const jid = typeof req.body?.jid === 'string' ? req.body.jid.trim() : ''
    if (detectKind(jid) !== JID_KIND.CHANNEL) return reply.code(400).send({ error: 'JID deve terminar com @newsletter' })
    if (!isRunning(req.user.sub)) return reply.code(503).send({ error: 'WhatsApp não está conectado.' })
    try {
      const data = await channelMetadata(req.user.sub, { jid })
      if (!data) return reply.code(404).send({ error: 'Canal não encontrado' })
      return data
    } catch (err) {
      return reply.code(502).send({ error: err.message })
    }
  })
```

- [ ] **Step 4: Add client method em `dashboard/lib/api.js`**

```js
  resolveChannelJid: (jid) =>
    fetch('/api/groups/resolve-channel-jid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jid }),
    }).then(handleJson),
```

- [ ] **Step 5: Run tests + full suite**

- [ ] **Step 6: Commit**

```bash
git add src/api/routes/groups.js dashboard/lib/api.js test/api/routes/groups.channel.test.js
git commit -m "feat(channels): rota POST /api/groups/resolve-channel-jid"
```

---

## Task 14: Integrar modal + badges + filtro no `dashboard/app/dashboard/grupos/page.js`

**Files:**
- Modify: `dashboard/app/dashboard/grupos/page.js`

- [ ] **Step 1: Read e localizar âncoras**

Pontos a editar:
- Topo: importar `AddChannelModal`, `TypeBadge`, `FollowBadge`, `AdminBadge`.
- Estado: adicionar `showChannelModal`, `filter` (`'all' | 'group' | 'channel'`), `followStatusByGroupId` (Map), `adminStatusByGroupId` (Map), `refreshingAdminId`.
- Render: chips de filtro acima da lista; badge de tipo em cada item; modal renderizado condicionalmente.

- [ ] **Step 2: Edits**

No topo do arquivo (após imports existentes):
```js
import { AddChannelModal } from '@/components/AddChannelModal'
import { TypeBadge, FollowBadge, AdminBadge } from '@/components/ChannelStatusBadges'
```

Dentro do componente, adicionar estado:
```js
  const [showChannelModal, setShowChannelModal] = useState(false)
  const [filter, setFilter] = useState('all')
  const [followStatus, setFollowStatus] = useState({})    // { [groupId]: 'pending' | 'followed' | 'error' }
  const [adminStatus, setAdminStatus] = useState({})       // { [groupId]: 'owner' | 'not-owner' | 'unknown' | 'error' }
  const [refreshingAdminId, setRefreshingAdminId] = useState(null)
```

Adicionar função pra refresh admin (após `load()`):
```js
  async function refreshAdmin(group) {
    setRefreshingAdminId(group.id)
    try {
      const data = await api.refreshChannelAdmin(group.id)
      setAdminStatus(prev => ({ ...prev, [group.id]: data.isViewerOwner ? 'owner' : 'not-owner' }))
    } catch {
      setAdminStatus(prev => ({ ...prev, [group.id]: 'error' }))
    } finally {
      setRefreshingAdminId(null)
    }
  }

  async function handleChannelCreated(group) {
    setGroups(prev => [...prev, group])
    if (group.kind === 'channel' && group.role === 'monitor') {
      setFollowStatus(prev => ({ ...prev, [group.id]: 'pending' }))
      try {
        await api.followChannelNow(group.id)
        setFollowStatus(prev => ({ ...prev, [group.id]: 'followed' }))
      } catch {
        setFollowStatus(prev => ({ ...prev, [group.id]: 'error' }))
      }
    }
    if (group.kind === 'channel' && group.role === 'post') {
      refreshAdmin(group)
    }
  }
```

Filter chips + botão "Adicionar canal" no topo da listagem (logo após `<h1>` da página, antes do form de cadastro manual de grupo):
```jsx
  <div className="flex items-center gap-2 mb-4 flex-wrap">
    {['all', 'group', 'channel'].map(f => (
      <button key={f} onClick={() => setFilter(f)}
        className={`px-3 py-1 rounded-full text-sm ${filter === f ? 'bg-sky-600 text-white' : 'bg-slate-100'}`}>
        {f === 'all' ? `Todos (${groups.length})` :
          f === 'group' ? `Grupos (${groups.filter(g => g.kind !== 'channel').length})` :
          `Canais (${groups.filter(g => g.kind === 'channel').length})`}
      </button>
    ))}
    <button onClick={() => setShowChannelModal(true)}
      className="ml-auto px-3 py-1.5 bg-emerald-600 text-white rounded text-sm">
      + Adicionar canal
    </button>
  </div>
```

Onde a listagem itera sobre `groups`, trocar para `groups.filter(...)`:
```jsx
  {groups.filter(g =>
    filter === 'all' ||
    (filter === 'channel' && g.kind === 'channel') ||
    (filter === 'group' && g.kind !== 'channel')
  ).map(group => (
    // ... renderização existente, adicionando:
    // <TypeBadge kind={group.kind} />
    // se canal+monitor: <FollowBadge status={followStatus[group.id] ?? 'unknown'} />
    // se canal+post: <AdminBadge status={adminStatus[group.id] ?? 'unknown'} onRefresh={() => refreshAdmin(group)} refreshing={refreshingAdminId === group.id} />
  ))}
```

Renderizar modal no fim do JSX:
```jsx
  <AddChannelModal
    open={showChannelModal}
    onClose={() => setShowChannelModal(false)}
    onCreated={handleChannelCreated}
  />
```

- [ ] **Step 3: Verify build**

Run: `cd dashboard && npm run build 2>&1 | tail -15 && cd ..`
Expected: success.

- [ ] **Step 4: Commit**

```bash
git add dashboard/app/dashboard/grupos/page.js
git commit -m "feat(channels): integra AddChannelModal + badges + filtro na página Grupos"
```

---

## Task 15: Renomear menu lateral e título da página

**Files:**
- Modify: `dashboard/app/dashboard/DashboardClientLayout.js` (menu lateral)
- Modify: `dashboard/app/dashboard/grupos/page.js` (título)

- [ ] **Step 1: Localizar item "Grupos" no menu**

Read `dashboard/app/dashboard/DashboardClientLayout.js`. Procure por `'Grupos'` ou `'/dashboard/grupos'`.

- [ ] **Step 2: Renomear**

Substituir o label de "Grupos" por "Grupos e Canais" (manter href).

Mesma coisa no `<h1>` da página `grupos/page.js`.

- [ ] **Step 3: Build dashboard**

Run: `cd dashboard && npm run build 2>&1 | tail -5 && cd ..`

- [ ] **Step 4: Commit**

```bash
git add dashboard/app/dashboard/DashboardClientLayout.js dashboard/app/dashboard/grupos/page.js
git commit -m "feat(channels): renomeia menu/título para 'Grupos e Canais'"
```

---

## Task 16: Atualizar plan doc com decisões da Fase 4

**Files:**
- Modify: `docs/whatsapp-channels-implementation-plan.md`

- [ ] **Step 1: Read seção "Fase 4" do plan doc**

Encontre a seção e atualize com:
- Decisão: cadastro via link + lista de seguidos + JID manual (3 abas)
- Decisão: follow imediato via IPC (channelMetadata, followChannelImmediate)
- Decisão: badge admin preventivo com refresh manual
- Decisão: página única "Grupos e Canais"
- Decisão: reusar `requestWithTimeout` do sessionCore ao invés de novo `requestFromWorker`
- Marcar Fase 4 como COMPLETA pós-merge

- [ ] **Step 2: Commit**

```bash
git add docs/whatsapp-channels-implementation-plan.md
git commit -m "docs(channels): atualizar plan doc com decisões da Fase 4"
```

---

## Task 17: Push e atualizar PR #496

- [ ] **Step 1: Push**

```bash
git push -u origin feat/channels-phase-4-ui
```

- [ ] **Step 2: PR #496 update**

A PR já existe. Atualizar descrição via MCP github comentando com:
- Resumo do que foi implementado
- Test plan manual em staging (resolver link real, follow real, badge admin, role=post sem admin → erro esperado)
- Riscos / limitações

- [ ] **Step 3: Smoke local opcional**

Se a usuária quiser smoke local antes de mergear, rodar `npm test` final pra confirmar count.

---

## Test plan completo (consolidado)

**Automatizado** (rodando a cada task):
- `node --test test/core/channelDirectory.test.js` — 14 testes.
- `node --test test/api/routes/groups.channel.test.js` — 11 testes (~).
- `npm test` full — deve fechar em 220+ verdes (197 anteriores + ~25 novos).

**Manual em staging (pós-merge develop)**:
1. **Resolve link** — Colar URL de canal real no modal, ver preview correto com badge "Admin OK" (se for próprio).
2. **Cadastrar canal-destino próprio** — submit com role=post → linha aparece com badge `[Canal]` + `Admin OK`.
3. **Cadastrar canal-monitor** — submit com role=monitor → linha aparece com badge `Seguindo em breve…` → vira `Seguindo` em segundos.
4. **Postar oferta no canal-monitor** → confirmar que chega no destino (grupo ou canal).
5. **Cadastrar canal alheio como destino** (com checkbox de prosseguir) → primeira postagem falha com forbidden, MessageLog mostra erro real, sem 3 retries (Fase 3 já cobre).
6. **JID manual** — colar `xxx@newsletter` direto → preview funciona.
7. **Refresh admin** — clicar badge → vê "Verificando…" → status atualiza.
8. **Worker offline** — parar pm2 api-staging, abrir modal → erro 503 claro, sem travamento.
9. **Filtro** — clicar chips Grupos/Canais → lista filtra client-side.

**Não-regressão**:
- Smoke do legacy: postar oferta em grupo monitor → chega em grupo destino com link convertido (garante que mudanças não tocaram path crítico).
- Login + dashboard carregam normalmente.

---

## Self-review

Checagem rápida contra a spec:

1. **Cadastro link + lista + JID manual** → Tasks 6, 9, 12, 13.
2. **Follow imediato via IPC** → Tasks 2, 4, 5, 7.
3. **Badge admin preventivo + refresh manual** → Tasks 8, 11, 14.
4. **Página única "Grupos e Canais"** → Tasks 14, 15.
5. **Edge cases** (worker offline, URL inválida, 404, duplicado, role=post non-admin) → cobertos nos testes das Tasks 6-9.
6. **Banner orientativo** → Task 12 (dentro do modal).
7. **Renomeio do menu/título** → Task 15.
8. **Docs atualizadas** → Task 16.

Sem placeholders. Nomes de funções consistentes (`channelMetadata`, `followChannelImmediate`, `listFollowedChannels`, `getChannelMetadata`, `followChannel`). Caminhos exatos. TDD RED→GREEN→COMMIT em cada task que envolve código novo. Riscos da spec mapeados (cleanup de inFlight em finally; assinatura do `newsletterMetadata` validada via `.d.ts` antes de escrever — feito no preâmbulo deste plano).
