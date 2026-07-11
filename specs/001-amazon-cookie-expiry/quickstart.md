# Quickstart / Validação: Expiração dos cookies da Amazon

**Feature**: 001-amazon-cookie-expiry

Guia de validação end-to-end. Detalhes de forma em `contracts/amazon-session-probe.md` e `data-model.md`.

## Pré-requisitos
- Branch `001-amazon-cookie-expiry` a partir de `develop`.
- Node com `node --test` disponível.
- Para validação em staging: cookie Amazon real cadastrado no ambiente de staging.

## 1. Testes unitários (node:test, db-free)
```bash
node --test test/converters-amazon.test.js
node --test test/amazon-session-probe-cache.test.js
node --test test/credentials-amazon-session-route.test.js
```
Cenários esperados:
- `checkAmazonSession` devolve `credentialPatch` quando a resposta simulada traz `Set-Cookie` rotacionado; **não** devolve com diretiva de limpeza (valor vazio) nem quando nada mudou (FR-002/FR-010).
- Cache: 2ª chamada dentro da janela TTL retorna cacheado sem sondar; após expiração, sonda de novo (FR-004/SC-003).
- Rota: patch persistido é **cifrado** (começa com `v1:`); transitório (`network_error`) não é persistido como expiração (D-3/FR-007).
- Formatos legado (3 cookies) e cookie completo ambos produzem patch coerente (FR-009).

## 2. Suíte completa (não regredir)
```bash
node --test
```

## 3. Validação em staging (fluxo canônico)
1. PR `001-amazon-cookie-expiry` → `develop` → autodeploy staging (`http://178.105.54.0:3006`).
2. No painel de credenciais Amazon:
   - Abrir/recarregar o painel ~10x em poucos minutos → confirmar no log que houve **1** sondagem efetiva (demais servidas pelo cache), não 10 (SC-003).
   - Confirmar que, após uma conversão bem-sucedida (amzn.to gerado), o `Credential.data` foi atualizado com o token rotacionado (`rotatedCookie:true` no log) e a próxima chamada continua viva (SC-002).
3. Sessão genuinamente expirada continua exibindo aviso "renovar cookies" e ofertas caem no fallback `?tag=` (SC-004/FR-008).
4. Simular resposta 5xx/rede → painel mostra estado indeterminado, **não** "cookies expirados" (SC-006/FR-007).

## 4. Medição antes/depois (SC-001)
- Registrar baseline: frequência de recadastro reportada hoje (horas/poucos dias).
- Após correção, medir em janela representativa de uso real que o tempo até recadastro aumentou de forma mensurável (meta: dias, alinhado à vida natural da sessão).

## 5. Promoção a produção
- Só após validação em staging: PR `develop` → `main` (merge dispara autodeploy prod). Nunca direto para `main`.
