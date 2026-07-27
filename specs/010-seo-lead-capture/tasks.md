---

description: "Task list for SEO Fix, Signup Attribution & Article Lead Capture"
---

# Tasks: SEO Fix, Signup Attribution & Article Lead Capture

**Input**: Design documents from `/specs/010-seo-lead-capture/` (plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md)

**Tests**: Não solicitados explicitamente na spec. Tarefas de teste incluídas abaixo são pontuais
(cobrem a lógica NOVA de sanitização/persistência introduzida por US2, seguindo o padrão de
testes `node --test` já usado no repo) — não é TDD completo, é reforço de regressão no que muda.

**Organization**: Tarefas agrupadas por user story (spec.md) para permitir implementação e
validação independentes de cada uma. Restrição canônica em todas as fases: mudança leve, sem
novo processo/worker/Redis/heap, sem migration/DDL (AGENTS.md, política de memória).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependência de tarefa incompleta)
- **[Story]**: US1 (P1 — SEO técnico), US2 (P1 — atribuição de cadastro), US3 (P2 — lead
  magnet no artigo), US4 (P2 — sitemap/robots + submissão)

## Path Conventions

Web app existente: frontend em `dashboard/` (Next.js App Router), backend em `src/` (Fastify).
Nenhuma pasta/serviço novo — só arquivos dentro das duas árvores já existentes + `docs/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirmar dependências instaladas e capturar a baseline vermelha antes de qualquer
mudança de código (evidência para comparar com o "depois").

- [X] T001 Rodar `npm ci` na raiz do repo e `npm ci` dentro de `dashboard/` para garantir
      dependências instaladas (nenhuma dependência nova é introduzida por esta feature).
- [X] T002 Capturar a baseline vermelha rodando, de dentro de `dashboard/`: `npm run
      guard:seo-registry` e `npm run lint:seo-metadata` (scripts em
      `dashboard/scripts/guard-seo-registry-coverage.mjs` e
      `dashboard/scripts/lint-seo-metadata-duplicates.mjs`) — confirmar que os dois erros
      conhecidos aparecem (rotas `/cadastro`/`/parcerias` ausentes do registro; título duplicado
      `/conteudos` × `/blog/comecar-afiliado-whatsapp-sem-grupo-grande`). Não alterar código
      nesta tarefa; serve de evidência "antes" para o quickstart.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Prerequisitos bloqueantes compartilhados por todas as user stories.

Nenhuma tarefa fundacional bloqueante é necessária nesta feature: US1, US2, US3 e US4 tocam
arquivos disjuntos (`seo-registry.mjs`/páginas estáticas; `marketing-attribution.js` +
`login/page.js` + `auth.js`; `LeadMagnetCard.jsx`; `sitemap.js`/`robots.js`/docs) e reaproveitam
infraestrutura já existente e funcional (FR-006). Prosseguir direto para as user stories a
partir do Setup.

**Checkpoint**: Setup completo (T001-T002) — user stories podem começar em paralelo.

---

## Phase 3: User Story 1 - Corrigir SEO técnico que sufoca tráfego orgânico (Priority: P1) 🎯 MVP

**Goal**: Toda página pública indexável aparece no sitemap; nenhum par de páginas compete pelo
mesmo título. `npm run guard:seo-registry`, `npm run lint:seo-metadata` e `npm run
validate:seo-p0` (de dentro de `dashboard/`) ficam verdes sem os dois erros conhecidos.

**Independent Test**: Rodar os três comandos acima de dentro de `dashboard/` e confirmar exit 0
sem os erros de `/cadastro`/`/parcerias` ausentes e sem o par duplicado `/conteudos` × artigo.

### Implementation for User Story 1

- [X] T003 [P] [US1] Adicionar a entrada `/cadastro` em `CONTENT_SEO_ROUTES` em
      `dashboard/lib/seo-registry.mjs`: `{ path: '/cadastro', title: <título único, ex.:
      "Cadastro BOTinho — teste grátis para automatizar ofertas no WhatsApp">, description:
      <opcional>, template: 'signup', priority: <coerente com rotas comerciais, ex. 0.7>,
      changeFrequency: 'monthly', lastModified: DEFAULT_LAST_MODIFIED (ou
      resolveLastModified), indexable: true }`. `/cadastro` é uma página de redirect
      (`dashboard/app/cadastro/page.js`) sem `metadata` própria — o `title` explícito no
      registro é a única fonte, evitando que o lint tente (e falhe) parsear o arquivo.
- [X] T004 [P] [US1] Adicionar a entrada `/parcerias` em `CONTENT_SEO_ROUTES` em
      `dashboard/lib/seo-registry.mjs`: `{ path: '/parcerias', title: <mesmo título já usado
      em `dashboard/app/parcerias/page.js` — "Parcerias BOTinho | Co-marketing para admins e
      afiliados", ou um título único equivalente>, description: <opcional>, template:
      'partnerships', priority: <coerente, ex. 0.7>, changeFrequency: 'monthly',
      lastModified: DEFAULT_LAST_MODIFIED (ou resolveLastModified), indexable: true }`.
      Definir o `title` explícito no registro evita que
      `dashboard/scripts/lint-seo-metadata-duplicates.mjs` capture por engano o primeiro
      `title:` do arquivo (que hoje é o de um item de lista interno, não o título real da
      página).
- [X] T005 [US1] Em `dashboard/lib/seo-registry.mjs`, diferenciar a entrada existente de
      `/conteudos` em `CONTENT_SEO_ROUTES` (hoje `{ path: '/conteudos', template:
      'content-hub', ... }` sem `title`/`description` explícitos) adicionando um `title` de
      **hub** explícito (ex. reaproveitar/adaptar "Conteúdos: blog e materiais para afiliados
      no WhatsApp — hub de conteúdo BOTinho") e uma `description` de hub, distintos do título
      do artigo `/blog/comecar-afiliado-whatsapp-sem-grupo-grande`. Isso faz o
      `lint-seo-metadata-duplicates.mjs` usar `route.title`/`route.description` do registro em
      vez de cair no parser ingênuo de `app/conteudos/page.js` (que hoje casa por engano com o
      primeiro `title:` do arquivo — um item de `blogPosts`, que é justamente o título do
      artigo). Depende de T003/T004 apenas por estarem no mesmo arquivo (editar em sequência
      para evitar conflito de merge, não por dependência lógica).
- [X] T006 [US1] Rodar `npm run guard:seo-registry` de dentro de `dashboard/` e confirmar exit
      0, sem `/cadastro` nem `/parcerias` na lista de rotas ausentes (verifica T003/T004).
- [X] T007 [US1] Rodar `npm run lint:seo-metadata` de dentro de `dashboard/` e confirmar exit
      0, sem o par duplicado `/conteudos` × `/blog/comecar-afiliado-whatsapp-sem-grupo-grande`
      (verifica T005).
- [X] T008 [US1] Rodar `npm run validate:seo-p0` de dentro de `dashboard/` e confirmar que a
      suíte agregadora sai verde (SC-001), consolidando T006/T007.

**Checkpoint**: US1 completa e testável de forma independente — SEO técnico já não vaza; pode
ser validada/deployada isoladamente das demais stories.

---

## Phase 4: User Story 2 - Medir qual conteúdo orgânico vira cadastro (Priority: P1)

**Goal**: Todo cadastro novo grava a página de entrada (first-touch) e UTMs capturados na
metadata do evento durável `signup_created`, sem migration de schema; a dona consegue consultar
cadastros agrupados por landing.

**Independent Test**: Entrar por `/blog/<artigo>?utm_source=teste&utm_medium=organic&utm_campaign=lote1`,
concluir o cadastro, e confirmar via a rota admin de leitura que o cadastro está associado à
landing e aos UTMs capturados; repetir sem UTMs e confirmar que o cadastro conclui normalmente
com UTMs vazios e a landing ainda registrada.

### Implementation for User Story 2

- [X] T009 [P] [US2] Em `dashboard/lib/marketing-attribution.js`, adicionar uma função de
      persistência first-touch da página de entrada (ex.: `captureFirstTouchLandingPage()` /
      `getFirstTouchLandingPage()`) que grava, **só na primeira vez da sessão**, um cookie
      `SameSite=Lax` (ex.: `first_touch_landing`) com `${pathname}${search}` sanitizado via
      `sanitizeAttributionValue` (truncado a 500 chars); se já existir, não sobrescreve
      (semântica first-touch, D4). Deve degradar graciosamente (retornar vazio) quando
      `document`/cookies não estão disponíveis ou estão bloqueados — nunca lançar exceção.
- [X] T010 [P] [US2] Em `dashboard/components/marketing/OrganicPageTracker.jsx`, chamar a
      captura first-touch de T009 dentro do `useEffect` existente (junto do
      `trackEvent(TRACKING_EVENTS.ORGANIC_PAGE_VIEW, ...)`), sem alterar o comportamento de
      tracking/click já existente.
- [X] T011 [US2] Em `dashboard/app/login/page.js`, no fluxo de registro (`handleSubmit` /
      `api.register(...)`), ler a landing first-touch persistida por T009; se ausente, usar
      fallback `${window.location.pathname}${window.location.search}` (ou apenas `pathname`);
      se ainda ausente, enviar vazio. Incluir o valor como `landingPage` no objeto de
      atribuição passado para `api.register(...)`, sem quebrar o payload existente (`ref`,
      `aff_code`, UTMs). Depende de T009/T010.
- [X] T012 [US2] Em `src/api/routes/auth.js` (`POST /register`), aceitar `landingPage`
      (string, opcional) no body, sanitizar no servidor (mesma regra de
      `sanitizeAttributionValue`: remover caracteres fora de `[\p{L}\p{N}._~:@/-]`, colapsar
      `-` repetidos, truncar a 500 chars) e incluir como `landing_page` na metadata do evento
      `trackAnalyticsEventSafe({ event: 'signup_created', metadata: { ... } })` (linhas
      ~443-460), junto dos campos `utm_*` já existentes. Ausência de `landingPage` MUST NOT
      bloquear o cadastro (gravar string vazia) — não alterar a ordem/atomicidade do fluxo
      best-effort já documentado no arquivo (o cadastro sempre retorna token).
- [X] T013 [P] [US2] Adicionar rota `GET /marketing/signups-by-landing` em
      `src/api/routes/admin.js` (junto das demais rotas `/marketing/*`, ex. próxima a
      `/marketing/campaigns`), seguindo o mesmo padrão de `db.$queryRaw` com
      `json_extract(metadata, '$.landing_page')` agrupado por landing (janela `from`/`to` via
      `parseDateRange`, proteção `requireAdmin(req, reply, 'admin:read')`, auditoria
      `writeAdminAuditLog`), retornando contagem de cadastros por landing (FR-007). Sem PII
      sensível na resposta (só landing/contagem).
- [X] T014 [P] [US2] Adicionar o client wrapper `adminMarketingSignupsByLanding(params)` em
      `dashboard/lib/api.js` (mesmo padrão de `adminMarketingCampaigns`/`adminMarketingFunnel`),
      consumindo a rota de T013.
- [X] T015 [US2] Em `dashboard/app/admin/marketing-growth/page.js`, adicionar um card/tabela
      "Cadastros por página de entrada" que consome `api.adminMarketingSignupsByLanding(...)`
      (T014), seguindo o mesmo padrão visual do card de campanhas existente (FR-007 — "a dona
      MUST conseguir visualizar/consultar"). Depende de T013/T014.
- [X] T016 [P] [US2] Adicionar teste `test/register-landing-attribution.test.js` cobrindo a
      sanitização/gravação de `landing_page` introduzida em T012 (ex.: `landingPage` ausente →
      metadata com `landing_page` vazio e cadastro segue OK; `landingPage` com caracteres fora
      da allowlist → sanitizado; string maior que 500 → truncada). Seguir o padrão de mock/DB
      já usado em testes existentes de `src/api/routes/auth.js` (ex.
      `test/auth-rate-limit.test.js`) para não depender de banco real.
- [~] T017 [US2] DIFERIDA (validação manual pós-deploy — não executável no ciclo automatizado):
      validar em staging o roteiro completo do quickstart (US2): entrar por URL de artigo com
      UTMs → cadastrar → consultar via T015/T013 → repetir sem UTMs e confirmar landing ainda
      registrada com UTMs vazios (SC-004, FR-005, FR-007). Rodar após merge em `develop`.

**Checkpoint**: US2 completa e testável de forma independente de US1/US3/US4 — cadastros novos
já carregam landing/UTMs consultáveis por landing.

---

## Phase 5: User Story 3 - Transformar visita de artigo em lead com captura de e-mail (Priority: P2)

**Goal**: Toda página de artigo exibe o bloco de captura de e-mail (`LeadMagnetCard` dentro de
`ArticleShell`, já existente); validação amigável de e-mail vazio/inválido; cópia usa a marca
BOTinho.

**Independent Test**: Abrir uma página de artigo, ver o bloco de captura, submeter e-mail
inválido/vazio (mensagem de validação amigável, nenhum lead) e e-mail válido (lead registrado
pelo fluxo existente).

### Implementation for User Story 3

- [X] T018 [P] [US3] Verificar em `dashboard/components/marketing/_preservationBlogPosts.js`
      (ou lista equivalente de posts) e nos `page.js` de `dashboard/app/blog/*` que **todo**
      artigo é renderizado via `dashboard/components/marketing/ArticleShell.jsx` (que já
      injeta `<LeadMagnetCard origin={origin} compact />`); se algum artigo novo não usar
      `ArticleShell`, migrá-lo para o shell (sem duplicar o card manualmente).
- [X] T019 [US3] Em `dashboard/components/marketing/LeadMagnetCard.jsx`, ajustar a validação
      do campo `email` para amigável no cliente: hoje o form é um GET nativo com só
      `required`/`type="email"` (validação padrão do navegador); adicionar validação
      JavaScript no `onSubmit` (regex já usada no repo, ex.
      `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`) que **impede o submit** e mostra uma mensagem amigável
      inline quando o e-mail está vazio ou mal formatado, sem alterar o destino
      (`/login?mode=register`) nem os campos hidden existentes (FR-011).
- [X] T020 [US3] Revisar toda a cópia visível de `dashboard/components/marketing/LeadMagnetCard.jsx`
      (título, texto, rótulos, botão) e confirmar que nenhum texto usa nome interno diferente
      de **BOTinho** (FR-012); ajustar se necessário.
- [~] T021 [US3] DIFERIDA (validação manual pós-deploy — não executável no ciclo automatizado):
      validar (staging ou local) o roteiro do quickstart (US3): abrir artigo → bloco visível
      dentro do `ArticleShell` → submeter e-mail inválido/vazio → ver mensagem amigável sem
      navegação → submeter e-mail válido → confirmar redirecionamento para
      `/login?mode=register&email=...` com fluxo de cadastro/lead prosseguindo (SC-005).

**Checkpoint**: US3 completa e testável de forma independente — todo artigo captura lead com
validação amigável e marca correta.

---

## Phase 6: User Story 4 - Sitemap/robots refletem todas as rotas indexáveis novas (Priority: P2)

**Goal**: `sitemap.xml` inclui as 6 páginas de blog novas + `/cadastro` + `/parcerias`;
`robots` não bloqueia nenhuma delas; existe documentação do passo manual de submissão no
Google Search Console e Bing Webmaster.

**Independent Test**: Inspecionar o sitemap gerado e confirmar as 9 URLs-alvo presentes;
confirmar que `robots.js` não lista nenhuma delas em `disallow`; confirmar que a documentação
de submissão existe e é acionável.

### Implementation for User Story 4

- [X] T022 [US4] Gerar/inspecionar o sitemap (`dashboard/app/sitemap.js`, que deriva 100% de
      `getIndexableSeoRoutes()`) após T003-T005 e confirmar que as 6 páginas de blog novas
      (as já registradas em `CONTENT_SEO_ROUTES`/`PROGRAMMATIC_SEO_ROUTES` antes desta
      feature) + `/cadastro` + `/parcerias` aparecem (SC-002, FR-008). Depende de US1
      (T003-T005) para `/cadastro`/`/parcerias` existirem no sitemap.
- [X] T023 [P] [US4] Inspecionar `dashboard/app/robots.js` e confirmar que a lista `allow`/
      `disallow` não bloqueia `/blog/*`, `/cadastro` nem `/parcerias` (hoje `disallow` cobre
      só `/painel`, `/painel/*`, `/api/admin/*`, `/api/auth/*`, `/api/dashboard/*`,
      `/api/payments/*`, `/promo-vip-7dias` — nenhuma rota pública nova deveria colidir); se
      alguma rota nova cair sob um prefixo bloqueado, ajustar `robots.js` para liberá-la.
- [X] T024 [P] [US4] Criar `docs/deploy/seo-search-console-submission.md` documentando o passo
      manual de submissão do sitemap no Google Search Console e no Bing Webmaster (verificação
      de propriedade do domínio `espelhagrupos.com.br`, submissão da URL
      `https://espelhagrupos.com.br/sitemap.xml`, onde conferir status de indexação) — passo
      operacional, não código (FR-009).

**Checkpoint**: US4 completa — cobertura de sitemap/robots verificada e passo de submissão
documentado.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Fechamento da feature — reconfirmar o envelope de "mudança leve" e rodar o
quickstart completo antes do PR `develop` → validação em staging.

- [X] T025 Confirmar o envelope de custo (SC-006/FR-013): rodar `grep "name:"
      ecosystem.config.cjs` (mesmos 7 apps de antes, nenhum novo) e `git diff --stat` (mudanças
      concentradas em `dashboard/` + `src/api/routes/auth.js` + `src/api/routes/admin.js` +
      `docs/`) — nenhuma dependência nova de Redis/BullMQ, nenhum processo PM2 novo, nenhum
      aumento de heap.
- [~] T026 DIFERIDA (validação manual pós-deploy — não executável no ciclo automatizado):
      rodar o roteiro completo de `specs/010-seo-lead-capture/quickstart.md` (US1-US4) em
      staging (`http://178.105.54.0:3006`) após merge em `develop`, confirmando os critérios de
      aceite de cada seção antes de abrir o PR `develop` → `main`.
- [X] T027 [P] Atualizar `specs/010-seo-lead-capture/quickstart.md` (ou anexar nota) com a
      evidência final ("depois") dos comandos capturados na baseline de T002, confirmando os
      dois erros conhecidos resolvidos.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências — pode começar imediatamente.
- **Foundational (Phase 2)**: N/A — nenhuma tarefa bloqueante; ver nota na Phase 2.
- **User Stories (Phase 3-6)**: dependem apenas do Setup (T001-T002).
  - US1 (P1) e US2 (P1) são totalmente independentes entre si (arquivos disjuntos) e podem
    rodar em paralelo.
  - US3 (P2) é independente de US1/US2/US4 (só toca `LeadMagnetCard.jsx`/`ArticleShell.jsx`).
  - US4 (P2) depende de US1 (T003-T005) apenas para a verificação de sitemap incluir
    `/cadastro`/`/parcerias` (T022); T023/T024 são independentes e podem rodar antes.
- **Polish (Phase 7)**: depende de todas as user stories desejadas estarem completas.

### User Story Dependencies

- **US1 (P1)**: sem dependência de outra story. MVP recomendado.
- **US2 (P1)**: sem dependência de outra story (independente de US1).
- **US3 (P2)**: sem dependência de outra story.
- **US4 (P2)**: T022 depende de US1 (T003-T005); T023/T024 são independentes.

### Parallel Opportunities

- T003/T004 (novas entradas de registro) podem rodar em paralelo entre si (mesmo arquivo, mas
  edições em blocos distintos — coordenar merge).
- T009/T010 (persistência first-touch + integração no tracker) podem rodar em paralelo com
  T013/T014 (rota admin + client) — arquivos totalmente diferentes.
- T018 (verificação de ArticleShell) e T019/T020 (LeadMagnetCard) podem rodar em paralelo com
  qualquer tarefa de US1/US2/US4.
- T023/T024 (robots + doc) podem rodar em paralelo com US1/US2/US3.

---

## Parallel Example: User Story 2

```bash
# Em paralelo (arquivos diferentes):
Task: "Persistência first-touch em dashboard/lib/marketing-attribution.js (T009)"
Task: "Rota admin GET /marketing/signups-by-landing em src/api/routes/admin.js (T013)"
Task: "Client wrapper adminMarketingSignupsByLanding em dashboard/lib/api.js (T014)"

# Depois, em sequência (dependem dos anteriores):
Task: "Integrar first-touch no OrganicPageTracker.jsx (T010, depende de T009)"
Task: "Enviar landingPage no /register via login/page.js (T011, depende de T009/T010)"
Task: "Gravar landing_page na metadata de signup_created em auth.js (T012)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Phase 1: Setup (T001-T002).
2. Phase 2: Foundational — N/A, sem bloqueio.
3. Completar Phase 3: User Story 1 (T003-T008).
4. **PARAR e VALIDAR**: rodar `npm run validate:seo-p0` de dentro de `dashboard/` e confirmar
   verde — este é o "parar o vazamento", menor risco e maior alavanca imediata.
5. Deploy/validar em staging antes de seguir para as próximas stories.

### Incremental Delivery

1. Setup → Foundational (N/A) → Fundação pronta.
2. US1 (SEO técnico) → validar independentemente → deploy/demo (MVP).
3. US2 (atribuição de cadastro) → validar independentemente → deploy/demo.
4. US4 (sitemap/robots + doc) → validar (depende de US1 para T022) → deploy/demo.
5. US3 (lead magnet no artigo) → validar independentemente → deploy/demo.
6. Cada story agrega valor sem quebrar as anteriores — ordem de entrega pode seguir a
   prioridade da spec (P1, P1, P2, P2) ou paralelizar US1/US2/US3 e fechar com US4.

### Parallel Team Strategy

Com mais de uma pessoa disponível:

1. Completar Setup em conjunto.
2. A partir daí:
   - Dev A: US1 (seo-registry.mjs)
   - Dev B: US2 (marketing-attribution.js + login/page.js + auth.js + admin.js)
   - Dev C: US3 (LeadMagnetCard.jsx)
3. Uma pessoa fecha US4 (T022 após US1 mergear; T023/T024 podem começar antes) e a Phase 7.

---

## Notes

- [P] = arquivos diferentes, sem dependência de tarefa incompleta.
- [Story] mapeia cada tarefa à user story correspondente para rastreabilidade.
- Nenhuma tarefa introduz processo PM2/worker/Redis/BullMQ/heap novo (FR-013/SC-006) nem
  migration/DDL (D3 em research.md) — toda persistência nova de US2 é metadata JSON de um
  evento durável já existente.
- Marca pública em todo texto novo = **BOTinho** (FR-012) — conferir em T019/T020 e em
  qualquer string nova de T003-T005/T024.
- Fluxo de entrega: branch a partir de `develop` → validar em staging
  (`http://178.105.54.0:3006`) → PR `develop` → `main`. Nenhuma tarefa acima toca `.env`,
  portas ou deploy.
- Commitar após cada tarefa ou grupo lógico; parar em qualquer checkpoint de story para validar
  antes de seguir.
