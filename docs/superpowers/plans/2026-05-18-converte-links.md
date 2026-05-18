# Converte Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar no dashboard do Botinho uma aba autenticada "Converte links" onde o cliente cola 1 a 10 URLs suportadas e recebe os links de afiliado convertidos.

**Architecture:** Reutilizar `detectLinks`, `convertLink`, credenciais por usuário e validação existente, sem criar tabelas ou tocar em portas/.env. A API terá uma rota autenticada isolada para conversão manual em lote; a UI chamará essa rota via proxy Next já existente e exibirá resultado por link.

**Tech Stack:** Fastify, Prisma SQLite existente, módulos ESM Node, Next.js App Router, React client components, `node:test`.

---

## Análise de risco STRICT

1. **Erros fatais:** evitar conversão em massa sem limite; validar body e URLs antes de chamar conversores; rotas com `try/catch` por item para impedir quebra do lote; UI com estado de loading e sem loops em `useEffect`; proteger contra texto gigante, spam de requisições, conversões concorrentes do mesmo usuário e conversores externos lentos.
2. **Breaking changes:** não alterar assinatura de `convertLink`, `detectLinks`, schema Prisma, portas, contrato das rotas existentes nem credenciais salvas.
3. **Efeito cascata:** nova rota e nova página são aditivas; navegação recebe apenas mais um item. Conversores existentes continuam sendo usados pelo bot sem alteração.
4. **Isolamento de ambiente:** sem `.env`, banco real ou migrations. Testes criam/removem usuário e credenciais no banco de teste/dev local via Prisma como os testes existentes.
5. **Bloqueio:** nenhum risco fatal/breaking identificado porque o plano é aditivo. Se algum teste indicar schema ausente, parar antes de mexer em `DATABASE_URL`.

## File Structure

- Create: `src/api/routes/linkConversion.js` — rota POST `/api/link-conversion/convert`, parsing de links, limite de 10 e conversão manual por usuário.
- Modify: `src/api/server.js` — registrar a rota em `/api/link-conversion`.
- Modify: `dashboard/lib/api.js` — adicionar método `convertLinks(text)`.
- Modify: `dashboard/app/dashboard/DashboardClientLayout.js` — adicionar item "Converte links" no menu Operação.
- Create: `dashboard/app/dashboard/converte-links/page.js` — página client-side com textarea, CTA, erro para mais de 10 links, saída 1:1/n:n e botões copiar.
- Create: `test/link-conversion-route.test.js` — testes da rota com mock de conversor, incluindo limites operacionais de tamanho, frequência, concorrência e timeout.

## Tasks

### Task 1: API route with batch validation

**Files:**
- Create: `src/api/routes/linkConversion.js`
- Modify: `src/api/server.js`
- Test: `test/link-conversion-route.test.js`

- [ ] **Step 1: Write route tests** covering: one valid link converted, more than 10 links returns HTTP 400 with explanatory message, missing credentials returns per-link error without calling converter, converter exception returns per-link error.
- [ ] **Step 2: Implement `linkConversionRoutes(app, deps)`** using `detectLinks`, `validateCredentialData`, `parseCredentialData`, `db.credential.findMany`, and injected `convertLink` fallback.
- [ ] **Step 3: Register route** in `src/api/server.js` with prefix `/api/link-conversion`.
- [ ] **Step 4: Run** `node --test test/link-conversion-route.test.js` and expect pass.

### Task 2: Dashboard API client and navigation

**Files:**
- Modify: `dashboard/lib/api.js`
- Modify: `dashboard/app/dashboard/DashboardClientLayout.js`

- [ ] **Step 1: Add `api.convertLinks(text)`** POSTing `{ text }` to `/api/link-conversion/convert`.
- [ ] **Step 2: Add nav item** `{ href: '/dashboard/converte-links', icon: '🔗', label: 'Converte links' }` under Operação.
- [ ] **Step 3: Verify dashboard lint/build later in Task 4.**

### Task 3: Dashboard page UX

**Files:**
- Create: `dashboard/app/dashboard/converte-links/page.js`

- [ ] **Step 1: Create client page** with textarea, link counter preview, max 10 guidance, submit button and loading state.
- [ ] **Step 2: Render API errors** with explicit Portuguese message: "Cole no máximo 10 links por vez..." for limit failures.
- [ ] **Step 3: Render results n:n** as cards containing platform, original URL, converted URL or item error, plus copy buttons for individual and all successful links.
- [ ] **Step 4: Avoid extra dependencies** and keep styling aligned with existing dashboard Tailwind classes.

### Task 4: Verification and finish

**Files:** all modified files

- [ ] **Step 1: Run** `node --test test/link-conversion-route.test.js`.
- [ ] **Step 2: Run** `npm test -- --test-name-pattern "manual|convers|link"` if useful; otherwise root `npm test` when time permits.
- [ ] **Step 3: Run** `cd dashboard && npm run lint`.
- [ ] **Step 4: Run** `cd dashboard && npm run build` because this is a perceptible dashboard route.
- [ ] **Step 5: Review** `git diff`, `git status --short`.
- [ ] **Step 6: Commit** changes on current branch and create PR metadata against `develop`.


### Task 5: Hardening operacional pós-review

**Files:**
- Modify: `src/api/routes/linkConversion.js`
- Modify: `dashboard/app/dashboard/converte-links/page.js`
- Modify: `test/link-conversion-route.test.js`

- [x] **Step 1: Limitar tamanho de payload/texto** com `bodyLimit` na rota e `MAX_TEXT_LENGTH` na API/UI.
- [x] **Step 2: Adicionar rate limit por usuário** para impedir spam de conversões manuais.
- [x] **Step 3: Bloquear conversões concorrentes do mesmo usuário** e limitar capacidade global do endpoint.
- [x] **Step 4: Aplicar timeout por item e deadline por requisição** para não manter workers presos em marketplaces lentos.
- [x] **Step 5: Cobrir hardening com testes** para texto grande, rate limit, concorrência e timeout.


### Task 6: Ajuste mobile first pós-review

**Files:**
- Modify: `dashboard/app/dashboard/converte-links/page.js`

- [x] **Step 1: Reduzir densidade visual no mobile** com cards menores, `p-4`, títulos compactos e métricas em chips.
- [x] **Step 2: Melhorar uso com dedo** usando botões `min-h-12`, CTA sticky no mobile e ações full-width.
- [x] **Step 3: Evitar overflow em URLs longas** com áreas roláveis/`break-all` nos links original e convertido.
- [x] **Step 4: Manter layout expandido em telas maiores** via classes `sm:` sem alterar contrato da API.
