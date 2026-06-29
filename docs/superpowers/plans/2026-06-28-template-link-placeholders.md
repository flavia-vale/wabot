# Template Link Placeholders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent `{{grupoLink}}` and `{{cupomLink}}` from being injected into mirrored group messages that use “Manter texto original convertido”; only replace those variables when the selected template explicitly contains them.

**Architecture:** Keep the fix in the message-rendering boundary, not in route/UI code. The relay path must continue using `applyConversionsAndBranding()` to convert product links and preserve the upstream caption, while template paths continue using `applyVariation()` with `autoInjectWhenMissing: false` so global link variables are substituted only when present in the template body. Add regression coverage around both mirrored relay and mirrored template rendering.

**Tech Stack:** Node.js ESM, `node:test`, dashboard shared template utilities, bot worker mirror pipeline, Prisma-backed config fields.

---

## File Structure

- Modify: `src/bot-worker.js`
  - Responsibility: decide when incoming mirrored messages are relayed as original text vs rebuilt with a template.
  - Planned change: stop passing `brandingGroupLink` / `brandingCtaText` into `applyConversionsAndBranding()` for the “Manter texto original convertido” relay path; keep coupon-url replacement for stripped coupon URLs unchanged.
- Modify: `src/core/mirrorTemplate.js`
  - Responsibility: render selected mirror templates from product scrape fields and global config.
  - Planned change: pass `couponLink` into `buildMobileOfferText()` so `{{cupomLink}}` is supported in templates, and keep `bonusMode`/`groupBonus` available only to the template renderer.
- Modify: `test/mirror-template.test.js`
  - Responsibility: regression tests for mirror template rendering.
  - Planned change: add tests proving templates replace `{{grupoLink}}` and `{{cupomLink}}` only when explicitly present, and relay fallback preserves original converted text without appending global links.
- Modify or add: `test/message-processor.test.js` or a focused `test/bot-worker-relay-branding.test.js`
  - Responsibility: regression test around `applyConversionsAndBranding()` usage in the relay path.
  - Planned change: prefer a small direct test if `applyConversionsAndBranding` is already exported; otherwise export it from `src/bot-worker.js` only if that file already exposes test seams, or test through the existing message processor harness.

## Behavior Rules To Preserve

1. **Relay / “Manter texto original convertido”:** convert marketplace URLs to affiliate URLs, preserve the original caption, and do not append or inject `brandingGroupLink`, `brandingCtaText`, `couponLink`, `{{grupoLink}}`, or `{{cupomLink}}` unless they already appear literally in the original upstream text and are intentionally processed by a template path. The expected output is only the converted original message.
2. **Template mode:** render the selected template body. Replace `{{grupoLink}}` only if that token exists in the template. Replace `{{cupomLink}}` only if that token exists in the template. Do not auto-append either link when absent from the template.
3. **Existing coupon-stripping behavior:** if `urlsToStrip` exists and `botConfig.couponLink` is configured, replacing stripped upstream coupon URLs with the user’s coupon URL should remain unchanged because that is link ownership correction, not template-variable injection.
4. **Automatic offers:** do not change `src/offerAutomation/dispatcher.js`; it already calls `applyVariation(..., { groupInviteLink, couponLink, autoInjectWhenMissing: false })`, which is the desired template-only behavior.

---

### Task 1: Add mirror-template regression tests for explicit link variables

**Files:**
- Modify: `test/mirror-template.test.js`

- [ ] **Step 1: Add a failing test for template bodies that explicitly include both link variables**

Append this test after the existing `applyMirrorTemplate renderiza...` test:

```js
test('applyMirrorTemplate substitui grupoLink e cupomLink apenas quando o template contém as variáveis', async () => {
  const text = await applyMirrorTemplate('Texto original https://ex.com/a', {
    templateKey: 'tpl_links',
    originalUrl: 'https://ex.com/a',
    convertedUrl: 'https://ex.com/a?tag=ok',
    platform: 'amazon',
    botConfig: {
      mobileTemplatesJson: JSON.stringify({
        custom: [{
          key: 'tpl_links',
          name: 'Links globais',
          body: '🔥 {produto}\n👉 {link}\nGrupo: {{grupoLink}}\nCupom: {{cupomLink}}',
        }],
      }),
      brandingGroupLink: 'https://chat.whatsapp.com/grupo',
      couponLink: 'https://cupom.test/oferta',
    },
    fetchInfo: async () => ({ title: 'Produto com links', oldPrice: '', newPrice: 'R$ 99,90' }),
  })

  assert.equal(text, [
    '🔥 Produto com links',
    '👉 https://ex.com/a?tag=ok',
    'Grupo: https://chat.whatsapp.com/grupo',
    'Cupom: https://cupom.test/oferta',
  ].join('\n'))
})
```

- [ ] **Step 2: Add a failing test proving global links are not auto-appended when absent from the template**

Append immediately after the previous test:

```js
test('applyMirrorTemplate não injeta grupoLink nem cupomLink quando o template não contém as variáveis', async () => {
  const text = await applyMirrorTemplate('Texto original https://ex.com/a', {
    templateKey: 'tpl_sem_links_globais',
    originalUrl: 'https://ex.com/a',
    convertedUrl: 'https://ex.com/a?tag=ok',
    platform: 'amazon',
    botConfig: {
      mobileTemplatesJson: JSON.stringify({
        custom: [{
          key: 'tpl_sem_links_globais',
          name: 'Sem links globais',
          body: '🔥 {produto}\n👉 {link}',
        }],
      }),
      brandingGroupLink: 'https://chat.whatsapp.com/grupo',
      couponLink: 'https://cupom.test/oferta',
    },
    fetchInfo: async () => ({ title: 'Produto sem links globais', oldPrice: '', newPrice: 'R$ 49,90' }),
  })

  assert.equal(text, '🔥 Produto sem links globais\n👉 https://ex.com/a?tag=ok')
  assert.doesNotMatch(text, /chat\.whatsapp\.com\/grupo/)
  assert.doesNotMatch(text, /cupom\.test\/oferta/)
})
```

- [ ] **Step 3: Run tests to verify the current bug is exposed**

Run:

```bash
node --test test/mirror-template.test.js
```

Expected before implementation: at least the first new test fails because `{{cupomLink}}` remains unresolved or is stripped instead of being replaced with `botConfig.couponLink`.

- [ ] **Step 4: Commit the failing tests if following strict TDD**

```bash
git add test/mirror-template.test.js
git commit -m "test: cover mirror template global link variables"
```

---

### Task 2: Pass couponLink through mirror template rendering

**Files:**
- Modify: `src/core/mirrorTemplate.js`
- Test: `test/mirror-template.test.js`

- [ ] **Step 1: Update `buildMobileOfferText()` options in `applyMirrorTemplate`**

Change the render call near the end of `src/core/mirrorTemplate.js` from:

```js
  const rendered = buildMobileOfferText({
    product: fields,
    link: fields.link,
    template: templateKey,
    templateBody: body,
    bonusMode: botConfig?.brandingGroupLink ? 'group' : '',
    groupBonus: {
      link: botConfig?.brandingGroupLink || '',
      cta: botConfig?.brandingCtaText || '',
    },
    preserveAutomationPlaceholders: false,
  })
```

to:

```js
  const rendered = buildMobileOfferText({
    product: fields,
    link: fields.link,
    template: templateKey,
    templateBody: body,
    bonusMode: botConfig?.brandingGroupLink ? 'group' : '',
    groupBonus: {
      link: botConfig?.brandingGroupLink || '',
      cta: botConfig?.brandingCtaText || '',
    },
    couponLinks: {
      default: botConfig?.couponLink || '',
    },
    preserveAutomationPlaceholders: false,
  })
```

If `buildMobileOfferText()` does not currently read `couponLinks.default`, inspect `dashboard/lib/mobileOfferComposer.js` and use the smallest supported shape. If it only supports platform keys, pass the active platform-specific key plus `default`:

```js
    couponLinks: {
      default: botConfig?.couponLink || '',
      [platform || 'default']: botConfig?.couponLink || '',
    },
```

- [ ] **Step 2: Run the mirror-template test file**

Run:

```bash
node --test test/mirror-template.test.js
```

Expected: all `test/mirror-template.test.js` tests pass.

- [ ] **Step 3: Commit the implementation**

```bash
git add src/core/mirrorTemplate.js test/mirror-template.test.js
git commit -m "fix: render coupon links in mirror templates"
```

---

### Task 3: Add relay-path regression coverage for “Manter texto original convertido”

**Files:**
- Modify: `test/message-processor.test.js` or create `test/bot-worker-relay-branding.test.js`
- Modify only if necessary: `src/bot-worker.js`

- [ ] **Step 1: Locate the test seam for `applyConversionsAndBranding`**

Run:

```bash
rg -n "function applyConversionsAndBranding|export .*applyConversionsAndBranding|applyConversionsAndBranding" src/bot-worker.js test
```

Expected: one definition in `src/bot-worker.js` and current usage in the incoming-message pipeline.

- [ ] **Step 2: If `applyConversionsAndBranding` is not exported, add a named export without changing runtime behavior**

In `src/bot-worker.js`, change the function declaration from:

```js
function applyConversionsAndBranding(text, conversions, brandingLink, brandingCtaText) {
```

to:

```js
export function applyConversionsAndBranding(text, conversions, brandingLink = '', brandingCtaText = '') {
```

Keep the function body unchanged for now so the next test fails against the current behavior.

- [ ] **Step 3: Add a failing relay test**

Create `test/bot-worker-relay-branding.test.js` with:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { applyConversionsAndBranding } from '../src/bot-worker.js'

test('relay convertido não injeta link de grupo global em texto original', () => {
  const original = 'Oferta boa\nhttps://loja.test/produto'
  const output = applyConversionsAndBranding(
    original,
    [{ url: 'https://loja.test/produto', converted: 'https://loja.test/produto?tag=ok' }],
    '',
    '',
  )

  assert.equal(output, 'Oferta boa\nhttps://loja.test/produto?tag=ok')
  assert.doesNotMatch(output, /chat\.whatsapp\.com/)
})
```

This test intentionally calls the helper the way the relay path should call it after the fix: no branding arguments for original-text relay.

- [ ] **Step 4: Add a second regression test for the old incorrect call pattern**

In the same file, add:

```js
test('relay convertido não depende de variáveis globais de mensagens para preservar caption original', () => {
  const original = 'Oferta sem template\nhttps://loja.test/produto'
  const output = applyConversionsAndBranding(
    original,
    [{ url: 'https://loja.test/produto', converted: 'https://loja.test/produto?tag=ok' }],
    '',
    '',
  )

  assert.equal(output, 'Oferta sem template\nhttps://loja.test/produto?tag=ok')
  assert.doesNotMatch(output, /Grupo|Cupom|whatsapp|cupom/i)
})
```

- [ ] **Step 5: Run the relay tests**

Run:

```bash
node --test test/bot-worker-relay-branding.test.js
```

Expected before the bot-worker call-site fix: helper-level tests may pass because they encode the desired call contract. The call-site change in Task 4 is still required; these tests document the safe helper usage.

- [ ] **Step 6: Commit the test seam and tests**

```bash
git add src/bot-worker.js test/bot-worker-relay-branding.test.js
git commit -m "test: cover original relay without global link injection"
```

---

### Task 4: Stop injecting group branding in the original-text relay path

**Files:**
- Modify: `src/bot-worker.js`
- Test: `test/bot-worker-relay-branding.test.js`, `test/message-processor.test.js`, `test/mirror-template.test.js`

- [ ] **Step 1: Change the relay call-site after conversions**

In `src/bot-worker.js`, replace:

```js
        finalText = applyConversionsAndBranding(sanitizedText, conversions, cfg.botConfig.brandingGroupLink, cfg.botConfig.brandingCtaText)
```

with:

```js
        // Relay mode (“Manter texto original convertido”) must only swap the
        // upstream links for the user’s converted affiliate links. Global link
        // variables from /painel/mensagens are template variables and must not
        // be appended to original captions.
        finalText = applyConversionsAndBranding(sanitizedText, conversions)
```

- [ ] **Step 2: Confirm coupon URL ownership replacement still runs after conversion**

Ensure the existing block remains directly after the call-site and still reads `cfg.botConfig.couponLink`:

```js
        if (urlsToStrip.length) {
          const userCouponLink = String(cfg.botConfig.couponLink || '').trim()
          if (userCouponLink) {
            for (const url of urlsToStrip) {
              finalText = finalText.replace(url, userCouponLink)
            }
          } else {
            finalText = stripUrlsFromText(finalText, urlsToStrip)
          }
        }
```

- [ ] **Step 3: Run focused tests**

Run:

```bash
node --test test/bot-worker-relay-branding.test.js test/mirror-template.test.js test/message-processor.test.js
```

Expected: all focused tests pass.

- [ ] **Step 4: Commit the relay fix**

```bash
git add src/bot-worker.js test/bot-worker-relay-branding.test.js
 git commit -m "fix: keep global links out of original relay captions"
```

---

### Task 5: Verify existing automatic-template behavior remains correct

**Files:**
- No code changes expected.
- Test: `test/offer-automation.test.js`, `test/mobile-offer-composer.test.js`, `test/copy-variation.test.js`

- [ ] **Step 1: Run tests covering template variable replacement**

Run:

```bash
node --test test/offer-automation.test.js test/mobile-offer-composer.test.js test/copy-variation.test.js
```

Expected: all tests pass. In particular, the existing automation test named `runAutomation: template pode usar ganchos, CTAs e links globais como variáveis` should continue to pass because automatic offers are template-based and should still replace `{{grupoLink}}` / `{{cupomLink}}` when present.

- [ ] **Step 2: Run the broader relevant suite**

Run:

```bash
node --test test/mirror-template.test.js test/message-processor.test.js test/offer-automation.test.js test/mobile-offer-composer.test.js test/copy-variation.test.js test/core/copyVariation.test.js
```

Expected: all tests pass.

- [ ] **Step 3: Commit only if verification required small fixes**

If Task 5 required any code or test adjustment, commit it:

```bash
git add <changed-files>
git commit -m "test: keep template variable behavior covered"
```

If there are no changes, do not create an empty commit.

---

### Task 6: Manual staging validation checklist

**Files:**
- No code changes.

- [ ] **Step 1: In staging, configure global links in `/painel/mensagens`**

Set:

```text
Link do grupo: https://chat.whatsapp.com/grupo-teste
Link de cupom: https://cupom.test/oferta
```

Expected: config saves successfully.

- [ ] **Step 2: Configure one destination group as “Manter texto original convertido”**

In `/painel/grupos`, set the destination’s template option to relay/original mode.

Expected: the saved group payload has `templateKey: ''` for explicit relay, or inherits an empty global mirror template default if using inherited relay.

- [ ] **Step 3: Send a source message with a marketplace link**

Use a source message like:

```text
Oferta teste
https://www.amazon.com.br/dp/B000000000
```

Expected in the destination: the product URL is converted to the user’s affiliate URL, but neither `https://chat.whatsapp.com/grupo-teste` nor `https://cupom.test/oferta` appears.

- [ ] **Step 4: Configure another destination group with a template containing the variables**

Use a custom template body:

```text
🔥 {produto}
👉 {link}
Grupo: {{grupoLink}}
Cupom: {{cupomLink}}
```

Expected: destination output includes the converted offer link plus the exact group and coupon links.

- [ ] **Step 5: Configure a template without the variables**

Use:

```text
🔥 {produto}
👉 {link}
```

Expected: destination output includes only product text and converted offer link; global group/coupon links do not appear.

---

## Self-Review

**Spec coverage:**
- Requirement that `/painel/mensagens` variables must not be inserted into groups using “Manter texto original convertido” is implemented by Task 4 and validated in Tasks 3 and 6.
- Requirement that variables are added only when template mode is selected and the template body contains them is implemented by Task 2 and validated in Tasks 1, 5, and 6.
- Existing automatic offer templates remain supported by Task 5.

**Placeholder scan:**
- No `TBD`, `TODO`, “implement later”, or unspecified test steps remain.

**Type consistency:**
- `botConfig.brandingGroupLink`, `botConfig.brandingCtaText`, and `botConfig.couponLink` match existing config fields.
- `applyMirrorTemplate()` and `applyConversionsAndBranding()` names match current code usage.
- Test commands use the repo’s existing `node --test` runner pattern.
