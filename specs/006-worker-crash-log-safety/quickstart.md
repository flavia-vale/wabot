# Quickstart — Validação da correção

Guia de validação end-to-end. Referências de contrato/estrutura em
[data-model.md](./data-model.md) e [plan.md](./plan.md).

## Pré-requisitos

- Node.js instalado, dependências já resolvidas (`npm ci` na raiz, se necessário).
- Nenhuma env especial: o sanitizador usa `MESSAGE_LOG_MAX_CHARS` (default 240).

## 1. Teste unitário do sanitizador (US1 / FR-008 / SC-004)

Roda a lógica pura de sanitização, incluindo o caso do corte no meio de um par
surrogate de emoji.

```bash
node --test test/message-log-sanitizer.test.js
```

**Esperado**: todos os casos passam:

- Corte exatamente entre os dois code units de um emoji → retorno **sem
  surrogate solto** e **dentro do limite** de chars.
- Texto com `NUL`/controle → esses caracteres **removidos** do retorno.
- Texto de emojis multi-byte → truncagem conta **por code point**.
- `null` / `''` / não-string → retorna `''` **sem lançar**.

Sanidade rápida sem arquivo de teste (opcional):

```bash
node -e "import('./src/messageLogSanitizer.js').then(({sanitizeMessageForLog})=>{const s='a'.repeat(239)+'😀';const out=sanitizeMessageForLog(s);const lone=/[\uD800-\uDFFF]/.test(out.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g,''));console.log('lone surrogate?',lone);})"
# Esperado: lone surrogate? false
```

## 2. Suíte existente continua verde (SC-004)

```bash
node --test
```

**Esperado**: suíte inteira passa (nenhum call-site de `sanitizeMessageForLog`
quebrado pela extração do módulo).

## 3. Defesa em profundidade do broadcast (US2 / FR-006/FR-007)

Validação de que uma falha de `db.messageLog.create()` no handler de broadcast é
capturada localmente e não encerra o worker nem descarta a fila em memória.

- **Unitário/estrutural**: confirmar que o `db.messageLog.create()` do handler
  `type:'broadcast'` (~L3636 de `src/bot-worker.js`) está dentro de `try/catch`
  e que o catch loga sem `process.exit`/`throw`.
- **Comportamental (staging)**: com o worker rodando, disparar um broadcast e —
  em ambiente de teste — forçar a escrita de log a lançar; confirmar no log do
  worker que a falha foi registrada, o processo **continua online** (`pm2 list`
  não mostra restart) e os jobs `queued` permanecem na fila.

## 4. Critérios de sucesso observáveis (pós-deploy em staging/prod)

- **SC-001**: `grep 'unexpected end of hex escape' bot.log` → **0** ocorrências
  após a correção (era 8+/dia).
- **SC-002**: zero reinícios do worker atribuídos a falha de escrita de log.
- **SC-003**: nenhuma mensagem perdida em `status=queued` por crash de log.

## Rollback

Correção é code-only, memory-neutral, sem migration. Rollback = reverter o commit
(ou o PR) e redeploy; nenhuma limpeza de dados necessária.
