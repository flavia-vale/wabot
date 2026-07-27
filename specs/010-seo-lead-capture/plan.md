# Implementation Plan: SEO Fix, Signup Attribution & Article Lead Capture

**Branch**: `010-seo-lead-capture` | **Date**: 2026-07-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-seo-lead-capture/spec.md`

## Summary

Três frentes de baixo risco, todas dentro do dashboard Next.js e da API existente, sem
novo processo/worker/Redis/heap:

1. **US1/US4 — Parar o vazamento de SEO técnico.** Registrar `/cadastro` e `/parcerias`
   no `lib/seo-registry.mjs` (o `app/sitemap.js` deriva o sitemap 100% do registro, então
   registrar já resolve a presença no sitemap) e diferenciar o título de `/conteudos` para
   remover a duplicidade com o artigo `/blog/comecar-afiliado-whatsapp-sem-grupo-grande`.
   Critério objetivo: `npm run guard:seo-registry`, `npm run lint:seo-metadata` e a suíte
   `npm run validate:seo-p0` verdes. As 6 páginas de blog novas já estão registradas (o guard
   passaria/falharia por elas) — US4 é majoritariamente verificação + documentação de submissão
   no Search Console/Bing.

2. **US2 — Medir qual conteúdo orgânico vira cadastro.** Hoje o `/register` só persiste
   entrada/landing para o fluxo de **afiliado** (`AffiliateAttributionTouch`) e emite
   `signup_created` (AnalyticsEvent) com `source`/`utm_*`, **sem a página de entrada** para
   cadastros orgânicos. Fechar essa lacuna reaproveitando `marketing-attribution` +
   `OrganicPageTracker`: capturar a página de entrada (first-touch) no cliente e enviá-la no
   payload de `/register`, persistindo-a na metadata do evento `signup_created` (sem migration
   de schema). Consulta agrupada por landing = leitura desses eventos (rota admin de leitura).

3. **US3 — Captura de e-mail no artigo.** O `ArticleShell` já renderiza `LeadMagnetCard`, que
   já posta `mode=register` + `email` para `/login` (o lead vira cadastro). Escopo aqui é
   **verificar/ajustar**: garantir que todo artigo passe pelo `ArticleShell`, que a validação de
   e-mail (vazio/inválido) seja amigável e que a cópia use a marca **BOTinho**.

Restrições canônicas respeitadas: mudança leve (FR-013/SC-006), reaproveita infra, marca
pública = BOTinho, fluxo feature → develop → main sem tocar `.env`/portas/deploy.

## Technical Context

**Language/Version**: Node.js (ESM no dashboard), Next.js 14 App Router (dashboard), Fastify (API)

**Primary Dependencies**: Next.js (`app/`), React (client components de marketing), Fastify
(`src/api/routes/auth.js`), Prisma/SQLite (AnalyticsEvent) — todas já presentes; nenhuma nova.

**Storage**: SQLite via Prisma. **Sem migration nova** — a atribuição orgânica de cadastro é
gravada na metadata (JSON) do evento durável `AnalyticsEvent('signup_created')` já existente.

**Testing**: `node --test` (repo raiz e `dashboard/scripts/*` guards); guards de SEO
(`guard:seo-registry`, `lint:seo-metadata`, `validate:seo-p0`) como aceitação executável.

**Target Platform**: Web (dashboard público Next.js) + API Fastify no VPS.

**Project Type**: Web application (frontend `dashboard/` + backend `src/`).

**Performance Goals**: N/A (conteúdo estático + instrumentação leve; sem caminho quente novo).

**Constraints**: Envelope de "mudança leve" da política de memória do repo — **nenhum** novo
processo PM2/worker, dependência de Redis/BullMQ, cache em memória ou aumento de heap
(FR-013/SC-006). PII: e-mail de lead segue tratamento já adotado; atribuição não expõe PII
sensível em claro (FR-014) — landing/UTMs passam por `sanitizeAttributionValue`.

**Scale/Scope**: ~4 arquivos de código tocados no dashboard + ~1 na API; conteúdo estático de
poucas rotas; nenhum volume de runtime relevante.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

O arquivo `.specify/memory/constitution.md` é o template não preenchido (placeholders), portanto
não há princípios formais versionados a checar. Na ausência dele, os gates aplicáveis vêm das
regras canônicas do `AGENTS.md` do repo, que funcionam como constituição de fato:

- **Política de memória (REGRA #1/#2/#3)**: nenhuma mudança memory-heavy. ✅ Feature é conteúdo
  estático + instrumentação leve; sem novo processo/worker/Redis/heap. Sem necessidade de
  super-sinalização de RAM.
- **Fluxo de entrega**: feature → `develop` (staging) → `main`. ✅ Sem tocar `.env`/portas/deploy.
- **Marca pública = BOTinho** em toda cópia nova. ✅ (FR-012).
- **Sem migration destrutiva / DDL sob lock**: ✅ Nenhuma migration nova (usa AnalyticsEvent).

**Resultado do gate: PASS** — nenhuma violação; a seção Complexity Tracking fica vazia.

## Project Structure

### Documentation (this feature)

```text
specs/010-seo-lead-capture/
├── plan.md              # Este arquivo (/speckit-plan)
├── research.md          # Phase 0 — decisões (first-touch, persistência, título)
├── data-model.md        # Phase 1 — entidades e shape da metadata do evento
├── quickstart.md        # Phase 1 — roteiro de validação executável
├── contracts/           # Phase 1 — contratos (register payload, seo-registry, sitemap/robots)
│   ├── register-attribution.md
│   ├── seo-registry-entry.md
│   └── lead-capture.md
└── tasks.md             # Phase 2 (/speckit-tasks — NÃO criado aqui)
```

### Source Code (repository root)

```text
dashboard/
├── lib/
│   ├── seo-registry.mjs            # US1: + entradas /cadastro e /parcerias
│   └── marketing-attribution.js    # US2: reaproveitado (entry-page first-touch)
├── app/
│   ├── sitemap.js                  # US4: derivado do registro (sem mudança de lógica)
│   ├── robots.js                   # US4: já não bloqueia as rotas (verificação)
│   ├── conteudos/page.js           # US1: diferenciar `title`
│   ├── cadastro/page.js            # US1: alvo do registro (metadata coerente)
│   ├── parcerias/page.js           # US1: alvo do registro (metadata coerente)
│   └── login/page.js               # US2: enviar entry-page (first-touch) no /register
├── components/marketing/
│   ├── OrganicPageTracker.jsx      # US2: origem do first-touch de página de entrada
│   ├── ArticleShell.jsx            # US3: já renderiza LeadMagnetCard (verificação)
│   └── LeadMagnetCard.jsx          # US3: validação amigável + cópia BOTinho (ajuste)
└── scripts/
    ├── guard-seo-registry-coverage.mjs   # US1: gate de aceitação (não alterar)
    └── lint-seo-metadata-duplicates.mjs  # US1: gate de aceitação (não alterar)

src/
└── api/routes/auth.js              # US2: aceitar landingPage e gravar na metadata do
                                    #      signup_created (sem migration)

docs/
└── deploy/seo-search-console-submission.md   # US4/FR-009: passo manual documentado
```

**Structure Decision**: Web application. A frente de SEO e captura vive inteira em
`dashboard/` (Next.js App Router); a única mudança na API é aditiva e não-destrutiva em
`src/api/routes/auth.js` (persistir a landing orgânica na metadata de um evento durável já
existente). Nenhuma pasta/serviço novo.

## Complexity Tracking

> Nenhuma violação de gate. Seção intencionalmente vazia.
