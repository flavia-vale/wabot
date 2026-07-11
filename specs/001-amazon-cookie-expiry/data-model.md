# Data Model: Expiração dos cookies da Amazon

**Feature**: 001-amazon-cookie-expiry | **Date**: 2026-07-10

Nenhuma migration de schema. As entidades abaixo são conceituais/em-memória, exceto `Credential` (já existente).

## Credential (existente — Prisma/SQLite)
- **Chave**: `userId_platform` (único), `platform = 'amazon'`.
- **Campo `data`**: string cifrada (D-3, formato `v1:<iv>:<tag>:<ct>`) contendo JSON com o cookie de sessão do SiteStripe e a `tag` de afiliada.
- **Formatos aceitos (FR-009)**: (a) cookie completo da sessão; (b) 3 cookies nomeados legados. Ambos devem continuar funcionando.
- **Escrita**: sempre via `encryptCredential(JSON.stringify(data))` (idempotente). **Leitura**: `parseCredentialData` / `decryptCredential` (tolera texto puro legado).
- **Regra nova**: quando a sondagem recebe rotação, o `data` é atualizado com o `cookie` mesclado (fresco) — sem sobrescrever com token de limpeza (valor vazio) nem regredir para token mais velho na mesma resposta.

## Rotação de token (patch de credencial) — conceitual/em-memória
- **Forma**: `{ cookie: string }` (jar mesclado por nome, `nome=valor; nome=valor`).
- **Origem**: `buildAmazonCredentialPatchFromSetCookie(cookieHeaderSent, responseHeaders)` (`src/converters/amazon.js`).
- **Regras**: só produzido quando algum cookie mudou (`changed === true`); ignora diretivas de limpeza (valor vazio); `null` quando nada mudou.
- **Propagação**: retornado por `createAmazonShortLink`/`checkAmazonSession` como `credentialPatch`; persistido pela rota do painel (cifrado) e/ou pelo gancho `__onCredentialPatch` (worker/linkConversion).

## Resultado de sondagem (probe result) — conceitual
- **Forma pública**: `{ configured: boolean, alive: boolean|null, reason: string, checkedAt?: string }`.
- **`reason`**: `ok` (alive=true), `expired` (alive=false, parede de login), `network_error` (alive=null, transitório — FR-007), `no_cookie`/`no_tag`/`not_configured` (configured=false).
- **Campo interno**: `credentialPatch?` — consumido pela rota, **não** exposto na resposta HTTP (espelha ML: destructuring `{ credentialPatch, ...publicResult }`).

## Cache de sondagem (novo — em-memória, módulo puro)
- **Estrutura**: `Map<userId, { result: ProbeResult, expiresAt: number }>`.
- **TTL**: janela curta (default seguro, configurável por env). Poda de entradas expiradas em cada acesso/insert.
- **Operações puras**: `getCachedProbe(userId, now)`, `setCachedProbe(userId, result, now)`, `pruneExpired(now)`.
- **Invariante**: um hit dentro da janela NÃO dispara chamada à Amazon (não consome rotação) — atende SC-003/FR-004.
- **Escopo**: processo da API (por-processo; não cross-processo — aceitável, o objetivo é cortar rajada de aberturas do painel, não coordenação global).

## Transições de estado da sessão (derivadas das respostas Amazon)
```
viva (ok) --getShortUrl 200 amzn.to--> viva (+ rotação persistida)
viva (ok) --parede "Acessar Amazon"--> expirada (expired)  → painel avisa "renovar cookies" + fallback ?tag=
qualquer --5xx/rede/timeout--> indeterminada (network_error) → NÃO conta como expiração (FR-007)
```
