# Preservação Avançada — Sidebar com Monitoramento + Configurações — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expor todas as features do Phase 5 como módulo configurável + monitorável na sidebar do dashboard, transformando-as em diferencial real do plano Pro/Trial. Backend passa a aplicar gating real; UI ganha grupo dedicado com Monitoramento e Configurações avançadas, mais página de upsell para não-Pro.

**Architecture:** Reusa `canUseAdvancedPreservation()` de `src/billing/plans.js` como fonte única de verdade do gating. Bot-worker e jobs/cron passam a checar gating antes de aplicar lógica Phase 5. Frontend ganha 2 páginas novas (`/dashboard/preservacao/monitoramento` e `/configuracoes`) sob um layout wrapper que decide entre conteúdo real ou `UpsellShell`. 9 novas rotas em `/api/preservation/*`.

**Tech Stack:** Node 20 + Fastify + Prisma (SQLite) + Next.js 16 (App Router, client components) + Tailwind. Testes em `node:test`.

**Spec:** `docs/superpowers/specs/2026-05-19-preservacao-avancada-sidebar-design.md` (PR #561)

**Requisito transversal (stakeholder):** toda funcionalidade exposta no dashboard precisa ter microcopy em linguagem simples explicando o que faz. Cada componente novo no frontend tem que renderizar pelo menos uma linha de texto explicativo próxima ao controle.

---

## File Structure

### Backend (novos/modificados)

| Path | Responsabilidade | Status |
|------|------------------|--------|
| `src/billing/plans.js` | Já existe; adicionar `getAdvancedPreservationAccess(userId, { db })` com cache TTL 60s | Modify |
| `src/core/channelThrottle.js` | `checkAndReserve` ganha curto-circuito se gating off | Modify |
| `src/core/followGuard.js` | `canFollowNow` ganha curto-circuito se gating off | Modify |
| `src/jobs/channelSnapshot.js` | `captureAllForUser` retorna `{gated:1}` se off | Modify |
| `src/core/channelProbe.js` | `runProbeWatchdog` filtra por gating | Modify |
| `src/bot-worker.js` | Wrap das chamadas Phase 5 em `if (preservationActive)` | Modify |
| `src/api/routes/preservation.js` | Todas as rotas `/api/preservation/*` (NEW) | Create |
| `src/api/server.js` | Registrar `preservationRoutes` com prefix | Modify |
| `test/core/planGating.test.js` | Cache TTL + transição trial→basic | Create |
| `test/core/channelThrottle.test.js` | Caso `gating_off` | Modify |
| `test/core/followGuard.test.js` | Caso `gating_off` | Modify |
| `test/jobs/channelSnapshot.test.js` | Caso usuário não-Pro | Modify |
| `test/api/routes/preservation.config.test.js` | GET/PUT + 402 | Create |
| `test/api/routes/preservation.monitoring.test.js` | Happy path + 402 | Create |

### Frontend (novos/modificados)

| Path | Responsabilidade | Status |
|------|------------------|--------|
| `dashboard/lib/plan.js` | Centraliza `canAccessAdvancedPreservation` | Create |
| `dashboard/lib/api.js` | Novos helpers `preservationConfig*`, `preservationMonitoring*` | Modify |
| `dashboard/app/dashboard/DashboardClientLayout.js` | Novo grupo na navGroups + 🔒 | Modify |
| `dashboard/app/dashboard/configuracoes/page.js` | Importar do `lib/plan.js` | Modify |
| `dashboard/app/dashboard/preservacao/page.js` | Redirect server-side | Create |
| `dashboard/app/dashboard/preservacao/layout.js` | Wrapper client; decide upsell vs children | Create |
| `dashboard/app/dashboard/preservacao/monitoramento/page.js` | Grid de cards read-only | Create |
| `dashboard/app/dashboard/preservacao/configuracoes/page.js` | Form com 7 seções | Create |
| `dashboard/components/preservacao/UpsellShell.js` | Hero + cards de feature + CTAs | Create |
| `dashboard/components/preservacao/HealthOverview.js` | Tabela de saúde | Create |
| `dashboard/components/preservacao/RiskScoreSummary.js` | Score médio + breakdown | Create |
| `dashboard/components/preservacao/RecentFollowsList.js` | Últimos 20 follows | Create |
| `dashboard/components/preservacao/SnapshotsList.js` | Counts por canal | Create |
| `dashboard/components/preservacao/ProbeStatus.js` | Estado consolidado | Create |
| `dashboard/components/preservacao/ClicksSummary.js` | Totais + top 5 | Create |
| `dashboard/components/preservacao/ThrottleForm.js` | 5 inputs throttle | Create |
| `dashboard/components/preservacao/FollowGuardForm.js` | maxDailyFollows | Create |
| `dashboard/components/preservacao/QuietHoursForm.js` | Editor quiet hours | Create |
| `dashboard/components/preservacao/CopyVariationPoolEditor.js` | JSON pool + preview | Create |
| `dashboard/components/preservacao/ImageMutationToggle.js` | Toggle simples | Create |
| `dashboard/components/preservacao/ProbeToggle.js` | Toggle + descrição | Create |
| `dashboard/components/preservacao/ClickTrackerStatus.js` | Read-only status | Create |

---

## Convenções de teste no projeto

- Test runner: `node --test` puro, com `import test from 'node:test'` e `import assert from 'node:assert/strict'`.
- Stubs in-memory passando via `opts.db` — NÃO mockear Prisma diretamente. Vide `test/jobs/channelSnapshot.test.js` como referência.
- Rotas: não tem framework de teste integrado pro Fastify. As rotas existentes ficam testadas via integração manual em staging. **Adicionar arquivos de teste de rota só se for trivial bootar a app inteira** — caso contrário documentar smoke test em comentário.

---

## Task 1: Cache helper `getAdvancedPreservationAccess` em billing/plans.js

**Files:**
- Modify: `src/billing/plans.js`
- Create: `test/core/planGating.test.js`

- [ ] **Step 1.1: Escrever teste falho do cache TTL**

Criar arquivo `test/core/planGating.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'

import { getAdvancedPreservationAccess, __resetCacheForTests } from '../../src/billing/plans.js'

function makeFakeDb(user) {
  let calls = 0
  return {
    _calls: () => calls,
    user: {
      findUnique: async () => {
        calls++
        return user
      },
    },
  }
}

test('getAdvancedPreservationAccess libera para plano pro', async () => {
  __resetCacheForTests()
  const db = makeFakeDb({ plan: 'pro', accessExpiresAt: null })
  const access = await getAdvancedPreservationAccess('u-1', { db })
  assert.equal(access.active, true)
  assert.equal(access.plan, 'pro')
})

test('getAdvancedPreservationAccess libera para trial dentro do prazo', async () => {
  __resetCacheForTests()
  const future = new Date(Date.now() + 60_000)
  const db = makeFakeDb({ plan: 'trial', accessExpiresAt: future })
  const access = await getAdvancedPreservationAccess('u-1', { db })
  assert.equal(access.active, true)
})

test('getAdvancedPreservationAccess bloqueia trial expirado', async () => {
  __resetCacheForTests()
  const past = new Date(Date.now() - 60_000)
  const db = makeFakeDb({ plan: 'trial', accessExpiresAt: past })
  const access = await getAdvancedPreservationAccess('u-1', { db })
  assert.equal(access.active, false)
})

test('getAdvancedPreservationAccess bloqueia plano basic', async () => {
  __resetCacheForTests()
  const db = makeFakeDb({ plan: 'basic', accessExpiresAt: null })
  const access = await getAdvancedPreservationAccess('u-1', { db })
  assert.equal(access.active, false)
})

test('getAdvancedPreservationAccess cacheia por TTL', async () => {
  __resetCacheForTests()
  const db = makeFakeDb({ plan: 'pro', accessExpiresAt: null })
  await getAdvancedPreservationAccess('u-1', { db })
  await getAdvancedPreservationAccess('u-1', { db })
  await getAdvancedPreservationAccess('u-1', { db })
  assert.equal(db._calls(), 1, 'só uma consulta dentro do TTL')
})

test('getAdvancedPreservationAccess revalida após TTL', async () => {
  __resetCacheForTests()
  const db = makeFakeDb({ plan: 'pro', accessExpiresAt: null })
  const now = Date.now()
  await getAdvancedPreservationAccess('u-1', { db, now })
  await getAdvancedPreservationAccess('u-1', { db, now: now + 61_000 })
  assert.equal(db._calls(), 2)
})

test('getAdvancedPreservationAccess retorna inactive quando usuário não existe', async () => {
  __resetCacheForTests()
  const db = makeFakeDb(null)
  const access = await getAdvancedPreservationAccess('u-missing', { db })
  assert.equal(access.active, false)
  assert.equal(access.plan, null)
})
```

- [ ] **Step 1.2: Rodar o teste e ver falhando**

Run: `node --test test/core/planGating.test.js`
Expected: FAIL — `getAdvancedPreservationAccess is not defined` (export ainda não existe).

- [ ] **Step 1.3: Implementar o helper em `src/billing/plans.js`**

Adicionar AO FINAL do arquivo (preservando exports atuais):

```js
// Cache em memória pra evitar martelar o DB no fan-out do bot-worker.
// TTL de 60s — aceitável: mudança de plano leva até 1min pra refletir nas defesas.
const PRESERVATION_CACHE_TTL_MS = 60_000
const preservationCache = new Map() // userId → { fetchedAt, active, plan, accessExpiresAt }

export function __resetCacheForTests() {
  preservationCache.clear()
}

/**
 * Retorna se usuário tem acesso ao Módulo de Preservação Avançada (Pro ou Trial ativo).
 * Cacheia o resultado por 60s. Use em hot paths (bot-worker fan-out, cron).
 *
 * @param {string} userId
 * @param {{ db?: object, now?: number }} opts
 * @returns {Promise<{ active: boolean, plan: string|null, accessExpiresAt: Date|null }>}
 */
export async function getAdvancedPreservationAccess(userId, opts = {}) {
  const db = opts.db
  if (!db) throw new Error('getAdvancedPreservationAccess: db obrigatório')
  const now = opts.now ?? Date.now()
  const cached = preservationCache.get(userId)
  if (cached && now - cached.fetchedAt < PRESERVATION_CACHE_TTL_MS) {
    return { active: cached.active, plan: cached.plan, accessExpiresAt: cached.accessExpiresAt }
  }
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { plan: true, accessExpiresAt: true },
  })
  if (!user) {
    const entry = { fetchedAt: now, active: false, plan: null, accessExpiresAt: null }
    preservationCache.set(userId, entry)
    return { active: false, plan: null, accessExpiresAt: null }
  }
  const active = canUseAdvancedPreservation(user, { now: new Date(now) })
  const entry = { fetchedAt: now, active, plan: user.plan, accessExpiresAt: user.accessExpiresAt }
  preservationCache.set(userId, entry)
  return { active, plan: user.plan, accessExpiresAt: user.accessExpiresAt }
}
```

- [ ] **Step 1.4: Rodar o teste**

Run: `node --test test/core/planGating.test.js`
Expected: 7/7 PASS.

- [ ] **Step 1.5: Commit**

```bash
git add src/billing/plans.js test/core/planGating.test.js
git commit -m "feat(billing): cache de getAdvancedPreservationAccess com TTL 60s"
```

---

## Task 2: Gating em `checkAndReserve` (channelThrottle)

**Files:**
- Modify: `src/core/channelThrottle.js`
- Modify: `test/core/channelThrottle.test.js`

- [ ] **Step 2.1: Adicionar teste do curto-circuito**

Abrir `test/core/channelThrottle.test.js` e adicionar AO FINAL:

```js
test('checkAndReserve curto-circuita quando preservationActive=false', async () => {
  const db = {
    channelThrottle: {
      findUnique: async () => { throw new Error('NÃO deveria consultar throttle quando gating off') },
      upsert: async () => { throw new Error('NÃO deveria reservar quando gating off') },
    },
  }
  const result = await checkAndReserve('g-1', { channelMinIntervalSec: 30 }, {
    db,
    preservationActive: false,
    getHealth: async () => ({}),
  })
  assert.equal(result.allow, true)
  assert.equal(result.reason, 'gating_off')
})
```

(O import de `checkAndReserve` já deve existir no arquivo.)

- [ ] **Step 2.2: Rodar e ver falhando**

Run: `node --test test/core/channelThrottle.test.js`
Expected: FAIL — porque `preservationActive` é ignorado e a função vai chamar `findUnique`.

- [ ] **Step 2.3: Implementar curto-circuito**

Em `src/core/channelThrottle.js`, modificar `checkAndReserve` (linha ~130):

```js
export async function checkAndReserve(groupId, botConfig, opts = {}) {
  if (opts.preservationActive === false) {
    return { allow: true, reason: 'gating_off' }
  }
  const db = opts.db ?? defaultDb
  const now = opts.now ?? Date.now()
  // ... resto inalterado
```

- [ ] **Step 2.4: Rodar testes**

Run: `node --test test/core/channelThrottle.test.js`
Expected: ALL PASS (incluindo o novo).

- [ ] **Step 2.5: Commit**

```bash
git add src/core/channelThrottle.js test/core/channelThrottle.test.js
git commit -m "feat(throttle): curto-circuito de checkAndReserve com preservationActive=false"
```

---

## Task 3: Gating em `canFollowNow` (followGuard)

**Files:**
- Modify: `src/core/followGuard.js`
- Modify: `test/core/followGuard.test.js`

- [ ] **Step 3.1: Adicionar teste**

Abrir `test/core/followGuard.test.js` e adicionar AO FINAL:

```js
test('canFollowNow nega quando preservationActive=false', async () => {
  const db = {
    followLog: { findMany: async () => { throw new Error('não deve consultar') } },
    waSession: { findFirst: async () => ({ createdAt: new Date() }) },
  }
  const decision = await canFollowNow('u-1', {
    db,
    preservationActive: false,
    botConfig: { maxDailyFollows: 3 },
  })
  assert.equal(decision.allow, false)
  assert.equal(decision.reason, 'gating_off')
})
```

- [ ] **Step 3.2: Rodar e ver falhando**

Run: `node --test test/core/followGuard.test.js`
Expected: FAIL.

- [ ] **Step 3.3: Implementar**

Em `src/core/followGuard.js`, modificar `canFollowNow` (linha ~93):

```js
export async function canFollowNow(userId, opts = {}) {
  if (opts.preservationActive === false) {
    return { allow: false, reason: 'gating_off' }
  }
  // ... resto inalterado
```

- [ ] **Step 3.4: Rodar testes**

Run: `node --test test/core/followGuard.test.js`
Expected: ALL PASS.

- [ ] **Step 3.5: Commit**

```bash
git add src/core/followGuard.js test/core/followGuard.test.js
git commit -m "feat(followGuard): canFollowNow nega quando preservationActive=false"
```

---

## Task 4: Gating em `captureAllForUser` (channelSnapshot)

**Files:**
- Modify: `src/jobs/channelSnapshot.js`
- Modify: `test/jobs/channelSnapshot.test.js`

- [ ] **Step 4.1: Adicionar teste**

Abrir `test/jobs/channelSnapshot.test.js` e adicionar AO FINAL (antes do último parêntese de fim de arquivo):

```js
test('captureAllForUser pula quando preservationActive=false', async () => {
  const db = makeFakeDb({
    groups: [
      { id: 'g-1', userId: 'u', role: 'post', kind: 'channel', waJid: 'a@newsletter' },
    ],
  })
  const summary = await captureAllForUser('u', {
    db,
    getMetadata: async () => ({ jid: 'a@newsletter', name: 'X' }),
    preservationActive: false,
  })
  assert.equal(summary.captured, 0)
  assert.equal(summary.gated, 1)
  assert.equal(db._snapshots.has('g-1'), false)
})
```

- [ ] **Step 4.2: Rodar e ver falhando**

Run: `node --test test/jobs/channelSnapshot.test.js`
Expected: FAIL.

- [ ] **Step 4.3: Implementar**

Em `src/jobs/channelSnapshot.js`, modificar `captureAllForUser`:

```js
export async function captureAllForUser(userId, opts = {}) {
  if (opts.preservationActive === false) {
    return { captured: 0, skipped: 0, errors: 0, gated: 1 }
  }
  // ... resto inalterado
```

E no `scripts/run_channel_snapshots.mjs`, filtrar usuários antes de chamar `captureAllForUser`:

```js
// scripts/run_channel_snapshots.mjs (modificar)
import { getAdvancedPreservationAccess } from '../src/billing/plans.js'
import db from '../src/db.js'

// ... dentro do loop principal por usuário:
const access = await getAdvancedPreservationAccess(user.id, { db })
const summary = await captureAllForUser(user.id, {
  db,
  getMetadata,
  preservationActive: access.active,
})
```

Antes de aplicar, confirmar a estrutura atual do script:
```bash
cat scripts/run_channel_snapshots.mjs
```
Adaptar a chamada existente conforme padrão local. **Não** mudar logging nem signature.

- [ ] **Step 4.4: Rodar testes**

Run: `node --test test/jobs/channelSnapshot.test.js`
Expected: ALL PASS.

- [ ] **Step 4.5: Commit**

```bash
git add src/jobs/channelSnapshot.js scripts/run_channel_snapshots.mjs test/jobs/channelSnapshot.test.js
git commit -m "feat(snapshot): pula captura quando preservationActive=false"
```

---

## Task 5: Gating em `runProbeWatchdog`

**Files:**
- Modify: `src/core/channelProbe.js`

- [ ] **Step 5.1: Ler `runProbeWatchdog` atual**

```bash
sed -n '51,90p' src/core/channelProbe.js
```

- [ ] **Step 5.2: Modificar pra filtrar por gating**

Substituir o corpo do `runProbeWatchdog` por uma versão que, ANTES de cada per-user processing, chama `getAdvancedPreservationAccess` e pula se off. Adicionar import no topo:

```js
import { getAdvancedPreservationAccess } from '../billing/plans.js'
```

E dentro do loop por usuário (adaptar à estrutura atual):

```js
const access = await getAdvancedPreservationAccess(user.id, { db })
if (!access.active) continue
// ... resto do processamento por usuário
```

- [ ] **Step 5.3: Confirmar manualmente que não quebra a função (sem teste novo)**

`runProbeWatchdog` é watchdog que roda em setInterval; testar é caro. Cobertura via smoke em staging.

- [ ] **Step 5.4: Commit**

```bash
git add src/core/channelProbe.js
git commit -m "feat(probe): watchdog pula usuários sem preservationActive"
```

---

## Task 6: Wrap das chamadas Phase 5 em `bot-worker.js`

**Files:**
- Modify: `src/bot-worker.js`

- [ ] **Step 6.1: Importar `getAdvancedPreservationAccess` no topo**

Adicionar ao bloco de imports (perto dos outros `import` de `./core/`):

```js
import { getAdvancedPreservationAccess } from './billing/plans.js'
```

- [ ] **Step 6.2: Cachear `preservationActive` em `loadConfig`**

Em `src/bot-worker.js:253-297` (função `loadConfig`), após o `user` ser carregado e antes do `return`, adicionar:

```js
const preservation = await getAdvancedPreservationAccess(userId, { db })
return { credentials, groups, plan: user.plan, botConfig, preservationActive: preservation.active }
```

- [ ] **Step 6.3: Passar `preservationActive` pra `checkAndReserve`**

Em `src/bot-worker.js:608-610`:

```js
const cfg = await getConfig().catch(() => null)
const botConfigForThrottle = cfg?.botConfig ?? {}
const decision = await throttleCheckAndReserve(channelGroupId, botConfigForThrottle, {
  preservationActive: cfg?.preservationActive ?? false,
})
```

(Aplicar a mesma mudança no retry abaixo, linha ~619.)

- [ ] **Step 6.4: Gating no `applyVariation` (linha ~1212)**

Trocar:
```js
? applyVariation(finalText, { groupId: destJid, poolJson: cfg.botConfig.copyVariationPoolJson })
```
Por:
```js
? (cfg.preservationActive
    ? applyVariation(finalText, { groupId: destJid, poolJson: cfg.botConfig.copyVariationPoolJson })
    : finalText)
```

- [ ] **Step 6.5: Gating no jitter stagger (linha ~1216-1217)**

```js
const staggerMs = (destIndex > 0 && isChannelDest && cfg.preservationActive && staggerJitterMs > 0)
  ? Math.floor(Math.random() * staggerJitterMs)
  : 0
```

- [ ] **Step 6.6: Gating no image mutation (linha ~1249)**

```js
if (image && isChannelDest && cfg.preservationActive && cfg.botConfig.imageMutationEnabled) {
```

- [ ] **Step 6.7: Smoke test local — process boota?**

Não tem teste unitário trivial pro bot-worker (depende de Baileys). Validação:

```bash
node -e "import('./src/bot-worker.js').then(()=>console.log('OK')).catch(e=>{console.error(e); process.exit(1)})"
```
Expected: `OK` (módulo carrega sem erro sintático).

- [ ] **Step 6.8: Commit**

```bash
git add src/bot-worker.js
git commit -m "feat(worker): aplica gating preservationActive nas defesas Phase 5"
```

---

## Task 7: Rotas `/api/preservation/*`

**Files:**
- Create: `src/api/routes/preservation.js`
- Modify: `src/api/server.js`

- [ ] **Step 7.1: Criar `src/api/routes/preservation.js`**

Conteúdo completo:

```js
import db from '../../db.js'
import {
  FEATURE_CODES,
  buildFeatureGateError,
  getAdvancedPreservationAccess,
} from '../../billing/plans.js'
import { getHealth as getChannelHealth } from '../../core/channelHealth.js'
import { collectScoreInputs, recomputeScore } from '../../core/reportRiskScore.js'
import { getClickStats } from '../../core/clickTracker.js'

const PRESERVATION_CONFIG_KEYS = [
  'channelMinIntervalSec',
  'channelBurstCap',
  'channelBurstWindowSec',
  'channelDailyCap',
  'channelStaggerJitterMs',
  'channelQuietHoursJson',
  'maxDailyFollows',
  'copyVariationPoolJson',
  'imageMutationEnabled',
  'probeEnabled',
]

function pickConfig(botConfig) {
  const out = {}
  for (const k of PRESERVATION_CONFIG_KEYS) out[k] = botConfig?.[k] ?? null
  out.probeAccountSessionId = botConfig?.probeAccountSessionId ?? null
  return out
}

function validatePartialUpdate(body = {}) {
  const updates = {}
  const errors = []
  const int = (key, { min = 0, max = Number.MAX_SAFE_INTEGER, nullable = false } = {}) => {
    if (!(key in body)) return
    const v = body[key]
    if (nullable && v === null) { updates[key] = null; return }
    if (!Number.isInteger(v) || v < min || v > max) {
      errors.push(`${key} deve ser inteiro entre ${min} e ${max}${nullable ? ' ou null' : ''}`)
      return
    }
    updates[key] = v
  }
  const bool = (key) => {
    if (!(key in body)) return
    if (typeof body[key] !== 'boolean') { errors.push(`${key} deve ser boolean`); return }
    updates[key] = body[key]
  }
  const json = (key) => {
    if (!(key in body)) return
    if (typeof body[key] !== 'string') { errors.push(`${key} deve ser string JSON`); return }
    try { JSON.parse(body[key]) } catch { errors.push(`${key} contém JSON inválido`); return }
    updates[key] = body[key]
  }

  int('channelMinIntervalSec', { min: 1, max: 86400 })
  int('channelBurstCap', { min: 1, max: 1000 })
  int('channelBurstWindowSec', { min: 60, max: 86400 })
  int('channelDailyCap', { min: 1, max: 10000, nullable: true })
  int('channelStaggerJitterMs', { min: 0, max: 600000 })
  int('maxDailyFollows', { min: 1, max: 50 })
  json('channelQuietHoursJson')
  json('copyVariationPoolJson')
  bool('imageMutationEnabled')
  bool('probeEnabled')

  return { updates, errors }
}

async function requirePreservationAccess(req, reply) {
  const access = await getAdvancedPreservationAccess(req.user.sub, { db })
  if (!access.active) {
    return reply.code(402).send(buildFeatureGateError(FEATURE_CODES.ADVANCED_PRESERVATION))
  }
}

export async function preservationRoutes(app) {
  app.addHook('preHandler', async (req) => req.jwtVerify())

  // ---------- Config ----------
  app.get('/config', async (req, reply) => {
    const gateError = await requirePreservationAccess(req, reply)
    if (gateError) return
    const cfg = await db.botConfig.findUnique({ where: { userId: req.user.sub } })
    const flags = {
      clickTrackerSaltConfigured: Boolean(process.env.CLICK_HASH_SALT),
      shortlinkBaseUrl: process.env.SHORTLINK_BASE_URL || null,
    }
    return { config: pickConfig(cfg ?? {}), flags }
  })

  app.put('/config', async (req, reply) => {
    const gateError = await requirePreservationAccess(req, reply)
    if (gateError) return
    const { updates, errors } = validatePartialUpdate(req.body)
    if (errors.length) return reply.code(400).send({ error: errors.join('; '), errors })
    const updated = await db.botConfig.upsert({
      where: { userId: req.user.sub },
      update: updates,
      create: { userId: req.user.sub, ...updates },
    })
    return { config: pickConfig(updated) }
  })

  // ---------- Monitoring ----------
  app.get('/monitoring/health', async (req, reply) => {
    const gateError = await requirePreservationAccess(req, reply)
    if (gateError) return
    const groups = await db.group.findMany({
      where: { userId: req.user.sub, role: 'post' },
      select: { id: true, name: true, waJid: true, kind: true },
    })
    const out = await Promise.all(groups.map(async (g) => {
      const health = await getChannelHealth(g.id, { db })
      return { groupId: g.id, name: g.name, waJid: g.waJid, kind: g.kind, health }
    }))
    return { items: out }
  })

  app.get('/monitoring/risk-score', async (req, reply) => {
    const gateError = await requirePreservationAccess(req, reply)
    if (gateError) return
    const channels = await db.group.findMany({
      where: { userId: req.user.sub, role: 'post', kind: 'channel' },
      include: { channelHealth: true },
    })
    const items = channels.map((g) => ({
      groupId: g.id,
      name: g.name,
      waJid: g.waJid,
      score: g.channelHealth?.reportRiskScore ?? null,
    }))
    const validScores = items.map(i => i.score).filter(s => typeof s === 'number')
    const avg = validScores.length
      ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
      : null
    return { items, avgScore: avg }
  })

  app.post('/monitoring/risk-score/recompute-all', async (req, reply) => {
    const gateError = await requirePreservationAccess(req, reply)
    if (gateError) return
    const channels = await db.group.findMany({
      where: { userId: req.user.sub, role: 'post', kind: 'channel' },
      select: { id: true },
    })
    let recomputed = 0
    for (const g of channels) {
      try {
        await recomputeScore(g.id, { db })
        recomputed++
      } catch {}
    }
    return { recomputed, total: channels.length }
  })

  app.get('/monitoring/follows', async (req, reply) => {
    const gateError = await requirePreservationAccess(req, reply)
    if (gateError) return
    const limit = Math.min(Number(req.query?.limit ?? 20) || 20, 200)
    const items = await db.followLog.findMany({
      where: { userId: req.user.sub },
      orderBy: { followedAt: 'desc' },
      take: limit,
    })
    return { items }
  })

  app.get('/monitoring/snapshots', async (req, reply) => {
    const gateError = await requirePreservationAccess(req, reply)
    if (gateError) return
    const channels = await db.group.findMany({
      where: { userId: req.user.sub, role: 'post', kind: 'channel' },
      select: { id: true, name: true, waJid: true },
    })
    const items = await Promise.all(channels.map(async (g) => {
      const snaps = await db.channelSnapshot.findMany({
        where: { groupId: g.id },
        orderBy: { snapshotedAt: 'desc' },
        take: 1,
        select: { snapshotedAt: true },
      })
      const count = await db.channelSnapshot.count({ where: { groupId: g.id } })
      return {
        groupId: g.id,
        name: g.name,
        waJid: g.waJid,
        lastSnapshotAt: snaps[0]?.snapshotedAt ?? null,
        total: count,
      }
    }))
    return { items }
  })

  app.get('/monitoring/probe', async (req, reply) => {
    const gateError = await requirePreservationAccess(req, reply)
    if (gateError) return
    const cfg = await db.botConfig.findUnique({ where: { userId: req.user.sub } })
    const channels = await db.group.findMany({
      where: { userId: req.user.sub, role: 'post', kind: 'channel' },
      include: { channelHealth: true },
    })
    const items = channels.map((g) => ({
      groupId: g.id,
      name: g.name,
      waJid: g.waJid,
      lastProbeSeenAt: g.channelHealth?.lastProbeSeenAt ?? null,
    }))
    return {
      enabled: Boolean(cfg?.probeEnabled),
      probeAccountSessionId: cfg?.probeAccountSessionId ?? null,
      items,
    }
  })

  app.get('/monitoring/clicks', async (req, reply) => {
    const gateError = await requirePreservationAccess(req, reply)
    if (gateError) return
    const stats = await getClickStats(req.user.sub, { db })
    return stats
  })
}
```

- [ ] **Step 7.2: Confirmar que `getClickStats` aceita assinatura usada**

```bash
grep -n "export.*getClickStats" src/core/clickTracker.js
```
Se a assinatura for diferente (e.g. `(userId, opts)` vs outra), ajustar a chamada acima. Se a função retornar shape diferente do esperado, adaptar o handler `/monitoring/clicks` pra repassar o que vier.

- [ ] **Step 7.3: Registrar a rota em `src/api/server.js`**

Em `src/api/server.js`, adicionar:

```js
import { preservationRoutes } from './routes/preservation.js'
```

E após linha 263:

```js
app.register(preservationRoutes, { prefix: '/api/preservation' })
```

- [ ] **Step 7.4: Smoke local — server boota?**

```bash
node -e "import('./src/api/server.js').then(()=>{console.log('OK'); process.exit(0)}).catch(e=>{console.error(e); process.exit(1)})"
```

Pode dar erro de JWT_SECRET no boot — está OK (significa que carregou até a validação de env). Se o erro for sobre imports, voltar e corrigir.

- [ ] **Step 7.5: Commit**

```bash
git add src/api/routes/preservation.js src/api/server.js
git commit -m "feat(api): rotas /api/preservation/* (config + monitoring) com gating estrito"
```

---

## Task 8: `dashboard/lib/plan.js` (centraliza gating no frontend)

**Files:**
- Create: `dashboard/lib/plan.js`
- Modify: `dashboard/app/dashboard/configuracoes/page.js`

- [ ] **Step 8.1: Criar `dashboard/lib/plan.js`**

```js
export function isTrialActive(planSubject) {
  if (planSubject?.plan !== 'trial' || !planSubject?.accessExpiresAt) return false
  const expiresAt = new Date(planSubject.accessExpiresAt)
  return !Number.isNaN(expiresAt.getTime()) && expiresAt > new Date()
}

export function canAccessAdvancedPreservation(planSubject) {
  return planSubject?.plan === 'pro' || isTrialActive(planSubject)
}
```

- [ ] **Step 8.2: Atualizar `configuracoes/page.js` pra importar do lib**

Em `dashboard/app/dashboard/configuracoes/page.js`:

- Remover as funções locais `hasActiveTrial` (linha 22) e `canAccessAdvancedPreservation` (linha 28).
- Adicionar import no topo:
```js
import { canAccessAdvancedPreservation } from '@/lib/plan'
```
- Substituir todas as chamadas locais por `canAccessAdvancedPreservation(planSubject)` (já é o nome usado).

- [ ] **Step 8.3: Smoke — lint**

```bash
cd dashboard && npx eslint app/dashboard/configuracoes/page.js lib/plan.js
```
Expected: sem erros.

- [ ] **Step 8.4: Commit**

```bash
git add dashboard/lib/plan.js dashboard/app/dashboard/configuracoes/page.js
git commit -m "refactor(dashboard): centraliza canAccessAdvancedPreservation em lib/plan"
```

---

## Task 9: Helpers em `dashboard/lib/api.js`

**Files:**
- Modify: `dashboard/lib/api.js`

- [ ] **Step 9.1: Adicionar helpers**

No objeto `api = {...}` em `dashboard/lib/api.js`, adicionar (após os helpers existentes de channelHealth/channelSnapshots):

```js
  preservationConfig: () => apiFetch('/api/preservation/config'),
  updatePreservationConfig: (patch) => apiFetch('/api/preservation/config', {
    method: 'PUT', body: JSON.stringify(patch),
    headers: { 'Content-Type': 'application/json' },
  }),
  preservationHealth: () => apiFetch('/api/preservation/monitoring/health'),
  preservationRiskScore: () => apiFetch('/api/preservation/monitoring/risk-score'),
  preservationRiskScoreRecomputeAll: () => apiFetch('/api/preservation/monitoring/risk-score/recompute-all', { method: 'POST' }),
  preservationFollows: (limit = 20) => apiFetch(`/api/preservation/monitoring/follows?limit=${limit}`),
  preservationSnapshots: () => apiFetch('/api/preservation/monitoring/snapshots'),
  preservationProbe: () => apiFetch('/api/preservation/monitoring/probe'),
  preservationClicks: () => apiFetch('/api/preservation/monitoring/clicks'),
```

- [ ] **Step 9.2: Lint**

```bash
cd dashboard && npx eslint lib/api.js
```

- [ ] **Step 9.3: Commit**

```bash
git add dashboard/lib/api.js
git commit -m "feat(dashboard): api helpers para /api/preservation/*"
```

---

## Task 10: Sidebar — novo grupo "Preservação Avançada"

**Files:**
- Modify: `dashboard/app/dashboard/DashboardClientLayout.js`

- [ ] **Step 10.1: Adicionar grupo na navGroups**

Localizar em `dashboard/app/dashboard/DashboardClientLayout.js:7-30` o array `navGroups`. Adicionar novo grupo **entre** "Configuração" (que termina em `]` da linha ~19) e "Conta":

```js
  {
    title: 'Preservação Avançada',
    pro: true,
    items: [
      { href: '/dashboard/preservacao/monitoramento', icon: '📊', label: 'Monitoramento' },
      { href: '/dashboard/preservacao/configuracoes',  icon: '⚙️', label: 'Configurações avançadas' },
    ],
  },
```

- [ ] **Step 10.2: Importar `canAccessAdvancedPreservation`**

No topo:
```js
import { canAccessAdvancedPreservation } from '@/lib/plan'
```

- [ ] **Step 10.3: Render do cadeado**

Localizar o render do item de navegação (linha ~157 `navGroups.map(group => ...)`). Encontrar onde cada `item` é renderizado (`<Link href={item.href}...>`) e ajustar o label:

```jsx
const itemLocked = group.pro && !canAccessAdvancedPreservation(planSubject)
// ...
<Link
  href={item.href}
  className={`... ${itemLocked ? 'opacity-70' : ''}`}
  ...
>
  <span>{item.icon}</span>
  <span>{item.label}{itemLocked ? ' 🔒' : ''}</span>
</Link>
```

(O `planSubject` já está disponível no escopo do componente — vide linha 81 `setPlanSubject(...)` no useEffect existente.)

- [ ] **Step 10.4: Lint + smoke**

```bash
cd dashboard && npx eslint app/dashboard/DashboardClientLayout.js
```

- [ ] **Step 10.5: Commit**

```bash
git add dashboard/app/dashboard/DashboardClientLayout.js
git commit -m "feat(dashboard): grupo Preservação Avançada na sidebar com cadeado pra não-Pro"
```

---

## Task 11: Layout wrapper + redirect

**Files:**
- Create: `dashboard/app/dashboard/preservacao/page.js`
- Create: `dashboard/app/dashboard/preservacao/layout.js`

- [ ] **Step 11.1: Criar redirect em `page.js`**

```js
// dashboard/app/dashboard/preservacao/page.js
import { redirect } from 'next/navigation'

export default function PreservacaoIndex() {
  redirect('/dashboard/preservacao/monitoramento')
}
```

- [ ] **Step 11.2: Criar layout wrapper client**

```js
// dashboard/app/dashboard/preservacao/layout.js
'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { canAccessAdvancedPreservation } from '@/lib/plan'
import { LoadingState } from '@/components/States'
import { UpsellShell } from '@/components/preservacao/UpsellShell'

export default function PreservacaoLayout({ children }) {
  const [planSubject, setPlanSubject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    api.me()
      .then(me => {
        if (!active) return
        setPlanSubject({ plan: me?.plan ?? 'trial', accessExpiresAt: me?.accessExpiresAt ?? null })
      })
      .catch(err => active && setError(err.message))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [])

  if (loading) return <LoadingState message="Carregando..." />
  if (error) return <p className="text-sm text-red-600" role="alert">{error}</p>
  if (!canAccessAdvancedPreservation(planSubject)) return <UpsellShell />
  return <>{children}</>
}
```

- [ ] **Step 11.3: Lint**

```bash
cd dashboard && npx eslint app/dashboard/preservacao/page.js app/dashboard/preservacao/layout.js
```

- [ ] **Step 11.4: Commit**

```bash
git add dashboard/app/dashboard/preservacao/page.js dashboard/app/dashboard/preservacao/layout.js
git commit -m "feat(dashboard): rota raiz /preservacao + layout que decide upsell vs children"
```

---

## Task 12: `UpsellShell` (componente)

**Files:**
- Create: `dashboard/components/preservacao/UpsellShell.js`

- [ ] **Step 12.1: Criar componente**

```js
// dashboard/components/preservacao/UpsellShell.js
'use client'
import Link from 'next/link'

const FEATURES = [
  { icon: '📈', title: 'Limite inteligente por canal', desc: 'O bot espalha envios pra não estourar cap diário ou em rajadas.' },
  { icon: '🐢', title: 'Espaçamento humano', desc: 'Pausa pequena entre canais diferentes pra parecer natural.' },
  { icon: '🎲', title: 'Variação automática de textos', desc: 'Cada mensagem sai com pequenas variações pré-configuradas.' },
  { icon: '🖼️', title: 'Mutação leve de imagens', desc: 'Crop e recompressão sutis pra evitar hash duplicado.' },
  { icon: '🩺', title: 'Saúde dos canais', desc: 'Status verde/amarelo/vermelho pra cada canal de destino.' },
  { icon: '🔭', title: 'Probe externo', desc: 'Detecta sombras de banimento antes que afete o envio.' },
  { icon: '📊', title: 'Score de risco', desc: 'Estimativa 0-100 da chance de denúncia por canal.' },
  { icon: '📸', title: 'Snapshots diários', desc: 'Histórico do estado de cada canal — 30 dias guardados.' },
]

export function UpsellShell() {
  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-1">🛡️ Módulo de Preservação Avançada</h2>
        <p className="text-sm text-gray-600">
          Mantenha seus canais saudáveis com camadas extras de defesa estatística contra denúncia e shadowban.
        </p>
      </header>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {FEATURES.map(f => (
          <li key={f.title} className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100">
            <div className="flex items-start gap-3">
              <span className="text-2xl" aria-hidden="true">{f.icon}</span>
              <div>
                <p className="font-semibold text-gray-800 text-sm">{f.title}</p>
                <p className="text-xs text-gray-500 mt-1">{f.desc}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-xs text-gray-500">
        Disponível no plano Pro e durante o Trial. O Trial libera todas as funcionalidades por tempo limitado.
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <Link href="/dashboard/assinaturas"
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2">
          Ativar Pro
        </Link>
        <Link href="/planos"
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
          Ver detalhes do plano
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 12.2: Lint**

```bash
cd dashboard && npx eslint components/preservacao/UpsellShell.js
```

- [ ] **Step 12.3: Commit**

```bash
git add dashboard/components/preservacao/UpsellShell.js
git commit -m "feat(dashboard): UpsellShell explicando o módulo e CTAs"
```

---

## Task 13: Página de Monitoramento + 6 cards

Cada card é um arquivo isolado. Ordem: criar 6 componentes, depois a página que os agrega.

### Task 13.A: `HealthOverview`

**Files:**
- Create: `dashboard/components/preservacao/HealthOverview.js`

- [ ] **Step 13.A.1: Criar componente**

```js
'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { LoadingState, ErrorState } from '@/components/States'

const STATUS_LABEL = { green: '🟢 Saudável', yellow: '🟡 Atenção', red: '🔴 Pausado', gray: '⚫ Sem dados' }

export function HealthOverview() {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')

  async function load() {
    try {
      setError('')
      const data = await api.preservationHealth()
      setItems(data.items ?? [])
    } catch (e) { setError(e.message) }
  }
  useEffect(() => { load() }, [])

  return (
    <section className="bg-white rounded-2xl shadow p-4">
      <header className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-800 text-sm">🩺 Saúde dos canais</h3>
          <p className="text-xs text-gray-500">
            Cada canal de destino tem um status: verde envia normal, amarelo está com falhas, vermelho está pausado pelo bot, cinza sem dados ainda.
          </p>
        </div>
        <button onClick={load} className="text-xs text-green-700 hover:underline">Atualizar</button>
      </header>
      {error && <ErrorState message={error} />}
      {!items && !error && <LoadingState message="Carregando saúde..." />}
      {items && items.length === 0 && <p className="text-xs text-gray-500">Sem canais de destino configurados.</p>}
      {items && items.length > 0 && (
        <table className="w-full text-xs">
          <thead className="text-gray-500 text-left">
            <tr><th className="py-1">Canal</th><th>Status</th><th>Última falha</th></tr>
          </thead>
          <tbody>
            {items.map(it => (
              <tr key={it.groupId} className="border-t border-gray-100">
                <td className="py-1.5 pr-2 font-medium text-gray-700">{it.name || it.waJid}</td>
                <td>{STATUS_LABEL[it.health?.status ?? 'gray'] ?? '⚫ Sem dados'}</td>
                <td className="text-gray-500">{it.health?.lastFailureAt ? new Date(it.health.lastFailureAt).toLocaleString('pt-BR') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
```

- [ ] **Step 13.A.2: Commit**

```bash
git add dashboard/components/preservacao/HealthOverview.js
git commit -m "feat(dashboard): HealthOverview card"
```

### Task 13.B: `RiskScoreSummary`

**Files:**
- Create: `dashboard/components/preservacao/RiskScoreSummary.js`

- [ ] **Step 13.B.1: Criar componente**

```js
'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { LoadingState, ErrorState } from '@/components/States'

export function RiskScoreSummary() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [recomputing, setRecomputing] = useState(false)

  async function load() {
    try {
      setError('')
      setData(await api.preservationRiskScore())
    } catch (e) { setError(e.message) }
  }
  useEffect(() => { load() }, [])

  async function recompute() {
    setRecomputing(true)
    try { await api.preservationRiskScoreRecomputeAll(); await load() }
    catch (e) { setError(e.message) }
    finally { setRecomputing(false) }
  }

  return (
    <section className="bg-white rounded-2xl shadow p-4">
      <header className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-800 text-sm">📊 Risco de denúncia</h3>
          <p className="text-xs text-gray-500">
            Score 0-100 estima a chance de cada canal ser denunciado, baseado em quantidade de posts vs seguidores e diversidade de fontes. Quanto menor, melhor.
          </p>
        </div>
        <button onClick={recompute} disabled={recomputing} className="text-xs text-green-700 hover:underline disabled:opacity-50">
          {recomputing ? 'Recalculando...' : 'Recalcular tudo'}
        </button>
      </header>
      {error && <ErrorState message={error} />}
      {!data && !error && <LoadingState message="Carregando..." />}
      {data && (
        <>
          <p className="text-2xl font-bold text-gray-800">
            {data.avgScore ?? '—'}<span className="text-sm text-gray-400">/100</span>
          </p>
          <p className="text-xs text-gray-500 mb-3">Média entre {data.items?.length ?? 0} canais.</p>
          {data.items?.length > 0 && (
            <ul className="text-xs space-y-1">
              {data.items.map(it => (
                <li key={it.groupId} className="flex justify-between border-t border-gray-100 py-1">
                  <span className="text-gray-700">{it.name || it.waJid}</span>
                  <span className="font-mono text-gray-600">{it.score ?? '—'}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
```

- [ ] **Step 13.B.2: Commit**

```bash
git add dashboard/components/preservacao/RiskScoreSummary.js
git commit -m "feat(dashboard): RiskScoreSummary card"
```

### Task 13.C: `RecentFollowsList`

**Files:**
- Create: `dashboard/components/preservacao/RecentFollowsList.js`

- [ ] **Step 13.C.1: Criar**

```js
'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { LoadingState, ErrorState } from '@/components/States'

const STATUS_PT = { ok: '✅ Seguido', failed: '❌ Falhou', rate_limited: '⏳ Limite', pending: '⏳ Em fila' }

export function RecentFollowsList() {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')

  async function load() {
    try { setError(''); const d = await api.preservationFollows(20); setItems(d.items ?? []) }
    catch (e) { setError(e.message) }
  }
  useEffect(() => { load() }, [])

  return (
    <section className="bg-white rounded-2xl shadow p-4">
      <header className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-800 text-sm">👣 Últimos follows</h3>
          <p className="text-xs text-gray-500">
            Lista dos canais que o bot tentou seguir. \"Limite\" indica que o WhatsApp pediu pra esperar — o bot espera 1h antes de tentar de novo.
          </p>
        </div>
        <button onClick={load} className="text-xs text-green-700 hover:underline">Atualizar</button>
      </header>
      {error && <ErrorState message={error} />}
      {!items && !error && <LoadingState message="Carregando..." />}
      {items && items.length === 0 && <p className="text-xs text-gray-500">Sem follows registrados ainda.</p>}
      {items && items.length > 0 && (
        <ul className="text-xs space-y-1">
          {items.map(f => (
            <li key={f.id} className="flex justify-between border-t border-gray-100 py-1">
              <span className="text-gray-700 truncate max-w-xs">{f.channelJid}</span>
              <span className="text-gray-500">{STATUS_PT[f.status] ?? f.status}</span>
              <span className="text-gray-400">{new Date(f.followedAt).toLocaleString('pt-BR')}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
```

- [ ] **Step 13.C.2: Commit**

```bash
git add dashboard/components/preservacao/RecentFollowsList.js
git commit -m "feat(dashboard): RecentFollowsList card"
```

### Task 13.D: `SnapshotsList`

**Files:**
- Create: `dashboard/components/preservacao/SnapshotsList.js`

- [ ] **Step 13.D.1: Criar**

```js
'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { LoadingState, ErrorState } from '@/components/States'

export function SnapshotsList() {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')

  async function load() {
    try { setError(''); const d = await api.preservationSnapshots(); setItems(d.items ?? []) }
    catch (e) { setError(e.message) }
  }
  useEffect(() => { load() }, [])

  return (
    <section className="bg-white rounded-2xl shadow p-4">
      <header className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-800 text-sm">📸 Snapshots dos canais</h3>
          <p className="text-xs text-gray-500">
            Todo dia o bot guarda uma foto do estado de cada canal de destino (nome, descrição, link). Útil pra investigar mudanças suspeitas.
          </p>
        </div>
        <button onClick={load} className="text-xs text-green-700 hover:underline">Atualizar</button>
      </header>
      {error && <ErrorState message={error} />}
      {!items && !error && <LoadingState message="Carregando..." />}
      {items && items.length === 0 && <p className="text-xs text-gray-500">Sem canais de destino.</p>}
      {items && items.length > 0 && (
        <ul className="text-xs space-y-1">
          {items.map(it => (
            <li key={it.groupId} className="flex justify-between border-t border-gray-100 py-1">
              <span className="text-gray-700 truncate max-w-xs">{it.name || it.waJid}</span>
              <span className="text-gray-500">{it.total} snapshots</span>
              <span className="text-gray-400">{it.lastSnapshotAt ? new Date(it.lastSnapshotAt).toLocaleDateString('pt-BR') : '—'}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
```

- [ ] **Step 13.D.2: Commit**

```bash
git add dashboard/components/preservacao/SnapshotsList.js
git commit -m "feat(dashboard): SnapshotsList card"
```

### Task 13.E: `ProbeStatus`

**Files:**
- Create: `dashboard/components/preservacao/ProbeStatus.js`

- [ ] **Step 13.E.1: Criar**

```js
'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { LoadingState, ErrorState } from '@/components/States'

export function ProbeStatus() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  async function load() {
    try { setError(''); setData(await api.preservationProbe()) }
    catch (e) { setError(e.message) }
  }
  useEffect(() => { load() }, [])

  return (
    <section className="bg-white rounded-2xl shadow p-4">
      <header className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-800 text-sm">🔭 Probe externo</h3>
          <p className="text-xs text-gray-500">
            O probe é uma conta WhatsApp \"observadora\" que confere se suas mensagens estão chegando nos canais de destino. Se não chega, é sinal de shadowban.
          </p>
        </div>
        <button onClick={load} className="text-xs text-green-700 hover:underline">Atualizar</button>
      </header>
      {error && <ErrorState message={error} />}
      {!data && !error && <LoadingState message="Carregando..." />}
      {data && (
        <>
          <p className="text-xs text-gray-700 mb-2">
            Estado: <strong>{data.enabled ? 'Ativado' : 'Desativado'}</strong>
          </p>
          {data.items?.length > 0 && (
            <ul className="text-xs space-y-1">
              {data.items.map(it => (
                <li key={it.groupId} className="flex justify-between border-t border-gray-100 py-1">
                  <span className="text-gray-700 truncate max-w-xs">{it.name || it.waJid}</span>
                  <span className="text-gray-400">{it.lastProbeSeenAt ? `visto ${new Date(it.lastProbeSeenAt).toLocaleString('pt-BR')}` : 'nunca'}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
```

- [ ] **Step 13.E.2: Commit**

```bash
git add dashboard/components/preservacao/ProbeStatus.js
git commit -m "feat(dashboard): ProbeStatus card"
```

### Task 13.F: `ClicksSummary`

**Files:**
- Create: `dashboard/components/preservacao/ClicksSummary.js`

- [ ] **Step 13.F.1: Criar**

```js
'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { LoadingState, ErrorState } from '@/components/States'

export function ClicksSummary() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  async function load() {
    try { setError(''); setData(await api.preservationClicks()) }
    catch (e) { setError(e.message) }
  }
  useEffect(() => { load() }, [])

  return (
    <section className="bg-white rounded-2xl shadow p-4">
      <header className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-800 text-sm">🔗 Cliques nos links</h3>
          <p className="text-xs text-gray-500">
            Cada link enviado pelo bot ganha um endereço curto rastreável. Aqui aparece quantos cliques cada link recebeu.
          </p>
        </div>
        <button onClick={load} className="text-xs text-green-700 hover:underline">Atualizar</button>
      </header>
      {error && <ErrorState message={error} />}
      {!data && !error && <LoadingState message="Carregando..." />}
      {data && (
        <>
          <p className="text-xs text-gray-700">
            <strong>{data.totalLinks ?? 0}</strong> links criados ·{' '}
            <strong>{data.totalClicks ?? 0}</strong> cliques no total
          </p>
          {data.topLinks?.length > 0 && (
            <ul className="text-xs mt-2 space-y-1">
              {data.topLinks.slice(0, 5).map(l => (
                <li key={l.id} className="flex justify-between border-t border-gray-100 py-1">
                  <span className="text-gray-700 truncate max-w-xs">{l.originalUrl}</span>
                  <span className="font-mono text-gray-600">{l.clicks}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
```

**Nota:** Se `getClickStats` retornar shape diferente (ex: não tem `topLinks`), adaptar o render pra usar o que vier. Ver `src/core/clickTracker.js` antes.

- [ ] **Step 13.F.2: Commit**

```bash
git add dashboard/components/preservacao/ClicksSummary.js
git commit -m "feat(dashboard): ClicksSummary card"
```

### Task 13.G: Página `monitoramento/page.js`

**Files:**
- Create: `dashboard/app/dashboard/preservacao/monitoramento/page.js`

- [ ] **Step 13.G.1: Criar**

```js
'use client'
import { HealthOverview } from '@/components/preservacao/HealthOverview'
import { RiskScoreSummary } from '@/components/preservacao/RiskScoreSummary'
import { RecentFollowsList } from '@/components/preservacao/RecentFollowsList'
import { SnapshotsList } from '@/components/preservacao/SnapshotsList'
import { ProbeStatus } from '@/components/preservacao/ProbeStatus'
import { ClicksSummary } from '@/components/preservacao/ClicksSummary'

export default function MonitoramentoPage() {
  return (
    <div className="max-w-5xl">
      <header className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-1">📊 Monitoramento</h2>
        <p className="text-sm text-gray-500">
          Veja em tempo quase real como o bot está protegendo seus canais. Atualize cada card pela seta no canto superior.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <HealthOverview />
        <RiskScoreSummary />
        <RecentFollowsList />
        <SnapshotsList />
        <ProbeStatus />
        <ClicksSummary />
      </div>
    </div>
  )
}
```

- [ ] **Step 13.G.2: Lint da pasta inteira de preservação**

```bash
cd dashboard && npx eslint app/dashboard/preservacao/ components/preservacao/
```

- [ ] **Step 13.G.3: Commit**

```bash
git add dashboard/app/dashboard/preservacao/monitoramento/page.js
git commit -m "feat(dashboard): página de Monitoramento agregando 6 cards"
```

---

## Task 14: Configurações — 7 forms isolados

Cada form é um arquivo. Padrão comum: recebe `value`, `onChange`, `disabled` via props; renderiza inputs + microcopy.

### Task 14.A: `ThrottleForm`

**Files:**
- Create: `dashboard/components/preservacao/ThrottleForm.js`

- [ ] **Step 14.A.1: Criar**

```js
'use client'

const FIELDS = [
  { key: 'channelMinIntervalSec', label: 'Intervalo mínimo entre envios (segundos)', hint: 'Tempo mínimo antes de enviar 2 mensagens seguidas no MESMO canal.', min: 1, max: 86400 },
  { key: 'channelBurstCap',        label: 'Limite por janela de rajada',              hint: 'Máximo de envios em uma janela curta de tempo (controle anti-flood).', min: 1, max: 1000 },
  { key: 'channelBurstWindowSec',  label: 'Janela da rajada (segundos)',              hint: 'Tamanho da janela usada pelo limite acima. Ex: 600 = 10 minutos.', min: 60, max: 86400 },
  { key: 'channelDailyCap',        label: 'Limite diário (envios/dia)',               hint: 'Máximo de envios em um dia inteiro para um canal. Deixe vazio para sem limite.', min: 1, max: 10000, nullable: true },
  { key: 'channelStaggerJitterMs', label: 'Jitter entre canais (ms)',                 hint: 'Pequeno atraso aleatório entre canais diferentes pra parecer humano. 90000 = até 90 segundos.', min: 0, max: 600000 },
]

export function ThrottleForm({ value, onChange, disabled }) {
  return (
    <fieldset className="bg-white rounded-2xl shadow p-5">
      <legend className="text-base font-semibold text-gray-800">⏱️ Espaçamento entre canais</legend>
      <p className="text-xs text-gray-500 mb-3">
        Controla a velocidade com que o bot dispara mensagens. Defaults seguros vêm pré-preenchidos.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map(f => (
          <label key={f.key} className="block">
            <span className="text-xs font-medium text-gray-700">{f.label}</span>
            <input
              type="number"
              min={f.min} max={f.max}
              value={value[f.key] ?? ''}
              onChange={e => onChange({ [f.key]: f.nullable && e.target.value === '' ? null : Number(e.target.value) })}
              disabled={disabled}
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-50"
            />
            <span className="text-[11px] text-gray-500 mt-1 block">{f.hint}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
```

- [ ] **Step 14.A.2: Commit**

```bash
git add dashboard/components/preservacao/ThrottleForm.js
git commit -m "feat(dashboard): ThrottleForm com 5 inputs e microcopy"
```

### Task 14.B: `FollowGuardForm`

**Files:**
- Create: `dashboard/components/preservacao/FollowGuardForm.js`

- [ ] **Step 14.B.1: Criar**

```js
'use client'

export function FollowGuardForm({ value, onChange, disabled }) {
  return (
    <fieldset className="bg-white rounded-2xl shadow p-5">
      <legend className="text-base font-semibold text-gray-800">👣 Limite de seguidas por dia</legend>
      <p className="text-xs text-gray-500 mb-3">
        Quantos canais novos o bot pode começar a seguir em um único dia. Vai começando devagar pra contas novas — esse limite é o teto.
      </p>
      <label className="block">
        <span className="text-xs font-medium text-gray-700">Máximo diário</span>
        <input
          type="number"
          min={1} max={50}
          value={value.maxDailyFollows ?? ''}
          onChange={e => onChange({ maxDailyFollows: Number(e.target.value) })}
          disabled={disabled}
          className="mt-1 w-full max-w-xs border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-50"
        />
        <span className="text-[11px] text-gray-500 mt-1 block">
          Se o WhatsApp pedir pra esperar (rate limit), o bot pausa novas seguidas por 1 hora.
        </span>
      </label>
    </fieldset>
  )
}
```

- [ ] **Step 14.B.2: Commit**

```bash
git add dashboard/components/preservacao/FollowGuardForm.js
git commit -m "feat(dashboard): FollowGuardForm"
```

### Task 14.C: `QuietHoursForm`

**Files:**
- Create: `dashboard/components/preservacao/QuietHoursForm.js`

- [ ] **Step 14.C.1: Criar**

```js
'use client'

const TZ_OPTIONS = [
  'America/Sao_Paulo',
  'America/Manaus',
  'America/Belem',
  'America/Recife',
  'UTC',
]

function parseQuiet(json) {
  try { return { startHour: 0, endHour: 6, tz: 'America/Sao_Paulo', ...JSON.parse(json || '{}') } }
  catch { return { startHour: 0, endHour: 6, tz: 'America/Sao_Paulo' } }
}

export function QuietHoursForm({ value, onChange, disabled }) {
  const q = parseQuiet(value.channelQuietHoursJson)
  const update = (patch) => onChange({ channelQuietHoursJson: JSON.stringify({ ...q, ...patch }) })

  return (
    <fieldset className="bg-white rounded-2xl shadow p-5">
      <legend className="text-base font-semibold text-gray-800">🌙 Janela silenciosa</legend>
      <p className="text-xs text-gray-500 mb-3">
        Faixa de horas em que o bot PAUSA envios pra canais. Ideal pra simular um humano que dorme. Ex: 0h a 6h da manhã.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="text-xs font-medium text-gray-700">Início (hora)</span>
          <input type="number" min={0} max={23}
            value={q.startHour}
            onChange={e => update({ startHour: Number(e.target.value) })}
            disabled={disabled}
            className="mt-1 w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-50" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-700">Fim (hora)</span>
          <input type="number" min={0} max={23}
            value={q.endHour}
            onChange={e => update({ endHour: Number(e.target.value) })}
            disabled={disabled}
            className="mt-1 w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-50" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-700">Fuso horário</span>
          <select value={q.tz}
            onChange={e => update({ tz: e.target.value })}
            disabled={disabled}
            className="mt-1 w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-50">
            {TZ_OPTIONS.map(tz => <option key={tz} value={tz}>{tz}</option>)}
          </select>
        </label>
      </div>
      <p className="text-[11px] text-gray-500 mt-2">
        Use 0 = meia-noite, 6 = 6h da manhã. O bot retoma envios automaticamente ao final da janela.
      </p>
    </fieldset>
  )
}
```

- [ ] **Step 14.C.2: Commit**

```bash
git add dashboard/components/preservacao/QuietHoursForm.js
git commit -m "feat(dashboard): QuietHoursForm com 3 inputs e parsing JSON"
```

### Task 14.D: `CopyVariationPoolEditor`

**Files:**
- Create: `dashboard/components/preservacao/CopyVariationPoolEditor.js`

- [ ] **Step 14.D.1: Criar**

```js
'use client'
import { useMemo, useState } from 'react'

const EXAMPLE_POOL = JSON.stringify({
  greetings: ['', '🔥 ', '💥 ', '⚡ '],
  ctas: ['Confira:', 'Pega já:', 'Olha essa:', 'Não perde:'],
  trailers: ['', ' 👀', ' 💸', ' 🎯'],
}, null, 2)

function tryParse(text) {
  try { JSON.parse(text); return null } catch (e) { return e.message }
}

export function CopyVariationPoolEditor({ value, onChange, disabled }) {
  const current = value.copyVariationPoolJson ?? '{}'
  const parseError = useMemo(() => tryParse(current), [current])
  const [showExample, setShowExample] = useState(false)

  return (
    <fieldset className="bg-white rounded-2xl shadow p-5">
      <legend className="text-base font-semibold text-gray-800">🎲 Variações de texto</legend>
      <p className="text-xs text-gray-500 mb-3">
        Listas de pedacinhos de texto que o bot intercala em cada envio, pra mensagens nunca saírem 100% iguais. Quanto mais variações, mais natural.
      </p>
      <textarea
        value={current}
        onChange={e => onChange({ copyVariationPoolJson: e.target.value })}
        disabled={disabled}
        rows={10}
        className="w-full font-mono text-xs border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-50"
      />
      {parseError && <p className="text-xs text-red-600 mt-1">JSON inválido: {parseError}</p>}
      <button type="button"
        onClick={() => { setShowExample(!showExample); if (!showExample) onChange({ copyVariationPoolJson: EXAMPLE_POOL }) }}
        disabled={disabled}
        className="mt-2 text-xs text-green-700 hover:underline">
        {showExample ? 'Ocultar exemplo' : 'Restaurar exemplo padrão'}
      </button>
      <p className="text-[11px] text-gray-500 mt-2">
        Formato: JSON com listas. Pelo menos uma string vazia (\"\") em cada lista é recomendado, pra não forçar variação em todo envio.
      </p>
    </fieldset>
  )
}
```

- [ ] **Step 14.D.2: Commit**

```bash
git add dashboard/components/preservacao/CopyVariationPoolEditor.js
git commit -m "feat(dashboard): CopyVariationPoolEditor com validação JSON inline"
```

### Task 14.E: `ImageMutationToggle`

**Files:**
- Create: `dashboard/components/preservacao/ImageMutationToggle.js`

- [ ] **Step 14.E.1: Criar**

```js
'use client'

export function ImageMutationToggle({ value, onChange, disabled }) {
  return (
    <fieldset className="bg-white rounded-2xl shadow p-5">
      <legend className="text-base font-semibold text-gray-800">🖼️ Mutação de imagem</legend>
      <p className="text-xs text-gray-500 mb-3">
        Quando ligado, o bot corta 1 ou 2 pixels da borda e re-salva a imagem com qualidade levemente diferente. Isso muda o \"hash\" da imagem sem afetar visualmente, evitando filtros que detectam reenvio.
      </p>
      <label className="inline-flex items-center gap-2">
        <input
          type="checkbox"
          checked={!!value.imageMutationEnabled}
          onChange={e => onChange({ imageMutationEnabled: e.target.checked })}
          disabled={disabled}
          className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-400"
        />
        <span className="text-sm text-gray-700">Ativar mutação de imagem</span>
      </label>
    </fieldset>
  )
}
```

- [ ] **Step 14.E.2: Commit**

```bash
git add dashboard/components/preservacao/ImageMutationToggle.js
git commit -m "feat(dashboard): ImageMutationToggle"
```

### Task 14.F: `ProbeToggle`

**Files:**
- Create: `dashboard/components/preservacao/ProbeToggle.js`

- [ ] **Step 14.F.1: Criar**

```js
'use client'

export function ProbeToggle({ value, onChange, disabled, probeAccountSessionId }) {
  return (
    <fieldset className="bg-white rounded-2xl shadow p-5">
      <legend className="text-base font-semibold text-gray-800">🔭 Probe externo</legend>
      <p className="text-xs text-gray-500 mb-3">
        Uma segunda conta WhatsApp conectada como observadora confere se suas mensagens chegam nos canais de destino. Se não chega, o bot marca o canal em estado de alerta.
      </p>
      <label className="inline-flex items-center gap-2">
        <input
          type="checkbox"
          checked={!!value.probeEnabled}
          onChange={e => onChange({ probeEnabled: e.target.checked })}
          disabled={disabled}
          className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-400"
        />
        <span className="text-sm text-gray-700">Ativar probe externo</span>
      </label>
      <p className="text-[11px] text-gray-500 mt-2">
        Conta probe configurada no servidor: <span className="font-mono">{probeAccountSessionId ?? 'nenhuma'}</span>.
        Pra trocar, fale com o suporte.
      </p>
    </fieldset>
  )
}
```

- [ ] **Step 14.F.2: Commit**

```bash
git add dashboard/components/preservacao/ProbeToggle.js
git commit -m "feat(dashboard): ProbeToggle"
```

### Task 14.G: `ClickTrackerStatus`

**Files:**
- Create: `dashboard/components/preservacao/ClickTrackerStatus.js`

- [ ] **Step 14.G.1: Criar**

```js
'use client'

export function ClickTrackerStatus({ flags }) {
  return (
    <fieldset className="bg-white rounded-2xl shadow p-5">
      <legend className="text-base font-semibold text-gray-800">🔗 Rastreio de cliques</legend>
      <p className="text-xs text-gray-500 mb-3">
        Cada link enviado pelo bot pode virar um endereço curto que conta os cliques. Configurado no servidor — só pra conferência aqui.
      </p>
      <ul className="text-xs space-y-1 text-gray-700">
        <li>Endereço base: <span className="font-mono">{flags?.shortlinkBaseUrl ?? 'não configurado'}</span></li>
        <li>Chave de hash configurada: <strong>{flags?.clickTrackerSaltConfigured ? '✅ Sim' : '❌ Não'}</strong></li>
      </ul>
    </fieldset>
  )
}
```

- [ ] **Step 14.G.2: Commit**

```bash
git add dashboard/components/preservacao/ClickTrackerStatus.js
git commit -m "feat(dashboard): ClickTrackerStatus read-only"
```

### Task 14.H: Página `configuracoes/page.js`

**Files:**
- Create: `dashboard/app/dashboard/preservacao/configuracoes/page.js`

- [ ] **Step 14.H.1: Criar página**

```js
'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'
import { LoadingState, ErrorState } from '@/components/States'
import { ThrottleForm } from '@/components/preservacao/ThrottleForm'
import { FollowGuardForm } from '@/components/preservacao/FollowGuardForm'
import { QuietHoursForm } from '@/components/preservacao/QuietHoursForm'
import { CopyVariationPoolEditor } from '@/components/preservacao/CopyVariationPoolEditor'
import { ImageMutationToggle } from '@/components/preservacao/ImageMutationToggle'
import { ProbeToggle } from '@/components/preservacao/ProbeToggle'
import { ClickTrackerStatus } from '@/components/preservacao/ClickTrackerStatus'

export default function ConfiguracoesAvancadasPage() {
  const [config, setConfig] = useState(null)
  const [flags, setFlags] = useState(null)
  const [draft, setDraft] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedAt, setSavedAt] = useState(null)

  useEffect(() => { load() }, [])
  async function load() {
    try {
      setError('')
      const data = await api.preservationConfig()
      setConfig(data.config)
      setFlags(data.flags)
      setDraft(data.config)
    } catch (e) { setError(e.message) }
  }

  function update(patch) {
    setDraft(d => ({ ...d, ...patch }))
  }

  async function save() {
    setSaving(true)
    setError('')
    try {
      const patch = {}
      for (const k of Object.keys(draft)) {
        if (draft[k] !== config?.[k]) patch[k] = draft[k]
      }
      if (Object.keys(patch).length === 0) { setSaving(false); return }
      const data = await api.updatePreservationConfig(patch)
      setConfig(data.config)
      setDraft(data.config)
      setSavedAt(new Date())
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  if (!config && !error) return <LoadingState message="Carregando configurações..." />
  if (error && !config) return <ErrorState message={error} actionLabel="Tentar novamente" onAction={load} />

  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-1">⚙️ Configurações avançadas</h2>
        <p className="text-sm text-gray-500">
          Ajustes finos das defesas. Os defaults já são seguros para a maioria dos casos — só mexa se entender o que cada controle faz.
        </p>
      </header>

      {error && <div className="mb-4"><Alert type="error" message={error} /></div>}
      {savedAt && <div className="mb-4"><Alert type="success" message={`Configurações salvas às ${savedAt.toLocaleTimeString('pt-BR')}.`} /></div>}

      <div className="flex flex-col gap-4">
        <ThrottleForm value={draft} onChange={update} disabled={saving} />
        <QuietHoursForm value={draft} onChange={update} disabled={saving} />
        <FollowGuardForm value={draft} onChange={update} disabled={saving} />
        <CopyVariationPoolEditor value={draft} onChange={update} disabled={saving} />
        <ImageMutationToggle value={draft} onChange={update} disabled={saving} />
        <ProbeToggle value={draft} onChange={update} disabled={saving} probeAccountSessionId={draft.probeAccountSessionId} />
        <ClickTrackerStatus flags={flags} />
      </div>

      <div className="mt-6 flex gap-3">
        <button onClick={save} disabled={saving}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
          {saving ? 'Salvando...' : 'Salvar tudo'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 14.H.2: Lint da pasta**

```bash
cd dashboard && npx eslint app/dashboard/preservacao/ components/preservacao/
```

- [ ] **Step 14.H.3: Commit**

```bash
git add dashboard/app/dashboard/preservacao/configuracoes/page.js
git commit -m "feat(dashboard): página de Configurações avançadas com 7 seções"
```

---

## Task 15: Build verification + push + PR

- [ ] **Step 15.1: Rodar testes backend completos**

```bash
node --test test/
```
Expected: tudo passa. Investigar falhas — provavelmente algum teste atualizado não recebeu `preservationActive: true` explicitamente em chamadas legadas (default `undefined` mantém comportamento atual em tudo exceto `=== false`).

- [ ] **Step 15.2: Build do dashboard**

```bash
cd dashboard && rm -rf .next && npm run build
```
Expected: build bem sucedido. Erros típicos: import case, falta de `'use client'`, tipos de prop. Corrigir até passar.

- [ ] **Step 15.3: Smoke local de boot**

```bash
node -e "import('./src/api/server.js').catch(e=>{ if(/JWT_SECRET/.test(e.message)) {console.log('OK (JWT_SECRET ausente é esperado)'); process.exit(0)} else { console.error(e); process.exit(1) }})"
```

- [ ] **Step 15.4: Push pra branch + abrir PR**

Branch: já estamos em `claude/preservacao-avancada-spec` desde a spec, ou criamos `claude/preservacao-avancada-impl` se preferir separar. Recomendação: criar branch nova `claude/preservacao-avancada-impl` partindo de `develop` atualizado e cherry-pickar a spec se já mergeada, OU continuar na mesma branch da spec.

```bash
git push -u origin <branch-name>
```

Abrir PR no GitHub (via tool `mcp__github__create_pull_request`) com:
- **Title:** `feat(preservacao): módulo de Preservação Avançada — sidebar + monitoramento + configurações`
- **Body:** referenciar a spec PR #561, listar checklist do test plan (validação manual em staging com Pro/Trial/basic + smoke do shortlink + persistência de config).

---

## Self-Review (preenchido)

### Spec coverage

| Spec section | Task que implementa |
|--------------|----------------------|
| Lógica de gating reutilizável | Task 1 (`getAdvancedPreservationAccess` com cache TTL) |
| Gating em channelThrottle | Task 2 |
| Gating em followGuard | Task 3 |
| Gating em channelSnapshot + cron | Task 4 |
| Gating em channelProbe | Task 5 |
| Wrap em bot-worker | Task 6 |
| Cache de plano TTL 60s | Task 1 |
| Rotas `/api/preservation/*` | Task 7 |
| `dashboard/lib/plan.js` | Task 8 |
| Sidebar com cadeado | Task 10 |
| `preservacao/page.js` redirect | Task 11 |
| `preservacao/layout.js` decidindo upsell | Task 11 |
| `UpsellShell` | Task 12 |
| Monitoramento — 6 cards | Task 13.A-G |
| Configurações — 7 forms | Task 14.A-H |
| Helpers em `dashboard/lib/api.js` | Task 9 |
| Microcopy em cada controle | Embutido em cada componente do Task 12-14 |
| Testes do gating | Task 1 + Task 2-4 (deltas) |
| Riscos #2 (rotas legadas em groups.js) | **Coberto**: tasks 1-7 não tocam em `routes/groups.js`; gating estrito só nas novas |

### Placeholder scan

Sem placeholders `TBD`/`TODO`. Cada passo tem código concreto.

### Type consistency

- `preservationActive` é booleano em todo lugar (worker → cores).
- `getAdvancedPreservationAccess(userId, { db, now }) → { active, plan, accessExpiresAt }` consistente em Task 1, 4, 5.
- Frontend usa `canAccessAdvancedPreservation(planSubject)` em todos os lugares (Task 8, 10, 11).
- API responses: `{ items, ... }` ou `{ config, flags }` consistente com como o frontend consome em cada card.
