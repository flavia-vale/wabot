# Phase 1 — Data Model

Feature de baixo acoplamento a dados: **nenhuma migration de schema**. As entidades abaixo
mapeiam para estruturas já existentes; a única "estrutura de dados nova" é o shape da metadata
de um evento durável já emitido.

Referências: entidades da spec (§ Key Entities); decisões D3/D4 em [research.md](./research.md).

---

## E1 — Entrada do SEO registry (rota indexável)

- **Fonte**: `dashboard/lib/seo-registry.mjs` (`CONTENT_SEO_ROUTES` / grupos de rotas).
- **Campos** (por entrada, padrão já existente no arquivo):
  - `path` (string, obrigatório) — ex.: `/cadastro`, `/parcerias`.
  - `title` (string) — título único; para `/conteudos` passa a ser um **título de hub** explícito.
  - `description` (string, opcional) — usada por metadata/lint quando presente.
  - `template` (string) — ex.: `signup`, `partnerships`, `content-hub`, `article`.
  - `priority` (number), `changeFrequency` (string), `lastModified` (string ISO).
  - `indexable` (boolean, `true` para entrar no sitemap).
- **Regras de validação (impostas pelos guards)**:
  - Toda rota pública com `page.js` (fora de `/painel`, `/admin`, `/login`, `/api`,
    `/promo-vip-7dias`) MUST ter entrada indexável — `guard:seo-registry`.
  - Nenhum par de rotas indexáveis pode compartilhar `title` normalizado — `lint:seo-metadata`.
- **Mudança nesta feature**: +2 entradas (`/cadastro`, `/parcerias`); `title` de `/conteudos`
  diferenciado. Sem remoção de entradas existentes.

## E2 — Atribuição de cadastro (landing + UTMs) — metadata de evento

- **Fonte**: metadata JSON do evento durável `AnalyticsEvent` com `event: 'signup_created'`,
  emitido em `src/api/routes/auth.js` (`trackAnalyticsEventSafe`). **Sem tabela nova.**
- **Campos da metadata** (existentes + novo):
  | Campo | Tipo | Origem | Obrigatório | Notas |
  |-------|------|--------|-------------|-------|
  | `source` | string | body `/register` | não | já existe |
  | `utm_source` | string | body | não | já existe |
  | `utm_medium` | string\|null | body | não | já existe |
  | `utm_campaign` | string\|null | body | não | já existe |
  | `utm_content` | string\|null | body | não | já existe |
  | `utm_term` | string\|null | body | não | já existe |
  | `landing_page` | string | body `landingPage` (novo) | não | **novo**; first-touch, sanitizado, `≤500` |
- **Validação / sanitização**:
  - `landing_page` e UTMs passam por `sanitizeAttributionValue` (marketing-attribution) —
    caracteres fora de `[\p{L}\p{N}._~:@/-]` viram `-`; comprimento limitado (FR-014).
  - Ausência de UTMs/landing NÃO bloqueia o cadastro (FR-005): campos ficam vazios/nulos.
- **Consulta (FR-007)**: contagem de cadastros por landing = leitura agrupada de
  `AnalyticsEvent where event='signup_created'` agregando por `metadata.landing_page`
  (exposta por uma rota admin de leitura, sem PII sensível).
- **Semântica**: first-touch (D4) — a landing enviada é a primeira página de entrada da sessão.

## E3 — Lead de artigo (captura de e-mail)

- **Fonte**: fluxo de lead-magnet existente — `components/marketing/LeadMagnetCard.jsx` posta
  `mode=register` + `email` (+ `utm_source=lead_magnet` + `origin`) para `/login`, que dirige o
  fluxo de cadastro/lead. **Sem coleção nova de leads.**
- **Campos capturados**: `email` (validado), `origin` (artigo/página de origem),
  `utm_source='lead_magnet'` e demais atribuições herdadas.
- **Regras de validação (FR-011)**:
  - E-mail vazio ou com formato inválido → mensagem amigável, **nenhum** lead registrado.
  - E-mail válido → lead registrado pelo fluxo existente; confirmação/acesso ao material.
  - E-mail já cadastrado → tratado como sucesso idempotente ou mensagem amigável (edge case da
    spec), sem erro bruto.
- **Marca**: toda cópia/rótulo do card = **BOTinho** (FR-012).

---

## Relações e invariantes

- E1 alimenta `app/sitemap.js` (deriva 100% do registro) e é verificada pelos guards — não há
  leitura de rota indexável fora de `getIndexableSeoRoutes()`.
- E2 é puramente aditiva à metadata de um evento já existente — nenhuma FK/coluna nova.
- E3 reusa o pipeline de register; o "lead" e o "cadastro" compartilham o mesmo caminho.
- **Invariante de custo**: nenhuma entidade introduz processo/worker/Redis/heap/DDL novo
  (FR-013/SC-006).
