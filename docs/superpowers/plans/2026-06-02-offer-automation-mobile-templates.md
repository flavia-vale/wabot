# Offer Automation Mobile Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make automatic Shopee offer sends use the same editable offer templates used by “Gerar oferta”, expose those templates on the “Ganchos e CTAs” page, add a preset matching the current hardcoded automatic-offer copy, and show users the variables they can insert.

**Architecture:** Keep one shared template store in `BotConfig.mobileTemplatesJson`, already used by mobile “Gerar oferta”, and make offer automations resolve their selected template from that same store. Add a `templateKey` to `OfferAutomation` so each automation can choose a model while existing automations default to the new “Automático clássico” preset that reproduces the current hardcoded copy. Extend the template renderer to support both manual product data and Shopee automation metadata (`{desconto}`, `{rating}`, `{vendas}`, `{loja}`), then reuse it in the dispatcher.

**Tech Stack:** Node.js ESM, Fastify routes, Prisma + SQLite migrations, Next.js dashboard, node:test.

---

## Risk and Blocking Analysis

1. **Fatal errors:** Avoid circular imports between `src/` and `dashboard/` by putting shared template constants/rendering in dashboard libs already imported by backend code (`src/telegram/offerBot.js` imports dashboard libs today). Add tests before changing dispatcher formatting to prevent silent WhatsApp copy regressions.
2. **Breaking changes:** Adding `OfferAutomation.templateKey` is a DB schema change. It must ship through `develop` and staging first, with `prisma migrate deploy` validated before production.
3. **Cascade effects:** `mobileTemplatesJson` is used by mobile “Gerar oferta” and account template editing. Changes to variables must keep `{produto}`, `{preço}`, `{preço_de}`, and `{link}` behavior unchanged for existing templates.
4. **Environment isolation:** All validation happens locally and then on staging (`~/wabot-staging`, branch `develop`, dashboard `3006`, API `3004`). Do not touch production `.env`, production DB, or production PM2 apps for this feature.
5. **Blocking rule:** If migration fails with SQLite lock or the dashboard build fails, stop and validate staging PM2/database state before proceeding to production. Do not deploy to `main` until staging confirms automatic send, manual “Gerar oferta”, and template editing.

---

## Current Code Map

- `src/offerAutomation/dispatcher.js` currently owns the hardcoded automatic-offer template in `formatOfferMessage()` and calls `applyVariation()` before `sendBroadcast()`.
- `dashboard/lib/mobileTemplateStore.js` owns preset template bodies and persistence for `BotConfig.mobileTemplatesJson`.
- `dashboard/lib/mobileOfferComposer.js` owns template variable replacement and manual offer message generation.
- `dashboard/app/m/account/templates/page.js` already has a template editor with visible variables, but only on mobile account templates.
- `dashboard/app/dashboard/variacoes-de-texto/page.js` is the desktop “Ganchos e CTAs” page and currently edits only variation pools/links.
- `dashboard/app/m/account/variations/page.js` is the mobile “Ganchos e CTAs” page and currently edits only variation pools.
- `dashboard/app/dashboard/ofertas-automaticas/page.js` and `dashboard/app/m/op/automations/page.js` create/edit automations and need a template selector.
- `src/api/routes/offerAutomation.js` validates create/update payloads and needs to accept `templateKey`.
- `prisma/schema.prisma` needs a `templateKey` column on `OfferAutomation`.
- `test/mobile-offer-composer.test.js`, `test/offer-automation.test.js`, and `test/offer-automation-extended.test.js` cover the affected behavior.

---

## File Structure

### Create

- `prisma/migrations/20260602120000_add_offer_automation_template_key/migration.sql`
  - Adds `templateKey TEXT NOT NULL DEFAULT 'automatico_classico'` to `OfferAutomation`.

### Modify

- `prisma/schema.prisma`
  - Add `templateKey String @default("automatico_classico")` to `OfferAutomation`.
- `dashboard/lib/mobileTemplateStore.js`
  - Add `automatico_classico` preset body equal to the current hardcoded automatic-offer copy.
- `dashboard/lib/mobileOfferComposer.js`
  - Extend template variables with `{desconto}`, `{rating}`, `{vendas}`, and `{loja}` while preserving existing behavior.
  - Export visible variable metadata for UI use.
- `src/offerAutomation/dispatcher.js`
  - Replace hardcoded message assembly with shared template rendering.
  - Keep `formatOfferMessage(offer, keyword, templateBody?)` backwards compatible for tests and callers.
- `src/api/routes/offerAutomation.js`
  - Accept, validate, persist, and update `templateKey`.
- `dashboard/app/dashboard/ofertas-automaticas/page.js`
  - Load available templates and add a visible template selector in create/edit forms.
- `dashboard/app/m/op/automations/page.js`
  - Add the same selector in the mobile automation form.
- `dashboard/app/dashboard/variacoes-de-texto/page.js`
  - Show/edit the same offer templates used by “Gerar oferta”, plus the visible variable list.
- `dashboard/app/m/account/variations/page.js`
  - Add a link/section for templates so mobile “Ganchos e CTAs” also exposes them.
- `test/mobile-offer-composer.test.js`
  - Add tests for the new preset and variables.
- `test/offer-automation.test.js`
  - Add tests proving automation uses selected `templateKey` and falls back to `automatico_classico`.
- `test/offer-automation-extended.test.js`
  - Update hardcoded-format tests to use the new preset behavior.

---

## Task 1: Add the `templateKey` database field

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260602120000_add_offer_automation_template_key/migration.sql`

- [ ] **Step 1: Write the schema change**

Add `templateKey` to `OfferAutomation` immediately after `keyword`:

```prisma
model OfferAutomation {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  destGroupJid    String
  destGroupName   String
  keyword         String
  templateKey     String    @default("automatico_classico")
  intervalMinutes Int
  offersPerSend   Int       @default(1)
  minDiscountPct  Int       @default(0)
  sortType        Int       @default(2)
  prioritizeAMS   Boolean   @default(false)
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

- [ ] **Step 2: Create the migration SQL**

Create `prisma/migrations/20260602120000_add_offer_automation_template_key/migration.sql`:

```sql
ALTER TABLE "OfferAutomation" ADD COLUMN "templateKey" TEXT NOT NULL DEFAULT 'automatico_classico';
```

- [ ] **Step 3: Run Prisma generation**

Run:

```bash
npx prisma generate
```

Expected: Prisma Client generation succeeds without schema errors.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260602120000_add_offer_automation_template_key/migration.sql
git commit -m "feat: add offer automation template key"
```

---

## Task 2: Extend shared offer templates and variable metadata

**Files:**
- Modify: `dashboard/lib/mobileTemplateStore.js`
- Modify: `dashboard/lib/mobileOfferComposer.js`
- Test: `test/mobile-offer-composer.test.js`

- [ ] **Step 1: Write failing tests for the new preset and variables**

Append to `test/mobile-offer-composer.test.js`:

```js
test('preset Automático clássico reproduz a copy atual das ofertas automáticas', () => {
  assert.equal(PRESET_TEMPLATE_BODIES.automatico_classico, [
    '🏷️ *{produto}*',
    '',
    '💰 ~{preço_de}~ → *{preço}* (*{desconto}*)',
    '{rating} | {vendas}',
    '',
    '👉 {link}',
  ].join('\n'))
})

test('template Automático clássico preenche desconto, rating e vendas', () => {
  const text = buildMobileOfferText({
    product: {
      title: 'Liquidificador turbo',
      price: 'R$ 89,90',
      oldPrice: 'R$ 129,90',
      discount: '-31% OFF',
      rating: '⭐ 4.8',
      sales: '🛒 1.200+ vendidos',
      storeName: 'Shopee',
    },
    link: 'https://shope.ee/abc',
    template: 'automatico_classico',
    templateBody: PRESET_TEMPLATE_BODIES.automatico_classico,
  })

  assert.match(text, /🏷️ \*Liquidificador turbo\*/)
  assert.match(text, /💰 ~R\$ 129,90~ → \*R\$ 89,90\* \(\*-31% OFF\*\)/)
  assert.match(text, /⭐ 4\.8 \| 🛒 1\.200\+ vendidos/)
  assert.match(text, /👉 https:\/\/shope\.ee\/abc/)
  assert.doesNotMatch(text, /\{produto\}|\{preço\}|\{preço_de\}|\{desconto\}|\{rating\}|\{vendas\}|\{link\}/)
})

test('template remove linha de metadata vazia quando rating e vendas faltam', () => {
  const text = buildMobileOfferText({
    product: {
      title: 'Produto simples',
      price: 'R$ 39,90',
      oldPrice: '',
      discount: '',
      rating: '',
      sales: '',
    },
    link: 'https://shope.ee/sem-meta',
    template: 'automatico_classico',
    templateBody: PRESET_TEMPLATE_BODIES.automatico_classico,
  })

  assert.match(text, /🏷️ \*Produto simples\*/)
  assert.match(text, /💰 \*R\$ 39,90\*/)
  assert.doesNotMatch(text, /^\s*\|\s*$/m)
  assert.doesNotMatch(text, /vendidos/)
  assert.doesNotMatch(text, /⭐/)
})
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
node --test test/mobile-offer-composer.test.js
```

Expected: FAIL because `PRESET_TEMPLATE_BODIES.automatico_classico` and the new variables are not implemented yet.

- [ ] **Step 3: Add the preset body**

In `dashboard/lib/mobileTemplateStore.js`, add the new preset before `simples`:

```js
export const PRESET_TEMPLATE_BODIES = {
  automatico_classico: '🏷️ *{produto}*\n\n💰 ~{preço_de}~ → *{preço}* (*{desconto}*)\n{rating} | {vendas}\n\n👉 {link}',
  simples: '🛍️ {produto}\n\n~De {preço_de}~\n💥 *Por {preço}*\n\n🛒 Compre aqui 👉 {link}',
  achadinho: '✨ Achadinho do dia\n\n{produto}\n\nDe {preço_de} por *{preço}*\n\n👉 {link}',
  relampago: '⚡ Oferta relâmpago\n\n{produto}\n\nDe {preço_de} por *{preço}*\n\n👉 {link}',
  tech: '🔌 Achado tech\n\n{produto}\n\nDe {preço_de} por *{preço}*\n\n👉 {link}',
  beleza: '💄 Oferta de beleza\n\n{produto}\n\nDe {preço_de} por *{preço}*\n\n👉 {link}',
}
```

- [ ] **Step 4: Add the template option and visible variable metadata**

At the top of `dashboard/lib/mobileOfferComposer.js`, add `automatico_classico` to `TEMPLATE_OPTIONS`:

```js
export const TEMPLATE_OPTIONS = [
  {
    key: 'automatico_classico',
    name: 'Automático clássico',
    preview: `🏷️ *{produto}*

💰 ~{preço_de}~ → *{preço}* (*{desconto}*)
{rating} | {vendas}

👉 {link}`,
  },
  // existing templates stay below
]
```

Also export variable metadata from `dashboard/lib/mobileOfferComposer.js`:

```js
export const OFFER_TEMPLATE_VARIABLES = [
  { token: '{produto}', label: 'Nome do produto', example: 'Liquidificador turbo' },
  { token: '{preço}', label: 'Preço atual', example: 'R$ 89,90' },
  { token: '{preço_de}', label: 'Preço antigo', example: 'R$ 129,90' },
  { token: '{desconto}', label: 'Desconto', example: '-31% OFF' },
  { token: '{rating}', label: 'Avaliação', example: '⭐ 4.8' },
  { token: '{vendas}', label: 'Vendas', example: '🛒 1.200+ vendidos' },
  { token: '{link}', label: 'Link da oferta', example: 'https://shope.ee/abc' },
  { token: '{loja}', label: 'Loja/plataforma', example: 'Shopee' },
]
```

- [ ] **Step 5: Extend normalization and replacement**

In `normalizeMobileOfferProduct()`, return the extra optional fields:

```js
export function normalizeMobileOfferProduct(product = {}, manual = {}) {
  return {
    title: firstText(product?.title, product?.productName, manual.title, 'Produto em oferta'),
    price: firstText(product?.price, product?.newPrice, product?.priceNow, manual.price),
    oldPrice: firstText(product?.oldPrice, product?.priceWas, manual.oldPrice),
    discount: firstText(product?.discount, product?.discountText, manual.discount),
    rating: firstText(product?.rating, product?.ratingText, manual.rating),
    sales: firstText(product?.sales, product?.salesText, manual.sales),
    storeName: firstText(product?.storeName, product?.store, product?.platformName, manual.storeName),
  }
}
```

Update `applyTemplateVariables()` to accept and clean the new variables:

```js
export function applyTemplateVariables(body, { title = '', price = '', oldPrice = '', link = '', discount = '', rating = '', sales = '', storeName = '' } = {}) {
  let result = body
    .replace(/\{produto\}/g, title || '{produto}')
    .replace(/\{preço\}/g, price || '{preço}')
    .replace(/\{link\}/g, link || '{link}')
    .replace(/\{desconto\}/g, discount || '')
    .replace(/\{rating\}/g, rating || '')
    .replace(/\{vendas\}/g, sales || '')
    .replace(/\{loja\}/g, storeName || '')

  if (oldPrice) {
    result = result.replace(/\{preço_de\}/g, oldPrice)
  } else {
    result = result
      .replace(/💰\s*~\{preço_de\}~\s*→\s*\*([^*]+)\*\s*\(\*?\s*\*?\)/g, '💰 *$1*')
      .replace(/De \{preço_de\} por \*([^*]+)\*/g, '*$1*')
      .replace(/^\s*~?De \{preço_de\}~?\s*$/gm, '')
      .replace(/\{preço_de\}/g, '')
  }

  return result
    .replace(/\(\*?\s*\*?\)/g, '')
    .replace(/^\s*\|\s*$/gm, '')
    .replace(/^\s*\|\s*/gm, '')
    .replace(/\s*\|\s*$/gm, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
```

Update the `buildMobileOfferText()` template call:

```js
const bodyText = applyTemplateVariables(templateBody, {
  title: normalized.title,
  price: normalized.price,
  oldPrice: normalized.oldPrice,
  link,
  discount: normalized.discount,
  rating: normalized.rating,
  sales: normalized.sales,
  storeName: normalized.storeName,
})
```

- [ ] **Step 6: Run focused tests**

Run:

```bash
node --test test/mobile-offer-composer.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add dashboard/lib/mobileTemplateStore.js dashboard/lib/mobileOfferComposer.js test/mobile-offer-composer.test.js
git commit -m "feat: add automatic offer template preset"
```

---

## Task 3: Make offer automation render from shared templates

**Files:**
- Modify: `src/offerAutomation/dispatcher.js`
- Test: `test/offer-automation.test.js`
- Test: `test/offer-automation-extended.test.js`

- [ ] **Step 1: Write failing automation template tests**

Append to `test/offer-automation.test.js`:

```js
test('runAutomation: usa templateKey selecionado em mobileTemplatesJson', async () => {
  const automation = {
    id: 'auto-template', userId: 'user-template', keyword: 'festa', minDiscountPct: 0,
    offersPerSend: 1, destGroupJid: 'grupo@g.us', sentItemIds: '[]', intervalMinutes: 60,
    sortType: 2, prioritizeAMS: false, isKeySeller: false, templateKey: 'tpl_custom',
  }
  const sent = []
  const dbMock = {
    credential: { findUnique: async () => ({ data: JSON.stringify({ appId: 'app', secretKey: 'secret' }) }) },
    botConfig: { findUnique: async () => ({
      mobileTemplatesJson: JSON.stringify({ overrides: {}, custom: [{ key: 'tpl_custom', name: 'Meu modelo', body: '🔥 {produto}\n{preço}\n{desconto}\n{rating}\n{vendas}\n{link}' }] }),
      copyVariationPoolJson: JSON.stringify({ greetings: [''], ctas: [''], trailers: [''] }),
      brandingGroupLink: '',
      couponLink: '',
    }) },
    offerAutomation: { update: async () => ({}) },
  }

  const result = await runAutomation(automation, {
    dbOverride: dbMock,
    isRunningFn: () => true,
    fetchOffersFn: async () => ({ rawCount: 1, offers: [{
      itemId: '42', productName: 'Balão metalizado', priceMin: '19.9', priceDiscountRate: '20',
      offerLink: 'https://shope.ee/balao', ratingStar: 4.7, sales: 1200, imageUrl: 'https://img.test/balao.jpg',
    }] }),
    sendBroadcastFn: async (_userId, text) => sent.push(text),
  })

  assert.deepEqual(result, { sent: 1 })
  assert.match(sent[0], /🔥 Balão metalizado/)
  assert.match(sent[0], /R\$/)
  assert.match(sent[0], /-20% OFF/)
  assert.match(sent[0], /⭐ 4\.7/)
  assert.match(sent[0], /1\.200\+ vendidos/)
  assert.match(sent[0], /https:\/\/shope\.ee\/balao/)
})

test('runAutomation: sem templateKey cai no Automático clássico', async () => {
  const automation = {
    id: 'auto-default-template', userId: 'user-template', keyword: 'festa', minDiscountPct: 0,
    offersPerSend: 1, destGroupJid: 'grupo@g.us', sentItemIds: '[]', intervalMinutes: 60,
    sortType: 2, prioritizeAMS: false, isKeySeller: false,
  }
  const sent = []
  const dbMock = {
    credential: { findUnique: async () => ({ data: JSON.stringify({ appId: 'app', secretKey: 'secret' }) }) },
    botConfig: { findUnique: async () => ({
      mobileTemplatesJson: '{}',
      copyVariationPoolJson: JSON.stringify({ greetings: [''], ctas: [''], trailers: [''] }),
      brandingGroupLink: '',
      couponLink: '',
    }) },
    offerAutomation: { update: async () => ({}) },
  }

  await runAutomation(automation, {
    dbOverride: dbMock,
    isRunningFn: () => true,
    fetchOffersFn: async () => ({ rawCount: 1, offers: [{
      itemId: '99', productName: 'Kit festa', priceMin: '50', priceDiscountRate: '10',
      offerLink: 'https://shope.ee/kit', ratingStar: null, sales: null,
    }] }),
    sendBroadcastFn: async (_userId, text) => sent.push(text),
  })

  assert.match(sent[0], /🏷️ \*Kit festa\*/)
  assert.match(sent[0], /👉 https:\/\/shope\.ee\/kit/)
})
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
node --test test/offer-automation.test.js test/offer-automation-extended.test.js
```

Expected: FAIL because `runAutomation()` still ignores `templateKey` and `mobileTemplatesJson`.

- [ ] **Step 3: Import shared renderer and templates**

At the top of `src/offerAutomation/dispatcher.js`, add imports:

```js
import { buildMobileOfferText } from '../../dashboard/lib/mobileOfferComposer.js'
import { composeTemplates } from '../../dashboard/lib/mobileTemplateStore.js'
```

- [ ] **Step 4: Add helpers in dispatcher**

Below `priceStr()`, add:

```js
const DEFAULT_AUTOMATION_TEMPLATE_KEY = 'automatico_classico'

function salesStr(raw) {
  const num = Number(raw)
  if (!num || num <= 0) return ''
  return `🛒 ${num.toLocaleString('pt-BR')}+ vendidos`
}

function ratingStr(raw) {
  const num = Number(raw)
  if (!num || num <= 0) return ''
  return `⭐ ${num.toFixed(1)}`
}

function discountStr(raw) {
  const pct = Number(raw) || 0
  return pct > 0 ? `-${pct}% OFF` : ''
}

function automationOfferProduct(offer) {
  const currentRaw = Number(offer.priceMin ?? offer.price) || 0
  const pct = Number(offer.priceDiscountRate) || 0
  const originalRaw = pct > 0 && currentRaw > 0 ? Math.round(currentRaw * 100 / (100 - pct)) : 0
  return {
    title: offer.productName ?? 'Produto Shopee',
    price: priceStr(currentRaw),
    oldPrice: priceStr(originalRaw),
    discount: discountStr(pct),
    rating: ratingStr(offer.ratingStar),
    sales: salesStr(offer.sales),
    storeName: 'Shopee',
  }
}

function parseTemplateStore(mobileTemplatesJson) {
  try { return JSON.parse(mobileTemplatesJson || '{}') } catch { return {} }
}

function resolveAutomationTemplateBody(botConfig, templateKey) {
  const templates = composeTemplates(parseTemplateStore(botConfig?.mobileTemplatesJson))
  const key = templateKey || DEFAULT_AUTOMATION_TEMPLATE_KEY
  return templates.find((template) => template.key === key)?.body
    || templates.find((template) => template.key === DEFAULT_AUTOMATION_TEMPLATE_KEY)?.body
    || null
}
```

- [ ] **Step 5: Make `formatOfferMessage()` template-aware while preserving signature**

Replace `formatOfferMessage()` with:

```js
export function formatOfferMessage(offer, keyword, templateBody = null) {
  if (templateBody) {
    return buildMobileOfferText({
      product: automationOfferProduct(offer),
      link: offer.offerLink,
      template: DEFAULT_AUTOMATION_TEMPLATE_KEY,
      templateBody,
    })
  }

  const name = offer.productName ?? 'Produto Shopee'
  const currentRaw = Number(offer.priceMin ?? offer.price) || 0
  const pct = Number(offer.priceDiscountRate) || 0
  const current = priceStr(currentRaw)

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
```

This keeps old unit tests passing while allowing `runAutomation()` to pass a body.

- [ ] **Step 6: Use the selected template in `runAutomation()`**

After loading `botConfig`, resolve the body:

```js
const templateBody = resolveAutomationTemplateBody(botConfig, automation.templateKey)
```

Then change the send loop:

```js
for (const offer of toSend) {
  const base = formatOfferMessage(offer, automation.keyword, templateBody)
  const text = applyVariation(base, {
    groupId: automation.destGroupJid,
    poolJson,
    groupInviteLink,
    couponLink,
    random: true,
  })
  await sendBroadcastFn(automation.userId, text, [automation.destGroupJid], {
    imageUrl: offer.imageUrl,
    imageRefererUrl: offer.offerLink,
    source: 'offerAutomation',
  })
  sentIds.push(offer.itemId)
}
```

- [ ] **Step 7: Run automation tests**

Run:

```bash
node --test test/offer-automation.test.js test/offer-automation-extended.test.js test/mobile-offer-composer.test.js
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/offerAutomation/dispatcher.js test/offer-automation.test.js test/offer-automation-extended.test.js
git commit -m "feat: render automations with saved offer templates"
```

---

## Task 4: Accept `templateKey` in offer automation API

**Files:**
- Modify: `src/api/routes/offerAutomation.js`
- Test: `test/offer-automation.test.js`

- [ ] **Step 1: Write failing route tests**

Append to `test/offer-automation.test.js` near route tests:

```js
test('POST /api/offer-automations: persists templateKey', async () => {
  let createdData
  const dbMock = {
    offerAutomation: {
      create: async ({ data }) => { createdData = data; return { id: 'a1', ...data } },
    },
  }
  const app = buildOfferApp(dbMock)
  const res = await app.inject({
    method: 'POST',
    url: '/api/offer-automations',
    payload: {
      destGroupJid: '123@g.us', destGroupName: 'Grupo', keyword: 'festa',
      intervalMinutes: 60, offersPerSend: 1, minDiscountPct: 0, templateKey: 'automatico_classico',
    },
  })

  assert.equal(res.statusCode, 200)
  assert.equal(createdData.templateKey, 'automatico_classico')
})

test('PUT /api/offer-automations/:id: updates templateKey', async () => {
  let updatedData
  const dbMock = {
    offerAutomation: {
      findFirst: async () => ({ id: 'a1', userId: 'user-1' }),
      update: async ({ data }) => { updatedData = data; return { id: 'a1', ...data } },
    },
  }
  const app = buildOfferApp(dbMock)
  const res = await app.inject({ method: 'PUT', url: '/api/offer-automations/a1', payload: { templateKey: 'tpl_custom' } })

  assert.equal(res.statusCode, 200)
  assert.equal(updatedData.templateKey, 'tpl_custom')
})

test('POST /api/offer-automations: rejects invalid templateKey characters', async () => {
  const dbMock = { offerAutomation: { create: async () => ({}) } }
  const app = buildOfferApp(dbMock)
  const res = await app.inject({
    method: 'POST',
    url: '/api/offer-automations',
    payload: {
      destGroupJid: '123@g.us', keyword: 'festa', intervalMinutes: 60, offersPerSend: 1,
      templateKey: '../bad',
    },
  })

  assert.equal(res.statusCode, 400)
  assert.match(JSON.parse(res.body).error, /template/i)
})
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
node --test test/offer-automation.test.js
```

Expected: FAIL because the route does not persist/validate `templateKey` yet.

- [ ] **Step 3: Add validation helper**

In `src/api/routes/offerAutomation.js`, add near constants:

```js
const DEFAULT_TEMPLATE_KEY = 'automatico_classico'
const TEMPLATE_KEY_RE = /^[a-zA-Z0-9_-]{1,80}$/

function normalizeTemplateKey(value) {
  const key = String(value ?? DEFAULT_TEMPLATE_KEY).trim() || DEFAULT_TEMPLATE_KEY
  if (!TEMPLATE_KEY_RE.test(key)) return null
  return key
}
```

- [ ] **Step 4: Persist on create**

In POST body destructuring, include `templateKey`:

```js
const { destGroupJid, destGroupName, keyword, intervalMinutes, offersPerSend, minDiscountPct, sortType, prioritizeAMS, isKeySeller, templateKey } = req.body ?? {}
```

Before `db.offerAutomation.create()`, add:

```js
const parsedTemplateKey = normalizeTemplateKey(templateKey)
if (!parsedTemplateKey) return reply.code(400).send({ error: 'templateKey inválido' })
```

Inside `data`, add:

```js
templateKey: parsedTemplateKey,
```

- [ ] **Step 5: Persist on update**

In PUT body destructuring, include `templateKey`:

```js
const { keyword, intervalMinutes, offersPerSend, minDiscountPct, enabled, destGroupJid, destGroupName, prioritizeAMS, templateKey } = req.body ?? {}
```

Before `return db.offerAutomation.update(...)`, add:

```js
if (templateKey !== undefined) {
  const parsedTemplateKey = normalizeTemplateKey(templateKey)
  if (!parsedTemplateKey) return reply.code(400).send({ error: 'templateKey inválido' })
  updates.templateKey = parsedTemplateKey
}
```

- [ ] **Step 6: Run route tests**

Run:

```bash
node --test test/offer-automation.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/api/routes/offerAutomation.js test/offer-automation.test.js
git commit -m "feat: persist offer automation template selection"
```

---

## Task 5: Add template selection to automatic-offer pages

**Files:**
- Modify: `dashboard/app/dashboard/ofertas-automaticas/page.js`
- Modify: `dashboard/app/m/op/automations/page.js`

- [ ] **Step 1: Update desktop imports and state**

In `dashboard/app/dashboard/ofertas-automaticas/page.js`, import:

```js
import { composeTemplates, loadTemplateStore } from '@/lib/mobileTemplateStore'
```

Add `templateKey` to `emptyForm`:

```js
const emptyForm = {
  destGroupJid: '',
  destGroupName: '',
  keyword: '',
  templateKey: 'automatico_classico',
  intervalMinutes: 240,
  offersPerSend: 1,
  minDiscountPct: 20,
  prioritizeAMS: false,
}
```

Add state:

```js
const [templates, setTemplates] = useState([])
```

- [ ] **Step 2: Load templates on desktop page**

In `load()`, fetch templates alongside automations/groups:

```js
const [list, groups, templateStore] = await Promise.all([
  api.offerAutomations(),
  api.groups().then(gs => gs.filter(g => g.role === 'post')),
  loadTemplateStore(),
])
setAutomations(list)
setWaGroups(groups)
setTemplates(composeTemplates(templateStore))
```

- [ ] **Step 3: Populate edit form with saved template**

In `openEdit(a)`, add:

```js
templateKey: a.templateKey || 'automatico_classico',
```

- [ ] **Step 4: Render desktop selector**

In the form, after the keyword input and before destination, add:

```jsx
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">
    Modelo da mensagem
  </label>
  <select
    value={form.templateKey}
    onChange={e => setForm(f => ({ ...f, templateKey: e.target.value }))}
    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
  >
    {templates.map(t => (
      <option key={t.key} value={t.key}>{t.name}</option>
    ))}
  </select>
  <p className="text-xs text-gray-400 mt-1">
    Edite os modelos em Ganchos e CTAs. O padrão “Automático clássico” mantém o texto atual.
  </p>
</div>
```

- [ ] **Step 5: Update mobile automation page**

In `dashboard/app/m/op/automations/page.js`, apply the same changes:

```js
import { composeTemplates, loadTemplateStore } from '@/lib/mobileTemplateStore'
```

Add `templateKey: 'automatico_classico'` to `emptyForm`, add `templates` state, load `templateStore` with `loadTemplateStore()`, set `templates(composeTemplates(templateStore))`, set `templateKey: item.templateKey || 'automatico_classico'` in edit, and render this selector after the keyword field:

```jsx
<label>
  <div style={cfgStyles.label}>Modelo da mensagem</div>
  <select style={cfgStyles.field} value={form.templateKey} onChange={(event) => setForm((current) => ({ ...current, templateKey: event.target.value }))}>
    {templates.map((template) => <option key={template.key} value={template.key}>{template.name}</option>)}
  </select>
</label>
```

- [ ] **Step 6: Run dashboard build check**

Run:

```bash
cd dashboard && npm run build
```

Expected: PASS with a successful Next.js build.

- [ ] **Step 7: Commit**

```bash
git add dashboard/app/dashboard/ofertas-automaticas/page.js dashboard/app/m/op/automations/page.js
git commit -m "feat: select templates for automatic offers"
```

---

## Task 6: Expose templates and variables on “Ganchos e CTAs”

**Files:**
- Modify: `dashboard/app/dashboard/variacoes-de-texto/page.js`
- Modify: `dashboard/app/m/account/variations/page.js`

- [ ] **Step 1: Add template store imports to desktop Ganchos page**

In `dashboard/app/dashboard/variacoes-de-texto/page.js`, import:

```js
import {
  composeTemplates,
  readLocalTemplateStore,
  loadTemplateStore,
  withPresetBody,
  withoutPresetBody,
  withNewCustomTemplate,
  withUpdatedCustomTemplate,
  withoutCustomTemplate,
} from '@/lib/mobileTemplateStore'
import { OFFER_TEMPLATE_VARIABLES } from '@/lib/mobileOfferComposer'
```

- [ ] **Step 2: Load template store with the existing config**

Add state:

```js
const [templateStore, setTemplateStore] = useState(() => readLocalTemplateStore())
const [templateMode, setTemplateMode] = useState('list')
const [editingTemplateKey, setEditingTemplateKey] = useState(null)
const [editTemplateName, setEditTemplateName] = useState('')
const [editTemplateBody, setEditTemplateBody] = useState('')
```

In the existing `useEffect`, after `api.variationsGet()`, also call:

```js
loadTemplateStore()
  .then(store => setTemplateStore(store))
  .catch(() => {})
```

- [ ] **Step 3: Save variations and templates together**

In `handleSave()`, send `mobileTemplatesJson` in the same `api.variationsUpdate()` call:

```js
await api.variationsUpdate({
  copyVariationPoolJson: value.copyVariationPoolJson,
  brandingGroupLink: value.brandingGroupLink,
  couponLink: value.couponLink,
  mobileTemplatesJson: JSON.stringify(templateStore),
})
```

This uses the existing backend contract for `mobileTemplatesJson`.

- [ ] **Step 4: Render visible variable guide**

Add a card before the template editor:

```jsx
<div className="border rounded-lg p-4 bg-white space-y-3">
  <div>
    <h2 className="text-sm font-semibold text-gray-800">Variáveis dos modelos de oferta</h2>
    <p className="text-xs text-gray-500 mt-0.5">
      Clique/copiei uma variável e cole no corpo do modelo. O bot substitui no envio automático e no Gerar oferta.
    </p>
  </div>
  <div className="grid sm:grid-cols-2 gap-2">
    {OFFER_TEMPLATE_VARIABLES.map(variable => (
      <button
        key={variable.token}
        type="button"
        onClick={() => navigator.clipboard?.writeText(variable.token)}
        className="text-left rounded-lg border px-3 py-2 hover:bg-gray-50"
      >
        <code className="text-green-700 font-semibold">{variable.token}</code>
        <div className="text-xs text-gray-500">{variable.label} · Ex: {variable.example}</div>
      </button>
    ))}
  </div>
</div>
```

- [ ] **Step 5: Render template list/editor on desktop**

Use `const templates = composeTemplates(templateStore)` and render:

```jsx
<div className="border rounded-lg p-4 bg-white space-y-3">
  <div className="flex items-center justify-between gap-3">
    <div>
      <h2 className="text-sm font-semibold text-gray-800">Modelos de oferta</h2>
      <p className="text-xs text-gray-500 mt-0.5">
        Estes são os mesmos modelos do Gerar oferta e agora também das ofertas automáticas.
      </p>
    </div>
    <button type="button" onClick={() => { setTemplateMode('create'); setEditingTemplateKey(null); setEditTemplateName(''); setEditTemplateBody('') }} className="px-3 py-2 rounded-lg bg-green-600 text-white text-xs font-semibold">
      + Novo modelo
    </button>
  </div>

  {templateMode === 'list' && templates.map(template => (
    <div key={template.key} className="rounded-lg border px-3 py-2 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-gray-800">{template.name}</div>
        <div className="text-xs text-gray-500 truncate">{(template.body || '').replace(/\n/g, ' · ')}</div>
      </div>
      <button type="button" onClick={() => { setTemplateMode('edit'); setEditingTemplateKey(template.key); setEditTemplateName(template.name); setEditTemplateBody(template.body || '') }} className="text-xs text-green-700 font-semibold hover:underline">
        Editar
      </button>
    </div>
  ))}
</div>
```

- [ ] **Step 6: Implement desktop template save/reset/delete handlers**

Add handlers:

```js
function saveTemplateDraft() {
  if (templateMode === 'create') {
    if (!editTemplateName.trim() || !editTemplateBody.trim()) return
    const { store } = withNewCustomTemplate(templateStore, { name: editTemplateName.trim(), body: editTemplateBody })
    setTemplateStore(store)
    setTemplateMode('list')
    return
  }

  const template = composeTemplates(templateStore).find(t => t.key === editingTemplateKey)
  if (!template || !editTemplateBody.trim()) return
  const nextStore = template.isCustom
    ? withUpdatedCustomTemplate(templateStore, editingTemplateKey, { name: editTemplateName.trim(), body: editTemplateBody })
    : withPresetBody(templateStore, editingTemplateKey, editTemplateBody)
  setTemplateStore(nextStore)
  setTemplateMode('list')
}

function resetPresetTemplate() {
  setTemplateStore(withoutPresetBody(templateStore, editingTemplateKey))
  setTemplateMode('list')
}

function deleteCustomTemplate() {
  setTemplateStore(withoutCustomTemplate(templateStore, editingTemplateKey))
  setTemplateMode('list')
}
```

Render edit mode with textarea and the same `OFFER_TEMPLATE_VARIABLES` buttons under it.

- [ ] **Step 7: Update mobile Ganchos page**

In `dashboard/app/m/account/variations/page.js`, add a clear link/card to the existing template editor:

```jsx
<div style={cfgStyles.cardWrap}>
  <div style={{ ...cfgStyles.cardP, display: 'grid', gap: 10 }}>
    <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)' }}>Modelos de oferta</div>
    <div style={{ fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
      Os modelos do Gerar oferta também podem ser usados nas ofertas automáticas. Lá você vê todas as variáveis disponíveis.
    </div>
    <button type="button" onClick={() => router.push('/m/account/templates')} style={mobi.btn('ghost', true)}>
      Editar modelos e variáveis
    </button>
  </div>
</div>
```

- [ ] **Step 8: Run dashboard build**

Run:

```bash
cd dashboard && npm run build
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add dashboard/app/dashboard/variacoes-de-texto/page.js dashboard/app/m/account/variations/page.js
git commit -m "feat: manage offer templates in cta settings"
```

---

## Task 7: Full regression tests and staging validation

**Files:**
- No new files expected.

- [ ] **Step 1: Run all backend/unit tests**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run dashboard build and config guard**

Run:

```bash
cd dashboard && npm run guard:config-page && npm run build
```

Expected: PASS.

- [ ] **Step 4: Manual staging acceptance on port 3006**

After merging to `develop` and staging deploy completes, validate at `http://178.105.54.0:3006`:

1. Open **Dashboard → Ganchos e CTAs**.
2. Confirm the page shows **Modelos de oferta**.
3. Confirm the page visibly lists variables: `{produto}`, `{preço}`, `{preço_de}`, `{desconto}`, `{rating}`, `{vendas}`, `{link}`, `{loja}`.
4. Confirm there is a preset called **Automático clássico**.
5. Confirm **Automático clássico** body matches the previous automatic-offer copy:

```txt
🏷️ *{produto}*

💰 ~{preço_de}~ → *{preço}* (*{desconto}*)
{rating} | {vendas}

👉 {link}
```

6. Create or edit an offer automation and choose **Automático clássico**.
7. Click **Enviar agora** and confirm the WhatsApp message keeps the old format.
8. Create a custom template with body:

```txt
🔥 TESTE AUTOMÁTICO
{produto}
{preço}
{desconto}
{rating}
{vendas}
{link}
```

9. Edit the automation to use that custom template.
10. Click **Enviar agora** and confirm the WhatsApp message uses the custom format.
11. Open mobile `/m/op/offer` and confirm manual **Gerar oferta** still uses templates normally.
12. Open mobile `/m/account/variations` and confirm it links users to template/variable editing.

- [ ] **Step 5: Confirm no uncommitted implementation drift remains**

Run:

```bash
git status --short
```

Expected: no uncommitted files except intentional follow-up documentation created during implementation.

---

## Self-Review

- **Spec coverage:**
  - Automatic offers use templates from “Gerar oferta”: Tasks 2, 3, 4, and 5.
  - “Ganchos e CTAs” also shows templates: Task 6.
  - Add a template equal to current hardcoded copy: Task 2.
  - Show variables visibly to the user: Task 6.
- **Placeholder scan:** This plan avoids open-ended “TBD” steps and includes exact file paths, commands, test snippets, and code snippets for implementation.
- **Type consistency:** The plan consistently uses `templateKey`, `automatico_classico`, `mobileTemplatesJson`, `OFFER_TEMPLATE_VARIABLES`, `buildMobileOfferText()`, and `composeTemplates()`.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-02-offer-automation-mobile-templates.md`. Two execution options:

1. **Subagent-Driven (recommended)** - dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** - execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach should be used when implementation starts?
