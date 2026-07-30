# Quickstart — Validação da trilha de nutrição de leads

Guia de validação end-to-end. Detalhes de shape/entidades: ver
[data-model.md](./data-model.md) e [contracts/](./contracts/). Implementação vai para `tasks.md`.

## Pré-requisitos

- Node do repo; `node --test` disponível.
- Testes rodam **sem banco e sem SMTP** (mailer é no-op; lógica pura injeta `db`/`sendMail` fakes).
- Validação COM envio real → só em **staging** com `SMTP_*` configurado (ver §Staging).

## 1. Testes unitários / de integração (local, db-free / SMTP-free)

```bash
node --test test/nurture-emails.test.js
node --test test/lead-nurture-policy.test.js
node --test test/lead-nurture-sweep.test.js
node --test test/lead-nurture-unsubscribe.test.js
```

Cobertura esperada (mapeada aos requisitos):

| Cenário | Requisito | Resultado esperado |
|---|---|---|
| `buildNurtureEmail` de cada passo contém `unsubscribeUrl` em `text` e `html`, cópia pt-BR/BOTinho | FR-004, SC-004 | link presente nos 4 passos |
| `computeDueSteps` com `elapsedDays` 0/2/5/7 e `sentSteps` variados | FR-001, FR-006 | só passos devidos e não enviados |
| Passada executada 2× no mesmo `now` | FR-006, SC-002 | cada passo enviado **1×** (2ª rodada: `sent=0`) |
| Reinício simulado (sentSteps já tem 0 e 2) | US3 cenário 2 | retoma no próximo passo, não reenvia |
| Passada perdida (`elapsedDays=6`, nada enviado além do 0) | FR-011 | envia dia 2 e dia 5 na mesma passada |
| Lead `user_x@sistema.com` / e-mail inválido | FR-002, US2-4 | nunca elegível (`isRealEmail=false`) |
| `sendMail` no-op (`{skipped:true}`) | FR-007, SC-006 | passada sem erro, **nenhum** `nurture_email_sent` gravado |
| Um item lança no envio | FR-009 | demais leads seguem; erro em `failures[]`, passada não aborta |
| `nurture_unsubscribed` presente | FR-005, SC-003 | `computeDueSteps=[]`; nenhum envio |
| Token: `verify(sign(userId))===userId`; token adulterado → `null` | D5 | round-trip ok; adulteração rejeitada |

## 2. Verificação de restrições canônicas (memória / infra)

```bash
# Nenhum app PM2 novo introduzido por esta feature (SC-005):
grep "name:" ecosystem.config.cjs        # continua 4 apps prod + equivalentes staging

# A passada usa o padrão de timer existente (setInterval + unref, top-level):
grep -n "startLeadNurtureSweep\|setInterval\|unref" src/api/server.js

# Nenhuma dependência de Redis/BullMQ nesta feature:
grep -rn "bullmq\|ioredis" src/leadNurture src/email/nurtureEmails.js   # vazio
```

Esperado: nenhum processo/worker/Redis novo; um único `setInterval(...).unref()`.

## 3. Verificação de "sem migration/DDL"

```bash
git status --porcelain prisma/           # sem novos arquivos de migration
grep -c "nurture" prisma/schema.prisma   # 0 — nenhuma coluna/tabela nova
grep -n "nurture_email_sent\|nurture_unsubscribed" src/analytics.js   # 2 eventos na allowlist
```

## 4. Validação manual em staging (COM SMTP) — antes de prod

1. Garantir `SMTP_*` no `~/wabot-staging/.env` e apps de staging de pé (painel admin ou
   `pm2 start ... --only api-staging`). **Não** alterar portas/deploy.
2. Cadastrar um lead com **e-mail real** (fluxo lead magnet ou `/register`). Confirmar:
   - recebe o e-mail de boas-vindas (dia 0) e o evento `nurture_email_sent{step:0}` é semeado.
3. Forçar a passada com relógio simulado (ex.: script de teste que chama `runNurtureSweep({now})`
   com `now` = entrada + 2d / +5d / +7d) apontando ao `db`/SMTP de staging:
   - dia 2, 5 e 7 chegam na ordem, um por marco, sem duplicar.
4. Clicar no link de descadastro de um e-mail; rodar a passada de novo:
   - nenhum passo futuro chega ao contato descadastrado; outros leads seguem recebendo.
5. Reexecutar a passada duas vezes seguidas: nenhum e-mail repetido.

## Critérios de aceite (resumo)

- SC-001: 100% dos leads reais sem opt-out recebem o dia 0 em ≤24h (welcome imediato no register).
- SC-002: 0 duplicados sob execução dupla/reinício.
- SC-003: 0 e-mails a descadastrados.
- SC-004: 100% dos e-mails com link de descadastro.
- SC-005: 0 novos processos/apps/Redis.
- SC-006: sem SMTP, passada sem erro e sem marcar passos; suíte roda sem banco/SMTP.

Depois de aprovado em staging: PR `develop → main` (fluxo canônico). Sem mexer em `.env`/portas/deploy.
