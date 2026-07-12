# Phase 1 — Data Model: Entidades de configuração

Esta feature é de tooling/CI; não há entidades de banco. As "entidades" são os
artefatos de configuração versionados e sua estrutura. Mapeamento direto das
*Key Entities* da spec.

## Entidade 1 — Configuração da barreira de import

Arquivo: `.dependency-cruiser.cjs` (CommonJS `module.exports`).

| Campo | Tipo | Descrição | Regra de validação |
|---|---|---|---|
| `forbidden[]` | array de regras | Regras de fronteira proibida | ≥ 3 regras (US1, routes, domain) |
| `forbidden[].name` | string | Slug da regra (`no-src-to-dashboard`, `routes-must-use-manager`, `domain-no-infra`) | kebab-case, único |
| `forbidden[].severity` | `'error'` | Faz `depcruise` sair com exit ≠ 0 | sempre `error` (FR-002/FR-004) |
| `forbidden[].from` | objeto | Origem da aresta (`path`, opcional `pathNot`) | regex ancorada |
| `forbidden[].to` | objeto | Destino da aresta (`path`) | regex |
| `forbidden[].comment` | string | Documenta o porquê da regra e o link ao AGENTS.md | recomendado |
| `options.doNotFollow` | objeto | `{ path: 'node_modules' }` | evita varrer deps |
| `options.tsPreCompilationDeps` | ausente/false | Projeto `src/` é JS puro | — |

### Regras (estado transicional)

| Regra | from.path | to.path | from.pathNot (allowlist) | Estado inicial |
|---|---|---|---|---|
| `no-src-to-dashboard` | `^src/` | `^dashboard/` | os 2 arquivos de baseline | **verde** (2 exceções) |
| `routes-must-use-manager` | `^src/api/routes/` | `src/core/sessionCore\.js$` | — | **verde** (0 violações hoje) |
| `domain-no-infra` | `^src/domain/` | `(@prisma/client\|baileys\|@whiskeysockets/baileys\|ioredis)` | — | **dormante** (`src/domain/` inexistente) |

## Entidade 2 — Allowlist de baseline (dívida conhecida)

Não é arquivo separado; é o campo `from.pathNot` da regra `no-src-to-dashboard`.

| Item | Valor | Ciclo de vida |
|---|---|---|
| Exceção #1 | `src/offerAutomation/dispatcher\.js` | Remover na Etapa 1 |
| Exceção #2 | `src/core/mirrorTemplate\.js` | Remover na Etapa 1 |

**Transição de estado**: `2 exceções → 1 → 0`. Remover uma exceção é apagar uma
linha do `pathNot`; a barreira segue verde mesmo antes da remoção (dependency-cruiser
não falha por exceção não utilizada — cobre o edge case "baseline encolhendo").

**Invariante**: nenhuma exceção nova pode ser adicionada nesta etapa; a lista só
encolhe daqui para frente.

## Entidade 3 — Workflow de CI de qualidade

Arquivo: `.github/workflows/quality-gate.yml`.

| Campo | Valor | Regra |
|---|---|---|
| `on.pull_request.branches` | `[develop, main]` | FR-008 |
| `jobs.quality.runs-on` | `ubuntu-latest` | Assumptions |
| `steps` (ordem) | checkout → setup-node(22) → `npm ci` → `npm test` → `npm run arch:check` | FR-009/FR-012 |
| Falha em qualquer step | job vermelho | FR-009 (merge bloqueado via branch protection) |

**Invariante**: não referencia nem altera `deploy.yml` (FR-011/SC-005).

## Entidade 4 — Livro-razão de acoplamento

Arquivo: `docs/architecture/coupling-ledger.md`.

Estrutura de cada **entrada**:

| Campo | Obrigatório | Descrição |
|---|---|---|
| Data | sim | Quando o elo foi descoberto |
| O que quebrou | sim | Sintoma observado (aparentemente não relacionado) |
| Acoplamento causador | sim | O elo escondido de fato responsável |
| Como foi mitigado | sim | Correção/contenção aplicada |
| Status | recomendado | Aberto / Mitigado / Removido (com referência à etapa) |

**Entrada seed (obrigatória)**: as 2 violações `src/ → dashboard/lib`
(`dispatcher.js` e `mirrorTemplate.js` importando `mobileOfferComposer.js` e
`mobileTemplateStore.js`), marcadas como dívida de baseline a ser removida na
Etapa 1. (FR-015/SC-004)

## Entidade 5 — Manifesto do pacote (edição pontual)

Arquivo: `package.json` (+ `package-lock.json`).

| Mudança | Valor |
|---|---|
| `devDependencies["dependency-cruiser"]` | versão estável (pinned pelo lock) |
| `scripts["arch:check"]` | `depcruise src dashboard/lib --config .dependency-cruiser.cjs` |

**Invariante**: nenhuma mudança em `dependencies` (runtime), `scripts.start`,
`scripts.test`, `postinstall` ou `pretest` — o runtime de produção não muda
(FR-016/FR-017/SC-006/SC-007).
