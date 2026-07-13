# Quickstart / Validação: Expiração dos cookies/tokens do Mercado Livre

**Feature**: 005-ml-cookie-expiry | **Date**: 2026-07-13

Guia de validação da correção. Detalhes de entidades/contratos em [data-model.md](./data-model.md) e [contracts/](./contracts/mercadolivre-session-probe.md).

## Pré-requisitos
- Node do repo; deps instaladas (`npm ci`).
- Testes são **db-free/env-free**: sem `DATABASE_URL`, sem rede real, sem `CREDENTIAL_ENCRYPTION_KEY` (encrypt/decrypt viram no-op em teste — D-3).

## 1. Testes unitários (node:test)

```bash
# módulos puros novos
node --test test/ml-oauth-token-policy.test.js
node --test test/mercadolivre-session-probe-cache.test.js
# rota (com db/handlers injetados via opts)
node --test test/credentials-mercadolivre-session-route.test.js
# regressão do eixo cookie (não regredir)
node --test test/mercadolivre-session.test.js test/mercadolivre-lock.test.js
# suite inteira antes de abrir PR
node --test
```

### Cenários que os testes DEVEM cobrir
- **OAuth refresh persiste o token rotacionado (C2 / FR-003 / FR-009)**: dado `oauthTokenExpiry` no passado + `oauthRefreshToken` presente, `getMlUserToken` faz refresh (fetch stub retorna novo `access_token`+`refresh_token`+`expires_in`) e devolve `credentialPatch` com os três campos frescos; o novo `refresh_token` ≠ o anterior.
- **Access token válido é reusado (SC-001, evita refresh redundante)**: `now < oauthTokenExpiry` → `buildOAuthRefreshDecision` retorna `action:'reuse'`, `getMlUserToken` não chama fetch, `credentialPatch:null`.
- **Falha transitória de refresh não apaga tokens (FR-008 / SC-006)**: fetch stub `!res.ok`/lança → `{ token:null, credentialPatch:null }`; nenhum campo OAuth é zerado.
- **Idempotência D-3 (SC-007)**: persistir o patch passa por `encryptCredential` (formato `v1:...`), sem texto puro, sem recifrar valor já cifrado.
- **Cache TTL da sondagem (C3 / FR-005 / SC-003)**: 2 chamadas dentro da janela → 1 sondagem efetiva ao ML; após TTL/`invalidateCachedProbe` (via `PUT`) → sonda de novo. `alive:null` não entra no cache.
- **Regressão cookie (SC-002)**: `checkMercadoLivreSession` ainda retorna `credentialPatch` em `Set-Cookie` rotacionado e ignora deleção; 401→`expired`, 403/429/rede→`alive:null`.
- **Formatos de credencial (FR-012)**: só-cookie (sem OAuth → refresh no-op), só-OAuth (sem cookie → probe `no_cookie`), ambos.

## 2. Validação manual em staging (após merge em `develop` → autodeploy)

1. Cadastrar credencial ML válida (cookie e/ou OAuth) no painel de credenciais (`/m/config/credentials`).
2. **Cache do probe**: abrir/recarregar o painel ~10x em poucos minutos; confirmar no log da `api-staging` que as sondagens efetivas ao ML caem para ~1 por janela (`grep "servida por cache"` vs. sondagem efetiva). Valida SC-003.
3. **Refresh OAuth persistido**: forçar `oauthTokenExpiry` no passado (ou aguardar), disparar um scrape de item ML (`fetchProductInfo` via oferta/converter); confirmar no log que houve refresh e que a credencial no banco tem `oauthRefreshToken` **novo** (o antigo deixou de valer). Repetir o scrape uma 2ª vez após novo vencimento: deve refazer refresh com sucesso (prova que o refresh rotacionado foi persistido). Valida C2/FR-003/FR-009/SC-001.
4. **Expiração legítima ainda sinaliza (FR-010/SC-004)**: com cookie/refresh inválido de propósito, o painel mostra "renovar credencial" e a conversão cai no fallback seguro (partner_id), sem encaminhar link de terceiro.
5. **Transitório não vira "expirada" (FR-008/SC-006)**: simular blip (403/429/rede) — painel não deve fixar "expirada"; próximo load reflete o estado real.

## 3. Promoção para produção
Só após validação em staging: PR `develop → main` (fluxo canônico). Sem migration, sem novo processo PM2, sem Redis, sem mudança de porta. Rollback: reverter o código mantém leitura de credenciais funcionando (D-3 tolera formatos legados; cache é aditivo e in-memory).

## Critérios de aceite (resumo → Success Criteria da spec)
- SC-001: tempo até recadastro aumenta (refresh OAuth persistido + menos sondagens).
- SC-002: 0 caminhos descartam rotação de cookie (regressão verde).
- SC-003: N aberturas do painel = ~1 sondagem efetiva.
- SC-005: research.md com veredito por causa + mapa completo de consumidores.
- SC-006: transitório nunca exibido/contado como expiração.
- SC-007: toda persistência via `encryptCredential` (`v1:...`), db-free/env-free.
