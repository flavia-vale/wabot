# Implementation Plan: Blindar escrita de MessageLog contra crash em loop do bot-worker

**Branch**: `006-worker-crash-log-safety` | **Date**: 2026-07-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-worker-crash-log-safety/spec.md`

## Summary

Corrigir a perda de mensagens causada por crash em loop do `bot-worker`. Duas
correções complementares, ambas P1:

1. **Sanitização segura de texto (causa raiz).** `sanitizeMessageForLog` trunca
   por code unit UTF-16 (`raw.slice(0, N)`), o que parte pares surrogate de emoji
   ao meio e deixa um surrogate solto no texto — o Prisma rejeita a escrita com
   `unexpected end of hex escape`. Passar a truncar por code point e remover
   surrogates soltos + caracteres de controle/`NUL`.
2. **Defesa em profundidade.** Envolver o `db.messageLog.create()` do caminho de
   broadcast/relay (handler `type: 'broadcast'`, ~linha 3636 de
   `src/bot-worker.js`) em tratamento de erro local, para que qualquer falha
   futura de escrita de log nunca vire `unhandledRejection` → `process.exit(1)`
   do crash-guard → descarte da fila de envio em memória (`QUEUE_BACKEND=memory`).

Abordagem técnica: extrair a lógica pura de sanitização para um módulo leaf
importável (`src/messageLogSanitizer.js`) para que o requisito de teste unitário
(FR-008) execute a função de verdade — `bot-worker.js` não é importável em teste
(faz `import 'dotenv/config'` e conecta ao WhatsApp no load). `bot-worker.js`
passa a importar `sanitizeMessageForLog` desse módulo, preservando o mesmo nome e
assinatura em todos os ~14 call-sites atuais.

## Technical Context

**Language/Version**: Node.js (ESM, `import`/`export`), mesmo runtime dos demais módulos do repo.

**Primary Dependencies**: Prisma Client (SQLite, `src/db.js`), `@whiskeysockets/baileys` (contexto do worker; não tocado). Nenhuma dependência nova.

**Storage**: SQLite via Prisma (`MessageLog`). Sem migration — nenhuma mudança de schema.

**Testing**: `node:test` + `node:assert/strict` (suíte existente em `test/`). Novo teste unitário puro para o sanitizador.

**Target Platform**: Linux server (VPS), processo `bot-worker` forkado por `api`/`bot-supervisor`.

**Project Type**: Single project (backend Node monolito com dashboard Next à parte — não afetado).

**Performance Goals**: Sanitização O(n) no comprimento do texto (limite 240 chars por default), custo desprezível; sem impacto no throughput de envio.

**Constraints**: Não aumentar uso de memória (política canônica do `AGENTS.md` — esta correção é memory-neutral). Não alterar `MESSAGE_LOG_MAX_CHARS`, portas, ou outros caminhos de log fora do handler de broadcast/relay (NG-003). Não migrar `QUEUE_BACKEND` (NG-001).

**Scale/Scope**: ~2 arquivos de código (`src/messageLogSanitizer.js` novo + edições em `src/bot-worker.js`) + 1 arquivo de teste novo. Zero mudança de dados.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

O arquivo `.specify/memory/constitution.md` é o template não preenchido (sem
princípios ratificados), portanto não há gates formais a avaliar. Em vez disso,
aplicam-se as regras canônicas do `AGENTS.md`, todas satisfeitas por este plano:

- **Memória (Regra #1/#2/#3)**: correção memory-neutral — não cria processo,
  worker, cache nem aumenta heap. Nenhuma sinalização de RAM necessária. ✅
- **Fluxo de entrega**: branch → PR contra `develop` → staging → `develop`→`main`.
  Nenhuma troca de porta. ✅
- **Banco/migrations**: nenhuma migration; escrita em `MessageLog` inalterada em
  schema. Pegadinha #8 (lock DDL) não se aplica. ✅
- **Não regredir taxonomia de `errorMsg`**: o caminho de erro do broadcast já usa
  `classifyError`; o try/catch novo não inventa prefixo novo. ✅

**Resultado do gate**: PASS (sem violações; Complexity Tracking vazio).

## Project Structure

### Documentation (this feature)

```text
specs/006-worker-crash-log-safety/
├── plan.md              # Este arquivo (/speckit-plan)
├── research.md          # Phase 0 — decisões técnicas
├── data-model.md        # Phase 1 — entidade MessageLog (referência, sem mudança de schema)
├── quickstart.md        # Phase 1 — como validar a correção
├── checklists/          # (pré-existente)
└── tasks.md             # Phase 2 (/speckit-tasks — NÃO criado aqui)
```

Sem diretório `contracts/`: a feature é interna (função pura + handler de
processo), não expõe nenhuma interface HTTP/CLI/externa nova.

### Source Code (repository root)

```text
src/
├── messageLogSanitizer.js     # NOVO — módulo leaf, puro/testável:
│                              #   sanitizeMessageForLog() com truncagem por
│                              #   code point + remoção de surrogate solto e
│                              #   caracteres de controle/NUL. Exporta também
│                              #   MESSAGE_LOG_MAX_CHARS (lido de env).
├── bot-worker.js              # EDITADO —
│                              #   (a) remove a def local de
│                              #       sanitizeMessageForLog/MESSAGE_LOG_MAX_CHARS
│                              #       e passa a importar do módulo novo;
│                              #   (b) envolve o db.messageLog.create() do handler
│                              #       type:'broadcast' (~L3636) em try/catch local
│                              #       que loga e degrada sem derrubar o worker.
└── db.js                      # NÃO alterado (referência do call-site de create)

test/
└── message-log-sanitizer.test.js  # NOVO — unitário puro (node:test):
                                    #   corte no meio de par surrogate de emoji,
                                    #   remoção de controle/NUL, limite de chars,
                                    #   entradas null/vazio/não-string.
```

**Structure Decision**: Projeto único (monolito Node em `src/`, testes em
`test/`). A única decisão estrutural relevante é extrair a função de sanitização
para um **módulo leaf** (`src/messageLogSanitizer.js`) sem imports pesados, para
que o teste unitário exigido por FR-008/SC-004 execute a lógica real em vez de
depender do padrão estrutural de grep-de-source (usado quando algo só existe
dentro do `bot-worker.js` não importável). `bot-worker.js` continua sendo o dono
do handler de broadcast e de todos os call-sites de `sanitizeMessageForLog`.

## Complexity Tracking

> Sem violações de constituição. Nada a justificar.
