# Preservation Jitter and Global Config Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the redundant global send cadence/template controls from `/painel/configuracoes` and make Preservação por destino apply a random 0–20% jitter above each destination's minimum interval.

**Architecture:** Move anti-spam timing randomness from global `BotConfig.delayMin/delayMax` to the per-destination throttle decision in `src/core/channelThrottle.js`. Keep database columns/API compatibility for now to avoid a risky schema cleanup, but stop exposing and using the global cadence in the dashboard and send pipeline. Add a pure helper for min-interval jitter so the behavior is deterministic under tests and easy to reason about.

**Tech Stack:** Node.js ESM, Fastify routes, Prisma/SQLite, Next.js App Router dashboard, Node built-in test runner.

---

## File Structure

- Modify: `src/core/channelThrottle.js`
  - Add a pure `calculateMinIntervalWithJitterMs(minIntervalSec, random)` helper.
  - Change `decideDestination()` so the `MIN_INTERVAL` defer is based on `minIntervalSec` through `minIntervalSec + random(0..20%)` instead of a fixed interval.
  - Accept optional `random` in `decideDestination()` / `checkAndReserve()` for deterministic tests.
- Modify: `test/core/channelThrottle.test.js`
  - Add direct helper tests for 600s → 600000ms at random 0 and 720000ms at random near 1.
  - Update/add min-interval decision tests to assert the randomized defer.
- Modify: `src/bot-worker.js`
  - Stop using global `delayMin/delayMax` for espelhamento sends.
  - Keep queue pressure/rest/typing behavior intact.
  - Keep channel stagger behavior intact because it is a separate channel-only feature.
- Modify: `test/smart-delay.test.js` or add `test/bot-worker-smart-delay-removal.test.js`
  - Remove/adjust assertions that expect global jitter to be part of worker send delay.
  - Keep pure `smartDelay` unit tests only if the helper remains used elsewhere; otherwise delete stale tests after verifying no imports remain.
- Modify: `dashboard/app/painel/espelhamento/page.js`
  - Stop fetching config only for cadence.
  - Remove the “1 envio a cada X–Y s / Evita parecer spam” card.
  - Remove the page comment that says `api.getConfig()` feeds cadence.
- Modify: `dashboard/app/painel/configuracoes/page.js`
  - Remove the “Cadência entre envios” section.
  - Remove the “Espelhamento com template (padrão global)” section.
  - Remove related imports/state/save payload fields if this page becomes empty or repurpose it only for still-relevant settings.
- Modify: `dashboard/lib/mobileConfigContracts.js`
  - Remove `delayMin` and `delayMax` from mobile config contract if they are no longer user-facing or used by mobile preferences.
- Modify: `test/mobile-config-contracts.test.js`
  - Update expected config contract fields after removing delay fields.
- Modify: `test/api/routes/config.mobile-prefs.test.js`
  - Remove or rewrite tests that PUT `delayMin/delayMax` or global mirror template defaults through `/api/config` if those settings are no longer supported from UI/mobile.
- Optional later cleanup, not in this implementation: Prisma migration to drop `BotConfig.delayMin`, `BotConfig.delayMax`, `mirrorTemplateKeyDefault`, and `primaryLinkTargetDefault`. Do not do this in the first implementation unless product explicitly wants a destructive schema cleanup now, because older code paths and historical rows can tolerate unused columns safely.

---

### Task 1: Add jitter to Preservação por destino min interval

**Files:**
- Modify: `src/core/channelThrottle.js`
- Test: `test/core/channelThrottle.test.js`

- [ ] **Step 1: Write failing helper tests**

Add these tests to `test/core/channelThrottle.test.js` near the existing min-interval tests:

```js
import {
  checkAndReserve,
  decideDestination,
  calculateMinIntervalWithJitterMs,
  DEFER_REASON,
} from '../../src/core/channelThrottle.js'

// Keep existing imports; only add calculateMinIntervalWithJitterMs if the file
// already imports the other symbols.

test('calculateMinIntervalWithJitterMs applies 0 to 20 percent jitter above the configured interval', () => {
  assert.equal(calculateMinIntervalWithJitterMs(600, () => 0), 600_000)
  assert.equal(calculateMinIntervalWithJitterMs(600, () => 0.999), 720_000)
  assert.equal(calculateMinIntervalWithJitterMs(600, () => 0.5), 660_000)
})

test('calculateMinIntervalWithJitterMs clamps invalid interval to the hard default before jitter', () => {
  assert.equal(calculateMinIntervalWithJitterMs(null, () => 0), 30_000)
  assert.equal(calculateMinIntervalWithJitterMs(undefined, () => 0.999), 36_000)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
node --test test/core/channelThrottle.test.js
```

Expected: FAIL with an import error or assertion failure because `calculateMinIntervalWithJitterMs` is not exported yet.

- [ ] **Step 3: Implement the helper and wire it into `decideDestination()`**

In `src/core/channelThrottle.js`, add the helper near the constants:

```js
export const MIN_INTERVAL_JITTER_RATIO = 0.2

function clampPositiveInteger(value, fallback) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.floor(n)
}

export function calculateMinIntervalWithJitterMs(minIntervalSec, random = Math.random) {
  const baseSec = clampPositiveInteger(minIntervalSec, 30)
  const safeRandom = typeof random === 'function' ? random : Math.random
  const jitterSec = Math.floor(baseSec * MIN_INTERVAL_JITTER_RATIO * safeRandom())
  return (baseSec + jitterSec) * SEC
}
```

Then change `decideDestination()` signature and min-interval calculation:

```js
export function decideDestination({ now, throttle, isPaused, dest, ignoreOperatingHours, random = Math.random }) {
  // existing health/hour/daily cap logic stays unchanged

  const lastSentAt = toMs(throttle?.lastSentAt)
  const minIntervalMs = calculateMinIntervalWithJitterMs(dest.minIntervalSec, random)
  if (throttleOn && lastSentAt && now - lastSentAt < minIntervalMs) {
    return { allow: false, reason: DEFER_REASON.MIN_INTERVAL, deferUntil: lastSentAt + minIntervalMs }
  }

  // existing burst cap / allow logic stays unchanged
}
```

Then pass the random function through `checkAndReserve()`:

```js
const decision = decideDestination({
  now,
  throttle,
  isPaused: isChannelPaused(health, now),
  dest,
  ignoreOperatingHours: opts.ignoreGlobalQuietHours === true,
  random: opts.random,
})
```

- [ ] **Step 4: Add a decision-level regression test**

Add this test to `test/core/channelThrottle.test.js`:

```js
test('decideDestination waits until lastSentAt plus randomized min interval', () => {
  const now = Date.UTC(2026, 0, 1, 12, 10, 0)
  const lastSentAt = new Date(Date.UTC(2026, 0, 1, 12, 0, 0))
  const result = decideDestination({
    now,
    throttle: { lastSentAt, dayBucket: '2026-01-01', postsToday: 1, windowStart: lastSentAt, postsInWindow: 1 },
    isPaused: false,
    dest: {
      ...DEST_DEFAULT,
      minIntervalSec: 600,
      burstCap: 99,
      burstWindowSec: 3600,
      dailyCap: null,
    },
    random: () => 0.999,
  })

  assert.equal(result.allow, false)
  assert.equal(result.reason, DEFER_REASON.MIN_INTERVAL)
  assert.equal(result.deferUntil, Date.UTC(2026, 0, 1, 12, 12, 0))
})
```

- [ ] **Step 5: Run tests to verify they pass**

Run:

```bash
node --test test/core/channelThrottle.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/channelThrottle.js test/core/channelThrottle.test.js
git commit -m "feat: add jitter to destination preservation intervals"
```

---

### Task 2: Stop applying global delayMin/delayMax in the worker send pipeline

**Files:**
- Modify: `src/bot-worker.js`
- Modify or delete: `test/smart-delay.test.js`

- [ ] **Step 1: Confirm current global delay usage**

Run:

```bash
rg -n "buildSmartDelayMs|delayMin|delayMax|calculateJitterDelayMs" src/bot-worker.js src test
```

Expected: find `buildSmartDelayMs()` in `src/bot-worker.js` and possibly pure helper tests in `test/smart-delay.test.js`.

- [ ] **Step 2: Remove global jitter from worker delay calculation**

In `src/bot-worker.js`, replace `buildSmartDelayMs()` with a queue-pressure-only helper:

```js
function buildQueuePressureDelayMs(queueSize = getSendBackendQueueSize()) {
  return calculateProgressiveDelayMs({
    baseDelayMs: 0,
    queueSize,
    threshold: SMART_DELAY_PROGRESSIVE_THRESHOLD,
    stepMs: SMART_DELAY_PROGRESSIVE_STEP_MS,
    maxExtraMs: SMART_DELAY_PROGRESSIVE_MAX_EXTRA_MS,
  })
}
```

Then replace all `buildSmartDelayMs(cfg.botConfig)` and `buildSmartDelayMs((await getConfig()).botConfig)` calls with:

```js
buildQueuePressureDelayMs()
```

For the monitored espelhamento path that adds channel stagger, use:

```js
delayMs: buildQueuePressureDelayMs() + staggerMs,
```

Keep this channel stagger block unchanged:

```js
const staggerMs = (destIndex > 0 && isChannelDest && staggerJitterMs > 0)
  ? Math.floor(Math.random() * staggerJitterMs)
  : 0
```

- [ ] **Step 3: Remove now-unused import if applicable**

If `src/bot-worker.js` no longer uses `calculateJitterDelayMs`, remove it from the `src/smartDelay.js` import list, leaving only the helpers still used:

```js
import {
  calculateProgressiveDelayMs,
  calculateRestWindowDelayMs,
  calculateTypingDelayMs,
} from './smartDelay.js'
```

- [ ] **Step 4: Adjust smart-delay tests**

If `test/smart-delay.test.js` only tests exported pure helpers, keep the `calculateJitterDelayMs` tests for now because the helper may still be exported. If product wants full dead-code deletion, remove `calculateJitterDelayMs` from `src/smartDelay.js` and replace its tests with this focused progressive-delay coverage:

```js
test('calculateProgressiveDelayMs keeps zero base when queue is below threshold', () => {
  assert.equal(calculateProgressiveDelayMs({ baseDelayMs: 0, queueSize: 19, threshold: 20 }), 0)
})

test('calculateProgressiveDelayMs adds pressure delay without global jitter', () => {
  assert.equal(calculateProgressiveDelayMs({ baseDelayMs: 0, queueSize: 20, threshold: 20, stepMs: 5000, maxExtraMs: 60000 }), 5000)
})
```

- [ ] **Step 5: Run worker-related tests**

Run:

```bash
node --test test/smart-delay.test.js test/core/channelThrottle.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/bot-worker.js src/smartDelay.js test/smart-delay.test.js
git commit -m "refactor: remove global send cadence from worker"
```

---

### Task 3: Remove redundant cards from `/painel/configuracoes`

**Files:**
- Modify: `dashboard/app/painel/configuracoes/page.js`
- Modify: `dashboard/lib/mobileConfigContracts.js`
- Modify: `test/mobile-config-contracts.test.js`
- Modify: `test/api/routes/config.mobile-prefs.test.js`

- [ ] **Step 1: Write/adjust UI source test if one exists**

Run:

```bash
rg -n "Cadência entre envios|Espelhamento com template|delayMin|mirrorTemplateKeyDefault" test dashboard/app/painel/configuracoes/page.js
```

If there is no existing test for this page, create `test/painel-configuracoes-cleanup.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../dashboard/app/painel/configuracoes/page.js', import.meta.url), 'utf8')

test('/painel/configuracoes no longer exposes global cadence or global mirror template defaults', () => {
  assert.doesNotMatch(source, /Cadência entre envios/)
  assert.doesNotMatch(source, /delayMin/)
  assert.doesNotMatch(source, /delayMax/)
  assert.doesNotMatch(source, /Espelhamento com template \(padrão global\)/)
  assert.doesNotMatch(source, /mirrorTemplateKeyDefault/)
  assert.doesNotMatch(source, /primaryLinkTargetDefault/)
})
```

- [ ] **Step 2: Run the new/adjusted test to verify it fails**

Run:

```bash
node --test test/painel-configuracoes-cleanup.test.js
```

Expected: FAIL because the page still contains those sections.

- [ ] **Step 3: Remove state and imports for deleted sections**

In `dashboard/app/painel/configuracoes/page.js`:

1. Remove these imports:

```js
import { composeTemplates, loadTemplateStore } from '@/lib/mobileTemplateStore'
```

2. Remove `DELAY_PRESETS`.
3. Remove `templates` state.
4. Replace the `useEffect` body with config-only loading for remaining fields:

```js
useEffect(() => {
  let active = true
  api.getConfig()
    .then((cfg) => {
      if (!active) return
      setForm({
        platforms: cfg.platforms ?? 'shopee,amazon,mercadolivre,magazineluiza',
        blockedKeywords: normalizeKeywords(cfg.blockedKeywords ?? '').join(','),
        welcomeMsg: cfg.welcomeMsg ?? '',
        postToStatus: cfg.postToStatus ?? false,
        brandingGroupLink: cfg.brandingGroupLink ?? '',
        brandingCtaText: cfg.brandingCtaText ?? DEFAULT_BRANDING_CTA_TEXT,
      })
    })
    .catch((err) => { if (active) setLoadError(err?.message || 'Não foi possível carregar as configurações.') })
  return () => { active = false }
}, [])
```

5. Remove `parseDelay()`.
6. In `save()`, remove delay validation and remove `mirrorTemplateKeyDefault` / `primaryLinkTargetDefault` from `api.saveConfig()`.
7. Delete the entire JSX section with title `Cadência entre envios`.
8. Delete the entire JSX section with title `Espelhamento com template (padrão global)`.
9. Keep the remaining settings sections intact.

- [ ] **Step 4: Update mobile config contract**

In `dashboard/lib/mobileConfigContracts.js`, change:

```js
export const MOBILE_CONFIG_CONTRACT_KEYS = ['welcomeMsg', 'brandingGroupLink', 'brandingCtaText', 'delayMin', 'delayMax', 'blockedKeywords', 'platforms', 'postToStatus']
```

to:

```js
export const MOBILE_CONFIG_CONTRACT_KEYS = ['welcomeMsg', 'brandingGroupLink', 'brandingCtaText', 'blockedKeywords', 'platforms', 'postToStatus']
```

Remove `delayMin`/`delayMax` normalization from the same file. The returned mobile config should no longer include these keys:

```js
return {
  welcomeMsg: String(draft?.welcomeMsg ?? ''),
  brandingGroupLink: String(draft?.brandingGroupLink ?? ''),
  brandingCtaText,
  blockedKeywords: String(draft?.blockedKeywords ?? ''),
  platforms: String(draft?.platforms ?? 'shopee,amazon,mercadolivre,magazineluiza'),
  postToStatus: Boolean(draft?.postToStatus),
}
```

- [ ] **Step 5: Update API/mobile tests that still assert removed fields**

In `test/mobile-config-contracts.test.js`, update expected keys to exclude `delayMin` and `delayMax`.

In `test/api/routes/config.mobile-prefs.test.js`, delete the test that sends only `{ delayMin: 7 }` if its only purpose is mobile preference coverage. Keep tests for `blockedKeywords`, `platforms`, `welcomeMsg`, `postToStatus`, branding fields, and any non-removed config still supported.

If there is a test for global mirror template defaults through `/api/config`, keep it only if backend compatibility is intentionally retained. Rename it to clarify it is backend compatibility, not UI behavior:

```js
test('PUT /api/config still accepts legacy mirror template defaults for backward compatibility', async () => {
  const put = await app.inject({ method: 'PUT', url: '/api/config', payload: { mirrorTemplateKeyDefault: 'tpl_global-1', primaryLinkTargetDefault: 'last' } })
  assert.equal(put.statusCode, 200)
  const body = put.json()
  assert.equal(body.mirrorTemplateKeyDefault, 'tpl_global-1')
  assert.equal(body.primaryLinkTargetDefault, 'last')
})
```

- [ ] **Step 6: Run dashboard/config tests**

Run:

```bash
node --test test/painel-configuracoes-cleanup.test.js test/mobile-config-contracts.test.js test/api/routes/config.mobile-prefs.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add dashboard/app/painel/configuracoes/page.js dashboard/lib/mobileConfigContracts.js test/painel-configuracoes-cleanup.test.js test/mobile-config-contracts.test.js test/api/routes/config.mobile-prefs.test.js
git commit -m "refactor: remove redundant global config controls"
```

---

### Task 4: Remove the espelhamento cadence card

**Files:**
- Modify: `dashboard/app/painel/espelhamento/page.js`
- Test: create or modify `test/painel-espelhamento-cadence-card.test.js`

- [ ] **Step 1: Write failing page source test**

Create `test/painel-espelhamento-cadence-card.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../dashboard/app/painel/espelhamento/page.js', import.meta.url), 'utf8')

test('/painel/espelhamento no longer displays global send cadence card', () => {
  assert.doesNotMatch(source, /1 envio a cada/)
  assert.doesNotMatch(source, /Evita parecer spam/)
  assert.doesNotMatch(source, /api\.getConfig\(\)/)
  assert.doesNotMatch(source, /const ritmo =/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test test/painel-espelhamento-cadence-card.test.js
```

Expected: FAIL because the page still renders the card and fetches config.

- [ ] **Step 3: Remove config fetch and cadence UI**

In `dashboard/app/painel/espelhamento/page.js`:

1. Update the top comment from:

```js
 *   - api.getConfig()    → cadência de envio (delayMin/delayMax)
```

to remove that line entirely.

2. Remove this state:

```js
const [config, setConfig] = useState(null)
```

3. Change the `Promise.allSettled` call from three requests to two:

```js
Promise.allSettled([api.groups(), api.logsSummary('today')]).then(([g, s]) => {
  if (!active) return
  if (g.status === 'fulfilled' && Array.isArray(g.value)) setGroups(g.value)
  else setLoadError('Não foi possível carregar os grupos do espelhamento.')
  if (s.status === 'fulfilled') setSummary(s.value)
  setLoading(false)
})
```

4. Remove the `ritmo` constant.
5. Delete the entire JSX section labeled `{/* Ritmo de envio */}`.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --test test/painel-espelhamento-cadence-card.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add dashboard/app/painel/espelhamento/page.js test/painel-espelhamento-cadence-card.test.js
git commit -m "refactor: remove espelhamento cadence card"
```

---

### Task 5: Full verification and cleanup

**Files:**
- No new files expected.
- May modify tests found by verification.

- [ ] **Step 1: Search for stale UI strings and active global cadence usage**

Run:

```bash
rg -n "Cadência entre envios|Espelhamento com template|1 envio a cada|Evita parecer spam|delayMin|delayMax|buildSmartDelayMs|calculateJitterDelayMs" dashboard src test
```

Expected:
- No dashboard strings for removed UI.
- No `buildSmartDelayMs` references.
- `delayMin/delayMax` may remain only in backend compatibility, Prisma schema/migrations, old route defaults, or explicitly retained tests.
- `calculateJitterDelayMs` may remain only if intentionally retained as an unused pure helper; prefer deleting it if no production imports remain.

- [ ] **Step 2: Run targeted tests**

Run:

```bash
node --test \
  test/core/channelThrottle.test.js \
  test/smart-delay.test.js \
  test/painel-configuracoes-cleanup.test.js \
  test/painel-espelhamento-cadence-card.test.js \
  test/mobile-config-contracts.test.js \
  test/api/routes/config.mobile-prefs.test.js
```

Expected: PASS.

- [ ] **Step 3: Run broader smoke tests if time permits**

Run:

```bash
npm test
```

Expected: PASS. If the full suite is too slow or has unrelated environment failures, capture the exact failing command and reason in the PR body.

- [ ] **Step 4: Build dashboard if frontend changed**

Run:

```bash
cd dashboard && npm run build
```

Expected: PASS. If dependencies or environment variables are missing, record the failure exactly and mark it as environment-limited.

- [ ] **Step 5: Commit any verification fixes**

If Step 1–4 required fixes:

```bash
git add <changed-files>
git commit -m "test: update coverage for preservation jitter cleanup"
```

If no fixes were needed, do not create an empty commit.

---

## Self-Review Checklist

- Spec coverage:
  - Destination preservation interval now varies from configured interval to configured interval + 20%.
  - Example 600s produces a random wait between 600s and 720s.
  - Global `/painel/configuracoes` cadence UI is removed.
  - Global `/painel/configuracoes` mirror template default card is removed.
  - `/painel/espelhamento` no longer displays the redundant cadence card.
- Placeholder scan:
  - No `TBD`, `TODO`, or “write tests for above” placeholders.
  - Each code-changing task includes concrete code snippets and exact commands.
- Type consistency:
  - `calculateMinIntervalWithJitterMs(minIntervalSec, random)` is exported from `src/core/channelThrottle.js` and imported by `test/core/channelThrottle.test.js`.
  - `decideDestination()` and `checkAndReserve()` use the same optional `random` name.
  - Dashboard tests reference exact current file paths.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-28-preservation-jitter-remove-global-config.md`. Two execution options:

1. **Subagent-Driven (recommended)** - Dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
