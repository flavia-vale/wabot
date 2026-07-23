# Phase 0 — Research: SEO Fix, Signup Attribution & Article Lead Capture

Consolidação das decisões técnicas. Cada NEEDS CLARIFICATION do Technical Context foi
resolvido abaixo. Nenhuma pendência permanece.

---

## D1 — Como registrar `/cadastro` e `/parcerias` no sitemap

- **Decision**: Adicionar as duas rotas como entradas em `CONTENT_SEO_ROUTES` (ou grupo de
  rotas estáticas equivalente) de `dashboard/lib/seo-registry.mjs`, com `indexable: true`,
  `template`, `priority`, `changeFrequency` e `lastModified` coerentes com o padrão das demais
  entradas comerciais/estáticas.
- **Rationale**: `app/sitemap.js` gera o sitemap **inteiramente** de
  `getIndexableSeoRoutes()`; `scripts/guard-seo-registry-coverage.mjs` compara os `page.js`
  públicos descobertos no filesystem contra o conjunto indexável do registro. Registrar =
  simultaneamente satisfazer o guard **e** incluir a URL no sitemap. Não há outro caminho de
  código a tocar para o sitemap.
- **Alternatives considered**: (a) adicionar as URLs direto no `sitemap.js` — rejeitado:
  duplicaria a fonte de verdade e o guard continuaria vermelho; (b) marcar as rotas como não
  públicas no guard — rejeitado: elas SÃO públicas e indexáveis (queremos ranquear).

## D2 — Como remover a duplicidade de título `/conteudos` × artigo de blog

- **Decision**: Diferenciar o `title` de `/conteudos` (o hub de conteúdo) para algo que
  descreva o **hub/índice** (ex.: manter o `title` já presente na página
  `"Conteúdos: blog e materiais para afiliados no WhatsApp"` como a fonte única e garantir que
  o registro/o `lint` leiam esse título — e NÃO o do artigo). O artigo
  `/blog/comecar-afiliado-whatsapp-sem-grupo-grande` mantém seu título específico.
- **Rationale**: O `lint:seo-metadata` reporta o par com o mesmo título normalizado
  (`"como comecar como afiliado no whatsapp sem ter grupo grande"`). A entrada de `/conteudos`
  no registro hoje não tem `title` explícito (usa `template: 'content-hub'`), então o lint
  provavelmente resolve o título por outra fonte que colide com o artigo. A correção é dar a
  `/conteudos` um `title` explícito de **hub** no registro, distinto do título do artigo.
  O hub descreve uma coleção; o artigo descreve o guia — semanticamente corretos e distintos,
  sem canibalização.
- **Open verification (resolver na implementação, não bloqueia o plano)**: confirmar de qual
  campo o `lint-seo-metadata-duplicates.mjs` extrai o título de `/conteudos` (registro vs.
  metadata da página) e diferenciar na fonte que o lint lê. O `Independent Test` da US1 é o
  critério: rodar o lint e confirmar zero duplicata.
- **Alternatives considered**: mudar o título do **artigo** — rejeitado: o artigo é a peça
  que deve ranquear para a intenção "começar como afiliado sem grupo grande"; alterar seu
  título prejudicaria o alvo de SEO. É o hub que deve ceder.

## D3 — Atribuição de cadastro orgânico (página de entrada) sem migration

- **Decision**: Persistir a página de entrada (landing) e os UTMs do cadastro orgânico na
  **metadata JSON do evento durável `AnalyticsEvent('signup_created')`** já emitido em
  `src/api/routes/auth.js`. Adicionar um campo `landing_page` (e reforçar `utm_*`, já
  presentes) nessa metadata. `/register` passa a aceitar `landingPage` no body; o frontend
  (`app/login/page.js`) envia a página de entrada first-touch no payload de `api.register`.
- **Rationale**: Hoje `signup_created` já grava `source`/`utm_*`, mas **não** a landing para
  cadastros orgânicos (a landing só é persistida no fluxo de afiliado via
  `AffiliateAttributionTouch`). Gravar na metadata do evento existente evita migration de
  schema (FR-013/SC-006: mudança leve, sem DDL sob lock — pegadinha #8) e reaproveita o
  pipeline de analytics já auditado. A consulta "cadastros por landing" (FR-007) vira leitura
  agrupada desses eventos.
- **Alternatives considered**: (a) nova coluna `signupLandingPage` em `User` — rejeitado
  por ora: exige migration/DDL (lock SQLite, pegadinha #8) para um dado analítico; a metadata
  do evento atende. (b) Nova tabela `SignupAttribution` — rejeitado: sistema paralelo de
  rastreamento, proibido por FR-006 (reaproveitar infra).

## D4 — Semântica first-touch da página de entrada

- **Decision**: First-touch — a **primeira** página de entrada da sessão. Capturar via um
  sinal persistido no cliente (cookie/localStorage de primeira visita) definido a partir do
  `OrganicPageTracker`/`marketing-attribution`, lido no momento do `/register`. Se o sinal não
  existir (cookies bloqueados / entrada direta no login), cair para
  `window.location.pathname` atual e, na falta, gravar vazio — sem quebrar o cadastro.
- **Rationale**: A Assumption da spec fixa first-touch e manda seguir a semântica da infra
  existente. `marketing-attribution.js` já lê atribuição de `searchParams`; a extensão mínima
  é persistir a primeira landing observada e reusá-la no register, em vez de reescrever o
  modelo. Degradação graciosa cobre o edge case de rastreamento bloqueado (FR-005).
- **Open verification (na implementação)**: confirmar se já existe um cookie/estado de
  first-touch persistido pela infra atual (`OrganicPageTracker` grava evento, mas pode não
  persistir a landing). Se não existir, adicionar persistência mínima (um cookie SameSite=Lax
  de first-touch), sem provedor novo.
- **Alternatives considered**: last-touch — rejeitado por contrariar a Assumption; capturar
  só no register (sem first-touch) — rejeitado: perderia a entrada real quando a pessoa navega
  antes de cadastrar.

## D5 — Bloco de captura de e-mail no artigo (US3)

- **Decision**: Reaproveitar o caminho existente: `ArticleShell` → `LeadMagnetCard`, que já
  posta `mode=register` + `email` para `/login` (o lead entra pelo mesmo fluxo de cadastro/
  lead-magnet). Escopo de código: **verificar** que todo artigo é renderizado via
  `ArticleShell`; **garantir** validação amigável de e-mail vazio/inválido no
  `LeadMagnetCard` (sem registrar lead inválido); **garantir** que a cópia use **BOTinho**.
- **Rationale**: FR-010 pede reaproveitar o fluxo de lead magnet já presente; o componente já
  existe e já está montado no shell. Construir do zero violaria "reaproveitar infra".
- **Alternatives considered**: novo endpoint/coleção de leads — rejeitado: duplicaria fluxo
  existente e adicionaria superfície; contraria FR-006/FR-010.

## D6 — Sitemap/robots das 6 páginas de blog novas + submissão (US4)

- **Decision**: As 6 páginas de blog novas **já estão registradas** no `seo-registry`
  (evidência: o guard só reclama de `/cadastro` e `/parcerias`; se um blog novo faltasse, ele
  também apareceria). Portanto US4 no código é **verificação**: confirmar as 6 URLs no sitemap
  gerado e que `robots.js` (allow `/`, disallow só painel/admin/api/promo) não bloqueia
  `/blog/*`, `/cadastro`, `/parcerias`. A submissão no Google Search Console e Bing Webmaster
  é passo **manual/operacional** documentado em `docs/deploy/seo-search-console-submission.md`.
- **Rationale**: FR-008 já satisfeito por construção do sitemap/robots; FR-009 é explicitamente
  passo manual (login/propriedade da dona), fora do escopo de código.
- **Alternatives considered**: automatizar ping de sitemap no deploy — rejeitado: adicionaria
  passo de deploy/infra fora do envelope "mudança leve" e do escopo desta feature.

## D7 — PII e sanitização (FR-014)

- **Decision**: Landing e UTMs passam por `sanitizeAttributionValue` (já existe em
  `marketing-attribution.js`) antes de qualquer persistência/analytics; o e-mail de lead segue
  o tratamento de PII já adotado no repo (mesmo caminho de register). Nada de e-mail em claro
  em logs de analytics além do que o fluxo de register já faz.
- **Rationale**: Reaproveita as garantias existentes; não introduz novo vetor de PII.
- **Alternatives considered**: hashing próprio da landing — desnecessário (landing/UTM não são
  PII sensível; sanitização basta).

---

## Resumo de decisões

| # | Tema | Decisão | Migration? |
|---|------|---------|------------|
| D1 | Sitemap de `/cadastro` `/parcerias` | Registrar no `seo-registry.mjs` | Não |
| D2 | Título duplicado | `title` de hub explícito em `/conteudos` | Não |
| D3 | Persistir landing orgânica | Metadata de `signup_created` | **Não** |
| D4 | First-touch | Cookie/estado de primeira landing, degradação graciosa | Não |
| D5 | Captura no artigo | Reusar `ArticleShell`+`LeadMagnetCard` | Não |
| D6 | 6 blogs + submissão | Verificação + doc manual | Não |
| D7 | PII | `sanitizeAttributionValue` + fluxo de e-mail existente | Não |

Todas as decisões cabem no envelope "mudança leve" (sem novo processo/worker/Redis/heap/DDL).
