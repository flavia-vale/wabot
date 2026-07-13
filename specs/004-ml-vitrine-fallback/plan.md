# Implementation Plan: Fallback de vitrine do Mercado Livre não usado apesar de vitrine cadastrada

**Branch**: `004-ml-vitrine-fallback` | **Date**: 2026-07-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-ml-vitrine-fallback/spec.md`

## Summary

Corrigir o caso em que uma oferta do Mercado Livre cujo link é uma vitrine/perfil
de terceiro (não convertível em link de afiliado) é marcada como **"ignorado"** no
painel, apesar de a usuária ter uma vitrine própria (`vitrineUrl`) cadastrada — e
apesar de o painel exibir simultaneamente a mensagem contraditória "A oferta saiu
usando o link da SUA vitrine".

Abordagem técnica: a lógica de fallback de vitrine já existe em
`src/converters/mercadolivre.js` (`buildVitrineFallback`, `isValidMlVitrineUrl`,
`isDirectVitrineShare`, consumidas em `convertMlCouponWithoutProduct`). O trabalho
é (1) **confirmar em produção** qual ramo realmente executou no incidente de
12/07/2026 21:14 (investigação obrigatória, sem suposição), e (2) corrigir a causa
raiz confirmada sem regredir os caminhos de produto. A hipótese técnica principal
já mapeada no código é o **desacoplamento entre a linha de warning e a linha de
status**: `bot-worker.js` grava uma linha `MessageLog` separada com
`errorMsg='warning:ml_vitrine_fallback_used'` (copy "a oferta saiu usando sua
vitrine") assim que o conversor devolve `warning='ml_vitrine_fallback_used'`,
enquanto o envio real pode ainda ser barrado a jusante (title mismatch, dedup,
etc.) e gerar uma linha `status='skipped'` ("ignorado") — produzindo as duas
linhas contraditórias que a cliente viu. A investigação em prod decide entre esta
hipótese e as alternativas (vitrine não chegou nas `creds`; `vitrineUrl` reprovado;
ramo `isDirectVitrineShare` descartou antes).

## Technical Context

**Language/Version**: Node.js (ESM), conforme repo (`type: module`); testes via
`node --test`.

**Primary Dependencies**: `@whiskeysockets/baileys` (^6.7.23) para a sessão WA;
Prisma + SQLite (WAL) para persistência; `src/converters/mercadolivre.js`
(conversão/afiliado ML); `src/bot-worker.js` (pipeline de envio e escrita de
`MessageLog`); `dashboard/lib/painel/logsCopy.js` + `dashboard/lib/mobileLogs.js`
(tradução de `errorMsg` → texto exibido ao usuário).

**Storage**: SQLite (`prisma/prod.db` / `prisma/staging.db`). `Credential.data`
cifrado AES-256-GCM (D-3) — o `vitrineUrl` vive nesse blob JSON, campo
`vitrineUrl`, junto das demais credenciais ML (sem tabela/migration nova).
`MessageLog` guarda `status`, `errorMsg` (taxonomia canônica), `originalUrl`,
`convertedUrl`.

**Testing**: `node --test` (arquivos em `test/`). Alvos existentes relevantes:
`test/mercadolivre-resolve.test.js`. Novo teste de regressão a criar para o
fallback de vitrine e para a coerência mensagem×status.

**Target Platform**: Linux server (VPS x86). Prod `~/wabot` (branch `main`),
staging `~/wabot-staging` (branch `develop`), ambos PM2.

**Project Type**: Serviço web/worker (backend Node + dashboard Next.js). Correção
concentrada no backend (conversor + pipeline de log); ajuste possível de copy no
dashboard.

**Performance Goals**: N/A — correção de comportamento, não de desempenho. Sem
impacto de memória (nenhum processo/worker novo, nenhum buffer adicional — respeita
a Política de memória do AGENTS.md).

**Constraints**:
- Invariante de segurança canônica: o link original de terceiro **NUNCA** é
  encaminhado (só a vitrine própria ou descarte seguro).
- Zero falso positivo: link de **produto** conversível nunca é substituído pela
  vitrine (FR-002/FR-005).
- Mensagem exibida ao usuário **coerente** com o desfecho real (FR-004).
- Fluxo canônico feature → develop → autodeploy staging → validação → main (FR-009).

**Scale/Scope**: Correção pontual. Arquivos-núcleo: `src/converters/mercadolivre.js`
e/ou `src/bot-worker.js` (acoplamento warning×status), possivelmente
`dashboard/lib/painel/logsCopy.js` / `dashboard/lib/mobileLogs.js` (copy). Escopo de
teste: 1 novo arquivo `node:test` cobrindo os dois eixos (vitrine usada / produto
não substituído / mensagem coerente).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

O arquivo `.specify/memory/constitution.md` está no estado de template não
preenchido (placeholders `[PRINCIPLE_x]`) — **não há princípios ratificados que
imponham gates automáticos**. Na ausência de constituição formal, aplicam-se as
regras canônicas do `AGENTS.md` como gates de fato:

- ✅ **Fluxo de branches**: feature → develop → staging → main (FR-009). Não abrir PR
  direto para `main`, não fazer amend em commits mergeados.
- ✅ **Memória**: nenhuma mudança memory-heavy (sem novo processo/worker/cache/
  dependência pesada). Não exige SUPER SINALIZAR.
- ✅ **Invariante de segurança do conversor**: link de terceiro nunca encaminhado —
  preservada por construção (FR-003).
- ✅ **Não regredir caminhos de produto** do `mercadolivre.js` (FR-005) e o
  `[PROTECTED_CORE]` do pipeline não é tocado sem necessidade.
- ✅ **Taxonomia de `MessageLog.errorMsg`**: qualquer novo/ajustado prefixo passa por
  `classifyError()`/`categorizeErrorMsg()` e pelo tradutor de copy — sem inventar
  prefixo fora da taxonomia.
- ✅ **Diagnóstico com dados reais** antes do fix (FR-008): investigação obrigatória
  em produção documentada em `research.md`.

Nenhuma violação a justificar → **Complexity Tracking vazio**.

## Project Structure

### Documentation (this feature)

```text
specs/004-ml-vitrine-fallback/
├── plan.md              # Este arquivo (/speckit-plan)
├── research.md          # Fase 0 — investigação em prod + decisão de causa raiz
├── data-model.md        # Fase 1 — entidades e campos envolvidos
├── quickstart.md        # Fase 1 — guia de validação (staging + testes)
├── contracts/
│   └── vitrine-fallback.md   # Contrato interno das funções de fallback e do log
├── checklists/          # (pré-existente)
└── tasks.md             # Fase 2 (/speckit-tasks — NÃO criado aqui)
```

### Source Code (repository root)

```text
src/
├── converters/
│   └── mercadolivre.js        # buildVitrineFallback / isValidMlVitrineUrl /
│                              # isDirectVitrineShare / convertMlCouponWithoutProduct
│                              # / convert()  ← núcleo do fallback de vitrine
├── credentialHealth.js        # leitura/validação de vitrineUrl no Credential.data
└── bot-worker.js              # pipeline de envio: grava linha warning
                               # (errorMsg='warning:ml_vitrine_fallback_used') e a
                               # linha de status final — ponto do desacoplamento

dashboard/
└── lib/
    ├── painel/logsCopy.js     # tradução errorMsg → texto exibido (copy da vitrine)
    └── mobileLogs.js          # idem, versão mobile

test/
├── mercadolivre-resolve.test.js        # cobertura existente do conversor
└── ml-vitrine-fallback.test.js         # NOVO — regressão dos dois eixos (a criar)
```

**Structure Decision**: Projeto único existente (backend Node + dashboard Next).
Nenhuma estrutura nova é criada. A correção é cirúrgica sobre os arquivos já
listados; o único arquivo novo é o teste de regressão em `test/`. Os caminhos acima
são reais e já verificados no repositório.

## Complexity Tracking

> Nenhuma violação de gate — seção intencionalmente vazia.
