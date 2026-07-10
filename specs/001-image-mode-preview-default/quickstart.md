# Quickstart — Validação da fixação de `imageMode` em `preview`

Roteiro de validação end-to-end. Segue o fluxo canônico do AGENTS.md:
`feature → develop (staging) → main (prod)`, com backup de prod antes da migração.

## Pré-requisitos

- Branch de trabalho: `claude/speckit-flow-image-default-0bdady`.
- Suite `node:test` verde localmente antes de abrir PR.

## 1. Testes unitários (local / CI)

```bash
node --test test/group-entitlements.test.js \
            test/bot-worker-manual-link-preview-channel.test.js \
            test/image-scrapers.test.js
```

**Esperado**:
- `group-entitlements`: `imageMode` efetivo é `'preview'` para qualquer valor de
  entrada (incluindo nulo/legado). (INV-1)
- `bot-worker-manual-link-preview-channel`: caminho `preview` intacto.
- `image-scrapers`: **verde** — código de extração dormante preservado (SC-005).

## 2. Migração de dados (idempotência) — base de teste

```bash
# Semear grupos em todos os modos e rodar a migração 2x
sqlite3 <db-teste> "SELECT imageMode, COUNT(*) FROM \"Group\" GROUP BY imageMode;"
npx prisma migrate deploy
npx prisma migrate deploy   # 2ª vez: idempotente
sqlite3 <db-teste> "SELECT imageMode, COUNT(*) FROM \"Group\" GROUP BY imageMode;"
```

**Esperado**: após a migração, 100% das linhas com `imageMode = 'preview'`; rodar
2x não muda nada e não lança erro. (FR-002, AC-2, SC-001)

## 3. Painel (`/painel/grupos`)

- Abrir a configuração de qualquer grupo → o bloco "Imagem da oferta" **não
  aparece**. (FR-004, SC-003)
- Salvar outra config (ex.: destinos, palavras bloqueadas) → salva normalmente; o
  grupo mantém `imageMode = 'preview'`. (US3-AC2)

## 4. Novo grupo nasce em `preview`

```bash
sqlite3 <db> "SELECT imageMode FROM \"Group\" ORDER BY id DESC LIMIT 1;"  # após criar 1 grupo no painel
```

**Esperado**: `preview`. (FR-003, SC-002)

## 5. Envio real (staging)

- Grupo que **antes** estava em `fetch`/`original`/`none`: disparar uma oferta
  elegível → sai como **card de preview clicável** (foto do produto no card, título
  e preço no texto, clique abre o link). (US1-AC1/AC2)
- Grupo que já estava em `preview`: comportamento idêntico ao de hoje (sem
  regressão). (US1-AC3)
- Conferir em `/dashboard/logs` que `MessageLog.status`/`errorMsg` e o card de
  dedup continuam coerentes (sem regressão). (FR-005, SC-004)

## 6. Promoção a produção (após staging aprovado)

```bash
# 1. Backup de prod ANTES da migração
scripts/backup_prod.sh
# 2. PR develop → main → autodeploy roda `prisma migrate deploy` em ~/wabot
# 3. Pós-deploy: conferir que nenhum grupo ficou fora de 'preview'
sqlite3 ~/wabot/prisma/prod.db "SELECT imageMode, COUNT(*) FROM \"Group\" GROUP BY imageMode;"
```

**Esperado**: só `preview`; login/painel/envio de ofertas seguem normais. (US2-AC3)

## 7. Documentação (FR-007)

Confirmar que `AGENTS.md` e/ou `docs/` registram: a decisão de fixar `preview`, o
motivo, e que o código de extração das outras fontes ficou **dormante/preservado**
para reativação futura.
