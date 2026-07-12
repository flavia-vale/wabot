# Contrato — Workflow de CI de qualidade (`.github/workflows/quality-gate.yml`)

Contrato observável do gate: dado um evento de PR, o workflow roda a suíte e a
barreira e reporta um status de check que bloqueia (ou libera) o merge.

## Gatilho

```yaml
on:
  pull_request:
    branches: [develop, main]
```

## Sequência de steps (job único `quality`, `ubuntu-latest`)

1. `actions/checkout@v4`
2. `actions/setup-node@v4` com `node-version: 22`
3. `npm ci`   — dispara `postinstall` (`prisma generate`) existente
4. `npm test` — dispara `pretest` (`prisma db push` para `file:/tmp/wabot-test.db`) + `node --test`
5. `npm run arch:check` — barreira de import (FR-012)

## Casos de contrato

| # | Cenário | Resultado esperado | FR / SC |
|---|---|---|---|
| G1 | PR contra `develop`, todos os testes passam, baseline limpo | check **verde** | FR-008/FR-009, SC-003 |
| G2 | PR onde ≥ 1 teste da suíte falha | check **vermelho** (job falha no step `npm test`) | FR-009, SC-003 |
| G3 | PR que introduz violação de fronteira | check **vermelho** (job falha no step `arch:check`) | FR-012, SC-002 |
| G4 | PR contra `main` | workflow dispara igualmente | FR-008 |
| G5 | Qualquer PR | `deploy.yml` não é executado nem alterado por este workflow | FR-011, SC-005 |

## Invariantes de não-regressão

- Arquivo **novo**; não edita `deploy.yml` (SC-005 — `deploy.yml` byte a byte
  inalterado; sha256 baseline registrado no plano) nem `backend-lint.yml`.
- Nenhum step toca banco de staging/prod — o gate usa `/tmp/wabot-test.db` via o
  `pretest` já existente.
- Nenhum artefato do workflow roda no runtime PM2 de produção (SC-007).
- A marcação do check como *required* (branch protection) é ato de configuração
  no GitHub, fora deste arquivo (Assumptions da spec).
