# Implementation Plan: SEO Fix, Signup Attribution & Article Lead Capture

**Branch**: `010-seo-lead-capture` | **Date**: 2026-07-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-seo-lead-capture/spec.md`

## Summary

Corrigir SEO técnico pré-existente e fechar o funil orgânico reaproveitando 100% da
infra existente do dashboard Next, sem novo processo/worker/Redis/heap:

1. **US1/US4 (SEO técnico)** — registrar `/cadastro` e `/parcerias` em
   `lib/seo-registry.mjs` (entram automaticamente em `app/sitemap.js`), e diferenciar o
   título de `/conteudos` do artigo `comecar-afiliado-whatsapp-sem-grupo-grande` dando à
   entrada `/conteudos` `title`/`description` explícitos no registry (hoje o lint
   raspa o primeiro `title:` da page.js, que é um item de lista de artigos → falso
   duplicado). Critério objetivo: `npm run validate:seo-p0` verde.
2. **US2 (atribuição)** — capturar a **página de entrada** (landing/rota) no cadastro,
   além dos UTMs que já são capturados. Estender o payload de `POST /register` e a
   metadata do evento durável `signup_created`; a consulta por landing agrupa esse
   evento. Reaproveita `OrganicPageTracker` + `lib/marketing-attribution.js` (first-touch
   já é a semântica da infra de UTM existente).
3. **US3 (lead capture)** — `ArticleShell` **já** renderiza `<LeadMagnetCard>`; o trabalho
   é garantir que as 6 páginas de blog-alvo rendem via ArticleShell (herdam o bloco) e
   validar o comportamento de e-mail válido/ inválido do fluxo de lead magnet existente.

Marca pública = **BOTinho** em toda cópia nova. Entrega: branch de `develop` → staging →
PR `develop`→`main`. Sem tocar `.env`/portas/deploy.

## Technical Context

**Language/Version**: Node.js (ESM `.mjs` para scripts/registry), React 18 / Next.js (App Router) no `dashboard/`; Fastify no `src/api` (backend do `/register`).

**Primary Dependencies**: Next.js App Router (`app/sitemap.js`, `app/robots.js`), `lib/seo-registry.mjs`, `components/marketing/{ArticleShell,LeadMagnetCard,OrganicPageTracker}.jsx`, `lib/marketing-attribution.js`, `lib/analytics.js`; backend `src/api/routes/auth.js` (`POST /register`), `AnalyticsEvent` (Prisma/SQLite).

**Storage**: SQLite via Prisma. Atribuição de cadastro persiste como metadata JSON em `AnalyticsEvent(event='signup_created')` — **sem migration de schema** (campo metadata já existe). Nenhuma tabela nova.

**Testing**: `node --test` (backend) + guards/lints Node no dashboard: `npm run guard:seo-registry`, `npm run lint:seo-metadata`, `npm run validate:seo-p0` (rodados de dentro de `dashboard/`).

**Target Platform**: Web (dashboard Next SSR) + API Fastify no VPS. Staging `:3006/:3004`, prod `:3000/:3001` (inalterado).

**Project Type**: Web app (frontend `dashboard/` + backend `src/api`).

**Performance Goals**: Nenhuma meta nova de throughput. Conteúdo estático + 1 campo extra no payload de cadastro (custo desprezível).

**Constraints**: **Mudança leve, memory-neutral** (FR-013/SC-006): sem novo processo PM2, worker, Redis/BullMQ, cache em memória ou aumento de heap. PII: e-mail de lead e valores de atribuição seguem `sanitizeAttributionValue` / tratamento de PII já adotado (FR-014). Não regredir cobertura do guard para blogs futuros.

**Scale/Scope**: ~2 arquivos de registry/página no dashboard, 1 estender de payload no dashboard (form de cadastro) + `auth.js` no backend, verificação de 6 páginas de blog, 1 doc operacional de submissão (Search Console/Bing). Nenhuma dependência nova.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

O arquivo `.specify/memory/constitution.md` é o template não ratificado (placeholders) — não há princípios versionados que imponham gates específicos. Na ausência de constituição ratificada, aplicam-se as regras canônicas do repo (`AGENTS.md`) como gates de fato:

| Gate (AGENTS.md) | Status |
|---|---|
| Política de memória — nenhuma mudança memory-heavy (novo processo/worker/Redis/heap/cache) | **PASS** — feature é conteúdo estático + 1 campo de metadata; SC-006 verificável no ecosystem/diff. |
| Fluxo feature → `develop` → staging → `main`; nunca PR direto p/ main | **PASS** — planejado. |
| Não tocar `.env`, portas, deploy | **PASS** — nada em `.env`/portas; sitemap/robots já servidos pelo Next. |
| Marca pública = BOTinho | **PASS** — FR-012 exige em toda cópia nova. |
| Reaproveitar infra, não duplicar lógica | **PASS** — registry, sitemap, ArticleShell, LeadMagnetCard, OrganicPageTracker, marketing-attribution reaproveitados. |
| Guards de aceitação existentes verdes | **PASS (alvo)** — `validate:seo-p0` é o critério objetivo. |

Sem violações a justificar → Complexity Tracking vazio.

## Project Structure

### Documentation (this feature)

```text
specs/010-seo-lead-capture/
├── plan.md              # Este arquivo
├── research.md          # Phase 0 — decisões (fix de duplicidade, atribuição, lead)
├── data-model.md        # Phase 1 — atribuição de cadastro, lead, entrada de registry
├── quickstart.md        # Phase 1 — como validar (guards + fluxos manuais)
├── contracts/
│   ├── seo-registry-entry.md    # contrato da entrada de rota no registry / sitemap
│   ├── register-attribution.md  # contrato do payload /register + metadata do evento
│   └── lead-magnet-form.md      # contrato do bloco de captura no ArticleShell
└── tasks.md             # Phase 2 (/speckit-tasks — NÃO criado aqui)
```

### Source Code (repository root)

```text
dashboard/
├── lib/
│   ├── seo-registry.mjs                 # (edit) +entradas /cadastro, /parcerias; +title/description de /conteudos
│   └── marketing-attribution.js         # (reuso) sanitização + chaves de atribuição; +chave de landing se necessário
├── app/
│   ├── sitemap.js                       # (reuso, sem edição) já deriva de getIndexableSeoRoutes()
│   ├── robots.js                        # (verificar) não bloquear rotas indexáveis novas
│   ├── cadastro/page.js                 # (edit) form encaminha landing/entry path no POST /register
│   ├── conteudos/page.js                # (verificar) título permanece 'Conteúdos: ...'
│   └── blog/_preservationBlogPosts.js   # (verificar) 6 blogs-alvo rendem via ArticleShell → herdam LeadMagnetCard
├── components/marketing/
│   ├── ArticleShell.jsx                 # (reuso) já renderiza <LeadMagnetCard origin compact />
│   ├── LeadMagnetCard.jsx               # (reuso) fluxo de captura de e-mail já existente
│   └── OrganicPageTracker.jsx           # (reuso) first-touch/organic tracking
└── scripts/
    ├── guard-seo-registry-coverage.mjs  # (critério) deve passar
    └── lint-seo-metadata-duplicates.mjs # (critério) deve passar

src/api/routes/
└── auth.js                              # (edit) POST /register lê landing/entry path e grava na metadata de signup_created

docs/seo/
└── search-console-bing-submission.md    # (novo) passo operacional de submissão do sitemap (FR-009)
```

**Structure Decision**: Web app existente. Reaproveitamento máximo — a maioria das
mudanças é edição pontual em `lib/seo-registry.mjs` (SEO) e no par
`app/cadastro/page.js` + `src/api/routes/auth.js` (atribuição). US3 é
predominantemente verificação porque `ArticleShell` já injeta o `LeadMagnetCard`.
Nenhum diretório/serviço novo.

## Complexity Tracking

> Sem violações de gate. Nada a justificar.
