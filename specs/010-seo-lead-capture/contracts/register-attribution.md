# Contract — Register Attribution (US2)

Extensão **aditiva e retrocompatível** do endpoint de cadastro para capturar a página de
entrada orgânica (first-touch). Sem migration de schema (grava na metadata do evento durável
`signup_created`). Ver D3/D4 em [research.md](./research.md).

## Endpoint

`POST /api/auth/register` (Fastify — `src/api/routes/auth.js`).

## Request body — campo novo (opcional)

Todos os campos existentes permanecem inalterados. Adiciona-se:

| Campo | Tipo | Obrigatório | Notas |
|-------|------|-------------|-------|
| `landingPage` | string | não | Primeira página de entrada da sessão (first-touch). Sanitizado e truncado (`≤500`) no servidor. Ausência não bloqueia o cadastro. |

UTMs/`source` já são aceitos hoje e permanecem.

## Comportamento

1. Cadastro é criado normalmente **independente** de `landingPage`/UTMs estarem presentes
   (FR-005 — degradação graciosa; nenhum passo auxiliar transforma cadastro OK em erro).
2. O evento durável `AnalyticsEvent('signup_created')` passa a incluir na metadata:
   - `landing_page` = `sanitizeAttributionValue(landingPage)` (vazio se ausente).
   - `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term` (já existentes).
3. Nenhuma PII sensível em claro além do já emitido pelo fluxo de register (FR-014).

## Produtor (frontend)

`dashboard/app/login/page.js` → `api.register(...)`: incluir `landingPage` no objeto de
atribuição enviado. A landing vem do first-touch persistido pela infra de marketing
(`OrganicPageTracker`/`marketing-attribution`); fallback para `location.pathname`; na falta,
vazio.

## Consulta (FR-007)

Rota admin de **leitura** que agrega `AnalyticsEvent where event='signup_created'` por
`metadata.landing_page`, retornando contagem de cadastros por landing. Somente leitura;
auditada conforme padrão admin do repo.

## Retrocompatibilidade

- Clientes antigos que não enviam `landingPage` continuam funcionando (campo opcional).
- Cadastros de afiliado continuam gravando `AffiliateAttributionTouch` como hoje (inalterado).
