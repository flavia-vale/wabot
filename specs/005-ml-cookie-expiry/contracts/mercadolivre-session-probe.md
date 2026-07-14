# Contrato: Sondagem de sessão ML, rotação de cookie e refresh OAuth

**Feature**: 005-ml-cookie-expiry | **Date**: 2026-07-13

## 1. `GET /api/credentials/mercadolivre/session` (Fastify, autenticado)

Checagem de saúde da sessão de afiliado ML exibida no painel. Forma da resposta **inalterada** (backward-compatible com o dashboard).

### Request
- Header: `Authorization: Bearer <jwt>` (via `app.authenticate`).
- Sem body.

### Response (200)
```json
{
  "configured": true,
  "alive": true,
  "reason": "ok",
  "checkedAt": "2026-07-13T12:00:00.000Z"
}
```
- `configured`: `false` quando não há credencial ML (`{ configured:false, alive:null, reason:'not_configured' }`) ou sem cookie (`reason:'no_cookie'`).
- `alive`: `true` (sessão viva), `false` (expirada — 401), `null` (indeterminado — transitório).
- `reason`: `ok` | `expired` | `forbidden` | `rate_limited` | `network_error` | `busy` | `no_cookie` | `not_configured`.
- `credentialPatch` **NUNCA** aparece na resposta HTTP (é destructurado e persistido server-side).

### Comportamento novo (esta feature)
1. **Cache TTL antes de sondar**: consulta `getCachedProbe(userId)`; em hit dentro da janela, retorna o resultado cacheado **sem chamar o ML** (log `debug` "servida por cache"). Só cacheia resultado com `alive === true || alive === false`.
2. **Persistência de rotação de cookie** (já existente, manter): se `checkMercadoLivreSession` devolver `credentialPatch`, persiste `encryptCredential(JSON.stringify({ ...data, ...credentialPatch }))`.
3. **Invalidação**: `PUT /api/credentials/mercadolivre` chama `invalidateCachedProbe(userId)` para refletir credencial recém-cadastrada imediatamente.

### Injeção de dependência (testes)
`credentialsRoutes(app, opts)` aceita `opts.db`, `opts.checkMercadoLivreSession`, `opts.getMlProbeCache`/`opts.setMlProbeCache`/`opts.invalidateMlProbeCache` (defaults reais; overrides em teste db-free).

## 2. `checkMercadoLivreSession(creds)` (converter, existente — contrato de regressão)

- **Input**: `{ ssid?, csrf?, cookie?, id?, tag? }`.
- **Output**: `{ configured, alive, reason, credentialPatch? }`.
- **Invariantes a NÃO regredir**:
  - Serializa acesso concorrente via `withMercadoLivreCredentialLock` (lock timeout → `reason:'busy'`, `alive:null`).
  - `credentialPatch` só presente quando algum cookie mudou; deleção (`Set-Cookie` vazio/`Max-Age=0`/`Expires` passado) é ignorada.
  - 401→`expired`(false); 403/429/rede→`alive:null`.

## 3. `getMlUserToken(mlCredentials)` (scraper — contrato NOVO)

### Antes (bug)
Retorna `access_token` (string) e **descarta** o refresh rotacionado.

### Depois (esta feature)
- **Input**: `{ oauthAccessToken?, oauthRefreshToken?, oauthTokenExpiry? }` (+ opcional `__onCredentialPatch`).
- **Output**: `{ token: string|null, credentialPatch: object|null }`.
  - `token`: access token utilizável (reusado se válido, ou o novo após refresh) ou `null`.
  - `credentialPatch`: `{ oauthAccessToken, oauthTokenExpiry, oauthRefreshToken }` quando houve refresh bem-sucedido; `null` quando reusou access válido ou quando o refresh falhou (transitório).
- **Persistência**: se `__onCredentialPatch` presente, chama-o com o patch; senão o chamador (rota/worker) persiste via `encryptCredential`.
- **Invariantes**:
  - Reusa `oauthAccessToken` enquanto `now < oauthTokenExpiry` (não chama o ML).
  - `refresh_token` rotacionado é **sempre persistido**; nunca reenvia refresh token velho.
  - Falha de refresh (`!res.ok`/rede) → `{ token:null, credentialPatch:null }`; tokens persistidos ficam intactos (FR-008).
  - Sem `oauthRefreshToken` → `{ token:null, credentialPatch:null }` (OAuth não configurado).

## 4. Módulo puro `mlOAuthTokenPolicy.js` (novo — db-free/env-free)

- `buildOAuthRefreshDecision(creds, now)` → `{ action:'reuse'|'refresh'|'skip', token? }`.
- `applyOAuthTokenResponse(prevCreds, tokenResponse, now)` → `credentialPatch|null` (mescla tokens; `oauthTokenExpiry = now + (expires_in-300)*1000`; mantém refresh anterior se resposta não trouxer novo; idempotente).

## 5. Módulo puro `mercadolivreSessionProbeCache.js` (novo — db-free)

Espelha `amazonSessionProbeCache.js`: `getCachedProbe(userId, now)`, `setCachedProbe(userId, result, now)`, `invalidateCachedProbe(userId)`, `pruneExpired(now)`. TTL configurável por env com default seguro.
