# Implementation Plan: Fallback de vitrine do Mercado Livre quando o SSID está vencido

**Branch**: `007-ml-vitrine-fallback-expired` | **Date**: 2026-07-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/007-ml-vitrine-fallback-expired/spec.md`

## Summary

Hoje o fallback de vitrine própria (feature 004) só é aplicado quando o Mercado
Livre recusa o `createLink` com o motivo `unsupported_url` ("fora do programa").
Quando o motivo é `expired` (SSID/cookie vencido) e o link **já é** uma vitrine
direta de terceiro (`/social/...`), a oferta é jogada fora e o painel sugere
"renovar o SSID" — mensagem enganosa, porque renovar o SSID nunca torna a
vitrine de um terceiro conversível.

A correção é cirúrgica e concentrada em `convertMlCouponWithoutProduct`
(`src/converters/mercadolivre.js`, ~L983-1016): (1) extrair a decisão de o que
fazer diante da recusa do ML para uma **função pura leaf testável**
(`decideVitrineFallback`); (2) passar a aplicar `buildVitrineFallback(creds)`
também no motivo `expired` **quando o link já é vitrine direta**
(`isDirectVitrineShare`); (3) quando é vitrine direta, a falha é `expired`/
`unsupported_url` e não há vitrine própria cadastrada, registrar um **motivo
canônico específico de "vitrine ausente"** (categoria de bloqueio por
configuração) que instrui a cadastrar a vitrine própria e **não** menciona o
SSID; (4) preservar 100% o caminho de produto e o caminho de produto ambíguo via
encurtador (US3, feature-004). Sem migração de banco, memory-neutral.

## Technical Context

**Language/Version**: Node.js (ESM, `type: module`), same runtime as repo

**Primary Dependencies**: nenhuma nova. Reusa `isDirectVitrineShare`,
`buildVitrineFallback`, `isValidMlVitrineUrl` (já em `mercadolivre.js`),
`classifyMlAffiliateFailure`/`buildMlAffiliateError` (motivos `expired` vs
`unsupported_url`), a taxonomia de `src/errorTaxonomy.js` e os tradutores de UI
`dashboard/lib/painel/logsCopy.js` e `dashboard/lib/mobileLogs.js`.

**Storage**: N/A — a vitrine própria já vive em `Credential.data.vitrineUrl`
(sem tabela/coluna nova). **Sem migration** (Assumption da spec + FR sem schema).

**Testing**: `node:test` (`node --test`). Suite existente:
`test/ml-vitrine-fallback.test.js` (contrato da feature 004, será estendida) +
novo teste puro para `decideVitrineFallback`.

**Target Platform**: VPS Linux (staging `~/wabot-staging`, prod `~/wabot`),
pipeline de envio no `bot-worker.js` (modo inline/remote indiferente).

**Project Type**: web (backend Node/Fastify + dashboard Next.js). A mudança é
quase toda no backend; o dashboard só ganha uma linha de tradução de UI.

**Performance Goals**: N/A (caminho de exceção, fora do hot path de produto).

**Constraints**: memory-neutral; **zero regressão** no caminho de produto
(FR-008) e no caminho de produto ambíguo via encurtador (RCA 2026-07-08);
mensagem exibida deve distinguir "falha que o SSID resolve" (produto) de "falha
estrutural que o SSID não resolve" (vitrine de terceiro).

**Scale/Scope**: 5 arquivos no máximo (1 novo leaf module + 4 edições
pontuais), ~2 arquivos de teste.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

O arquivo `.specify/memory/constitution.md` é o template não preenchido (sem
princípios ratificados), portanto não há gates formais do projeto-constituição.
Em substituição, aplicam-se as regras canônicas do `AGENTS.md`, todas
satisfeitas por este plano:

| Regra canônica (AGENTS.md) | Situação neste plano |
|---|---|
| Fluxo `feature → develop → main`, validar em staging | Branch `007-...`; validação de vitrine ML só é conclusiva em staging (clicar o link real). |
| Política de memória — super sinalizar aumento de RAM | **Sem impacto de RAM** (nenhum processo/worker/cache novo; caminho de exceção). |
| Não trocar portas / não mexer em `.env`/banco em prod | Nenhuma mudança de porta/env/schema. |
| Taxonomia canônica de `errorMsg` (`errorTaxonomy.js`) + tradutor | Novo motivo respeita a taxonomia: prefixo `skip:` → categoria `config_block`; tradutor atualizado nos DOIS renderizadores de UI (ver Research D2). |
| Não duplicar lógica de conversão (motor único) | A decisão vira função pura reusável; nenhuma lógica de scrape/converter é duplicada. |

**Resultado do gate**: PASS (sem violações; tabela de Complexity Tracking vazia).

## Project Structure

### Documentation (this feature)

```text
specs/007-ml-vitrine-fallback-expired/
├── plan.md              # Este arquivo (/speckit-plan)
├── research.md          # Phase 0 — decisões (função pura, taxonomia, plumbing)
├── data-model.md        # Phase 1 — entidades lógicas + tabela-verdade da decisão
├── quickstart.md        # Phase 1 — como validar (node:test + staging)
├── contracts/
│   ├── decide-vitrine-fallback.md   # contrato da função pura leaf
│   └── errormsg-vitrine-missing.md  # contrato do novo motivo canônico + tradução
├── checklists/          # (já existente)
└── tasks.md             # Phase 2 (/speckit-tasks — NÃO criado aqui)
```

### Source Code (repository root)

```text
src/
├── converters/
│   ├── mercadolivre.js          # ALVO: convertMlCouponWithoutProduct (~L983-1016)
│   │                            #   - passa a chamar decideVitrineFallback
│   │                            #   - aplica vitrine em 'expired' quando vitrine direta
│   │                            #   - sinaliza motivo canônico 'vitrine ausente'
│   └── mlVitrinePolicy.js        # NOVO (leaf, puro, sem imports pesados):
│                                 #   export decideVitrineFallback({failureType,
│                                 #     isDirectVitrine, hasVitrine}) -> outcome
├── errorTaxonomy.js              # add const/branch documentando skip:ml_vitrine_missing
│                                 #   (categoria config_block; já coberto pelo catch-all skip:)
└── bot-worker.js                 # honra o motivo pré-classificado vindo do converter
                                  #   (grava skip:ml_vitrine_missing / status 'skipped'
                                  #   em vez de error:conversion:)

dashboard/lib/
├── painel/logsCopy.js            # add branch traduzindo skip:ml_vitrine_missing
└── mobileLogs.js                 # add branch equivalente (2º renderizador — não esquecer)

test/
├── ml-vitrine-fallback.test.js   # ESTENDER: novos casos expired+vitrine
└── ml-vitrine-policy.test.js      # NOVO: tabela-verdade pura de decideVitrineFallback
```

**Structure Decision**: Projeto web já existente (backend `src/` + dashboard
Next). A decisão de negócio é isolada num **leaf module novo**
(`src/converters/mlVitrinePolicy.js`) — sem dependências pesadas, testável de
forma pura (padrão já usado no repo: `reconnectPolicy.js`, `couponPolicy.js`,
`monitoredRelayPolicy.js`). Todo o resto são edições pontuais nos arquivos que a
spec/guidance nomearam. Nenhuma estrutura nova de diretórios.

## Complexity Tracking

> Preencher só se o Constitution Check tiver violações a justificar.

Nenhuma violação — tabela intencionalmente vazia.
