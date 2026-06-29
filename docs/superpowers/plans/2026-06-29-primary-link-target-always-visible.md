# Primary Link Target Always Visible Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the “Link a converter quando há vários” selector visible and useful for every monitored group, even when the group keeps the original converted text instead of applying a template.

**Architecture:** The backend already persists `Group.primaryLinkTarget` and the worker already uses the effective target to pick the primary converted product for dedup/log/template scrape/image-related offer metadata. The adjustment is primarily a dashboard UX change: remove the `templateApplied` visibility gate, rewrite the helper copy so the setting clearly covers both “which product drives the offer/image metadata” and “which product a one-product template uses”, and add a regression guard so the field cannot be hidden behind the template condition again.

**Tech Stack:** Next.js dashboard under `dashboard/app`, React server/client page source assertions with Node’s built-in `node:test`, existing Fastify API route tests for persistence, Prisma `Group.primaryLinkTarget` already migrated.

---

## Rationale Confirmed

The previous rationale treated `primaryLinkTarget` as a template-only setting because a template renders a single product offer. That was incomplete. Mirrored offers can contain multiple links in the same original message, and the system still needs a deterministic primary product when it keeps the original converted text. That primary product is also the product whose store data/image-related metadata can drive the outgoing offer behavior. Therefore, the selector must remain configurable regardless of whether `templateKey` is blank/relay or points to a template.

## File Structure

- Modify: `dashboard/app/painel/grupos/page.js`
  - Responsibility: render monitored group settings in `/painel/grupos`.
  - Change: always render the `primaryLinkTarget` row in “Como a oferta é publicada”; update label/hint/info to describe multi-link mirrored offers and template behavior.
- Modify: `test/ux-backlog-implementation.test.js`
  - Responsibility: source-level regression checks for dashboard UX decisions.
  - Change: add a guard proving the `primaryLinkTarget` row is not wrapped in `{templateApplied && (...)}` and still posts `primaryLinkTarget` updates.
- Existing validation to run, no expected code changes:
  - `test/api/routes/groups.channel.test.js` already proves `PUT /api/groups/:id` persists `primaryLinkTarget`, maps `''` to `null`, and rejects invalid values.
  - `test/mirror-template.test.js` already proves templated mirror offers use the selected converted link as the emitted `{link}` when the worker supplies that primary conversion.
  - `src/bot-worker.js` already resolves `effectiveLinkTarget` before deciding whether a template is applied.

## Current Behavior to Preserve

- `templateKey === ''` means explicit relay (“Manter texto original convertido”).
- `templateKey === null` means inherit global default.
- `primaryLinkTarget === null` means inherit `BotConfig.primaryLinkTargetDefault`, whose default is `'first'`.
- The select must keep these submitted values:
  - `''` → inherit/default first link.
  - `'first'` → first link explicitly.
  - `'last'` → last link explicitly.
- Backend validation must remain unchanged: only `'first'`, `'last'`, empty string, or `null` are accepted.

---

### Task 1: Add a dashboard regression test for always-visible primary link selector

**Files:**
- Modify: `test/ux-backlog-implementation.test.js`
- Read-only context: `dashboard/app/painel/grupos/page.js`

- [ ] **Step 1: Inspect the existing UX source checks**

Run:
```bash
sed -n '1,180p' test/ux-backlog-implementation.test.js
```
Expected: PASS-like manual inspection; file contains Node `test()` cases that read dashboard source files with `readFileSync`.

- [ ] **Step 2: Add the failing regression test**

Append this test to `test/ux-backlog-implementation.test.js`:

```js
test('painel grupos mantém seletor de link primário independente de template', () => {
  const source = readFileSync('dashboard/app/painel/grupos/page.js', 'utf8')

  assert.match(source, /label="Link principal quando há vários"/)
  assert.match(source, /onUpdate\(g\.id, \{ primaryLinkTarget: e\.target\.value \}\)/)
  assert.doesNotMatch(source, /\{templateApplied && \(\s*<CfgRow\s+label="Link principal quando há vários"/s)
  assert.doesNotMatch(source, /\{templateApplied && \(\s*<CfgRow\s+label="Link a converter quando há vários"/s)
})
```

Why this exact test:
- The first assertion locks the new user-facing label.
- The second assertion locks the persistence hook.
- The last two assertions catch both the new and old label if someone wraps the row in the previous `templateApplied &&` condition again.

- [ ] **Step 3: Run the new test and verify it fails before implementation**

Run:
```bash
node --test test/ux-backlog-implementation.test.js
```
Expected: FAIL with an assertion similar to `The input did not match the regular expression /label="Link principal quando há vários"/` because the current page still uses `label="Link a converter quando há vários"` and gates the row with `templateApplied &&`.

- [ ] **Step 4: Commit the failing test only if using strict TDD commits**

Run:
```bash
git add test/ux-backlog-implementation.test.js
git commit -m "test: cover primary link selector visibility"
```
Expected: commit succeeds if the team wants red-green commits. If the implementer prefers a single final commit, skip this step and commit after Task 2.

---

### Task 2: Always show the primary link selector in `/painel/grupos`

**Files:**
- Modify: `dashboard/app/painel/grupos/page.js`
- Test: `test/ux-backlog-implementation.test.js`

- [ ] **Step 1: Replace the template-gated row with an always-rendered row**

In `dashboard/app/painel/grupos/page.js`, find the block that currently starts with:

```jsx
        {templateApplied && (
          <CfgRow
            label="Link a converter quando há vários"
            hint="O template vira oferta de um produto só — escolha qual link usar."
            extra="cfg-fadeup"
          >
            <select
              className="pnl-input"
              value={g.primaryLinkTarget ?? ''}
              onChange={(e) => onUpdate(g.id, { primaryLinkTarget: e.target.value })}
            >
              <option value="">Primeiro link (padrão)</option>
              <option value="first">Primeiro link da mensagem</option>
              <option value="last">Último link da mensagem</option>
            </select>
          </CfgRow>
        )}
```

Replace it with this always-rendered block:

```jsx
        <CfgRow
          label="Link principal quando há vários"
          info={<>
            Define qual produto vira a referência principal quando a mensagem espelhada traz mais de um link.<br />
            Com template, esse é o link usado para montar a oferta de um produto só. Sem template, o texto original continua com todos os links convertidos, mas esta escolha orienta a imagem/dados principais e os registros do envio.
          </>}
          hint={templateApplied
            ? 'O template usa esse link para buscar título, preço e imagem do produto principal.'
            : 'Útil em ofertas espelhadas com vários links: todos continuam no texto, mas a imagem/dados principais seguem esta escolha.'}
          extra="cfg-fadeup"
        >
          <select
            className="pnl-input"
            value={g.primaryLinkTarget ?? ''}
            onChange={(e) => onUpdate(g.id, { primaryLinkTarget: e.target.value })}
          >
            <option value="">Primeiro link (padrão)</option>
            <option value="first">Primeiro link da mensagem</option>
            <option value="last">Último link da mensagem</option>
          </select>
        </CfgRow>
```

Implementation notes:
- Keep `templateApplied`; it is still useful for dynamic copy in this row and the existing “Formato da mensagem” hint.
- Do not change API payload shape.
- Do not add backend migrations; `primaryLinkTarget` already exists.
- Do not move this row out of “Como a oferta é publicada”; the setting affects publication output, not capture filters.

- [ ] **Step 2: Run the focused dashboard regression test**

Run:
```bash
node --test test/ux-backlog-implementation.test.js
```
Expected: PASS; the source includes the new label and no longer has the `templateApplied &&` wrapper around the selector.

- [ ] **Step 3: Run the existing backend persistence test for group settings**

Run:
```bash
node --test test/api/routes/groups.channel.test.js
```
Expected: PASS; especially the case named `PUT /:id persiste primaryLinkTarget e rejeita valor inválido`.

- [ ] **Step 4: Run the existing mirror template tests**

Run:
```bash
node --test test/mirror-template.test.js
```
Expected: PASS; confirms template rendering still emits the selected converted link and never leaks the upstream affiliate link.

- [ ] **Step 5: Run the dashboard config guard**

Run:
```bash
npm --prefix dashboard run guard:config-page
```
Expected: PASS with `Guardrail OK: configurações não expõe cadência global nem template global.` This ensures the change did not reintroduce removed global config UI.

- [ ] **Step 6: Commit the implementation**

Run:
```bash
git add dashboard/app/painel/grupos/page.js test/ux-backlog-implementation.test.js
git commit -m "fix: show primary link selector without template"
```
Expected: commit succeeds on the current branch.

---

### Task 3: Manual QA checklist for staging after merge to `develop`

**Files:**
- No code changes.
- Validate page: `/painel/grupos` on staging after the PR is merged into `develop` and the staging workflow deploys.

- [ ] **Step 1: Open the group settings UI in staging**

Run locally only if validating source build is needed:
```bash
npm --prefix dashboard run build
```
Expected: PASS; the dashboard builds successfully.

Manual staging path:
```text
http://178.105.54.0:3006/painel/grupos
```
Expected: in a monitor group card, under “Como a oferta é publicada”, the field “Link principal quando há vários” appears even while “Formato da mensagem” is “Manter texto original convertido”.

- [ ] **Step 2: Validate persistence for relay mode**

Manual steps:
```text
1. Set “Formato da mensagem” to “Manter texto original convertido”.
2. Set “Link principal quando há vários” to “Último link da mensagem”.
3. Refresh the page.
4. Reopen the same monitor group settings.
```
Expected: the select remains on “Último link da mensagem”.

- [ ] **Step 3: Validate persistence for template mode**

Manual steps:
```text
1. Set “Formato da mensagem” to any template.
2. Keep “Link principal quando há vários” as “Último link da mensagem”.
3. Refresh the page.
4. Reopen the same monitor group settings.
```
Expected: the select remains visible and still set to “Último link da mensagem”.

- [ ] **Step 4: Validate behavior with a multi-link mirrored offer**

Manual steps:
```text
1. Use a source group message containing at least two product links and one image.
2. With relay mode enabled, send/receive the mirrored message.
3. Confirm all supported links in the outgoing text are converted to the customer affiliate links.
4. Confirm the selected primary link determines the main product/image/log reference used by the send pipeline.
5. Repeat once with “Primeiro link da mensagem” and once with “Último link da mensagem”.
```
Expected: relay mode no longer blocks configuration of the primary product; template mode behavior remains unchanged.

---

## Self-Review

**Spec coverage:**
- Requirement: the selector should not appear only when the field above is set to a template. Covered by Task 1 and Task 2.
- Requirement: the field remains useful to choose which link’s image/data to send in multi-link mirrored offers. Covered by the new label/info/hint in Task 2 and QA in Task 3.
- Requirement: avoid unnecessary backend work. Covered by File Structure and Current Behavior sections; backend already persists and consumes `primaryLinkTarget`.

**Placeholder scan:**
- No `TBD`, `TODO`, “implement later”, or unspecified “write tests” steps remain.
- Every code-changing step includes the exact code to add or replace.

**Type/name consistency:**
- The plan consistently uses `primaryLinkTarget`, `templateApplied`, `templateKey`, `'first'`, `'last'`, and `''` exactly as they exist today.
