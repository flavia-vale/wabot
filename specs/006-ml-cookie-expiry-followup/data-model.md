# Phase 1 — Data Model

Nenhuma migration de schema. As entidades abaixo são conceituais (estruturas em memória / campos já existentes de `Credential.data` / evento em `AnalyticsEvent`).

## Credencial do Mercado Livre (`Credential.data`)

- **Persistência**: tabela `Credential` (`userId_platform` único, `platform='mercadolivre'`), campo `data` cifrado em repouso (D-3, `v1:<iv>:<tag>:<ct>`).
- **Campos relevantes (JSON dentro de `data`)**:
  - `cookie` — jar serializado (`nome=valor; ...`), precedência sobre `ssid` em `buildCookieHeader`.
  - `ssid`, `csrf`, `id` — cookies conhecidos (campos separados legados).
  - `oauthAccessToken`, `oauthRefreshToken`, `oauthTokenExpiry` — sessão OAuth (refresh_token single-use).
- **Ciclo de vida nesta feature**: lida e potencialmente **rotacionada** por dois eixos — cookie (scrape web, #1) e OAuth (double-check, #3). Escrita sempre via `persistCredentialPatch` (merge + `encryptCredential`). Leitura fresca do double-check via `parseCredentialData` (decifra).
- **Invariantes**:
  - Nunca sobrescrever `ssid`/cookie válido por vazio (deleção ignorada).
  - `refresh_token` novo sempre substitui o anterior no patch (nunca regride ao velho).
  - Patch idempotente sob D-3 (re-encriptar valor já cifrado é no-op).

## Rotação de cookie (`Set-Cookie` da resposta web)

- **Origem**: cabeçalho `Set-Cookie` da resposta de `fetchHtml` no ramo autenticado de ML (hoje descartado).
- **Forma exposta**: `setCookie: string[]` no retorno de `fetchHtml` (`res.headers.getSetCookie?.() ?? []`).
- **Transformação**: `buildCredentialPatchFromSetCookie(creds, cookieHeader, { 'set-cookie': setCookie })` → `patch | null`.
  - `patch` = `{ cookie, [ssid], [csrf], [id] }` quando algum nome mudou; `null` quando nada mudou (→ nenhuma escrita, FR-006).
  - Linhas de deleção (`valor vazio` / `Max-Age=0` / `Expires` no passado) são ignoradas na mesclagem (FR-004).
- **Estados**: `nenhuma-rotação` (patch null) · `rotação-real` (patch com valor novo) · `deleção` (ignorada, patch preserva valor conhecido ou null).

## Decisão de renovação OAuth (double-check)

- **Entrada**: estado da credencial + `now`. Computada por `buildOAuthRefreshDecision` (módulo puro `mlOAuthTokenPolicy.js`, da 005).
- **Ações**: `skip` (sem OAuth configurado) · `reuse` (access token ainda válido → devolve `token`) · `refresh` (expirado → renovar).
- **Novo fluxo (#3)**: a decisão é recomputada sobre **leitura fresca** dentro de `withMercadoLivreCredentialLock`:
  - `refresh (pré-lock)` + `reuse (fresca)` → **reaproveita** o token recém-renovado por outra operação; **não** chama o ML.
  - `refresh (pré-lock)` + `refresh (fresca)` → renova com o `refresh_token` **fresco** e persiste (`applyOAuthTokenResponse`).
- **Dependência injetável**: `opts.readFreshCredential(mlCredentials) → credencial fresca | null` (default lê+decifra `Credential`; teste injeta stub). FR-010.

## Evento de falha de persistência (`ops_ml_patch_persist_failed`)

- **Origem**: `catch` da persistência de rotação (eixos `oauth` e `cookie`) em `productInfoScraper.js`.
- **Emissão**: `recordOperationalSignal('ml_patch_persist_failed', { axis })` → contador in-memory + `AnalyticsEvent` durável best-effort (`trackAnalyticsEventSafe`).
- **Registro nos dois lugares**:
  - `operationalSignals.js`: mapa `ml_patch_persist_failed → ops_ml_patch_persist_failed`.
  - `analytics.js`: `'ops_ml_patch_persist_failed'` em `ANALYTICS_EVENTS` (senão o evento durável é descartado).
- **Metadata**: apenas `{ axis: 'oauth' | 'cookie' }` — **sem** segredo/PII (nunca o valor do cookie/token).
- **Invariante**: emissão é best-effort — falhar ao registrar o evento não pode quebrar o fluxo de scrape (FR-013).
