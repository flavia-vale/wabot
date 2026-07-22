# Contrato — Double-check do refresh OAuth sob lock (#3)

## `getMlUserToken`

**Antes**: `getMlUserToken(mlCredentials) -> { token, credentialPatch }`
**Depois**: `getMlUserToken(mlCredentials, opts = {}) -> { token, credentialPatch }`

- `opts.readFreshCredential(mlCredentials) -> Promise<freshCreds | null>` — injetável (FR-010).
  - Default: lê `Credential` por `userId` (derivado de `mlCredentials`) e decifra via `parseCredentialData` (D-3). Retorna objeto com os campos OAuth atuais, ou `null` se indisponível.
  - Teste: injeta stub síncrono/assíncrono retornando o estado desejado.

### Fluxo

```
decision = buildOAuthRefreshDecision(mlCredentials, now)
if decision.action === 'skip'  -> { token: null, credentialPatch: null }
if decision.action === 'reuse' -> { token: decision.token, credentialPatch: null }   // caminho feliz, SEM lock (FR-009)

// decision.action === 'refresh':
withMercadoLivreCredentialLock(mlCredentials, async () => {
  const fresh = (await opts.readFreshCredential?.(mlCredentials)) ?? mlCredentials
  const reDecision = buildOAuthRefreshDecision(fresh, Date.now())
  if (reDecision.action === 'reuse')  return { token: reDecision.token, credentialPatch: null } // reaproveita, NÃO chama ML (FR-008)
  if (reDecision.action === 'skip')   return { token: null, credentialPatch: null }
  return await refreshMlOAuthToken(fresh)   // renova com refresh_token FRESCO (FR-007)
})
```

- Timeout/erro do lock (`ML_AFFILIATE_LOCK_TIMEOUT`) → `{ token: null, credentialPatch: null }` (best-effort, inalterado).
- `refreshMlOAuthToken` passa a usar `fresh.oauthRefreshToken` (não o snapshot pré-lock).

### Invariantes

- **FR-007**: decisão efetiva de refresh é sempre recomputada sobre leitura fresca dentro do lock.
- **FR-008**: se a fresca já tem access token válido, reaproveita — 0 chamadas ao ML com `refresh_token` morto.
- **FR-009**: single-caller — `reuse` fresco == `refresh` real; nenhuma renovação desnecessária, nenhuma renovação legítima bloqueada.
- **FR-010**: leitor injetado por `opts`; lógica testável sem DB.

## Testes (node:test, db-free/env-free)

- Concorrência simulada: pré-lock `refresh`, `readFreshCredential` devolve credencial com access token já renovado/válido → resultado `reuse`, `refreshMlOAuthToken` (stub de `fetch`) **não** é chamado.
- Single-caller: `readFreshCredential` devolve o mesmo estado expirado → `refresh` ocorre normalmente e persiste o token novo.
- `readFreshCredential` retorna `null` → cai no snapshot original (`mlCredentials`) sem quebrar.
