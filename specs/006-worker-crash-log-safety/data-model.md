# Phase 1 — Data Model

Esta feature **não altera o schema**. Nenhuma migration é criada. O modelo abaixo
documenta apenas a entidade tocada em runtime, para referência.

## MessageLog (existente — sem mudança de schema)

Registro de tentativa/resultado de envio de mensagem.

| Campo         | Tipo    | Papel nesta feature                                                        |
|---------------|---------|----------------------------------------------------------------------------|
| `id`          | id      | Correlaciona o log ao job de envio (`logId` no `enqueueSendJob`).          |
| `userId`      | string  | Dono da sessão.                                                            |
| `platform`    | string  | `'broadcast'` no caminho tratado.                                         |
| `sourceGroup` | string  | Origem (broadcast/relay).                                                  |
| `destGroup`   | string  | JID de destino.                                                           |
| `messageText` | string  | **Entrada sanitizada** — alvo direto da correção (US1). Passa por `sanitizeMessageForLog` antes da escrita. |
| `status`      | string  | `queued` → `success`/`skipped`/`error`. Linhas ficam **órfãs em `queued`** quando o worker cai no meio do processamento (US2). |
| `errorMsg`    | string  | Taxonomia canônica (`classifyError`); não recebe prefixo novo nesta feature. |
| `sentAt`      | datetime| Marcado no update de resultado.                                           |

### Regras de validação aplicadas (na sanitização, não no schema)

- `messageText` gravado MUST estar livre de surrogate solto (FR-002).
- `messageText` gravado MUST estar livre de controle/`NUL` (FR-003).
- Comprimento de `messageText` (conteúdo, code points) MUST ≤ `MESSAGE_LOG_MAX_CHARS` (FR-004).
- Entrada `null`/vazia/não-string → resultado `''` sem lançar (FR-005).

### Transições de estado relevantes (inalteradas)

`queued` → `success` (envio ok) | `queued` → `error` (fila cheia / falha) | `queued` (órfão, se o worker cair — o que esta feature previne).

## Entidade nova (código, não dados)

### Módulo `src/messageLogSanitizer.js`

- **Export** `MESSAGE_LOG_MAX_CHARS: number` — lido de `process.env.MESSAGE_LOG_MAX_CHARS` (default 240, mínimo 40).
- **Export** `sanitizeMessageForLog(text: unknown): string` — função pura, sem I/O, determinística para uma dada env.
