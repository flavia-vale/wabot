# Implementation Plan: Etapa 0.5 — Smoke list (subconjunto crítico rápido + checklist manual de staging)

**Branch**: `003-smoke-list` | **Date**: 2026-07-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-smoke-list/spec.md`

## Summary

Instalar o **par natural** da barreira de import da Etapa 0: uma checagem rápida
de sanidade que impede comportamento quebrado de passar despercebido. Dois
entregáveis, **sem tocar em runtime de produção**:

1. **Nível 1 — `npm run smoke`**: um novo script no `package.json` que roda, via
   `node --test`, um subconjunto **curado e enumerado explicitamente** de ~26
   arquivos de teste **já existentes** (não a suíte de 176). Replica o padrão de
   env do script `test` (`NODE_ENV=test`, `DATABASE_URL` de teste) e reaproveita
   o mesmo preparo de banco (`presmoke` espelhando `pretest`). Sai com código 0 no
   `develop` atual.
2. **Nível 2 — `docs/testing/regression-checklist.md`**: doc de processo com
   Nível 1 (o que o smoke cobre + como rodar) e Nível 2 (ritual manual de staging
   antes de promover `develop → main`), referenciando os 3 smoke de deploy já
   existentes em `scripts/deploy_safe_staging.sh` e registrando a lição
   "comportamento > regex de source".

Abordagem técnica: nenhuma lógica nova. O trabalho é **seleção + documentação**.
A única superfície executável é o script `smoke`/`presmoke` no `package.json`.

## Technical Context

**Language/Version**: Node.js (CommonESM misto), `node:test` runner nativo — sem framework de teste externo.

**Primary Dependencies**: nenhuma nova. Reusa `node --test` (já usado pelo script `test`) e `prisma db push` (já usado pelo `pretest`).

**Storage**: SQLite de teste em `file:/tmp/wabot-test.db` (mesmo caminho e mecanismo do `test`/`pretest` atuais). Não toca `prisma/staging.db` nem `prisma/prod.db`.

**Testing**: `node --test --test-concurrency=1` sobre uma lista explícita de arquivos; subconjunto de `test/**/*.test.js`.

**Target Platform**: dev local / CI. **Nunca** roda em produção — sem impacto de RAM no VPS.

**Project Type**: adição de tooling/doc a um serviço web existente (single repo). Sem novo diretório de código.

**Performance Goals**: tempo de parede substancialmente menor que `npm test` (~26 de 176 arquivos, ~15%). Determinístico (lista fixa, `--test-concurrency=1` como no `test`).

**Constraints** (canônicas, AGENTS.md): não alterar `src/`, testes existentes, `.env`, banco, portas ou `deploy.yml`; não aumentar memória de runtime; branch a partir de `develop`, PR contra `develop`.

**Scale/Scope**: 2 arquivos tocados — `package.json` (+2 scripts) e `docs/testing/regression-checklist.md` (novo).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

O `.specify/memory/constitution.md` é um template não preenchido. Conforme a
instrução do pipeline e o AGENTS.md, o **Constitution Check usa o AGENTS.md como
fonte canônica de regras**. Gates avaliados:

| Regra canônica (AGENTS.md) | Status | Observação |
|---|---|---|
| Sem mudança de runtime de produção (`src/` intocado) | ✅ PASS | Só `package.json` (novo script) + doc. FR-012. |
| Sem aumento de memória de runtime (SUPER SINALIZAR) | ✅ PASS | Smoke roda em dev/CI, nunca em prod. Nada a sinalizar. FR-013. |
| Fluxo `feature → develop` (PR contra `develop`, nunca `main`) | ✅ PASS | Branch `003-smoke-list` sai de `develop`. FR-014. |
| Não tocar `deploy.yml` nem scripts de deploy | ✅ PASS | Doc apenas **referencia** os smoke de `deploy_safe_staging.sh`. FR-010. |
| Não trocar portas / `.env` / banco de prod | ✅ PASS | Env de teste isolada (`file:/tmp/wabot-test.db`), igual ao `test`. |
| Não alterar testes existentes (apenas selecioná-los) | ✅ PASS | FR-012. |

**Resultado: PASS, sem violações.** Complexity Tracking não se aplica.

## Project Structure

### Documentation (this feature)

```text
specs/003-smoke-list/
├── plan.md              # This file (/speckit-plan)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (entidades de curadoria, não de runtime)
├── quickstart.md        # Phase 1 output (como validar o smoke)
├── contracts/
│   └── smoke-cli.md     # Contrato do "comando" npm run smoke (CLI-like)
└── tasks.md             # Phase 2 (/speckit-tasks — NÃO criado aqui)
```

### Source Code (repository root)

Nenhum arquivo de código-fonte é criado ou alterado. Os únicos artefatos de
implementação vivem fora de `src/`:

```text
package.json                          # + "smoke" e "presmoke" scripts (única mudança executável)
docs/
└── testing/
    └── regression-checklist.md       # NOVO doc de processo (Nível 1 + Nível 2)

# Arquivos SELECIONADOS (não modificados) pelo smoke — já existem:
test/reconnect-policy.test.js
test/session-persistence-policy.test.js
test/supervisor-env-guard.test.js
test/ops-mode-regression-guard.test.js
test/env-modes.test.js
test/message-dedup.test.js
test/core/global-dedup.test.js
test/core/mirror-dedup-key.test.js
test/coupon-dedup-window.test.js
test/offer-automation.test.js
test/converters-amazon.test.js
test/shopee-affiliate-info.test.js
test/shopee-shortlink-resolve.test.js
test/mercadolivre-resolve.test.js
test/mobile-converter.test.js
test/send-queue-backend.test.js
test/send-queue-backend-dlq.test.js
test/credential-crypto.test.js
test/auth.test.js
test/auth-rate-limit.test.js
test/payments-webhook.test.js
test/payments-service.test.js
test/group-entitlements.test.js
test/groups-route-image-mode.test.js
test/bot-worker-retry-cache-wiring.test.js
test/core/worker-spawn-options.test.js
```

**Structure Decision**: Single repo, sem novo módulo. A feature adiciona apenas
tooling (`package.json` scripts) e documentação (`docs/testing/`). A lista de
testes é **enumerada explicitamente** no script — ver decisão em `research.md`.

## Decisões técnicas registradas (obrigatório pela demanda)

### D1 — Enumeração explícita vs. glob

**Decisão: enumeração explícita** da lista de arquivos no script `smoke`, **não**
glob. Motivos:

- **FR-007 / edge case "arquivo renomeado"**: com uma lista explícita, se um
  caminho deixar de existir, `node --test <path-inexistente>` **falha de forma
  visível** (erro "Could not find …" / exit ≠ 0) em vez de silenciosamente
  reduzir o conjunto — que é o que um glob (`test/critical/**`) faria. O smoke
  precisa gritar quando a lista dessincroniza da suíte.
- **Curadoria humana e versionada** (Assumption da spec): "quais testes são
  críticos" é decisão de manutenção, não descoberta automática. A lista
  explícita no `package.json` é o registro versionado dessa curadoria e aparece
  em code review quando muda.
- **Determinismo**: ordem e conjunto fixos; nenhuma dependência de layout de
  diretório ou de o que um glob varre hoje. Combinado com `--test-concurrency=1`
  (herdado do `test`), a execução é reproduzível.

Alternativa rejeitada (glob por convenção, ex.: mover os 26 para
`test/smoke/`): exigiria **mover/alterar arquivos de teste existentes**,
violando FR-012 ("apenas os SELECIONA"). Descartada.

### D2 — Rápido e determinístico

- **Rápido**: ~26 de 176 arquivos (~15%). O subconjunto é majoritariamente de
  testes **puros** (db-free) — política/converter/dedup/env-guard — o que domina
  o ganho de tempo. Sem paralelismo novo (mantém `--test-concurrency=1` do
  `test` para não introduzir flakiness por concorrência).
- **Determinístico**: lista fixa; env fixa (`NODE_ENV=test`,
  `DATABASE_URL=file:/tmp/wabot-test.db`); `presmoke` reseta o banco de teste
  **do zero** (mesmo comando do `pretest`) para que os poucos testes que tocam DB
  (auth, payments, group-entitlements/route, offer-automation) sempre encontrem
  o schema esperado e o smoke saia verde de forma repetível — cumprindo o edge
  case "teste do subconjunto exige banco" sem inventar mecanismo novo.

### D3 — Env e preparo de banco (replicar o script `test`)

Script `test` atual:
```
pretest: rm -f /tmp/wabot-test.db*; NODE_ENV=test DATABASE_URL="file:/tmp/wabot-test.db" prisma db push --skip-generate --force-reset
test:    NODE_ENV=test DATABASE_URL="file:/tmp/wabot-test.db" node --test --test-concurrency=1 test/*.test.js test/**/*.test.js
```
O smoke espelha exatamente esse padrão de env e reaproveita o preparo de banco
via um `presmoke` idêntico ao `pretest` (npm roda `pre<script>` automaticamente),
trocando só a **lista de arquivos** (enumeração curada) no lugar do glob
`test/*.test.js test/**/*.test.js`.

## Complexity Tracking

Sem violações de Constitution Check. Seção não aplicável.
