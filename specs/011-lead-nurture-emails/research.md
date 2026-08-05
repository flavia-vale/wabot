# Phase 0 — Research & Decisions

Resolve todas as incógnitas do Technical Context. Cada decisão traz Rationale e Alternativas
descartadas. Referências de código verificadas: `src/api/server.js` (timers), `src/email/mailer.js`,
`src/email/welcomeEmail.js`, `src/analytics.js` (allowlist + `sanitizeAnalyticsMetadata`),
`src/api/routes/auth.js` (`/register`, `sendWelcomeEmail`, `generateFallbackEmail`),
`prisma/schema.prisma` (`User`, `AnalyticsEvent`), `specs/010-seo-lead-capture/*` (precedente de
metadata sem migration).

---

## D1 — Agendamento: timer in-process com passada diária (regra #1 de memória)

- **Decisão**: `startLeadNurtureSweep()` em `src/api/server.js` — `setInterval` de ~24h, chamado
  uma vez no boot, com `timer.unref?.()`, exatamente como `startLogRetentionJob`
  (`src/api/server.js:148-154`) e `startActivityCacheCleanup` (`:90-97`). Intervalo configurável por
  env **opcional aditiva** `LEAD_NURTURE_SWEEP_INTERVAL_MS` (default 24h). Roda também uma vez no
  boot (best-effort) para não esperar 24h após um deploy.
- **Rationale**: custo de memória desprezível (um timer `unref()` que não segura o event loop);
  reusa um padrão já validado e testado no repo; a elegibilidade é por "tempo decorrido desde a
  entrada" (não "hoje é o dia N"), então uma passada perdida se auto-recupera na próxima (FR-011).
- **Alternativas descartadas (por decisão de MEMÓRIA — AGENTS.md "Política de memória", regra #1)**:
  - **App PM2 dedicado / novo worker** — descartado: +processo long-running (~+0,1–0,3 GB), viola a
    regra #1 e SC-005. Sem ganho: a passada é O(janela) e trivial.
  - **Cron do SO (crontab) chamando um script Node** — descartado: cada tick sobe um processo Node
    novo (import de Prisma + libs), pico de RAM recorrente, e foge do runbook/observabilidade da API.
  - **Fila Redis/BullMQ com jobs agendados por lead** — descartado: exige Redis dedicado a esta
    feature (não é pré-requisito hoje em `inline`), +infra, +heap do Worker, e complexidade de DLQ
    para um caso que idempotência por evento já resolve. Viola regra #1.
  - **Cache em memória do progresso dos leads** — descartado: heap que cresce com a base; o estado
    já é durável em `AnalyticsEvent`, ler sob demanda por janela é barato.

## D2 — Fonte do e-mail do lead: `User.email`, nunca a metadata do evento

- **Decisão**: o e-mail de destino vem de `User.email`. O lead com e-mail real **já é uma linha
  `User`**: o lead magnet (`components/marketing/LeadMagnetCard.jsx`) posta `mode=register` + `email`
  e o cadastro comum usa o mesmo `/register` — ambos criam `User` com `email` único (feature 010).
- **Rationale**: `sanitizeAnalyticsMetadata` (`src/analytics.js:97`) **descarta** qualquer chave que
  bata `/(...|email|url|phone|key|token|...)/i` e trunca strings a 80 chars. Logo, guardar e-mail em
  `AnalyticsEvent.metadata` é impossível/inseguro por design — e nem é preciso: `User.email` é
  durável, único e já existe. O `userId` do evento amarra o progresso ao lead.
- **Alternativas descartadas**: coluna nova em `User` para "estado da trilha" (DDL desnecessário,
  pegadinha #8); tabela `Lead` dedicada (a feature 010 já decidiu reusar `User`/register).

## D3 — Estado da sequência derivado de `AnalyticsEvent` (idempotência natural, sem DDL)

- **Decisão**: cada passo enviado grava `AnalyticsEvent { userId, event: 'nurture_email_sent',
  metadata: { step: <0|2|5|7> } }`. O passo já enviado é o conjunto de `metadata.step` dos eventos
  desse `userId`. Antes de enviar, computa-se os passos **devidos** (elapsedDays ≥ milestone) menos os
  **já enviados** — reexecução no mesmo dia, execução dupla ou reinício da API nunca reenviam
  (FR-006, SC-002).
- **Rationale**: `step` é um número num campo não sensível → sobrevive à sanitização. Segue o
  precedente da feature 010 (gravar `landing_page` na metadata de `signup_created` em vez de coluna).
  Zero migration → sem risco de lock DDL (pegadinha #8).
- **Alternativas descartadas**: tabela `NurtureProgress(userId, step, sentAt)` — só entraria como
  **decisão a validar** se o volume tornasse a leitura de eventos custosa; por ora o índice
  `AnalyticsEvent(userId, createdAt)` (schema linha 628) já suporta a consulta por lead. Registrado
  como risco em D7.

## D4 — Passo dia 0 = o e-mail de boas-vindas já existente (evita e-mail duplicado)

- **Decisão**: o `/register` já dispara `sendWelcomeEmail` (fire-and-forget, só e-mail real —
  `src/api/routes/auth.js:483-485`). Esse e-mail **é** o passo dia 0 (entrega/boas-vindas). Logo após
  o disparo, o `/register` semeia `AnalyticsEvent { event:'nurture_email_sent', metadata:{step:0} }`
  para o `userId`. A passada diária cuida apenas dos passos **2, 5 e 7**.
- **Rationale**: sem isso, o lead receberia dois e-mails de boas-vindas no dia 0 (o welcome + o passo
  0 da trilha). Reusar o welcome como dia 0 elimina a duplicata, reduz superfície e mantém a trilha
  coerente com FR-001.
- **Cuidado no-op/SMTP**: o welcome pode ter sido `skipped:true` (sem SMTP). Mesmo assim semeamos o
  marker step 0 **apenas quando o objetivo é "não reenviar dia 0"** — como sem SMTP nada sai de fato,
  a passada dos dias seguintes também será no-op, então a semeadura do step 0 não "queima" um envio
  real (não há envio real em ambiente sem SMTP). Em ambiente COM SMTP, o welcome saiu de verdade.
- **Alternativa descartada**: passo dia 0 próprio, separado do welcome — geraria e-mail duplicado ou
  exigiria remover o welcome atual (mudança de comportamento fora do escopo). Registrado como opção
  reversível caso o time queira cópia distinta para o dia 0 (então o welcome deixaria de semear step 0).

## D5 — Opt-out / unsubscribe LGPD sem DDL

- **Decisão**: cada e-mail contém um link `GET /api/lead-nurture/unsubscribe?token=<t>`. O `token` é
  um HMAC-SHA256 de `userId` (chave = `JWT_SECRET` já presente, via `crypto`), **stateless**. A rota
  pública valida o token e grava `AnalyticsEvent { userId, event: 'nurture_unsubscribed' }`. A
  passada e o `/register` (semeadura) checam a existência desse evento **antes de qualquer envio**;
  se existir, o lead nunca recebe mais nada (FR-005, SC-003), e um novo download de material **não
  reinicia** a trilha (o opt-out prevalece — US2 cenário 3).
- **Rationale**: opt-out durável sem tabela nova; o token não precisa ser guardado em lugar nenhum
  (verificável por recomputação), o que é bom porque a metadata de evento descartaria `token`/`key`
  de qualquer forma. A verificação é feita o mais próximo possível do envio (edge case de corrida).
- **Alternativas descartadas**: coluna `unsubscribedAt` em `User` (DDL); token opaco persistido em
  tabela (DDL + PII); usar `email` no link (vaza PII na URL, e a sanitização removeria de logs).

## D6 — Elegibilidade e exclusão de e-mail não-real

- **Decisão**: elegível = `User` com **e-mail real** e `createdAt` dentro da janela ativa. "E-mail
  real" = NÃO termina em `@sistema.com` (o fallback `generateFallbackEmail` →
  `user_<hex>@sistema.com`, `src/api/routes/auth.js:120-122`) e casa formato básico
  (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`, mesmo critério de `src/domain/payments/payerEmail.js`). Janela
  ativa = `createdAt ≥ now − (7d + margem)` (default margem 1d → 8d) e `createdAt ≤ now`.
- **Rationale**: a janela de 8 dias cobre toda a trilha (0..7) e **exclui automaticamente** leads com
  mais de ~7 dias — atende a Assumption "leads pré-existentes não são reprocessados" sem estado extra.
- **Go-live floor (decisão fina)**: leads criados 1–6 dias ANTES do go-live cairiam na janela e
  entrariam no meio da trilha. Mitigação **opcional aditiva**: env `LEAD_NURTURE_GO_LIVE_AT` (ISO);
  se setada, só `createdAt ≥ LEAD_NURTURE_GO_LIVE_AT` entram. Default **unset** → comportamento
  janela-apenas (aceitável: no pior caso alguns leads recentes recebem 2/5/7). Não altera `.env` de
  ambiente por padrão (env é opcional, não obrigatória) — respeita FR-010.

## D7 — Riscos e decisões a validar

- **Tabela nova (não adotada, registrada)**: se, em escala, a leitura de `AnalyticsEvent` por lead
  ficar cara, avaliar `NurtureProgress`. **Só como decisão explícita a validar** (pegadinha #8: DDL
  exige parar API/supervisor; convive mal com WAL sob escrita contínua). Hoje **não** é necessário.
- **Validação em staging obrigatória** antes de prod: (a) SMTP configurado envia os 4 passos na
  cadência certa com relógio simulado; (b) link de unsubscribe realmente bloqueia passos futuros;
  (c) sem SMTP, passada termina sem erro e sem marcar passos (SC-006). O `.env` de staging já
  documenta `SMTP_*` como opcionais.
- **Cópia dos e-mails**: textos pt-BR BOTinho finais podem ser ajustados sem mudar a estrutura
  (Assumption da spec) — os builders são puros e isolados para facilitar isso.

---

## Resumo das decisões

| # | Decisão | Sem DDL? | Sem novo processo? |
|---|---|---|---|
| D1 | Timer in-process diário (`setInterval`+`unref`) | — | ✅ |
| D2 | E-mail do lead de `User.email` | ✅ | ✅ |
| D3 | Progresso via `AnalyticsEvent nurture_email_sent{step}` | ✅ | ✅ |
| D4 | Dia 0 = welcome existente + semeadura step 0 | ✅ | ✅ |
| D5 | Opt-out via token HMAC + `AnalyticsEvent nurture_unsubscribed` | ✅ | ✅ |
| D6 | Elegibilidade por janela 8d + exclusão `@sistema.com` | ✅ | ✅ |
| D7 | Tabela nova só se necessário (a validar) | n/a | n/a |
