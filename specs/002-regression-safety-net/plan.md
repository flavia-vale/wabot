# Implementation Plan: Etapa 0 — Rede de segurança contra regressão e acoplamento

**Branch**: `002-regression-safety-net` | **Date**: 2026-07-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-regression-safety-net/spec.md`

## Summary

Instalar uma rede de segurança de CI/qualidade **antes** de qualquer refatoração de
lógica, sem alterar comportamento de produção. Três entregáveis independentes:

1. **Barreira de import** — `dependency-cruiser` (devDependency) + config versionada
   (`.dependency-cruiser.cjs`) declarando as fronteiras proibidas do `AGENTS.md`
   (`src → dashboard`, `src/api/routes → sessionCore`, `src/domain → infra`), com
   allowlist de baseline das 2 violações conhecidas, rodável por `npm run arch:check`.
2. **Merge gate dos testes** — novo workflow GitHub Actions que roda `npm ci` +
   `npm test` + a barreira em PRs contra `develop`/`main`. `deploy.yml` intocado.
3. **Livro-razão de acoplamento** — `docs/architecture/coupling-ledger.md` com
   template de entrada + entrada seed das 2 violações `src/ → dashboard/lib`.

Abordagem técnica: **zero mudança em `src/**/*.js` de runtime**. Todos os artefatos
são devDependency, config estática, YAML de CI e markdown — nada é carregado pelos
processos PM2. A allowlist é expressa como `pathNot` (regex de exclusão) para que
encolher para zero na Etapa 1 seja apenas remover entradas, sem reescrever regra.

## Technical Context

**Language/Version**: Node.js 22.x (runtime local/dev validado: v22.22.2; ESM — `package.json` `type: module`). CI de testes fixa `node-version: 22` para espelhar o dev; a barreira roda no mesmo runner.

**Primary Dependencies**: `dependency-cruiser` (nova devDependency, só CI/dev). Runtime de produção inalterado (Fastify, Baileys, Prisma, BullMQ não são tocados).

**Storage**: N/A para esta etapa. O gate de testes reusa o `pretest` existente (`prisma db push` para `file:/tmp/wabot-test.db`), sem tocar bancos de staging/prod.

**Testing**: `node --test` (suíte existente, ~150 arquivos, `npm test`). Novos scripts, se houver, testáveis com `node:test`. A config da barreira é validada executando `depcruise` contra o repo (verde no baseline, vermelho ao injetar violação).

**Target Platform**: GitHub Actions `ubuntu-latest` (CI); dev local (macOS/Linux). Nenhum artefato roda no VPS de produção.

**Project Type**: Backend Node ESM + dashboard Next.js co-localizado (monorepo raiz). A fronteira `src ↛ dashboard` é exatamente o que a barreira protege.

**Performance Goals**: N/A (tooling de CI). Objetivo operacional: `arch:check` conclui em segundos; o gate de testes não altera tempo de deploy (workflow separado).

**Constraints**: **Invariante dura** — consumo de memória de produção inalterado (FR-017/SC-007); `deploy.yml` byte a byte inalterado (SC-005); nenhum comportamento de `src/**/*.js` de runtime alterado (FR-016/SC-006). `dependency-cruiser` não pode adicionar postinstall pesado (não adiciona) e a config deve ser `.cjs` (projeto é ESM; o config gerado pelo `--init` é CommonJS).

**Scale/Scope**: 3 arquivos novos de config/CI/doc + 2 entradas em `package.json` (`devDependencies` e `scripts`). Escopo de código de runtime tocado: **0 arquivos**.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

O `.specify/memory/constitution.md` é um template não preenchido; na ausência de
constituição formal, os gates são derivados das regras canônicas do `AGENTS.md`
(fonte única de verdade do repo).

| Gate (AGENTS.md) | Status | Nota |
|---|---|---|
| **Política de memória — SUPER SINALIZAR mudança memory-heavy** | ✅ PASS | Nenhum novo processo PM2, worker, cache ou dep de runtime. `dependency-cruiser` é devDependency só de CI/dev. Consumo de prod inalterado (FR-017/SC-007). |
| **Fluxo canônico (branch de `develop`, PR contra `develop`, nunca direto para `main`)** | ✅ PASS | FR-019. Branch `002-regression-safety-net` já parte de `develop`; PR será contra `develop`. |
| **Não alterar comportamento de runtime de produção** | ✅ PASS | FR-016/SC-006. Diff toca só config/CI/doc; suíte existente continua passando sem alterar asserts. |
| **Não trocar portas / não mexer em `.env` ou banco de prod** | ✅ PASS | Nada de portas, envs ou bancos. Gate reusa `pretest` em `/tmp`. |
| **Não alterar `deploy.yml`** | ✅ PASS | FR-011/SC-005. Gate vive em workflow novo separado. |
| **Scripts versionados e testáveis** | ✅ PASS | FR-018. Config versionada; scripts (se houver) com `node:test`. |

**Resultado**: PASS, sem violações. Seção *Complexity Tracking* não se aplica.

## Project Structure

### Documentation (this feature)

```text
specs/002-regression-safety-net/
├── plan.md              # Este arquivo (/speckit-plan)
├── research.md          # Phase 0 — decisões de ferramenta/config/CI
├── data-model.md        # Phase 1 — entidades de config (regras, allowlist, workflow, ledger)
├── quickstart.md        # Phase 1 — como validar a barreira e o gate localmente e no CI
├── contracts/           # Phase 1 — contratos de regra e de check de CI
│   ├── dependency-cruiser-rules.md
│   └── ci-quality-gate.md
└── tasks.md             # Phase 2 (/speckit-tasks — NÃO criado aqui)
```

### Source Code (repository root)

Arquivos **novos** (config/CI/doc) e a única mudança em `package.json`. Nenhum
arquivo de `src/**` de runtime é modificado.

```text
.dependency-cruiser.cjs                     # NOVO — config da barreira (CommonJS; projeto é ESM)
.github/workflows/
├── quality-gate.yml                        # NOVO — npm ci + npm test + arch:check em PRs develop/main
├── backend-lint.yml                        # INTOCADO
└── deploy.yml                              # INTOCADO (byte a byte — SC-005)
docs/architecture/
└── coupling-ledger.md                      # NOVO — livro-razão (template + seed)
package.json                                # EDIT — +devDependency dependency-cruiser, +script arch:check
package-lock.json                           # EDIT — lockfile do dependency-cruiser (devDep)

# Fronteiras que a barreira observa (LIDAS, não modificadas):
src/offerAutomation/dispatcher.js           # baseline violation #1 (allowlisted)
src/core/mirrorTemplate.js                  # baseline violation #2 (allowlisted)
src/api/routes/**                           # regra routes ↛ sessionCore (hoje já limpo)
src/domain/**                               # inexistente — regra dormante (FR-006)
dashboard/lib/mobileOfferComposer.js        # alvo das 2 violações de baseline
dashboard/lib/mobileTemplateStore.js        # alvo das 2 violações de baseline
```

**Structure Decision**: Monorepo Node ESM na raiz com `dashboard/` Next.js
co-localizado. A feature não introduz diretórios de código de runtime; adiciona
apenas 3 artefatos novos (config `.cjs`, workflow YAML, doc markdown) e edita
`package.json`/`package-lock.json`. A config da barreira é `.cjs` deliberadamente
porque o projeto é ESM e o formato gerado por `depcruise --init` é CommonJS.

## Complexity Tracking

> Constitution Check passou sem violações — nada a justificar.
