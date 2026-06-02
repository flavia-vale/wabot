# Offer Automation Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar placeholders `{{grupoLink}}`/`{{cupomLink}}` nos ganchos/CTAs, lógica de priorização AMS com duas buscas, intervalos de 15/30/45min, e UI correspondente.

**Architecture:** Migration adiciona `couponLink` em `BotConfig` e renomeia `isAMSOffer → prioritizeAMS` em `OfferAutomation`. `applyVariation` ganha substituição de dois novos placeholders. `runAutomation` faz duas chamadas a `fetchOffers` quando `prioritizeAMS=true`. Frontend reflete os novos campos e opções de intervalo.

**Tech Stack:** Prisma SQLite, Fastify, Node.js ESM, React (Next.js), `node:test`

---

## Mapa de arquivos

| Arquivo | O que muda |
|---------|------------|
| `prisma/schema.prisma` | `couponLink` em `BotConfig`; `prioritizeAMS` em `OfferAutomation` |
| `prisma/migrations/20260601120000_offer_automation_v2/migration.sql` | `ADD COLUMN couponLink`; `RENAME COLUMN isAMSOffer TO prioritizeAMS` |
| `src/core/copyVariation.js` | Substitui `{{grupoLink}}` e `{{cupomLink}}` |
| `src/offerAutomation/dispatcher.js` | Lógica de duas buscas para `prioritizeAMS`; passa links para `applyVariation` |
| `src/api/routes/offerAutomation.js` | `VALID_INTERVALS` ampliado; `prioritizeAMS` em POST e PUT |
| `src/api/routes/config.js` | `couponLink` em GET/PUT |
| `dashboard/lib/api.js` | `variationsUpdate` aceita objeto com os 3 campos |
| `dashboard/app/dashboard/ofertas-automaticas/page.js` | `INTERVAL_OPTIONS` atualizado; UI de `prioritizeAMS` no formulário |
| `dashboard/app/dashboard/variacoes-de-texto/page.js` | Seção "Links" com `brandingGroupLink` e `couponLink` |
| `test/copy-variation.test.js` | Testes dos novos placeholders |
| `test/offer-automation.test.js` | Testes de `prioritizeAMS` no dispatcher e intervalos na rota |

---

## Task 1: Migration — schema + SQL

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260601120000_offer_automation_v2/migration.sql`

- [ ] **Step 1: Atualizar schema.prisma**

Em `BotConfig` (após `copyVariationPoolJson`), adicionar:
```prisma
  couponLink            String   @default("")
```

Em `OfferAutomation`, renomear o campo (linha ~472):
```prisma
  // antes: isAMSOffer      Boolean   @default(false)
  prioritizeAMS   Boolean   @default(false)
```

- [ ] **Step 2: Criar arquivo de migration**

Criar `prisma/migrations/20260601120000_offer_automation_v2/migration.sql`:
```sql
-- AddColumn couponLink to BotConfig
ALTER TABLE "BotConfig" ADD COLUMN "couponLink" TEXT NOT NULL DEFAULT '';

-- Rename isAMSOffer to prioritizeAMS in OfferAutomation
ALTER TABLE "OfferAutomation" RENAME COLUMN "isAMSOffer" TO "prioritizeAMS";
```

- [ ] **Step 3: Aplicar migration**

```bash
cd /home/user/wabot
npx prisma migrate deploy
```

Saída esperada: `1 migration applied` (ou `2 migrations applied`).

- [ ] **Step 4: Verificar cliente Prisma regenerado**

```bash
npx prisma generate
```

Esperado: `Generated Prisma Client` sem erros.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260601120000_offer_automation_v2/
git commit -m "feat(schema): couponLink em BotConfig e prioritizeAMS em OfferAutomation"
```

---

## Task 2: `copyVariation.js` — novos placeholders

**Files:**
- Modify: `src/core/copyVariation.js`
- Create: `test/copy-variation.test.js`

- [ ] **Step 1: Escrever testes que falham**

Criar `test/copy-variation.test.js`:
```js
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { applyVariation } from '../src/core/copyVariation.js'

const pool = {
  greetings: ['Gancho!'],
  ctas: ['CTA aqui:'],
  trailers: ['Fechamento.'],
}

describe('applyVariation — placeholders de links', () => {
  it('substitui {{grupoLink}} pelo groupInviteLink', () => {
    const pool2 = { greetings: [], ctas: [], trailers: [] }
    const text = 'Entre aqui: {{grupoLink}}'
    const result = applyVariation(text, { pool: pool2, groupInviteLink: 'https://chat.wa.me/abc', couponLink: '' })
    assert.equal(result, 'Entre aqui: https://chat.wa.me/abc')
  })

  it('substitui {{cupomLink}} pelo couponLink', () => {
    const pool2 = { greetings: [], ctas: [], trailers: [] }
    const text = 'Cupom: {{cupomLink}}'
    const result = applyVariation(text, { pool: pool2, groupInviteLink: '', couponLink: 'https://cupom.io/x' })
    assert.equal(result, 'Cupom: https://cupom.io/x')
  })

  it('remove placeholder quando link está vazio', () => {
    const pool2 = { greetings: [], ctas: [], trailers: [] }
    const text = 'Link: {{grupoLink}}'
    const result = applyVariation(text, { pool: pool2, groupInviteLink: '', couponLink: '' })
    assert.equal(result, 'Link: ')
  })

  it('substitui ambos os placeholders no mesmo texto', () => {
    const pool2 = { greetings: [], ctas: [], trailers: [] }
    const text = 'Grupo: {{grupoLink}} | Cupom: {{cupomLink}}'
    const result = applyVariation(text, {
      pool: pool2,
      groupInviteLink: 'https://grupo.wa',
      couponLink: 'https://cupom.io',
    })
    assert.equal(result, 'Grupo: https://grupo.wa | Cupom: https://cupom.io')
  })

  it('preserva comportamento existente sem os novos opts', () => {
    const text = 'Produto\n\n👉 https://shopee.com/p'
    const result = applyVariation(text, { pool, random: true })
    assert.ok(result.includes('Gancho!'))
    assert.ok(result.includes('CTA aqui:'))
    assert.ok(result.includes('Fechamento.'))
  })
})
```

- [ ] **Step 2: Rodar para confirmar falha**

```bash
cd /home/user/wabot
node --test test/copy-variation.test.js
```

Esperado: falha com `TypeError` ou `AssertionError` nos primeiros 4 testes.

- [ ] **Step 3: Implementar substituição em `copyVariation.js`**

No arquivo `src/core/copyVariation.js`, alterar a assinatura de `applyVariation` e adicionar o segundo pass de substituição:

```js
const PLACEHOLDER_RE = /\{\{(greeting|cta|trailer)\}\}/g
const LINK_RE_GRUPO = /\{\{grupoLink\}\}/g
const LINK_RE_CUPOM = /\{\{cupomLink\}\}/g

export function applyVariation(text, opts = {}) {
  const { groupId, date, pool, poolJson, random = false, groupInviteLink = '', couponLink = '' } = opts
  if (text == null) return text
  let p = pool
  if (!p && poolJson) {
    try { p = typeof poolJson === 'string' ? JSON.parse(poolJson) : poolJson } catch { p = null }
  }

  // Substituição de links independe do pool
  let result = text
  if (groupInviteLink !== undefined) result = result.replace(LINK_RE_GRUPO, groupInviteLink ?? '')
  if (couponLink !== undefined) result = result.replace(LINK_RE_CUPOM, couponLink ?? '')

  if (!p || typeof p !== 'object') return result

  const today = date ?? new Date().toISOString().slice(0, 10)

  const greeting = pickVariant(p.greetings, groupId, today, random)
  const cta = pickVariant(p.ctas, groupId, today + 'c', random)
  const trailer = pickVariant(p.trailers, groupId, today + 't', random)

  if (PLACEHOLDER_RE.test(result)) {
    PLACEHOLDER_RE.lastIndex = 0
    return result.replace(PLACEHOLDER_RE, (_, key) => {
      if (key === 'greeting') return greeting
      if (key === 'cta') return cta
      if (key === 'trailer') return trailer
      return ''
    })
  }

  const prefix = greeting ? `${greeting}\n\n` : ''
  const suffix = trailer ? `\n\n${trailer}` : ''

  if (!cta) return `${prefix}${result}${suffix}`

  // Inserir CTA antes da última seção (a linha do link 👉)
  const lastSep = result.lastIndexOf('\n\n')
  if (lastSep < 0) return `${prefix}${result}\n\n${cta}${suffix}`
  return `${prefix}${result.slice(0, lastSep)}\n\n${cta}\n${result.slice(lastSep + 2)}${suffix}`
}
```

- [ ] **Step 4: Rodar testes**

```bash
node --test test/copy-variation.test.js
```

Esperado: 5/5 pass.

- [ ] **Step 5: Confirmar testes anteriores não quebraram**

```bash
node --test test/offer-automation.test.js test/offer-automation-extended.test.js
```

Esperado: todos passando.

- [ ] **Step 6: Commit**

```bash
git add src/core/copyVariation.js test/copy-variation.test.js
git commit -m "feat(copyVariation): placeholders {{grupoLink}} e {{cupomLink}}"
```

---

## Task 3: `dispatcher.js` — lógica prioritizeAMS + passar links

**Files:**
- Modify: `src/offerAutomation/dispatcher.js`
- Modify: `test/offer-automation.test.js`

- [ ] **Step 1: Adicionar testes ao offer-automation.test.js**

Adicionar ao final de `test/offer-automation.test.js` (antes do fechamento do arquivo):

```js
describe('runAutomation — prioritizeAMS', () => {
  const baseCreds = { appId: 'a', secretKey: 's' }

  function makeDb({ automation, botConfig = null }) {
    return {
      credential: { findUnique: async () => ({ data: JSON.stringify(baseCreds) }) },
      offerAutomation: { update: async () => {} },
      botConfig: { findUnique: async () => botConfig },
      _automation: automation,
    }
  }

  it('faz uma única busca quando prioritizeAMS=false', async () => {
    let fetchCount = 0
    const fakeOffer = { itemId: '1', productName: 'Prod', priceMin: '10', priceDiscountRate: '20', offerLink: 'https://s.pe/1' }
    const mockFetch = async () => { fetchCount++; return [fakeOffer] }
    const automation = {
      id: 'a1', userId: 'u1', keyword: 'test', minDiscountPct: 0,
      offersPerSend: 1, excludeItemIds: [], sortType: 2,
      isKeySeller: false, prioritizeAMS: false,
      destGroupJid: 'g1@g.us', sentItemIds: '[]',
    }
    await runAutomation(automation, {
      fetchOffersFn: mockFetch,
      sendBroadcastFn: async () => {},
      isRunningFn: () => true,
      dbOverride: makeDb({ automation }),
    })
    assert.equal(fetchCount, 1)
  })

  it('faz duas buscas quando prioritizeAMS=true', async () => {
    let fetchCount = 0
    const amsOffer = { itemId: '1', productName: 'AMS', priceMin: '10', priceDiscountRate: '20', offerLink: 'https://s.pe/1' }
    const regOffer = { itemId: '2', productName: 'Reg', priceMin: '10', priceDiscountRate: '20', offerLink: 'https://s.pe/2' }
    const mockFetch = async ({ isAMSOffer }) => { fetchCount++; return isAMSOffer ? [amsOffer] : [regOffer] }
    const automation = {
      id: 'a2', userId: 'u1', keyword: 'test', minDiscountPct: 0,
      offersPerSend: 2, excludeItemIds: [], sortType: 2,
      isKeySeller: false, prioritizeAMS: true,
      destGroupJid: 'g1@g.us', sentItemIds: '[]',
    }
    const sent = []
    await runAutomation(automation, {
      fetchOffersFn: mockFetch,
      sendBroadcastFn: async (uid, text) => { sent.push(text) },
      isRunningFn: () => true,
      dbOverride: makeDb({ automation }),
    })
    assert.equal(fetchCount, 2)
    assert.equal(sent.length, 2)
    assert.ok(sent[0].includes('AMS'), 'primeiro enviado deve ser o AMS')
    assert.ok(sent[1].includes('Reg'), 'segundo enviado deve ser o Regular')
  })

  it('exclui ids AMS do segundo fetch quando prioritizeAMS=true', async () => {
    let secondFetchExcludes = []
    const amsOffer = { itemId: '99', productName: 'AMS', priceMin: '10', priceDiscountRate: '20', offerLink: 'https://s.pe/99' }
    const mockFetch = async ({ isAMSOffer, excludeItemIds }) => {
      if (!isAMSOffer) secondFetchExcludes = excludeItemIds
      return isAMSOffer ? [amsOffer] : []
    }
    const automation = {
      id: 'a3', userId: 'u1', keyword: 'test', minDiscountPct: 0,
      offersPerSend: 2, excludeItemIds: [], sortType: 2,
      isKeySeller: false, prioritizeAMS: true,
      destGroupJid: 'g1@g.us', sentItemIds: '[]',
    }
    await runAutomation(automation, {
      fetchOffersFn: mockFetch,
      sendBroadcastFn: async () => {},
      isRunningFn: () => true,
      dbOverride: makeDb({ automation }),
    })
    assert.ok(secondFetchExcludes.includes('99'), 'segundo fetch deve excluir itemId do AMS')
  })
})
```

- [ ] **Step 2: Rodar para confirmar falha**

```bash
node --test test/offer-automation.test.js 2>&1 | tail -20
```

Esperado: falha nos 3 novos testes (`runAutomation` não aceita `fetchOffersFn`/`dbOverride`/`prioritizeAMS`).

- [ ] **Step 3: Implementar mudanças no dispatcher**

Substituir `src/offerAutomation/dispatcher.js` inteiro:

```js
import { fetchOffers as defaultFetchOffers } from './shopeeOffers.js'
import { sendBroadcast, isRunning } from '../manager.js'
import db from '../db.js'
import { parseCredentialData } from '../credentialHealth.js'
import { applyVariation } from '../core/copyVariation.js'

const PRICE_DIVISOR = 1

function priceStr(raw) {
  const num = Number(raw)
  if (!num || num <= 0) return null
  return (num / PRICE_DIVISOR).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatOfferMessage(offer, keyword) {
  const name = offer.productName ?? 'Produto Shopee'
  const currentRaw = Number(offer.priceMin ?? offer.price) || 0
  const pct = Number(offer.priceDiscountRate) || 0
  const current = priceStr(currentRaw)

  // originPrice não existe na API — calcular via álgebra reversa do desconto
  const originalRaw = pct > 0 && currentRaw > 0 ? Math.round(currentRaw * 100 / (100 - pct)) : 0
  const original = priceStr(originalRaw)
  const stars = offer.ratingStar ? `⭐ ${Number(offer.ratingStar).toFixed(1)}` : ''
  const sold = offer.sales ? `🛒 ${Number(offer.sales).toLocaleString('pt-BR')}+ vendidos` : ''

  const lines = [`🏷️ *${name}*`, '']

  if (original && current && pct > 0) {
    lines.push(`💰 ~${original}~ → *${current}* (*-${pct}% OFF*)`)
  } else if (current) {
    lines.push(`💰 *${current}*`)
  }

  const meta = [stars, sold].filter(Boolean).join(' | ')
  if (meta) lines.push(meta)

  lines.push('', `👉 ${offer.offerLink}`)
  return lines.join('\n')
}

function addSentIds(existing, newIds) {
  const all = [...existing, ...newIds.map(String)]
  return all.length > 200 ? all.slice(all.length - 200) : all
}

async function resolveOffers({ automation, sentItemIds, creds, fetchOffersFn }) {
  const base = {
    keyword: automation.keyword,
    minDiscountPct: automation.minDiscountPct,
    limit: automation.offersPerSend,
    creds,
    sortType: automation.sortType ?? 2,
    isKeySeller: automation.isKeySeller ?? false,
  }

  if (!automation.prioritizeAMS) {
    return fetchOffersFn({ ...base, isAMSOffer: false, excludeItemIds: sentItemIds })
  }

  const amsOffers = await fetchOffersFn({ ...base, isAMSOffer: true, excludeItemIds: sentItemIds })
  const amsItemIds = amsOffers.map(o => String(o.itemId))
  const regularOffers = await fetchOffersFn({
    ...base,
    isAMSOffer: false,
    excludeItemIds: [...sentItemIds, ...amsItemIds],
  })
  return [...amsOffers, ...regularOffers]
}

export async function runAutomation(automation, {
  sendBroadcastFn = sendBroadcast,
  isRunningFn = isRunning,
  fetchOffersFn = defaultFetchOffers,
  dbOverride,
} = {}) {
  const dbInstance = dbOverride ?? db

  if (!isRunningFn(automation.userId)) return { skipped: 'bot_not_running' }

  const credRow = await dbInstance.credential.findUnique({
    where: { userId_platform: { userId: automation.userId, platform: 'shopee' } },
  })
  if (!credRow) return { skipped: 'no_shopee_credentials' }

  const creds = parseCredentialData(credRow.data)
  if (!creds?.appId || !creds?.secretKey) return { skipped: 'invalid_shopee_credentials' }

  let sentItemIds
  try {
    sentItemIds = JSON.parse(automation.sentItemIds ?? '[]')
  } catch {
    sentItemIds = []
  }

  const offers = await resolveOffers({ automation, sentItemIds, creds, fetchOffersFn })

  if (!offers.length) return { skipped: 'no_offers_found' }

  const toSend = offers.slice(0, automation.offersPerSend)

  const botConfig = await dbInstance.botConfig.findUnique({ where: { userId: automation.userId } })
  const poolJson = botConfig?.copyVariationPoolJson ?? '{}'
  const groupInviteLink = botConfig?.brandingGroupLink ?? ''
  const couponLink = botConfig?.couponLink ?? ''

  const sentIds = []
  for (const offer of toSend) {
    const base = formatOfferMessage(offer, automation.keyword)
    const text = applyVariation(base, {
      groupId: automation.destGroupJid,
      poolJson,
      groupInviteLink,
      couponLink,
      random: true,
    })
    await sendBroadcastFn(automation.userId, text, [automation.destGroupJid])
    sentIds.push(offer.itemId)
  }

  const newSentIds = addSentIds(sentItemIds, sentIds)
  await dbInstance.offerAutomation.update({
    where: { id: automation.id },
    data: { lastSentAt: new Date(), sentItemIds: JSON.stringify(newSentIds) },
  })

  return { sent: sentIds.length }
}
```

- [ ] **Step 4: Rodar testes**

```bash
node --test test/offer-automation.test.js
```

Esperado: todos passando, incluindo os 3 novos.

- [ ] **Step 5: Commit**

```bash
git add src/offerAutomation/dispatcher.js test/offer-automation.test.js
git commit -m "feat(dispatcher): lógica prioritizeAMS com duas buscas + links para applyVariation"
```

---

## Task 4: Rotas da API — intervalos + prioritizeAMS + couponLink

**Files:**
- Modify: `src/api/routes/offerAutomation.js`
- Modify: `src/api/routes/config.js`

- [ ] **Step 1: Atualizar `offerAutomation.js`**

Substituir o conteúdo de `src/api/routes/offerAutomation.js`:

```js
import dbDefault from '../../db.js'
import { runAutomation } from '../../offerAutomation/dispatcher.js'

const VALID_INTERVALS = [15, 30, 45, 60, 120, 240, 360, 720, 1440]
const MAX_OFFERS_PER_SEND = 5

export async function offerAutomationRoutes(app, opts = {}) {
  const db = opts.db ?? dbDefault

  app.get('/', { onRequest: [app.authenticate] }, async (req) => {
    return db.offerAutomation.findMany({
      where: { userId: req.user.sub },
      orderBy: { createdAt: 'desc' },
    })
  })

  app.post('/', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { destGroupJid, destGroupName, keyword, intervalMinutes, offersPerSend, minDiscountPct, sortType, prioritizeAMS, isKeySeller } = req.body ?? {}

    if (!keyword?.trim()) return reply.code(400).send({ error: 'Palavra-chave obrigatória' })
    if (!destGroupJid) return reply.code(400).send({ error: 'Grupo de destino obrigatório' })
    if (!VALID_INTERVALS.includes(Number(intervalMinutes))) {
      return reply.code(400).send({ error: `Intervalo inválido. Valores aceitos: ${VALID_INTERVALS.join(', ')} minutos` })
    }
    const perSend = Number(offersPerSend)
    if (!perSend || perSend < 1 || perSend > MAX_OFFERS_PER_SEND) {
      return reply.code(400).send({ error: `offersPerSend deve ser entre 1 e ${MAX_OFFERS_PER_SEND}` })
    }
    const VALID_SORT_TYPES = [2, 5]
    const parsedSortType = Number(sortType ?? 2)
    if (!VALID_SORT_TYPES.includes(parsedSortType)) {
      return reply.code(400).send({ error: 'sortType inválido. Use 2 (mais vendidos) ou 5 (maior comissão)' })
    }

    return db.offerAutomation.create({
      data: {
        userId: req.user.sub,
        destGroupJid,
        destGroupName: destGroupName ?? destGroupJid,
        keyword: keyword.trim(),
        intervalMinutes: Number(intervalMinutes),
        offersPerSend: perSend,
        minDiscountPct: Number(minDiscountPct) || 0,
        sortType: parsedSortType,
        prioritizeAMS: Boolean(prioritizeAMS ?? false),
        isKeySeller: Boolean(isKeySeller ?? false),
      },
    })
  })

  app.put('/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const existing = await db.offerAutomation.findFirst({
      where: { id: req.params.id, userId: req.user.sub },
    })
    if (!existing) return reply.code(404).send({ error: 'Automação não encontrada' })

    const { keyword, intervalMinutes, offersPerSend, minDiscountPct, enabled, destGroupJid, destGroupName, prioritizeAMS } = req.body ?? {}
    const updates = {}

    if (keyword !== undefined) {
      const k = keyword.trim()
      if (!k) return reply.code(400).send({ error: 'Palavra-chave não pode ficar vazia' })
      updates.keyword = k
    }
    if (destGroupJid !== undefined) updates.destGroupJid = destGroupJid
    if (destGroupName !== undefined) updates.destGroupName = destGroupName
    if (intervalMinutes !== undefined) {
      if (!VALID_INTERVALS.includes(Number(intervalMinutes))) {
        return reply.code(400).send({ error: 'Intervalo inválido' })
      }
      updates.intervalMinutes = Number(intervalMinutes)
    }
    if (offersPerSend !== undefined) {
      const ps = Number(offersPerSend)
      if (!ps || ps < 1 || ps > MAX_OFFERS_PER_SEND)
        return reply.code(400).send({ error: `offersPerSend deve ser entre 1 e ${MAX_OFFERS_PER_SEND}` })
      updates.offersPerSend = ps
    }
    if (minDiscountPct !== undefined) {
      const pct = Number(minDiscountPct)
      if (pct < 0 || pct > 100)
        return reply.code(400).send({ error: 'minDiscountPct deve estar entre 0 e 100' })
      updates.minDiscountPct = pct
    }
    if (enabled !== undefined) updates.enabled = Boolean(enabled)
    if (prioritizeAMS !== undefined) updates.prioritizeAMS = Boolean(prioritizeAMS)

    return db.offerAutomation.update({ where: { id: req.params.id }, data: updates })
  })

  app.delete('/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const existing = await db.offerAutomation.findFirst({
      where: { id: req.params.id, userId: req.user.sub },
    })
    if (!existing) return reply.code(404).send({ error: 'Automação não encontrada' })
    await db.offerAutomation.delete({ where: { id: req.params.id } })
    return { ok: true }
  })

  app.post('/:id/trigger', { onRequest: [app.authenticate] }, async (req, reply) => {
    const automation = await db.offerAutomation.findFirst({
      where: { id: req.params.id, userId: req.user.sub },
    })
    if (!automation) return reply.code(404).send({ error: 'Automação não encontrada' })
    const result = await runAutomation(automation)
    return { ok: true, result }
  })
}
```

- [ ] **Step 2: Atualizar `config.js` para suportar `couponLink`**

No `src/api/routes/config.js`, adicionar `couponLink` ao objeto `DEFAULTS` (após `brandingCtaText`):

```js
const DEFAULTS = {
  delayMin: 5,
  delayMax: 15,
  platforms: 'shopee,amazon,mercadolivre,magazineluiza',
  blockedKeywords: '',
  welcomeMsg: '',
  feedGlobal: false,
  postToStatus: false,
  brandingGroupLink: '',
  brandingCtaText: DEFAULT_BRANDING_CTA_TEXT,
  couponLink: '',
  copyVariationPoolJson: DEFAULT_COPY_VARIATION_POOL_JSON,
}
```

No handler `PUT`, adicionar `couponLink` ao destructuring e ao `create`/`update`:

```js
// No destructuring do PUT:
const { delayMin, delayMax, platforms, blockedKeywords, welcomeMsg, feedGlobal, postToStatus,
        brandingGroupLink, brandingCtaText, couponLink, copyVariationPoolJson } = req.body ?? {}

// No create:
couponLink: couponLink ?? '',

// No update (adicionar ao bloco spread):
...(couponLink !== undefined && { couponLink: String(couponLink ?? '').trim() }),
```

- [ ] **Step 3: Verificar sintaxe**

```bash
node --check src/api/routes/offerAutomation.js src/api/routes/config.js
```

Esperado: sem erros.

- [ ] **Step 4: Rodar testes de integração existentes**

```bash
node --test test/offer-automation-extended.test.js 2>&1 | tail -10
```

Esperado: todos passando (ou falhas apenas em testes que dependem de `isAMSOffer` — verificar e corrigir nomes de campo se necessário).

- [ ] **Step 5: Commit**

```bash
git add src/api/routes/offerAutomation.js src/api/routes/config.js
git commit -m "feat(api): intervalos 15/30/45min, prioritizeAMS, couponLink"
```

---

## Task 5: `dashboard/lib/api.js` — atualizar `variationsUpdate`

**Files:**
- Modify: `dashboard/lib/api.js`

- [ ] **Step 1: Atualizar o método `variationsUpdate`**

Localizar as linhas (em torno de 343-346):

```js
  variationsGet: () => apiFetch('/api/config'),
  variationsUpdate: (copyVariationPoolJson) =>
    apiFetch('/api/config', { method: 'PUT', body: JSON.stringify({ copyVariationPoolJson }) }),
```

Substituir por:

```js
  variationsGet: () => apiFetch('/api/config'),
  variationsUpdate: (data) =>
    apiFetch('/api/config', {
      method: 'PUT',
      body: JSON.stringify(typeof data === 'string' ? { copyVariationPoolJson: data } : data),
    }),
```

- [ ] **Step 2: Verificar sintaxe**

```bash
node --check dashboard/lib/api.js
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add dashboard/lib/api.js
git commit -m "feat(api-client): variationsUpdate aceita objeto com múltiplos campos"
```

---

## Task 6: Frontend — `ofertas-automaticas/page.js`

**Files:**
- Modify: `dashboard/app/dashboard/ofertas-automaticas/page.js`

- [ ] **Step 1: Atualizar `INTERVAL_OPTIONS` e `emptyForm`**

Localizar `INTERVAL_OPTIONS` (linha 9) e substituir:

```js
const INTERVAL_OPTIONS = [
  { value: 15,   label: 'A cada 15 minutos' },
  { value: 30,   label: 'A cada 30 minutos' },
  { value: 45,   label: 'A cada 45 minutos' },
  { value: 60,   label: 'A cada 1 hora' },
  { value: 120,  label: 'A cada 2 horas' },
  { value: 240,  label: 'A cada 4 horas' },
  { value: 360,  label: 'A cada 6 horas' },
  { value: 720,  label: 'A cada 12 horas' },
  { value: 1440, label: 'Uma vez por dia' },
]
```

Localizar `emptyForm` (linha 32) e adicionar `prioritizeAMS`:

```js
const emptyForm = {
  destGroupJid: '',
  destGroupName: '',
  keyword: '',
  intervalMinutes: 240,
  offersPerSend: 1,
  minDiscountPct: 20,
  prioritizeAMS: false,
}
```

- [ ] **Step 2: Atualizar `openEdit` para incluir `prioritizeAMS`**

No `openEdit(a)` (em torno da linha 91), adicionar `prioritizeAMS` ao `setForm`:

```js
  function openEdit(a) {
    setEditId(a.id)
    setForm({
      destGroupJid: a.destGroupJid,
      destGroupName: a.destGroupName,
      keyword: a.keyword,
      intervalMinutes: a.intervalMinutes,
      offersPerSend: a.offersPerSend,
      minDiscountPct: a.minDiscountPct,
      prioritizeAMS: a.prioritizeAMS ?? false,
    })
    setSaveError('')
    setShowForm(true)
  }
```

- [ ] **Step 3: Adicionar campo `prioritizeAMS` no formulário**

Após o bloco do campo "desconto mínimo" (após o `</div>` que fecha o bloco de `DISCOUNT_OPTIONS`), adicionar:

```jsx
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.prioritizeAMS}
              onChange={e => setForm(f => ({ ...f, prioritizeAMS: e.target.checked }))}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-green-600"
            />
            <span>
              <span className="text-sm font-medium text-gray-700 block">
                Priorizar ofertas com comissão extra do vendedor
              </span>
              <span className="text-xs text-gray-400">
                Se ativado, o bot busca as duas e envia primeiro as com comissão extra.
              </span>
            </span>
          </label>
```

- [ ] **Step 4: Mostrar `prioritizeAMS` no card de lista de automações**

No bloco de metadados da automação (linha ~310, após o bloco `DISCOUNT_OPTIONS.find...`), adicionar badge condicional:

```jsx
                  {a.prioritizeAMS && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 mt-1">
                      ⚡ Comissão extra priorizada
                    </span>
                  )}
```

- [ ] **Step 5: Verificar sintaxe**

```bash
node --check dashboard/app/dashboard/ofertas-automaticas/page.js 2>/dev/null || echo "JSX - verificar manualmente"
```

- [ ] **Step 6: Commit**

```bash
git add dashboard/app/dashboard/ofertas-automaticas/page.js
git commit -m "feat(ui): intervalos 15/30/45min e toggle prioritizeAMS nas automações"
```

---

## Task 7: Frontend — `variacoes-de-texto/page.js`

**Files:**
- Modify: `dashboard/app/dashboard/variacoes-de-texto/page.js`

- [ ] **Step 1: Expandir estado e carregamento**

Substituir o estado inicial e o `useEffect`:

```js
  const [value, setValue] = useState({
    copyVariationPoolJson: '{}',
    brandingGroupLink: '',
    couponLink: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.variationsGet()
      .then(cfg => setValue({
        copyVariationPoolJson: cfg.copyVariationPoolJson ?? '{}',
        brandingGroupLink: cfg.brandingGroupLink ?? '',
        couponLink: cfg.couponLink ?? '',
      }))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])
```

- [ ] **Step 2: Atualizar `handleSave`**

```js
  async function handleSave() {
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      await api.variationsUpdate({
        copyVariationPoolJson: value.copyVariationPoolJson,
        brandingGroupLink: value.brandingGroupLink,
        couponLink: value.couponLink,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }
```

- [ ] **Step 3: Adicionar seção "Links" no JSX**

Após o bloco `{error && <Alert ...>}` e antes do `<CopyVariationPoolEditor>`, inserir:

```jsx
      <div className="border rounded-lg p-4 bg-white space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">Links</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Use <code className="bg-gray-100 px-1 rounded">{'{{grupoLink}}'}</code> e{' '}
            <code className="bg-gray-100 px-1 rounded">{'{{cupomLink}}'}</code> nos seus ganchos e CTAs.
          </p>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Link de convite do grupo</label>
          <input
            type="url"
            value={value.brandingGroupLink}
            onChange={e => setValue(v => ({ ...v, brandingGroupLink: e.target.value }))}
            placeholder="https://chat.whatsapp.com/..."
            disabled={saving}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Link de cupom</label>
          <input
            type="url"
            value={value.couponLink}
            onChange={e => setValue(v => ({ ...v, couponLink: e.target.value }))}
            placeholder="https://..."
            disabled={saving}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
          />
        </div>
      </div>
```

- [ ] **Step 4: Verificar sintaxe**

```bash
node --check dashboard/app/dashboard/variacoes-de-texto/page.js 2>/dev/null || echo "JSX - verificar manualmente"
```

- [ ] **Step 5: Commit**

```bash
git add dashboard/app/dashboard/variacoes-de-texto/page.js
git commit -m "feat(ui): seção Links com {{grupoLink}} e {{cupomLink}} na página de variações"
```

---

## Task 8: Testes finais e push

- [ ] **Step 1: Rodar toda a suite de testes**

```bash
cd /home/user/wabot
node --test test/copy-variation.test.js test/offer-automation.test.js test/offer-automation-extended.test.js
```

Esperado: todos passando.

- [ ] **Step 2: Build do dashboard**

```bash
cd /home/user/wabot/dashboard
npm run build 2>&1 | tail -20
```

Esperado: sem erros de compilação.

- [ ] **Step 3: Push**

```bash
cd /home/user/wabot
git push -u origin claude/shopee-affiliate-offers-api-ADOlJ
```

---

## Notas de implementação

- `RENAME COLUMN` requer SQLite ≥ 3.25.0 (2018). Node 22 usa SQLite suficientemente recente.
- O `couponLink` não tem validação de URL no backend (pode ficar vazio).
- A substituição de `{{grupoLink}}`/`{{cupomLink}}` ocorre ANTES da resolução dos buckets de variação, então esses links podem aparecer dentro de `{{cta}}` se o usuário os colocar lá.
- `offer-automation-extended.test.js` pode ter testes que referenciam `isAMSOffer` — verificar e corrigir para `prioritizeAMS` se necessário.
