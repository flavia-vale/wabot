# Data Model: Expiração dos cookies/tokens do Mercado Livre

**Feature**: 005-ml-cookie-expiry | **Date**: 2026-07-13

Nenhuma migration de schema. As entidades abaixo são conceituais/em-memória, exceto `Credential` (já existente). O patch OAuth reusa campos que **já existem** no JSON de `Credential.data` (escritos por `mlOAuth.js`).

## Credential (existente — Prisma/SQLite)
- **Chave**: `userId_platform` (único), `platform = 'mercadolivre'`.
- **Campo `data`**: string cifrada (D-3, formato `v1:<iv>:<tag>:<ct>`) contendo JSON com **dois eixos de segredo**:
  - Cookie de afiliado: `ssid`, `cookie` (jar completo), `csrf`, `id`, e dados de afiliada (`tag`).
  - OAuth: `oauthAccessToken`, `oauthRefreshToken`, `oauthTokenExpiry` (epoch ms; já com margem de -300s aplicada na escrita).
- **Formatos aceitos (FR-012)**: (a) só cookie; (b) só OAuth; (c) ambos. Todos devem continuar funcionando.
- **Escrita**: sempre via `encryptCredential(JSON.stringify(data))` (idempotente). **Leitura**: `parseCredentialData` / `decryptCredential` (tolera texto puro legado).
- **Regra nova (OAuth)**: quando `getMlUserToken` faz refresh, `oauthAccessToken`/`oauthTokenExpiry`/`oauthRefreshToken` são atualizados com os valores frescos da resposta do ML — o `refresh_token` **rotacionado** substitui o anterior; nunca regride para um refresh token mais velho nem apaga tokens em falha transitória.
- **Regra existente (cookie)**: quando a sondagem/`createLink` recebe rotação, `cookie`/`ssid`/`csrf`/`id` são mesclados (fresco), sem sobrescrever com token de limpeza (valor vazio).

## Rotação de cookie (patch de credencial) — conceitual/em-memória (JÁ EXISTE)
- **Forma**: `{ cookie: string, ssid?, csrf?, id? }` (jar mesclado por nome).
- **Origem**: `buildCredentialPatchFromSetCookie(creds, cookieHeader, headers)` (`src/converters/mercadolivre.js`).
- **Regras**: só produzido quando algum cookie mudou; ignora diretivas de limpeza (`parseSetCookieLine.isDeletion`); `null` quando nada mudou.
- **Propagação**: retornado por `checkMercadoLivreSession`/`createAffiliateLink` como `credentialPatch`; persistido pela rota (cifrado) e/ou pelo gancho `__onCredentialPatch` (worker/linkConversion).

## Patch OAuth (novo — conceitual/em-memória)
- **Forma**: `{ oauthAccessToken: string, oauthTokenExpiry: number, oauthRefreshToken: string }`.
- **Origem**: `applyOAuthTokenResponse(prevCreds, tokenResponse, now)` (`src/converters/mlOAuthTokenPolicy.js`, puro).
- **Regras**:
  - Só produzido quando a resposta de refresh traz `access_token` (senão `null` → tokens persistidos intactos, FR-008).
  - `oauthTokenExpiry = now + (expires_in - 300) * 1000` (mesma margem do `mlOAuth.js`).
  - `oauthRefreshToken` novo substitui o anterior; se a resposta não trouxer `refresh_token` (alguns fluxos), mantém o anterior (nunca apaga).
  - Idempotente: reprocessar a mesma resposta não regride tokens.
- **Propagação**: retornado por `getMlUserToken` junto do `token`; persistido por quem tem DB/gancho (rota/worker via `encryptCredential`; ou `__onCredentialPatch`).

## Decisão de refresh OAuth — conceitual/em-memória (novo, puro)
- **Função**: `buildOAuthRefreshDecision(creds, now)` → `{ action: 'reuse' | 'refresh' | 'skip', token? }`.
  - `reuse`: `oauthAccessToken` presente e `now < oauthTokenExpiry` → devolve o access token sem chamar o ML.
  - `refresh`: `oauthRefreshToken` presente e access expirado/ausente → precisa chamar `grant_type=refresh_token`.
  - `skip`: sem `oauthRefreshToken` → OAuth não configurado (cai em outros caminhos de scrape).

## Resultado de sondagem (probe result) — conceitual (JÁ EXISTE)
- **Forma pública**: `{ configured: boolean, alive: boolean|null, reason: string, checkedAt?: string }`.
- **`reason`**: `ok` (alive=true), `expired` (alive=false, 401), `forbidden`/`rate_limited`/`network_error`/`busy` (alive=null, não alarma — FR-008), `no_cookie`/`not_configured` (configured=false).
- **Campo interno**: `credentialPatch?` (cookie) — consumido pela rota, **não** exposto na resposta HTTP (destructuring `{ credentialPatch, ...publicResult }`).

## Cache de sondagem ML (novo — em-memória, módulo puro)
- **Estrutura**: `Map<userId, { result: ProbeResult, expiresAt: number }>` (`src/converters/mercadolivreSessionProbeCache.js`).
- **TTL**: janela curta (default seguro, configurável por env — ex.: `ML_SESSION_PROBE_CACHE_TTL_MS`). Poda de expirados em cada acesso/insert.
- **Operações puras**: `getCachedProbe(userId, now)`, `setCachedProbe(userId, result, now)`, `invalidateCachedProbe(userId)`, `pruneExpired(now)`.
- **Invariante**: hit dentro da janela NÃO chama o ML (não consome rotação) — atende SC-003/FR-005. Só cacheia resultado definitivo (`alive true/false`); `alive:null` (transitório) não entra no cache (espelha T023 do Amazon).
- **Escopo**: processo da API (por-processo; não cross-processo — aceitável, o objetivo é cortar rajada de aberturas do painel).

## Transições de estado da sessão
```
# Eixo cookie (ssid)
viva (ok) --createLink/probe 200--> viva (+ rotação cookie persistida)
viva (ok) --401--> expirada (expired) → painel pede renovar SSID + fallback partner_id
qualquer --403/429/rede/lock--> indeterminada (alive:null) → NÃO conta como expiração (FR-008)

# Eixo OAuth
access válido --now < expiry--> reuse (sem chamar ML)
access expirado + refresh presente --refresh 200--> renovado (+ novo access/refresh persistidos)
refresh 200 SEM refresh_token novo --> mantém refresh anterior (nunca apaga)
refresh !ok / rede --> transitório: retorna sem patch, tokens persistidos intactos (FR-008)
sem refresh token --> skip (OAuth não configurado)
```
