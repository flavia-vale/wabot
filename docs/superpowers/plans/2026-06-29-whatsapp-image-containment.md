# WhatsApp Image Containment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure mirrored-group images and official marketplace images are sent in a WhatsApp-friendly contained frame so the full product image remains visible instead of being cropped in the destination group.

**Architecture:** Introduce a single image-fit layer inside the existing Sharp normalization path, so both monitored mirroring (`imageMode=original` / `imageMode=fetch`) and offer/automation image sending reuse the same containment behavior. Preserve existing relay behavior only when it is safe, but force re-upload through normalization when the configured image display policy requires containment.

**Tech Stack:** Node.js ESM, Baileys, Sharp, built-in `node:test`, existing modules `src/converters/imageScrapers.js`, `src/monitoredImageResolver.js`, `src/monitoredRelayPolicy.js`, and `src/bot-worker.js`.

---

## Problem Summary

The screenshots show the final destination group rendering the product image cropped. The likely cause is not the product image itself, but the aspect ratio that WhatsApp chooses for the in-chat image card/preview. Today, the code preserves the original aspect ratio and only constrains it inside 1600x1600 before encoding. That is good for quality, but it still allows tall or wide marketplace images to be rendered by WhatsApp inside a cropped chat card.

The fix should not stretch the product. It should **contain** the image inside a predictable WhatsApp-safe canvas, adding neutral padding when needed. This keeps the product fully visible in the card and when opened.

## Current Code Map

- `src/converters/imageScrapers.js`
  - Owns `normalizeImageForWhatsApp(buf, opts = {})`, which already converts images to JPEG, resizes with Sharp, and creates the `jpegThumbnail` used by WhatsApp previews.
  - This is the best central hook because broadcast images and mirrored images both eventually pass through this function when they are uploaded.
- `src/bot-worker.js`
  - Broadcast/offer path: `buildBroadcastImageRecipe()` and `buildPayloadFromRecipe()` fetch `options.imageUrl` and normalize it before sending.
  - Mirroring path: `downloadOriginalImage()`, `getImage()`, and `buildPayload` resolve a monitored image and normalize it before sending, unless the relay path is used.
- `src/monitoredImageResolver.js`
  - Chooses between original media, official marketplace image, and thumbnail fallback.
  - This file should remain about source selection, not visual framing.
- `src/monitoredRelayPolicy.js`
  - Currently allows relay whenever `imageMode` is `original`. Relay reuses the original WhatsApp media proto, so it bypasses re-encoding and cannot add padding/canvas.
- `test/core/image-fit.test.js` (new)
  - Unit tests for the new pure image-fit helpers.
- `test/image-scrapers.test.js`
  - Extend or add tests for normalized output dimensions and thumbnail behavior.
- `test/monitored-relay-policy.test.js` (new or existing if present)
  - Ensure containment mode disables relay when necessary.

## Proposed Behavior

1. Add an image fit policy:
   - Default: preserve current behavior for compatibility.
   - New internal policy: `contain`, which places the full image inside a square or 4:5 WhatsApp-safe canvas.
2. Apply `contain` to:
   - official marketplace images (`imageMode=fetch`),
   - mirrored images when they are re-uploaded through `normalizeImageForWhatsApp`,
   - offer automation/broadcast images sent with `imageUrl`.
3. Prevent bypass through relay when containment is enabled:
   - Relay is excellent for preserving original media, but it cannot fix cropping caused by the chat-card aspect ratio.
   - For `imageMode=original`, use relay only when the account/group does not request containment.
4. Keep video/audio/document relay untouched.
5. Keep anti-fingerprint mutation for channels, but apply it after the contain canvas is built so the padded image remains visually stable.

## File Structure

- Create: `src/core/imageFit.js`
  - Pure helpers to decide canvas size, background, fit mode, and output dimensions.
- Modify: `src/converters/imageScrapers.js`
  - Add `opts.fit` support to `normalizeImageForWhatsApp`.
  - Use the pure helper and Sharp `resize({ fit: 'contain', background })` when containment is requested.
- Modify: `src/bot-worker.js`
  - Pass `{ fit: 'contain' }` for broadcast/offer images.
  - Pass `{ fit: 'contain' }` for monitored uploaded images.
  - Avoid relay when containment is required for image messages.
- Modify: `src/monitoredRelayPolicy.js`
  - Add a policy argument so relay can be disabled for image containment while preserving current default.
- Test: `test/core/image-fit.test.js`
  - Unit-test pure sizing decisions.
- Test: `test/image-scrapers.test.js`
  - Integration-test Sharp output dimensions for tall and wide fixtures.
- Test: `test/monitored-relay-policy.test.js`
  - Unit-test relay behavior with containment enabled.

---

### Task 1: Add pure image-fit policy helper

**Files:**
- Create: `src/core/imageFit.js`
- Test: `test/core/image-fit.test.js`

- [ ] **Step 1: Write the failing test**

Create `test/core/image-fit.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  WHATSAPP_SAFE_IMAGE_SIZE,
  buildContainedImageResizeOptions,
  shouldContainImageForWhatsApp,
} from '../../src/core/imageFit.js'

test('shouldContainImageForWhatsApp enables only explicit contain policy', () => {
  assert.equal(shouldContainImageForWhatsApp(), false)
  assert.equal(shouldContainImageForWhatsApp(null), false)
  assert.equal(shouldContainImageForWhatsApp('original'), false)
  assert.equal(shouldContainImageForWhatsApp('contain'), true)
})

test('buildContainedImageResizeOptions returns a square WhatsApp-safe contain canvas', () => {
  const options = buildContainedImageResizeOptions()
  assert.deepEqual(options, {
    width: WHATSAPP_SAFE_IMAGE_SIZE,
    height: WHATSAPP_SAFE_IMAGE_SIZE,
    fit: 'contain',
    withoutEnlargement: true,
    background: { r: 255, g: 255, b: 255, alpha: 1 },
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/core/image-fit.test.js`

Expected: FAIL with `Cannot find module ... src/core/imageFit.js`.

- [ ] **Step 3: Write minimal implementation**

Create `src/core/imageFit.js`:

```js
export const WHATSAPP_SAFE_IMAGE_SIZE = 1200

export const WHATSAPP_SAFE_IMAGE_BACKGROUND = Object.freeze({
  r: 255,
  g: 255,
  b: 255,
  alpha: 1,
})

export function shouldContainImageForWhatsApp(policy) {
  return policy === 'contain'
}

export function buildContainedImageResizeOptions() {
  return {
    width: WHATSAPP_SAFE_IMAGE_SIZE,
    height: WHATSAPP_SAFE_IMAGE_SIZE,
    fit: 'contain',
    withoutEnlargement: true,
    background: WHATSAPP_SAFE_IMAGE_BACKGROUND,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/core/image-fit.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/imageFit.js test/core/image-fit.test.js
git commit -m "feat: add WhatsApp image fit policy helper"
```

---

### Task 2: Teach image normalization to contain images without cropping

**Files:**
- Modify: `src/converters/imageScrapers.js`
- Test: `test/image-scrapers.test.js`

- [ ] **Step 1: Write failing tests for tall and wide images**

Append to `test/image-scrapers.test.js`:

```js
import sharp from 'sharp'
import { WHATSAPP_SAFE_IMAGE_SIZE } from '../src/core/imageFit.js'
import { normalizeImageForWhatsApp } from '../src/converters/imageScrapers.js'

test('normalizeImageForWhatsApp fit=contain keeps a tall product fully visible in a square canvas', async () => {
  const input = await sharp({
    create: {
      width: 600,
      height: 1400,
      channels: 3,
      background: '#ef4444',
    },
  }).jpeg().toBuffer()

  const normalized = await normalizeImageForWhatsApp(input, { fit: 'contain' })
  const meta = await sharp(normalized.buffer).metadata()

  assert.equal(meta.width, WHATSAPP_SAFE_IMAGE_SIZE)
  assert.equal(meta.height, WHATSAPP_SAFE_IMAGE_SIZE)
  assert.equal(normalized.mimetype, 'image/jpeg')
  assert.ok(normalized.jpegThumbnail?.length > 0)
})

test('normalizeImageForWhatsApp fit=contain keeps a wide product fully visible in a square canvas', async () => {
  const input = await sharp({
    create: {
      width: 1600,
      height: 500,
      channels: 3,
      background: '#22c55e',
    },
  }).jpeg().toBuffer()

  const normalized = await normalizeImageForWhatsApp(input, { fit: 'contain' })
  const meta = await sharp(normalized.buffer).metadata()

  assert.equal(meta.width, WHATSAPP_SAFE_IMAGE_SIZE)
  assert.equal(meta.height, WHATSAPP_SAFE_IMAGE_SIZE)
  assert.equal(normalized.mimetype, 'image/jpeg')
  assert.ok(normalized.jpegThumbnail?.length > 0)
})
```

If `test/image-scrapers.test.js` already imports `sharp`, `assert`, or `normalizeImageForWhatsApp`, do not duplicate imports; extend the existing import lists.

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/image-scrapers.test.js`

Expected: FAIL because `normalizeImageForWhatsApp(..., { fit: 'contain' })` still returns the original inside-resized dimensions instead of a square canvas.

- [ ] **Step 3: Implement contain fit in the normal non-mutation path**

Modify the imports at the top of `src/converters/imageScrapers.js`:

```js
import { computeMutationCrop } from '../core/imageMutationCrop.js'
import { buildContainedImageResizeOptions, shouldContainImageForWhatsApp } from '../core/imageFit.js'
```

Inside `normalizeImageForWhatsApp`, immediately after `const mutation = opts.mutation || null`, add:

```js
  const containForWhatsApp = shouldContainImageForWhatsApp(opts.fit)
  const baseResizeOptions = containForWhatsApp
    ? buildContainedImageResizeOptions()
    : { width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }
```

Replace the non-mutation resize block:

```js
.resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
```

with:

```js
.resize(baseResizeOptions)
```

Do the same replacement in the mutation fallback path.

- [ ] **Step 4: Update mutation raw path to use the same base resize options**

In the mutation branch, replace:

```js
.resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
```

with:

```js
.resize(baseResizeOptions)
```

Keep the existing `computeMutationCrop(info, ...)` call after the raw resize. This means containment happens first, then the existing 1-2px channel mutation can still alter the final hash.

- [ ] **Step 5: Keep thumbnails contained too**

Replace the thumbnail resize block:

```js
.resize({ width: 500, height: 500, fit: 'inside', withoutEnlargement: true })
```

with:

```js
.resize(containForWhatsApp
  ? { width: 500, height: 500, fit: 'contain', withoutEnlargement: true, background: { r: 255, g: 255, b: 255, alpha: 1 } }
  : { width: 500, height: 500, fit: 'inside', withoutEnlargement: true })
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `node --test test/core/image-fit.test.js test/image-scrapers.test.js`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/converters/imageScrapers.js test/image-scrapers.test.js
git commit -m "feat: contain WhatsApp image normalization"
```

---

### Task 3: Apply containment to offer/broadcast images

**Files:**
- Modify: `src/bot-worker.js`
- Test: existing broadcast/image tests, or create `test/broadcast-image-payload.test.js` only if current tests cannot cover this path.

- [ ] **Step 1: Locate the broadcast normalization call**

In `src/bot-worker.js`, find `buildPayloadFromRecipe(recipe)`. The current image path calls:

```js
image = fetched ? await normalizeImageForWhatsApp(fetched.buffer) : null
```

- [ ] **Step 2: Write or extend a failing test**

Prefer extending an existing bot-worker/broadcast test if it already stubs `normalizeImageForWhatsApp`. The assertion must verify the call includes `{ fit: 'contain' }`:

```js
assert.deepEqual(normalizeCalls[0].opts, { fit: 'contain' })
```

If no suitable test harness exists, add a small exported test seam only under `NODE_ENV === 'test'` is not recommended. Instead, cover the behavior through an integration test that sends an image recipe and inspects the resulting image dimensions after Task 2.

- [ ] **Step 3: Pass contain fit for offer/broadcast image URLs**

Change the normalization call in `buildPayloadFromRecipe(recipe)` to:

```js
image = fetched ? await normalizeImageForWhatsApp(fetched.buffer, { fit: 'contain' }) : null
```

- [ ] **Step 4: Run focused tests**

Run: `node --test test/image-scrapers.test.js test/offer-automation.test.js test/offer-queue-dispatcher.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/bot-worker.js test/image-scrapers.test.js test/offer-automation.test.js test/offer-queue-dispatcher.test.js
git commit -m "feat: contain broadcast offer images"
```

---

### Task 4: Apply containment to mirrored images that are uploaded

**Files:**
- Modify: `src/bot-worker.js`
- Test: `test/monitored-image-resolver.test.js` if possible; otherwise add/extend a bot-worker payload test.

- [ ] **Step 1: Locate the monitored normalization call**

In `src/bot-worker.js`, find the monitored `buildPayload` function. The current code calls:

```js
image = fetched
  ? await normalizeImageForWhatsApp(fetched.buffer, wantMutation ? { mutation: { groupId: destJid } } : {})
  : null
```

- [ ] **Step 2: Write the expected options explicitly**

Replace the inline ternary options with a named options object:

```js
const imageNormalizeOptions = {
  fit: 'contain',
  ...(wantMutation ? { mutation: { groupId: destJid } } : {}),
}
image = fetched
  ? await normalizeImageForWhatsApp(fetched.buffer, imageNormalizeOptions)
  : null
```

- [ ] **Step 3: Run focused monitored-image tests**

Run: `node --test test/monitored-image-resolver.test.js test/image-scrapers.test.js`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/bot-worker.js
git commit -m "feat: contain uploaded mirrored images"
```

---

### Task 5: Disable image relay when containment is required

**Files:**
- Modify: `src/monitoredRelayPolicy.js`
- Modify: `src/bot-worker.js`
- Test: `test/monitored-relay-policy.test.js`

- [ ] **Step 1: Write the failing policy test**

Create `test/monitored-relay-policy.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'

import { shouldRelayOriginalMediaForImageMode } from '../src/monitoredRelayPolicy.js'

test('relay remains enabled by default for original image mode', () => {
  assert.equal(shouldRelayOriginalMediaForImageMode('original'), true)
  assert.equal(shouldRelayOriginalMediaForImageMode(undefined), true)
})

test('relay is disabled for image messages when containment is required', () => {
  assert.equal(shouldRelayOriginalMediaForImageMode('original', { mediaType: 'imageMessage', imageFit: 'contain' }), false)
})

test('relay remains enabled for video even when image containment is configured', () => {
  assert.equal(shouldRelayOriginalMediaForImageMode('original', { mediaType: 'videoMessage', imageFit: 'contain' }), true)
})

test('fetch mode never relays original media', () => {
  assert.equal(shouldRelayOriginalMediaForImageMode('fetch', { mediaType: 'imageMessage', imageFit: 'contain' }), false)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/monitored-relay-policy.test.js`

Expected: FAIL because `shouldRelayOriginalMediaForImageMode` does not accept the policy argument yet.

- [ ] **Step 3: Implement relay policy**

Replace `src/monitoredRelayPolicy.js` with:

```js
// Decide when the pipeline monitorado can use relayMessage to reuse hosted media
// from the source message. Relay preserves the source proto and bypasses image
// normalization, so it must be disabled for image messages when we need to place
// the image inside a WhatsApp-safe canvas.
export function shouldRelayOriginalMediaForImageMode(imageMode, options = {}) {
  if ((imageMode ?? 'original') !== 'original') return false
  if (options.mediaType === 'imageMessage' && options.imageFit === 'contain') return false
  return true
}
```

- [ ] **Step 4: Pass media type and fit policy from bot-worker**

In `src/bot-worker.js`, replace:

```js
const original = shouldRelayOriginalMediaForImageMode(imageMode) ? originalMedia : null
```

with:

```js
const imageFitPolicy = 'contain'
const original = shouldRelayOriginalMediaForImageMode(imageMode, {
  mediaType: originalMedia?.type,
  imageFit: imageFitPolicy,
}) ? originalMedia : null
```

Then reuse `imageFitPolicy` in Task 4's `imageNormalizeOptions`:

```js
const imageNormalizeOptions = {
  fit: imageFitPolicy,
  ...(wantMutation ? { mutation: { groupId: destJid } } : {}),
}
```

- [ ] **Step 5: Run focused tests**

Run: `node --test test/monitored-relay-policy.test.js test/monitored-image-resolver.test.js test/image-scrapers.test.js`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/monitoredRelayPolicy.js src/bot-worker.js test/monitored-relay-policy.test.js
git commit -m "feat: reupload mirrored images for containment"
```

---

### Task 6: Add an operational rollout guard and logging

**Files:**
- Modify: `src/bot-worker.js`
- Optional Modify: `AGENTS.md` only if the team wants the behavior documented canonically.

- [ ] **Step 1: Add structured logs when containment is used**

In `buildPayloadFromRecipe(recipe)`, after successful normalization, add:

```js
if (image) {
  logger.info({ imageFit: 'contain', source: 'broadcastImage' }, 'Imagem normalizada com canvas WhatsApp-safe')
}
```

In the monitored `buildPayload`, after successful normalization, add:

```js
if (image) {
  logger.info({ msgId: msg.key.id, destJid, imageMode, imageFit: imageFitPolicy }, 'Imagem monitorada normalizada com canvas WhatsApp-safe')
}
```

- [ ] **Step 2: Run lint/tests that cover syntax**

Run: `node --test test/monitored-relay-policy.test.js test/image-scrapers.test.js test/monitored-image-resolver.test.js`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/bot-worker.js
git commit -m "chore: log WhatsApp image containment"
```

---

### Task 7: Manual QA in staging

**Files:**
- No code files.

- [ ] **Step 1: Deploy to staging via normal develop PR flow**

Do not deploy directly to `main`. Merge the feature branch into `develop` and let the existing GitHub Actions staging deploy run.

Expected: staging apps update at `http://178.105.54.0:3006`.

- [ ] **Step 2: Test mirrored original image mode**

Configure a monitor group with image mode “Imagem que veio na mensagem”. Send the same kind of source message shown in the first screenshot.

Expected: the destination group receives a square/padded image where the full product is visible, not cropped.

- [ ] **Step 3: Test official marketplace image mode**

Configure a monitor group with image mode “Imagem oficial da loja”. Send a product link whose official marketplace image is tall or wide.

Expected: the destination group receives a contained image where the full product is visible.

- [ ] **Step 4: Test offer automation/manual broadcast**

Trigger an automatic offer or queued offer with `imageUrl`.

Expected: the destination group receives a contained image where the full product is visible.

- [ ] **Step 5: Verify logs**

Run on the VPS:

```bash
pm2 logs api-staging --lines 200 | grep "WhatsApp-safe"
```

Expected: logs show containment for the tested sends and no send failures.

- [ ] **Step 6: Commit QA notes if documentation was updated**

If QA notes are added to docs, commit them:

```bash
git add docs/superpowers/plans/2026-06-29-whatsapp-image-containment.md
git commit -m "docs: record WhatsApp image containment QA"
```

---

## Risk Notes

- **Relay bypass:** `relayMessage` is currently a fidelity optimization, but it prevents image normalization. This plan disables relay only for image messages when containment is needed. Video relay remains unchanged.
- **White padding:** White is safe for marketplace product photos and WhatsApp light/dark mode. If the screenshots show white product backgrounds, this will look natural. If a future brand wants custom padding color, add configuration later; do not add that scope now.
- **No stretching:** The plan uses Sharp `fit: 'contain'`, not `cover`, so it avoids the exact crop problem.
- **Mutation order:** Containment must happen before the existing channel mutation. The mutation can crop 1-2px after containment without hiding the product.
- **File size:** 1200x1200 JPEG q95 is acceptable for product images and below the existing 1600 maximum. If uploads become slower, reduce `WHATSAPP_SAFE_IMAGE_SIZE` to 1080 after measuring.

## Self-Review

- **Spec coverage:** Covers both requested sources: image from mirrored group (`imageMode=original`) and image from official offer/marketplace (`imageMode=fetch` / broadcast `imageUrl`).
- **Placeholder scan:** No `TBD`, `TODO`, or vague “add tests” steps remain; each task has concrete files, code, commands, and expected output.
- **Type consistency:** The plan consistently uses `fit: 'contain'`, `imageFitPolicy`, `shouldContainImageForWhatsApp(policy)`, and `buildContainedImageResizeOptions()` across helper, normalizer, bot worker, and relay policy.
