# Mobile /m Routes Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every `/m` mobile route buildable, backed by real Wabot data/actions, and safe to validate first in staging before any production rollout.

**Architecture:** Treat `/m` as a mobile client for the existing backoffice contracts, not as a separate product surface. Extract shared client-side modules from desktop where possible (`api`, credentials metadata, WhatsApp connection flow, group management, log taxonomy) and keep mobile components thin, route-scoped, and feature-flagged by `NEXT_PUBLIC_ENABLE_MOBILE_PREVIEW` until acceptance passes.

**Tech Stack:** Next.js App Router 16, React 19 client components, existing `dashboard/lib/api.js` API proxy/client, Fastify API, SQLite/Prisma backend, PM2 staging deployment.

---

## Risk Gate: STRICT Pre-Implementation Review

1. **Fatal errors:** `/m/op/offer` currently breaks `npm run build` because `pasteFeedback`/`setPasteFeedback` are referenced without `useState`. This is P0 and blocks staging deploy.
2. **Breaking changes:** Do not change API contracts, DB schema, ports, supervisor protocol, or production envs for this mobile hardening. Add API methods only if a missing action truly has no existing endpoint.
3. **Cascade effects:** Shared `api` and desktop backoffice routes are production-critical. Prefer extracting reusable constants/helpers without changing behavior. Add tests/guards around extracted behavior.
4. **Environment isolation:** Validate only on `develop`/staging (`http://178.105.54.0:3006`). Do not touch production `.env`, SQLite files, or PM2 prod apps.
5. **Blockers:** Block production promotion until `npm run build`, `npm run lint`, mobile manual smoke, and desktop regression smoke all pass in staging.

## Current Route Inventory and Critical Findings

| Route | Current status | Priority |
| --- | --- | --- |
| `/m` | Reads real `me`, session, groups, credentials, logs summary, recent logs; onboarding routes are present. Needs stronger empty/error states and should use accurate setup completion semantics. | P1 |
| `/m/op/offer` | Build-breaking undefined state; uses real convert/scrape APIs but renders hardcoded product, templates, bonuses, destinations, and send/schedule CTAs with no backend action. | P0/P1 |
| `/m/op/converter` | Calls real link conversion but has no error UI, no multi-result handling, no clipboard fallback feedback, and active tab key does not match bottom navigation. | P1 |
| `/m/op/logs` | Reads real logs and maps status taxonomy; action buttons are visual-only, no pagination/infinite loading, and only first 50 logs are available. | P1/P2 |
| `/m/op/espelhar` | Reads real groups/session/summary but the main toggle, edit links, add buttons, filters, and cadence are visual-only. | P1 |
| `/m/config/whatsapp` | Reads session status but Connect/Disconnect/Sync and QR/pairing flows are not wired to the desktop session flow. | P1 |
| `/m/config/groups` | Lists groups only. Add CTA and toggles are visual-only; no `sessionWAGroups`, add, update, delete, channel admin, or target mapping workflows. | P1 |
| `/m/config/credentials` | Reads credentials but expects a non-existent `value` shape; mobile cannot save/edit credentials and likely displays configured stores as disconnected. | P1 |
| `/m/config/preferences` | Reads config but renders mostly hardcoded preferences and non-clickable toggles; no `saveConfig`. | P2 |
| `/m/account` | Reads real user/session but many rows are hardcoded and non-navigable; logout is visual-only. | P1/P2 |
| `/m/account/subscription` | Reads user/payment status but falls back to fake usage numbers and has visual-only plan/payment actions. | P2 |
| `/m/account/templates` | Reads config but renders hardcoded templates; back button and create/manage actions are visual-only. | P2 |
| `/m/help/tutorial` | Reads real onboarding signals and routes steps to mobile config/log pages; needs real content/media alignment with desktop tutorial. | P2 |

## File Structure Plan

### Create
- `dashboard/components/mobile/mobileCredentialPlatforms.js` — shared mobile-friendly credential metadata, derived from desktop `PLATFORMS` shape.
- `dashboard/components/mobile/useMobileAsyncAction.js` — standard loading/error/success wrapper for mobile buttons.
- `dashboard/components/mobile/useMobileSessionConnection.js` — mobile wrapper around `sessionStart`, `sessionStop`, `sessionForget`, `sessionPairingCode`, `sessionQRTicket`, `sessionQRLatest`, and `openQRSocket`.
- `dashboard/components/mobile/useMobileGroups.js` — shared group loading/mutation helpers for `/m/config/groups` and `/m/op/espelhar`.
- `dashboard/components/mobile/useMobileOfferDraft.js` — state machine for convert/scrape/manual edit/template/destination/send draft.
- `dashboard/docs/mobile/m-routes-qa-checklist.md` — route-by-route staging checklist.

### Modify
- `dashboard/app/m/op/offer/page.js` — fix fatal build issue; replace hardcoded draft/product/destinations with real state; disable or implement send/schedule explicitly.
- `dashboard/app/m/op/converter/page.js` — add error/copy feedback and align active nav.
- `dashboard/app/m/op/logs/page.js` — add pagination/load-more and disable/implement action buttons.
- `dashboard/app/m/op/espelhar/page.js` — wire edit/add/toggle actions to real routes/API, or label unavailable actions clearly.
- `dashboard/app/m/config/whatsapp/page.js` — implement mobile connect/disconnect/pairing/QR status flow.
- `dashboard/app/m/config/groups/page.js` — implement add/edit/delete/activate flows or route to desktop-safe fallback.
- `dashboard/app/m/config/credentials/page.js` — use `c.data`, not `c.value`; implement edit/save forms.
- `dashboard/app/m/config/preferences/page.js` — bind notification/template/cadence fields to `getConfig`/`saveConfig` or remove unsupported controls.
- `dashboard/app/m/account/page.js` — route rows to `/m/account/subscription`, `/m/account/templates`, `/m/config/preferences`, `/m/help/tutorial`; wire logout.
- `dashboard/app/m/account/subscription/page.js` — remove fake stats or mark unavailable; wire checkout/recovery where backend supports it.
- `dashboard/app/m/account/templates/page.js` — derive templates from config or explicitly ship as local presets with save path.
- `dashboard/components/mobile/MobileShell.jsx` — safe-area/dvh refinements, notification button behavior, active-key guard.
- `dashboard/lib/api.js` — only add missing thin methods for existing backend endpoints, if needed.

## Priority Execution Plan

### P0 — Build and Navigation Integrity

- [x] Fix `pasteFeedback` state in `dashboard/app/m/op/offer/page.js` with `const [pasteFeedback, setPasteFeedback] = useState('')` near the other `useState` calls.
- [x] Re-run `npm run build` in `dashboard/`; expected: no prerender error for `/m/op/offer`.
- [x] Change `/m/op/converter` from `active="converter"` to an existing tab key or add a supported secondary-active mode in `MobileShell`; expected: bottom nav never has an impossible active state.
- [x] Add a small route-smoke script or checklist that covers every file under `dashboard/app/m/**/page.js`.
- [x] Commit P0 separately: `fix: restore mobile offer build`.

### P1 — Real Backoffice Linkage for Core Operations

#### 1. WhatsApp connection flow
- [x] Extract the desktop session connection behavior from `dashboard/app/dashboard/page.js` into a mobile hook or carefully duplicate the required flow.
- [x] Wire `/m/config/whatsapp` Connect to pairing-code-first mobile UX, with QR fallback only if needed.
- [x] Wire Disconnect to `api.sessionStop()` and optionally `api.sessionForget()` behind confirmation.
- [x] Add loading/error/success feedback for every session action.
- [x] Test with a staging account: disconnected → pairing code → connected → disconnect → reconnect.

#### 2. Credentials
- [x] Extract credential platform metadata from desktop so mobile and desktop use the same required fields.
- [x] Fix mobile credential detection to read `credential.data` and platform-specific required keys.
- [x] Replace “Conectar/Editar” visual buttons with an inline mobile form using `api.saveCredential(platform, data)`.
- [x] Preserve sensitive field masking and validation messages.
- [x] Test Shopee, Amazon, Mercado Livre, and Magalu partial/complete credentials.

#### 3. Groups and channels
- [x] Replace visual toggles with `api.updateGroup(id, { active })` and optimistic rollback on failure.
- [x] Wire Add CTA to a mobile add flow based on `api.sessionWAGroups()`, `api.addGroup()`, and manual JID fallback.
- [x] Wire Delete with confirmation via `api.deleteGroup(id)`.
- [x] Add channel-specific badges/admin refresh only if already supported by existing endpoints.
- [x] Keep advanced target mapping either hidden on mobile or implement a focused sheet using `groupTargets`/`updateGroupTargets`.

#### 4. Offer creation
- [x] Replace hardcoded product card values with `api.scrapeOffer()` response fields and manual form state.
- [x] Replace hardcoded destination list with active `role='post'` groups from `api.groups()`.
- [x] Make template selection generate controlled text in the editor, not `defaultValue` that ignores subsequent state changes.
- [x] Decide implementation path for “Enviar agora”: either use existing `api.broadcastSend(text, jids)` for manual sends or explicitly disable with “envio manual mobile em breve” until backend contract is confirmed.
- [x] Never silently send to fake destinations.

#### 5. Espelhamento dashboard
- [x] Treat the main switch honestly: if the backend has no dedicated mirror toggle, label it “WhatsApp conectado/desconectado” and route to `/m/config/whatsapp`; do not imply a non-existent feature flag.
- [x] Wire “Editar” and Add buttons to `/m/config/groups` with role query/state if implemented.
- [x] Replace hardcoded filter count and cadence with actual config values or hide the modules.

### P2 — Observability, Account, Billing, Templates, Preferences

- [x] Add log pagination/load-more to `/m/op/logs` so mobile is not capped at 50 logs.
- [x] Hide or disable log action buttons unless backend endpoints exist for retry/repost/cancel/reagendar/postar mesmo assim.
- [x] Wire `/m/account` rows to mobile routes and implement logout through `api.logout()` with redirect to `/login`.
- [x] Remove fake subscription usage fallbacks (`2847`, `4`) and show explicit empty/unavailable states when API data is absent.
- [x] Wire payment actions to `api.paymentsCheckout`, `api.paymentsRecover`, or safe support guidance.
- [x] Convert preferences toggles to controlled config fields and persist via `api.saveConfig`, or remove unsupported settings.
- [x] Align `/m/account/templates` with actual config fields; if templates are new product scope, implement as presets stored in existing config only after confirming backend shape.
- [x] Align `/m/help/tutorial` copy/media with the existing desktop tutorial and mobile route map.

### P3 — UX/UI Polish and Mobile Quality

- [x] Replace route-local inline style duplication with shared mobile primitives where it reduces risk without a large refactor.
- [x] Update `MobileShell` to use `minHeight: '100dvh'`, `paddingBottom: 'calc(92px + env(safe-area-inset-bottom))'`, and bottom-nav safe-area padding.
- [x] Ensure every tappable element is at least 44px high/wide or has adequate hit target spacing.
- [x] Add visible focus styles to mobile buttons/links for keyboard and accessibility.
- [x] Add `aria-label` to icon-only buttons and avoid clickable `<div>` where a `<button>` is intended.
- [x] Ensure loading states appear within 300ms for slow API calls and are not layout-shifting.
- [x] Add an optional staging screenshot pass for `/m`, `/m/op/offer`, `/m/config/whatsapp`, `/m/config/groups`, and `/m/op/logs` after P1.

## Acceptance Checklist for Staging

- [ ] `cd /workspace/wabot/dashboard && npm run lint` passes.
- [ ] `cd /workspace/wabot/dashboard && npm run build` passes.
- [ ] Login on `http://178.105.54.0:3006/login`, then open `/m` with an authenticated user.
- [ ] `/m` shows correct onboarding state from real credentials/session/groups/logs.
- [ ] `/m/config/whatsapp` can connect/disconnect a WhatsApp session without affecting production.
- [ ] `/m/config/credentials` can save and re-open at least one credential per supported platform.
- [ ] `/m/config/groups` can add, toggle, and delete a staging group/channel safely.
- [ ] `/m/op/converter` converts supported links and shows a clear error for unsupported links.
- [ ] `/m/op/offer` never uses fake product/destination data and either sends via a confirmed backend endpoint or explicitly disables send.
- [ ] `/m/op/logs` matches desktop log counts/status labels for the same account.
- [ ] Desktop routes `/dashboard`, `/dashboard/credenciais`, `/dashboard/grupos`, and `/dashboard/logs` still behave as before.

## Recommended Rollout

1. Ship P0 alone if the current branch needs to unblock deploys quickly.
2. Ship P1 in two PRs: WhatsApp/Credentials/Groups first, Offer/Espelhar second.
3. Ship P2 after core mobile flows are validated by a real staging user.
4. Ship P3 polish only after functional parity is stable.
5. Keep `NEXT_PUBLIC_ENABLE_MOBILE_PREVIEW` available as a kill switch until all P1 acceptance checks pass in staging.
