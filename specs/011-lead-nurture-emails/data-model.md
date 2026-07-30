# Phase 1 — Data Model

Feature de **baixo acoplamento a dados: nenhuma migration/DDL**. Todas as entidades mapeiam para
estruturas já existentes (`User`, `AnalyticsEvent`) ou são definições **em código** (passos da
trilha, token). Referências: spec §Key Entities; decisões D2–D6 em [research.md](./research.md).

---

## E1 — Lead/Contato (existente: `User`)

- **Fonte**: `prisma/schema.prisma` `model User` (linhas 10–). Sem coluna nova.
- **Campos usados**:
  | Campo | Tipo | Uso na feature |
  |---|---|---|
  | `id` | String (cuid) | `userId` dos eventos + subject do token de unsubscribe |
  | `email` | String @unique | destinatário do e-mail (durável; **única** fonte de e-mail) |
  | `name` | String | saudação no corpo (primeiro nome), como em `welcomeEmail.js` |
  | `createdAt` | DateTime | **momento de entrada na trilha** (t0 do cálculo de elapsedDays) |
- **Regra de elegibilidade (D6, FR-002)**:
  - `email` real ⇔ NÃO termina em `@sistema.com` **e** casa `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`.
  - `createdAt` dentro da janela ativa: `now − (7d + margem) ≤ createdAt ≤ now` (margem default 1d).
  - (Opcional) `createdAt ≥ LEAD_NURTURE_GO_LIVE_AT` quando a env estiver setada.
- **Invariante**: fallback `user_*@sistema.com` **nunca** entra na trilha (US2 cenário 4, SC — parte).

## E2 — Passo da sequência (definição em código, imutável)

- **Fonte**: `src/email/nurtureEmails.js` (novo) + `src/leadNurture/policy.js` (novo). Sem persistência.
- **Estrutura** (constante ordenada):
  | Campo | Tipo | Valor |
  |---|---|---|
  | `step` | number | identificador estável = o dia-marco: `0`, `2`, `5`, `7` |
  | `milestoneDays` | number | dias desde `createdAt` a partir dos quais o passo fica devido (= `step`) |
  | `theme` | string | `entrega`/`valor`/`teste`/`ativacao` (rotulagem interna) |
  | `build(ctx)` | fn pura | `(name, unsubscribeUrl, dashboardUrl) → { subject, text, html }` |
- **Regras (FR-001, FR-004)**:
  - Exatamente 4 passos; conteúdo pt-BR, marca **BOTinho** em toda cópia (FR-012 do domínio).
  - Todo `html`/`text` MUST conter o link de descadastro (`unsubscribeUrl`) — garantido por teste.
  - O passo **0** é materializado pelo e-mail de boas-vindas existente (D4); os builders de 2/5/7 são
    os efetivamente disparados pela passada. (Um builder de dia 0 pode existir para o caso futuro de
    dia-0 próprio — dormente enquanto o welcome o cobre.)

## E3 — Estado de progresso do lead (derivado: `AnalyticsEvent`)

- **Fonte**: `AnalyticsEvent` (linhas 620–629), `event = 'nurture_email_sent'`. Sem tabela nova.
- **Shape da metadata**: `{ step: 0|2|5|7 }` (número — sobrevive a `sanitizeAnalyticsMetadata`).
- **Derivação**: `sentSteps(userId) = { e.metadata.step : e ∈ AnalyticsEvent, e.userId=userId,
  e.event='nurture_email_sent' }`.
- **Regra de idempotência (FR-006, SC-002)**: um passo só é enviado se `step ∉ sentSteps` **e**
  `elapsedDays ≥ milestoneDays`. O evento é gravado **somente após envio não-`skipped`** (D4/SC-006):
  se `sendMail` devolveu `{skipped:true}` (sem SMTP), **não** grava → o passo não é "queimado".
- **Índice de suporte**: `@@index([userId, createdAt])` já existente cobre a leitura por lead.

## E4 — Registro de descadastro / opt-out (derivado: `AnalyticsEvent`)

- **Fonte**: `AnalyticsEvent`, `event = 'nurture_unsubscribed'`. Sem tabela nova. `metadata` vazio
  ou `{ via: 'link' }` (sem PII — `email`/`token` seriam descartados de qualquer forma).
- **Derivação**: `isUnsubscribed(userId) = ∃ AnalyticsEvent(userId, 'nurture_unsubscribed')`.
- **Regra (FR-005, SC-003, US2)**: verificado antes de cada envio E antes da semeadura do step 0 no
  `/register`. Uma vez presente, prevalece para sempre (novo download não reinicia a trilha).

## E5 — Token de unsubscribe (stateless, em código)

- **Fonte**: `src/leadNurture/unsubscribeToken.js` (novo). **Não persistido.**
- **Definição**: `token = base64url(userId) + '.' + HMAC_SHA256(userId, key=JWT_SECRET)`.
- **Verificação**: recomputa o HMAC e compara em tempo constante; extrai `userId`. Inválido → a rota
  responde de forma amigável sem vazar se o `userId` existe.
- **Sem SMTP/JWT_SECRET**: `JWT_SECRET` é obrigatório no boot da API (já garantido), então a chave
  sempre existe em runtime; em teste, uma chave fake é injetada.

---

## Relações e invariantes

- E1 (`User`) é a única fonte de e-mail; E3/E4 apenas amarram progresso/opt-out por `userId`.
- E2 é definição imutável em código (não há entidade de dados).
- **Zero DDL / zero coluna nova / zero tabela nova** (FR-008, pegadinha #8). Dois eventos novos
  entram só na **allowlist** de `src/analytics.js` (`nurture_email_sent`, `nurture_unsubscribed`) —
  isso é edição de código, não de schema.
- **Invariante de custo (FR-012, SC-005)**: nenhuma entidade introduz processo/worker/Redis/heap/DDL.
