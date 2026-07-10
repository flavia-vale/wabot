# Implementation Plan: Fixar modo de imagem da oferta em "Preview clicável do WhatsApp"

**Branch**: `claude/speckit-flow-image-default-0bdady` | **Date**: 2026-07-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-image-mode-preview-default/spec.md`

## Summary

Remover o seletor "Imagem da oferta" (`imageMode`) de `/painel/grupos` e fixar o
comportamento de toda oferta espelhada no modo `preview` ("Preview clicável do
WhatsApp"). A abordagem técnica é **defesa em profundidade em um único chokepoint**
(`resolveGroupEntitlements` em `src/billing/groupEntitlements.js`), que hoje já é a
função por onde todo grupo monitorado passa para virar `cfg` do worker: ela deixa
de propagar o `imageMode` histórico e passa a devolver sempre `'preview'`. Assim,
mesmo que a migração de dados deixe algum resíduo (nulo/legado) na coluna, o
pipeline nunca cai em `fetch`/`original`/`none` (FR-009). A coluna `imageMode`
**permanece no schema** (migração graciosa + defesa em profundidade), a migração de
dados normaliza os valores existentes para `preview`, o default de criação vira
`preview`, o bloco de UI some do painel, e os ramos de extração de imagem
(scrapers hi-res, buffers, relay de mídia original) ficam **dormentes com
comentário claro** — não são apagados (FR-006).

## Technical Context

**Language/Version**: Node.js (ESM), Next.js (dashboard) — versões do repo, sem mudança.

**Primary Dependencies**: Fastify (API), Prisma (ORM), SQLite (WAL), Baileys
(WhatsApp), React/Next (painel). Nenhuma dependência nova.

**Storage**: SQLite via Prisma. Tabela `Group`, coluna `imageMode String @default("none")`.

**Testing**: `node:test` (backend, `test/*.test.js`). Suites relevantes:
`test/group-entitlements.test.js`, `test/bot-worker-manual-link-preview-channel.test.js`,
`test/image-scrapers.test.js` (deve permanecer verde — código dormante preservado).

**Target Platform**: VPS Linux (PM2). Staging (`develop`) → Produção (`main`).

**Project Type**: Web (backend Fastify + worker Baileys + dashboard Next.js) — monorepo único.

**Performance Goals**: Sem mudança de performance. Nenhum novo scrape/fetch é
introduzido; ao contrário, `preview` é o caminho mais leve (não baixa buffer hi-res
por padrão).

**Constraints** (canônicos do AGENTS.md, todos aplicáveis):
- Migração graciosa: validar em **staging antes de prod**; **backup de prod** antes
  de rodar; cuidado com **SQLITE_BUSY/WAL** (parar API se DDL — aqui é só DML `UPDATE`,
  que convive com WAL, mas mesmo assim seguir o fluxo do deploy).
- **Não quebrar** pipeline de envio, dedup, taxonomia de `MessageLog.errorMsg`,
  status de `MessageLog`.
- Migration Prisma **não-destrutiva**: só `UPDATE` de coluna, nunca `DROP`/zera dados.
- Fluxo `feature → develop (staging) → main (prod)`; nunca direto para `main`.

**Scale/Scope**: Base atual de grupos monitorados por usuário (dezenas de sessões).
Mudança pontual: 1 migration SQL, 1 chokepoint backend, 1 default de criação, 1
validação de rota, 1 bloco de UI removido, documentação.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

O arquivo `.specify/memory/constitution.md` é um template não ratificado (placeholders
`[PRINCIPLE_x]`). Não há princípios formais a validar. **Gate substituto: as regras
canônicas do `AGENTS.md`** (fonte única de verdade do repo), tratadas como
constituição de fato:

| Regra canônica (AGENTS.md) | Status neste plano |
|---|---|
| Migração graciosa validada em staging antes de prod | PASS — plano exige validação em staging antes do PR `develop→main` |
| Migration Prisma não-destrutiva (não zera dados) | PASS — só `UPDATE` idempotente de `imageMode` |
| Backup de prod antes de migração | PASS — `scripts/backup_prod.sh` no runbook |
| Não quebrar envio/dedup/taxonomia/status `MessageLog` | PASS — nenhuma escrita em `MessageLog` alterada; só a fonte da imagem |
| SUPER SINALIZAR mudança que aumente RAM | PASS — `preview` reduz uso (sem buffer hi-res); nenhum novo processo/heap |
| Não remover código de extração (dormante/preservado) | PASS — ramos mantidos, comentados como desativados |
| Fluxo feature → develop → main | PASS — branch de trabalho já em `claude/speckit-flow-image-default-0bdady` |

Nenhuma violação. Sem entradas em Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/001-image-mode-preview-default/
├── plan.md              # Este arquivo (/speckit-plan)
├── research.md          # Fase 0 — decisões técnicas
├── data-model.md        # Fase 1 — entidade Group / imageMode
├── quickstart.md        # Fase 1 — roteiro de validação (staging→prod)
├── contracts/
│   └── image-mode-behavior.md   # Contrato de comportamento (API + pipeline)
└── tasks.md             # Fase 2 (/speckit-tasks — não criado aqui)
```

### Source Code (repository root)

Arquivos concretos tocados por esta feature (todos já existentes):

```text
prisma/
├── schema.prisma                                   # imageMode @default: "none" → "preview"
└── migrations/
    └── 20260710xxxxxx_group_image_mode_default_preview/
        └── migration.sql                           # NOVO: UPDATE idempotente p/ 'preview'

src/
├── billing/groupEntitlements.js                    # CHOKEPOINT: imageMode efetivo → sempre 'preview' (defesa em profundidade, FR-009)
├── api/routes/groups.js                            # default de criação → 'preview'; validação de imageMode mantida (dormante)
├── bot-worker.js                                   # ramos fetch/original/none: comentar como dormantes (preservados, FR-006)
└── monitoredRelayPolicy.js                         # relay de mídia original: dormante (nunca acionado com preview), comentado

dashboard/
└── app/painel/grupos/page.js                       # remover o bloco CfgRow "Imagem da oferta" (FR-004)

test/
├── group-entitlements.test.js                      # ajustar/adicionar: imageMode efetivo sempre 'preview'
├── bot-worker-manual-link-preview-channel.test.js  # confirmar caminho preview intacto
└── image-scrapers.test.js                          # DEVE permanecer verde (código dormante preservado)

AGENTS.md / docs/                                   # documentar a decisão (FR-007)
```

**Structure Decision**: Monorepo web único (backend `src/` + dashboard `dashboard/`).
A mudança é cirúrgica e concentra a garantia de comportamento em **um chokepoint**
(`groupEntitlements.js`), evitando espalhar a coerção `→ preview` por múltiplos
call-sites do `bot-worker.js`. Os call-sites do worker que hoje ramificam por
`imageMode` continuam existindo (dormentes), mas nunca recebem valor diferente de
`preview` porque o `cfg` já chega normalizado.

## Complexity Tracking

*Sem violações de gate. Nada a justificar.*
