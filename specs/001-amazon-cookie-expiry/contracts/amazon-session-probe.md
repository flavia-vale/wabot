# Contrato: Sondagem e rotação de sessão Amazon

**Feature**: 001-amazon-cookie-expiry

## 1. `GET /api/credentials/amazon/session` (Fastify, autenticado)

**Request**: sem body; `onRequest: [app.authenticate]`; usuário via `req.user.sub`.

**Response (inalterada na forma pública)**:
```json
{ "configured": true, "alive": true|false|null, "reason": "ok|expired|network_error|no_cookie|no_tag|not_configured", "checkedAt": "<ISO>" }
```

**Comportamento novo (esta feature)**:
1. Antes de sondar, consulta o cache por `userId` (`getCachedProbe`). Em hit dentro da janela TTL, retorna o resultado cacheado **sem** chamar a Amazon (não consome rotação).
2. Em miss/expirado, chama `checkAmazonSession(data)`, que pode devolver `credentialPatch` interno.
3. Se `credentialPatch` presente, persiste cifrado (espelha `/mercadolivre/session`):
   `db.credential.update({ where: { userId_platform }, data: { data: encryptCredential(JSON.stringify({ ...data, ...credentialPatch })) } })`.
4. O `credentialPatch` **nunca** aparece na resposta HTTP (destructuring `{ credentialPatch, ...publicResult }`).
5. Grava o resultado público no cache (`setCachedProbe`).

**Invariantes**:
- Nenhuma credencial escrita em texto puro (D-3).
- `reason:'network_error'` (transitório) NÃO é persistido como expiração e NÃO altera `alive` para `false`.
- Sessão genuinamente expirada continua retornando `alive:false, reason:'expired'` (não mascarar).

## 2. `checkAmazonSession(creds)` → retorno estendido

**Antes**: `{ configured, alive, reason }` (rotação persistida só via gancho, no-op na rota do painel).

**Depois**:
```
{ configured, alive, reason, credentialPatch? }
```
- `credentialPatch` presente apenas quando a resposta trouxe cookies rotacionados (`buildAmazonCredentialPatchFromSetCookie` ≠ null).
- Backward-compat: quando `creds.__onCredentialPatch` existir (worker/linkConversion), a persistência via gancho continua ocorrendo; a rota do painel usa o `credentialPatch` retornado.

## 3. `createAmazonShortLink(longUrl, tag, creds)` → retorno estendido

**Depois**: `{ shortUrl, transient, credentialPatch? }`
- `credentialPatch` derivado do `Set-Cookie` da resposta bem-sucedida (jar mesclado por nome).
- `transient=true` em 5xx/rede/timeout; `credentialPatch` normalmente ausente nesses casos.

## 4. Módulo `amazonSessionProbeCache.js` (puro)

```
getCachedProbe(userId, now=Date.now()) -> ProbeResult | null   // null se ausente/expirado
setCachedProbe(userId, result, now=Date.now()) -> void
pruneExpired(now=Date.now()) -> void
```
- TTL configurável via env (default seguro em minutos).
- Sem dependência de DB/rede/Prisma — testável isoladamente.
