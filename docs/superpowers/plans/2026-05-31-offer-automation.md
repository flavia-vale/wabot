# Offer Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permite que usuários configurem envio automático de ofertas Shopee (via `productOfferV2`) para grupos WhatsApp em intervalos definidos, com filtros por palavra-chave, desconto mínimo, ordenação, ofertas com bônus do vendedor e lojas verificadas.

**Architecture:** Um novo modelo `OfferAutomation` no banco guarda a configuração por grupo (keyword, intervalo, desconto mínimo, deduplicação por itemId). Um `setInterval` dentro do processo `api` verifica a cada 60s quais automações estão vencidas, busca ofertas via API Shopee, formata e envia via `sendBroadcast`. O painel expõe uma nova página de CRUD com linguagem leiga.

**Tech Stack:** Fastify + Prisma/SQLite, Node.js `node:test`, Next.js (App Router), Shopee Affiliate GraphQL (`open-api.affiliate.shopee.com.br/graphql`), `sendBroadcast` de `src/manager.js`.

---

## File Map

| Ação | Arquivo | Responsabilidade |
|------|---------|-----------------|
| Create | `src/offerAutomation/shopeeOffers.js` | Busca `productOfferV2`, filtra por desconto, exclui itemIds já enviados |
| Create | `src/offerAutomation/dispatcher.js` | Formata mensagem WhatsApp + aplica variação aleatória + despacha via `sendBroadcast` |
| Create | `src/offerAutomation/cron.js` | `setInterval` de 60s, busca automações vencidas, chama dispatcher |
| Create | `src/api/routes/offerAutomation.js` | CRUD: list / create / update / delete + toggle enable + trigger manual |
| Create | `test/offer-automation.test.js` | Testa shopeeOffers (filtro), dispatcher (formatação), rotas (CRUD) |
| Modify | `prisma/schema.prisma` | Adiciona model `OfferAutomation` + relação em `User` |
| Modify | `src/api/server.js` | Registra rotas + `startOfferAutomationCron()` no boot |
| Modify | `src/core/copyVariation.js` | Adiciona opção `random: true` em `pickVariant` e `applyVariation` |
| Modify | `src/api/routes/config.js` | Expõe `copyVariationPoolJson` no GET/PUT (sem gate de plano) |
| Modify | `dashboard/lib/api.js` | Adiciona métodos `offerAutomations*` + `variationsGet` / `variationsUpdate` |
| Modify | `dashboard/app/dashboard/DashboardClientLayout.js` | Adiciona itens de nav "Ofertas automáticas" e "Ganchos e CTAs" |
| Create | `dashboard/app/dashboard/ofertas-automaticas/page.js` | Página de CRUD com linguagem leiga + botão "Editar ganchos e CTAs →" |
| Create | `dashboard/app/dashboard/variacoes-de-texto/page.js` | Editor de ganchos, CTAs e fechamentos — livre para todos os planos |

---

## Task 1: Prisma — model OfferAutomation

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Adicionar model e relação no schema**

Em `prisma/schema.prisma`, adicionar na relação `User` (após `scheduled ScheduledMessage[]`):

```prisma
  offerAutomations  OfferAutomation[]
```

E ao final do arquivo:

```prisma
model OfferAutomation {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  destGroupJid    String
  destGroupName   String
  keyword         String
  intervalMinutes Int
  offersPerSend   Int       @default(1)
  minDiscountPct  Int       @default(0)
  sortType        Int       @default(2)
  isAMSOffer      Boolean   @default(false)
  isKeySeller     Boolean   @default(false)
  enabled         Boolean   @default(true)
  lastSentAt      DateTime?
  sentItemIds     String    @default("[]")
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([userId, enabled])
  @@index([enabled, lastSentAt])
}
```

- [ ] **Step 2: Gerar e aplicar migration**

```bash
cd /home/user/wabot
npx prisma migrate dev --name offer_automation
```

Esperado: `Applied 1 migration` sem erros.

- [ ] **Step 3: Confirmar geração do cliente Prisma**

```bash
npx prisma generate
```

Esperado: `Generated Prisma Client`.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add OfferAutomation schema migration"
```

---

## Task 2: Shopee offer fetcher

**Files:**
- Create: `src/offerAutomation/shopeeOffers.js`
- Create: `test/offer-automation.test.js` (parcial — apenas testes do fetcher)

- [ ] **Step 1: Escrever testes que falham**

Criar `test/offer-automation.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { filterOffers, buildOffersQuery } from '../src/offerAutomation/shopeeOffers.js'

test('filterOffers: remove offers below minDiscountPct', () => {
  const offers = [
    { itemId: '1', priceDiscountRate: 5, originPrice: 1000, priceMin: 950 },
    { itemId: '2', priceDiscountRate: 25, originPrice: 1000, priceMin: 750 },
    { itemId: '3', priceDiscountRate: 0, originPrice: 1000, priceMin: 1000 },
  ]
  const result = filterOffers(offers, { minDiscountPct: 10, excludeItemIds: [] })
  assert.deepEqual(result.map(o => o.itemId), ['2'])
})

test('filterOffers: excludes already-sent itemIds', () => {
  const offers = [
    { itemId: '1', priceDiscountRate: 30, originPrice: 1000, priceMin: 700 },
    { itemId: '2', priceDiscountRate: 30, originPrice: 1000, priceMin: 700 },
  ]
  const result = filterOffers(offers, { minDiscountPct: 0, excludeItemIds: ['1'] })
  assert.deepEqual(result.map(o => o.itemId), ['2'])
})

test('filterOffers: requires originPrice > priceMin for real discount when rate is 0', () => {
  const offers = [
    { itemId: '1', priceDiscountRate: 0, originPrice: 0, priceMin: 500 },
    { itemId: '2', priceDiscountRate: 0, originPrice: 1000, priceMin: 800 },
  ]
  const result = filterOffers(offers, { minDiscountPct: 0, excludeItemIds: [] })
  assert.deepEqual(result.map(o => o.itemId), ['2'])
})

test('buildOffersQuery: generates valid GraphQL string', () => {
  const q = buildOffersQuery({ keyword: 'festa', page: 1, limit: 10 })
  assert.ok(q.includes('productOfferV2'))
  assert.ok(q.includes('keyword: "festa"'))
  assert.ok(q.includes('page: 1'))
  assert.ok(q.includes('limit: 10'))
  assert.ok(q.includes('offerLink'))
  assert.ok(q.includes('priceDiscountRate'))
})

test('buildOffersQuery: includes isAMSOffer when true', () => {
  const q = buildOffersQuery({ keyword: 'festa', page: 1, limit: 10, isAMSOffer: true })
  assert.ok(q.includes('isAMSOffer: true'))
})

test('buildOffersQuery: includes isKeySeller when true', () => {
  const q = buildOffersQuery({ keyword: 'festa', page: 1, limit: 10, isKeySeller: true })
  assert.ok(q.includes('isKeySeller: true'))
})

test('buildOffersQuery: uses custom sortType', () => {
  const q = buildOffersQuery({ keyword: 'festa', page: 1, limit: 10, sortType: 5 })
  assert.ok(q.includes('sortType: 5'))
})
```

- [ ] **Step 2: Executar teste para confirmar falha**

```bash
node --test test/offer-automation.test.js
```

Esperado: `SyntaxError` ou `ERR_MODULE_NOT_FOUND` — `shopeeOffers.js` ainda não existe.

- [ ] **Step 3: Implementar `src/offerAutomation/shopeeOffers.js`**

```js
import axios from 'axios'
import crypto from 'crypto'

const ENDPOINT = 'https://open-api.affiliate.shopee.com.br/graphql'

function buildAuth(appId, secretKey, payload) {
  const timestamp = Math.floor(Date.now() / 1000)
  const sig = crypto
    .createHash('sha256')
    .update(`${appId}${timestamp}${payload}${secretKey}`)
    .digest('hex')
  return `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${sig}`
}

export function buildOffersQuery({ keyword, page, limit, sortType = 2, isAMSOffer = false, isKeySeller = false }) {
  const safeKeyword = keyword.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  const amsParam = isAMSOffer ? ', isAMSOffer: true' : ''
  const keySellerParam = isKeySeller ? ', isKeySeller: true' : ''
  return `{
    productOfferV2(
      keyword: "${safeKeyword}",
      listType: 2,
      sortType: ${sortType},
      page: ${page},
      limit: ${limit}${amsParam}${keySellerParam}
    ) {
      nodes {
        itemId shopId productName imageUrl offerLink
        price priceMin priceMax originPrice priceDiscountRate
        commissionRate sales ratingStar
      }
    }
  }`
}

export function filterOffers(offers, { minDiscountPct, excludeItemIds }) {
  const excludeSet = new Set(excludeItemIds.map(String))
  return offers.filter(o => {
    if (excludeSet.has(String(o.itemId))) return false
    const rate = Number(o.priceDiscountRate) || 0
    const origin = Number(o.originPrice) || 0
    const current = Number(o.priceMin ?? o.price) || 0
    const hasRealDiscount = rate > 0 || (origin > 0 && current > 0 && current < origin)
    if (!hasRealDiscount) return false
    return rate >= minDiscountPct
  })
}

export async function fetchOffers({ keyword, minDiscountPct, limit, excludeItemIds, creds, sortType = 2, isAMSOffer = false, isKeySeller = false }) {
  const { appId, secretKey } = creds
  const query = buildOffersQuery({ keyword, page: 1, limit: Math.min(limit * 4, 100), sortType, isAMSOffer, isKeySeller })
  const body = { query }
  const payload = JSON.stringify(body)
  const authHeader = buildAuth(appId, secretKey, payload)

  const { data } = await axios.post(ENDPOINT, body, {
    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
    timeout: 10000,
  })

  const nodes = data?.data?.productOfferV2?.nodes ?? []
  return filterOffers(nodes, { minDiscountPct, excludeItemIds })
}
```

- [ ] **Step 4: Executar testes**

```bash
node --test test/offer-automation.test.js
```

Esperado: 4 testes passando.

- [ ] **Step 5: Commit**

```bash
git add src/offerAutomation/shopeeOffers.js test/offer-automation.test.js
git commit -m "feat: shopee offer fetcher with discount filter and dedup"
```

---

## Task 3: Dispatcher — formata mensagem e envia

**Files:**
- Create: `src/offerAutomation/dispatcher.js`
- Modify: `test/offer-automation.test.js` (adicionar testes do dispatcher)

- [ ] **Step 1: Adicionar testes no arquivo existente**

Adicionar ao final de `test/offer-automation.test.js`:

```js
import { formatOfferMessage } from '../src/offerAutomation/dispatcher.js'

test('formatOfferMessage: includes product name and price', () => {
  const offer = {
    productName: 'Balão Metalizado Estrela',
    priceMin: 1990000,
    originPrice: 3500000,
    priceDiscountRate: 43,
    offerLink: 'https://shope.ee/abc123',
    sales: 1250,
    ratingStar: 4.8,
  }
  const msg = formatOfferMessage(offer, 'decoração de festas')
  assert.ok(msg.includes('Balão Metalizado Estrela'))
  assert.ok(msg.includes('43%'))
  assert.ok(msg.includes('https://shope.ee/abc123'))
  assert.ok(msg.includes('R$'))
})

test('formatOfferMessage: handles missing originPrice gracefully', () => {
  const offer = {
    productName: 'Kit Festa Junina',
    priceMin: 2500000,
    originPrice: 0,
    priceDiscountRate: 0,
    offerLink: 'https://shope.ee/xyz456',
    sales: 80,
    ratingStar: 4.2,
  }
  const msg = formatOfferMessage(offer, 'festa')
  assert.ok(msg.includes('Kit Festa Junina'))
  assert.ok(msg.includes('https://shope.ee/xyz456'))
})
```

- [ ] **Step 2: Confirmar falha**

```bash
node --test test/offer-automation.test.js
```

Esperado: falha nos 2 novos testes (`dispatcher.js` não existe).

- [ ] **Step 3: Implementar `src/offerAutomation/dispatcher.js`**

```js
import { fetchOffers } from './shopeeOffers.js'
import { sendBroadcast, isRunning } from '../manager.js'
import db from '../db.js'
import { parseCredentialData } from '../credentialHealth.js'
import { applyVariation } from '../core/copyVariation.js'

const PRICE_DIVISOR = 100000

function priceStr(raw) {
  const num = Number(raw)
  if (!num || num <= 0) return null
  return (num / PRICE_DIVISOR).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatOfferMessage(offer, keyword) {
  const name = offer.productName ?? 'Produto Shopee'
  const current = priceStr(offer.priceMin ?? offer.price)
  const original = priceStr(offer.originPrice)
  const pct = Number(offer.priceDiscountRate) || 0
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

export async function runAutomation(automation, { sendBroadcastFn = sendBroadcast, isRunningFn = isRunning } = {}) {
  if (!isRunningFn(automation.userId)) return { skipped: 'bot_not_running' }

  const credRow = await db.credential.findUnique({
    where: { userId_platform: { userId: automation.userId, platform: 'shopee' } },
  })
  if (!credRow) return { skipped: 'no_shopee_credentials' }

  const creds = parseCredentialData(credRow.data)
  if (!creds?.appId || !creds?.secretKey) return { skipped: 'invalid_shopee_credentials' }

  const sentItemIds = JSON.parse(automation.sentItemIds ?? '[]')

  const offers = await fetchOffers({
    keyword: automation.keyword,
    minDiscountPct: automation.minDiscountPct,
    limit: automation.offersPerSend,
    excludeItemIds: sentItemIds,
    creds,
    sortType: automation.sortType ?? 2,
    isAMSOffer: automation.isAMSOffer ?? false,
    isKeySeller: automation.isKeySeller ?? false,
  })

  if (!offers.length) return { skipped: 'no_offers_found' }

  const toSend = offers.slice(0, automation.offersPerSend)

  const botConfig = await db.botConfig.findUnique({ where: { userId: automation.userId } })
  const poolJson = botConfig?.copyVariationPoolJson ?? '{}'

  for (const offer of toSend) {
    const base = formatOfferMessage(offer, automation.keyword)
    const text = applyVariation(base, { groupId: automation.destGroupJid, poolJson, random: true })
    await sendBroadcastFn(automation.userId, text, [automation.destGroupJid])
  }

  const newSentIds = addSentIds(sentItemIds, toSend.map(o => o.itemId))
  await db.offerAutomation.update({
    where: { id: automation.id },
    data: { lastSentAt: new Date(), sentItemIds: JSON.stringify(newSentIds) },
  })

  return { sent: toSend.length }
}
```

- [ ] **Step 4: Executar todos os testes**

```bash
node --test test/offer-automation.test.js
```

Esperado: 6 testes passando.

- [ ] **Step 5: Commit**

```bash
git add src/offerAutomation/dispatcher.js test/offer-automation.test.js
git commit -m "feat: offer dispatcher with WhatsApp message formatter and dedup tracking"
```

---

## Task 4: Cron runner

**Files:**
- Create: `src/offerAutomation/cron.js`

- [ ] **Step 1: Implementar `src/offerAutomation/cron.js`**

```js
import db from '../db.js'
import { runAutomation } from './dispatcher.js'

const TICK_MS = 60_000

async function tick() {
  const now = new Date()
  const automations = await db.offerAutomation.findMany({
    where: { enabled: true },
  })

  for (const automation of automations) {
    const dueAt = automation.lastSentAt
      ? new Date(automation.lastSentAt.getTime() + automation.intervalMinutes * 60_000)
      : new Date(0)

    if (now < dueAt) continue

    try {
      await runAutomation(automation)
    } catch (err) {
      console.error(`[offer-cron] automation ${automation.id} failed:`, err.message)
    }
  }
}

export function startOfferAutomationCron() {
  const interval = setInterval(() => {
    tick().catch(err => console.error('[offer-cron] tick error:', err.message))
  }, TICK_MS)
  interval.unref()
  return interval
}
```

- [ ] **Step 2: Verificar sintaxe**

```bash
node --input-type=module < src/offerAutomation/cron.js 2>&1 | head -5
```

Esperado: sem erros de sintaxe (pode ter erro de import se DB não estiver disponível, ok).

- [ ] **Step 3: Commit**

```bash
git add src/offerAutomation/cron.js
git commit -m "feat: offer automation cron runner (60s tick, runs inside API process)"
```

---

## Task 5: API routes — CRUD

**Files:**
- Create: `src/api/routes/offerAutomation.js`
- Modify: `test/offer-automation.test.js` (adicionar testes de rota)

- [ ] **Step 1: Adicionar testes de rota ao arquivo existente**

Adicionar ao final de `test/offer-automation.test.js`:

```js
import Fastify from 'fastify'
import { offerAutomationRoutes } from '../src/api/routes/offerAutomation.js'

function buildApp(dbMock) {
  const app = Fastify()
  app.decorate('authenticate', async (req) => { req.user = { sub: 'user-1' } })
  app.register(offerAutomationRoutes, { prefix: '/api/offer-automations', db: dbMock })
  return app
}

test('GET /api/offer-automations: returns user automations', async () => {
  const fakeList = [
    { id: 'a1', userId: 'user-1', keyword: 'festa', intervalMinutes: 120,
      offersPerSend: 2, minDiscountPct: 20, enabled: true, destGroupJid: '123@g.us',
      destGroupName: 'Grupo Festas', lastSentAt: null, sentItemIds: '[]',
      createdAt: new Date(), updatedAt: new Date() },
  ]
  const dbMock = {
    offerAutomation: {
      findMany: async ({ where }) => where.userId === 'user-1' ? fakeList : [],
    },
  }
  const app = buildApp(dbMock)
  const res = await app.inject({ method: 'GET', url: '/api/offer-automations' })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.equal(body.length, 1)
  assert.equal(body[0].keyword, 'festa')
})

test('POST /api/offer-automations: creates automation', async () => {
  let created = null
  const dbMock = {
    offerAutomation: {
      create: async ({ data }) => { created = data; return { id: 'new-1', ...data } },
    },
  }
  const app = buildApp(dbMock)
  const res = await app.inject({
    method: 'POST',
    url: '/api/offer-automations',
    payload: {
      destGroupJid: '123@g.us',
      destGroupName: 'Grupo Festas',
      keyword: 'decoração festa',
      intervalMinutes: 240,
      offersPerSend: 1,
      minDiscountPct: 20,
    },
  })
  assert.equal(res.statusCode, 200)
  assert.equal(created.keyword, 'decoração festa')
  assert.equal(created.userId, 'user-1')
})

test('POST /api/offer-automations: rejects missing keyword', async () => {
  const dbMock = { offerAutomation: {} }
  const app = buildApp(dbMock)
  const res = await app.inject({
    method: 'POST',
    url: '/api/offer-automations',
    payload: { destGroupJid: '123@g.us', destGroupName: 'G', intervalMinutes: 60, offersPerSend: 1, minDiscountPct: 0 },
  })
  assert.equal(res.statusCode, 400)
})

test('DELETE /api/offer-automations/:id: deletes owned automation', async () => {
  const dbMock = {
    offerAutomation: {
      findFirst: async () => ({ id: 'a1', userId: 'user-1' }),
      delete: async () => ({ id: 'a1' }),
    },
  }
  const app = buildApp(dbMock)
  const res = await app.inject({ method: 'DELETE', url: '/api/offer-automations/a1' })
  assert.equal(res.statusCode, 200)
})
```

- [ ] **Step 2: Confirmar falha**

```bash
node --test test/offer-automation.test.js
```

Esperado: falha nos 4 novos testes.

- [ ] **Step 3: Implementar `src/api/routes/offerAutomation.js`**

```js
import dbDefault from '../../db.js'
import { runAutomation } from '../../offerAutomation/dispatcher.js'

const VALID_INTERVALS = [60, 120, 240, 360, 720, 1440]
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
    const { destGroupJid, destGroupName, keyword, intervalMinutes, offersPerSend, minDiscountPct, sortType, isAMSOffer, isKeySeller } = req.body ?? {}

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
        isAMSOffer: Boolean(isAMSOffer ?? false),
        isKeySeller: Boolean(isKeySeller ?? false),
      },
    })
  })

  app.put('/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const existing = await db.offerAutomation.findFirst({
      where: { id: req.params.id, userId: req.user.sub },
    })
    if (!existing) return reply.code(404).send({ error: 'Automação não encontrada' })

    const { keyword, intervalMinutes, offersPerSend, minDiscountPct, enabled, destGroupJid, destGroupName } = req.body ?? {}
    const updates = {}

    if (keyword !== undefined) updates.keyword = keyword.trim()
    if (destGroupJid !== undefined) updates.destGroupJid = destGroupJid
    if (destGroupName !== undefined) updates.destGroupName = destGroupName
    if (intervalMinutes !== undefined) {
      if (!VALID_INTERVALS.includes(Number(intervalMinutes))) {
        return reply.code(400).send({ error: 'Intervalo inválido' })
      }
      updates.intervalMinutes = Number(intervalMinutes)
    }
    if (offersPerSend !== undefined) updates.offersPerSend = Number(offersPerSend)
    if (minDiscountPct !== undefined) updates.minDiscountPct = Number(minDiscountPct)
    if (enabled !== undefined) updates.enabled = Boolean(enabled)

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

- [ ] **Step 4: Executar todos os testes**

```bash
node --test test/offer-automation.test.js
```

Esperado: 10 testes passando.

- [ ] **Step 5: Commit**

```bash
git add src/api/routes/offerAutomation.js test/offer-automation.test.js
git commit -m "feat: offer automation CRUD routes with validation"
```

---

## Task 6: Integrar no servidor API

**Files:**
- Modify: `src/api/server.js`

- [ ] **Step 1: Localizar onde as rotas são registradas**

```bash
grep -n "broadcastRoutes\|credentialsRoutes\|import.*routes" /home/user/wabot/src/api/server.js | head -20
```

- [ ] **Step 2: Adicionar import das rotas e do cron**

No bloco de imports de rotas (junto com `broadcastRoutes`, `credentialsRoutes`, etc.):

```js
import { offerAutomationRoutes } from './routes/offerAutomation.js'
import { startOfferAutomationCron } from '../offerAutomation/cron.js'
```

- [ ] **Step 3: Registrar a rota**

Onde os outros `app.register(...)` de rotas estão, adicionar:

```js
app.register(offerAutomationRoutes, { prefix: '/api/offer-automations' })
```

- [ ] **Step 4: Iniciar o cron após o servidor estar pronto**

Localizar onde o servidor chama `app.listen(...)` ou onde outros serviços são iniciados no boot. Adicionar após o listen:

```js
startOfferAutomationCron()
```

- [ ] **Step 5: Verificar que o servidor inicia sem erros**

```bash
cd /home/user/wabot && node -e "import('./src/api/server.js')" 2>&1 | head -20
```

Esperado: nenhum erro de importação ou sintaxe.

- [ ] **Step 6: Commit**

```bash
git add src/api/server.js
git commit -m "feat: register offer automation routes and start cron on API boot"
```

---

## Task 7: Dashboard — cliente API

**Files:**
- Modify: `dashboard/lib/api.js`

- [ ] **Step 1: Adicionar métodos ao objeto `api`**

Em `dashboard/lib/api.js`, no bloco onde estão os outros métodos (ex: próximo de `scheduledList`), adicionar:

```js
offerAutomations: () => apiFetch('/api/offer-automations'),
offerAutomationCreate: (data) =>
  apiFetch('/api/offer-automations', { method: 'POST', body: JSON.stringify(data) }),
offerAutomationUpdate: (id, data) =>
  apiFetch(`/api/offer-automations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
offerAutomationDelete: (id) =>
  apiFetch(`/api/offer-automations/${id}`, { method: 'DELETE' }),
offerAutomationTrigger: (id) =>
  apiFetch(`/api/offer-automations/${id}/trigger`, { method: 'POST' }),
variationsGet: () => apiFetch('/api/config'),
variationsUpdate: (copyVariationPoolJson) =>
  apiFetch('/api/config', { method: 'PUT', body: JSON.stringify({ copyVariationPoolJson }) }),
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/lib/api.js
git commit -m "feat: add offer automation and variations API client methods"
```

---

## Task 8: Adicionar item de navegação

**Files:**
- Modify: `dashboard/app/dashboard/DashboardClientLayout.js`

- [ ] **Step 1: Adicionar entrada no `navGroups`**

Em `DashboardClientLayout.js`, no array `navGroups`, dentro do grupo `'Operação'`, após o item `'Gerar oferta'`:

```js
{ href: '/dashboard/ofertas-automaticas', icon: '🤖', label: 'Ofertas automáticas' },
{ href: '/dashboard/variacoes-de-texto', icon: '🎲', label: 'Ganchos e CTAs' },
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/app/dashboard/DashboardClientLayout.js
git commit -m "feat: add Ofertas automáticas and Ganchos e CTAs nav items"
```

---

## Task 9: Dashboard — página de configuração

**Files:**
- Create: `dashboard/app/dashboard/ofertas-automaticas/page.js`

- [ ] **Step 1: Criar a página**

Criar `dashboard/app/dashboard/ofertas-automaticas/page.js`:

```js
'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { LoadingState } from '@/components/States'
import { Alert } from '@/components/Alert'
import { ConfirmDialog } from '@/components/ConfirmDialog'

const INTERVAL_OPTIONS = [
  { value: 60,   label: 'A cada 1 hora' },
  { value: 120,  label: 'A cada 2 horas' },
  { value: 240,  label: 'A cada 4 horas' },
  { value: 360,  label: 'A cada 6 horas' },
  { value: 720,  label: 'A cada 12 horas' },
  { value: 1440, label: 'Uma vez por dia' },
]

const DISCOUNT_OPTIONS = [
  { value: 0,  label: 'Qualquer produto em oferta' },
  { value: 10, label: 'Pelo menos 10% de desconto' },
  { value: 20, label: 'Pelo menos 20% de desconto (recomendado)' },
  { value: 30, label: 'Pelo menos 30% de desconto' },
  { value: 50, label: 'Só promoções acima de 50% (as maiores ofertas)' },
]

const OFFERS_PER_SEND_OPTIONS = [
  { value: 1, label: '1 produto por envio' },
  { value: 2, label: '2 produtos por envio' },
  { value: 3, label: '3 produtos por envio' },
]

const emptyForm = {
  destGroupJid: '',
  destGroupName: '',
  keyword: '',
  intervalMinutes: 240,
  offersPerSend: 1,
  minDiscountPct: 20,
}

function nextSendLabel(lastSentAt, intervalMinutes) {
  if (!lastSentAt) return 'Próximo envio: assim que o bot estiver ativo'
  const next = new Date(new Date(lastSentAt).getTime() + intervalMinutes * 60_000)
  const now = new Date()
  if (next <= now) return 'Próximo envio: em breve'
  const diff = Math.round((next - now) / 60_000)
  if (diff < 60) return `Próximo envio: em ${diff} min`
  return `Próximo envio: em ${Math.round(diff / 60)}h`
}

export default function OfertasAutomaticasPage() {
  const [automations, setAutomations] = useState([])
  const [loading, setLoading] = useState(true)
  const [waGroups, setWaGroups] = useState([])
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [triggering, setTriggering] = useState(null)
  const [triggerResult, setTriggerResult] = useState({})

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [list, groups] = await Promise.all([
        api.offerAutomations(),
        api.groups().then(gs => gs.filter(g => g.role === 'post')),
      ])
      setAutomations(list)
      setWaGroups(groups)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function openCreate() {
    setEditId(null)
    setForm(emptyForm)
    setSaveError('')
    setShowForm(true)
  }

  function openEdit(a) {
    setEditId(a.id)
    setForm({
      destGroupJid: a.destGroupJid,
      destGroupName: a.destGroupName,
      keyword: a.keyword,
      intervalMinutes: a.intervalMinutes,
      offersPerSend: a.offersPerSend,
      minDiscountPct: a.minDiscountPct,
    })
    setSaveError('')
    setShowForm(true)
  }

  function handleGroupChange(jid) {
    const g = waGroups.find(g => g.waJid === jid)
    setForm(f => ({ ...f, destGroupJid: jid, destGroupName: g?.name ?? jid }))
  }

  async function handleSave() {
    setSaving(true)
    setSaveError('')
    try {
      if (editId) {
        await api.offerAutomationUpdate(editId, form)
      } else {
        await api.offerAutomationCreate(form)
      }
      setShowForm(false)
      await load()
    } catch (err) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(a) {
    try {
      await api.offerAutomationUpdate(a.id, { enabled: !a.enabled })
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDelete(a) {
    try {
      await api.offerAutomationDelete(a.id)
      setDeleteTarget(null)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleTrigger(a) {
    setTriggering(a.id)
    setTriggerResult(r => ({ ...r, [a.id]: null }))
    try {
      const res = await api.offerAutomationTrigger(a.id)
      setTriggerResult(r => ({ ...r, [a.id]: res.result }))
      await load()
    } catch (err) {
      setTriggerResult(r => ({ ...r, [a.id]: { error: err.message } }))
    } finally {
      setTriggering(null)
    }
  }

  if (loading) return <LoadingState />

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Ofertas automáticas</h1>
          <p className="text-sm text-gray-500 mt-1">
            O bot busca promoções na Shopee e envia automaticamente para seus grupos.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
        >
          + Nova automação
        </button>
      </div>

      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-3 flex items-center justify-between text-sm">
        <span className="text-gray-600">🎲 Quer que cada mensagem saia diferente? Configure ganchos e CTAs.</span>
        <a href="/dashboard/variacoes-de-texto" className="text-green-700 font-medium hover:underline shrink-0 ml-4">
          Editar ganchos e CTAs →
        </a>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      {!automations.length && !showForm && (
        <div className="text-center py-12 text-gray-400 text-sm border-2 border-dashed rounded-lg">
          Nenhuma automação configurada ainda.<br />
          Clique em <strong>+ Nova automação</strong> para começar.
        </div>
      )}

      {showForm && (
        <div className="border rounded-lg p-4 bg-white space-y-4">
          <h2 className="font-semibold text-gray-800">{editId ? 'Editar automação' : 'Nova automação'}</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              O que você quer vender?
            </label>
            <input
              type="text"
              value={form.keyword}
              onChange={e => setForm(f => ({ ...f, keyword: e.target.value }))}
              placeholder="Ex: decoração de festas, eletrônicos, moda feminina"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <p className="text-xs text-gray-400 mt-1">Use palavras que descrevem o tipo de produto.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Enviar para qual grupo?
            </label>
            <select
              value={form.destGroupJid}
              onChange={e => handleGroupChange(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">Selecione um grupo</option>
              {waGroups.map(g => (
                <option key={g.id} value={g.waJid}>{g.name}</option>
              ))}
            </select>
            {!waGroups.length && (
              <p className="text-xs text-orange-500 mt-1">
                Nenhum grupo de destino cadastrado. Vá em Grupos e Canais para adicionar.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Com que frequência enviar?
            </label>
            <select
              value={form.intervalMinutes}
              onChange={e => setForm(f => ({ ...f, intervalMinutes: Number(e.target.value) }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {INTERVAL_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quantos produtos enviar de uma vez?
            </label>
            <select
              value={form.offersPerSend}
              onChange={e => setForm(f => ({ ...f, offersPerSend: Number(e.target.value) }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {OFFERS_PER_SEND_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Qual o desconto mínimo para enviar?
            </label>
            <select
              value={form.minDiscountPct}
              onChange={e => setForm(f => ({ ...f, minDiscountPct: Number(e.target.value) }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {DISCOUNT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">Só produtos com desconto real serão enviados.</p>
          </div>

          {saveError && <Alert type="error">{saveError}</Alert>}

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving || !form.keyword.trim() || !form.destGroupJid}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {automations.map(a => {
          const result = triggerResult[a.id]
          return (
            <div key={a.id} className="border rounded-lg p-4 bg-white">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">"{a.keyword}"</p>
                  <p className="text-sm text-gray-500">→ {a.destGroupName}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {INTERVAL_OPTIONS.find(o => o.value === a.intervalMinutes)?.label ?? `${a.intervalMinutes} min`}
                    {' · '}
                    {OFFERS_PER_SEND_OPTIONS.find(o => o.value === a.offersPerSend)?.label ?? `${a.offersPerSend} produto(s)`}
                    {' · '}
                    {DISCOUNT_OPTIONS.find(o => o.value === a.minDiscountPct)?.label ?? `${a.minDiscountPct}% OFF mín.`}
                  </p>
                  <p className="text-xs text-gray-400">{nextSendLabel(a.lastSentAt, a.intervalMinutes)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleToggle(a)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${a.enabled ? 'bg-green-500' : 'bg-gray-300'}`}
                    title={a.enabled ? 'Pausar' : 'Ativar'}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${a.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                  <button
                    onClick={() => handleTrigger(a)}
                    disabled={triggering === a.id}
                    className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                    title="Enviar agora (teste)"
                  >
                    {triggering === a.id ? 'Enviando...' : 'Enviar agora'}
                  </button>
                  <button onClick={() => openEdit(a)} className="text-xs text-gray-500 hover:underline">Editar</button>
                  <button onClick={() => setDeleteTarget(a)} className="text-xs text-red-500 hover:underline">Remover</button>
                </div>
              </div>
              {result && (
                <p className={`text-xs mt-2 ${result.error ? 'text-red-500' : 'text-green-600'}`}>
                  {result.error
                    ? `Erro: ${result.error}`
                    : result.skipped
                      ? `Ignorado: ${result.skipped}`
                      : `✓ ${result.sent} produto(s) enviado(s)`}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {deleteTarget && (
        <ConfirmDialog
          title="Remover automação"
          description={`Tem certeza que deseja remover a automação para "${deleteTarget.keyword}"?`}
          confirmLabel="Remover"
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/app/dashboard/ofertas-automaticas/page.js
git commit -m "feat: offer automation dashboard page with layman-friendly copy"
```

---

## Task 10: Desbloquear copyVariationPoolJson e modo random

**Files:**
- Modify: `src/core/copyVariation.js`
- Modify: `src/api/routes/config.js`

- [ ] **Step 1: Adicionar opção `random` em `pickVariant` e `applyVariation`**

Em `src/core/copyVariation.js`, substituir a função `pickVariant`:

```js
export function pickVariant(bucket, groupId, date, random = false) {
  if (!Array.isArray(bucket) || bucket.length === 0) return ''
  if (bucket.length === 1) return bucket[0]
  if (random) return bucket[Math.floor(Math.random() * bucket.length)]
  const idx = hash32(`${groupId}|${date}`) % bucket.length
  return bucket[idx]
}
```

E em `applyVariation`, adicionar `random` no destructure de `opts` e passar para `pickVariant`:

```js
export function applyVariation(text, opts = {}) {
  const { groupId, date, pool, poolJson, random = false } = opts
  if (text == null) return text
  let p = pool
  if (!p && poolJson) {
    try { p = typeof poolJson === 'string' ? JSON.parse(poolJson) : poolJson } catch { p = null }
  }
  if (!p || typeof p !== 'object') return text

  const today = date ?? new Date().toISOString().slice(0, 10)

  const greeting = pickVariant(p.greetings, groupId, today, random)
  const cta = pickVariant(p.ctas, groupId, today + 'c', random)
  const trailer = pickVariant(p.trailers, groupId, today + 't', random)

  if (PLACEHOLDER_RE.test(text)) {
    PLACEHOLDER_RE.lastIndex = 0
    return text.replace(PLACEHOLDER_RE, (_, key) => {
      if (key === 'greeting') return greeting
      if (key === 'cta') return cta
      if (key === 'trailer') return trailer
      return ''
    })
  }

  return `${greeting}${text}${trailer}`
}
```

- [ ] **Step 2: Expor `copyVariationPoolJson` no `/api/config`**

Em `src/api/routes/config.js`, no GET da config, incluir `copyVariationPoolJson` no select e no retorno:

```js
// No SELECT do findUnique (ou no objeto retornado):
copyVariationPoolJson: cfg?.copyVariationPoolJson ?? '{}'
```

No PUT, aceitar e salvar `copyVariationPoolJson`:

```js
const { delayMin, delayMax, platforms, blockedKeywords, welcomeMsg,
        feedGlobal, postToStatus, brandingGroupLink, brandingCtaText,
        copyVariationPoolJson } = req.body ?? {}

// Antes do upsert, adicionar validação:
if (copyVariationPoolJson !== undefined) {
  if (typeof copyVariationPoolJson !== 'string') {
    return reply.code(400).send({ error: 'copyVariationPoolJson deve ser string JSON' })
  }
  try { JSON.parse(copyVariationPoolJson) } catch {
    return reply.code(400).send({ error: 'copyVariationPoolJson contém JSON inválido' })
  }
  updates.copyVariationPoolJson = copyVariationPoolJson
}
```

- [ ] **Step 3: Verificar que o encaminhamento normal não quebrou**

```bash
node --test test/ 2>&1 | grep -E "pass|fail|ok"
```

Esperado: todos passando, nenhuma regressão em `copyVariation`.

- [ ] **Step 4: Commit**

```bash
git add src/core/copyVariation.js src/api/routes/config.js
git commit -m "feat: random variation mode for offer automation, expose copyVariationPoolJson in /api/config"
```

---

## Task 11: Página de Ganchos e CTAs

**Files:**
- Create: `dashboard/app/dashboard/variacoes-de-texto/page.js`

- [ ] **Step 1: Criar página**

Criar `dashboard/app/dashboard/variacoes-de-texto/page.js`:

```js
'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'
import { LoadingState } from '@/components/States'
import { CopyVariationPoolEditor } from '@/components/preservacao/CopyVariationPoolEditor'

export default function VariacoesDeTextoPage() {
  const [value, setValue] = useState({ copyVariationPoolJson: '{}' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.variationsGet()
      .then(cfg => setValue({ copyVariationPoolJson: cfg.copyVariationPoolJson ?? '{}' }))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      await api.variationsUpdate(value.copyVariationPoolJson)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingState />

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Ganchos e CTAs</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure variações de texto para que suas ofertas automáticas nunca saiam iguais.
          O bot escolhe aleatoriamente uma opção de cada grupo a cada envio.
        </p>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      <CopyVariationPoolEditor value={value} onChange={next => setValue(v => ({ ...v, ...next }))} disabled={saving} />

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
        >
          {saving ? 'Salvando...' : 'Salvar variações'}
        </button>
        {saved && <span className="text-sm text-green-600">✓ Salvo!</span>}
      </div>

      <p className="text-xs text-gray-400">
        ← <a href="/dashboard/ofertas-automaticas" className="hover:underline">Voltar para Ofertas automáticas</a>
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/app/dashboard/variacoes-de-texto/page.js
git commit -m "feat: Ganchos e CTAs page — free for all plans, wired to offer automation"
```

---

## Task 13: Executar suite completa e push

- [ ] **Step 1: Executar todos os testes**

```bash
cd /home/user/wabot && npm test
```

Esperado: todos passando (incluindo os 10 de `offer-automation.test.js`).

- [ ] **Step 2: Build do dashboard**

```bash
cd /home/user/wabot/dashboard && npm run build 2>&1 | tail -20
```

Esperado: build sem erros (warnings de eslint são ok).

- [ ] **Step 3: Push**

```bash
git push -u origin claude/shopee-affiliate-offers-api-ADOlJ
```

---

## Self-Review

### Spec coverage

| Requisito | Task que implementa |
|---|---|
| Busca de ofertas via `productOfferV2` | Task 2 |
| Apenas produtos em oferta real (desconto > 0) | Task 2 — `filterOffers` |
| Configuração de palavra-chave | Tasks 5, 9 |
| Configuração de intervalo de envio | Tasks 5, 9 |
| Configuração de quantidade por envio | Tasks 5, 9 |
| Configuração de desconto mínimo | Tasks 5, 9 |
| Configuração de grupo destino | Tasks 5, 9 |
| Linguagem leiga na UI | Task 9 — labels de todas as opções |
| Envio automático periódico | Tasks 4, 6 |
| Deduplicação (não repetir produto) | Tasks 2, 3 |
| Ativar/Pausar automação | Tasks 5, 9 |
| Envio manual (teste) | Tasks 5, 9 |
| Credenciais Shopee reutilizadas do banco | Task 3 — `db.credential` |
| Variação aleatória por envio (ganchos/CTAs) | Tasks 3, 10 — `applyVariation` com `random: true` |
| Desbloquear variações para todos os planos | Task 10 — `/api/config` expõe `copyVariationPoolJson` sem gate |
| Página dedicada de Ganchos e CTAs | Task 11 — `/dashboard/variacoes-de-texto` |
| Botão de atalho na página de automação | Task 9 — banner com link para `/dashboard/variacoes-de-texto` |

### Sem placeholders
Todos os blocos de código são implementações completas.

### Consistência de tipos
- `formatOfferMessage(offer, keyword)` — definido Task 3, usado Task 9 (indireto via trigger)
- `runAutomation(automation, { sendBroadcastFn, isRunningFn })` — definido Task 3, chamado Task 4 e Task 5
- `fetchOffers({ keyword, minDiscountPct, limit, excludeItemIds, creds })` — definido Task 2, chamado Task 3
- `offerAutomationRoutes(app, opts)` — definido Task 5, registrado Task 6 com `opts.db ?? dbDefault`
