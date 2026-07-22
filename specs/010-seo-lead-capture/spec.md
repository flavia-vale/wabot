# Feature Specification: SEO Fix, Signup Attribution & Article Lead Capture

**Feature Branch**: `010-seo-lead-capture`

**Created**: 2026-07-22

**Status**: Draft

**Input**: User description: "Semana 1 — parar vazamento & medir. Corrigir SEO técnico pré-existente (rotas /cadastro e /parcerias no sitemap, título duplicado /conteudos vs artigo de blog); instrumentar atribuição de cadastro por página de entrada (reaproveitar OrganicPageTracker + marketing-attribution); garantir sitemap/robots corretos para as 6 páginas novas de blog + /cadastro + /parcerias e documentar submissão no Search Console/Bing; adicionar bloco de captura de e-mail (lead magnet) nos artigos via ArticleShell. Restrições: mudanças leves, sem novo processo/worker/Redis/heap; reaproveitar infra existente; marca pública = BOTinho."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Corrigir SEO técnico que sufoca tráfego orgânico (Priority: P1)

Como dona do produto, quero que todas as páginas públicas indexáveis apareçam no sitemap e que nenhum par de páginas compita entre si com o mesmo título, para que o Google pare de ignorar/canibalizar conteúdo que já existe e o tráfego orgânico volte a crescer.

**Why this priority**: É o "parar o vazamento". Sem isso, todo esforço de conteúdo e captura downstream rende menos, porque páginas ficam fora do índice ou brigam entre si. É a correção de menor risco e maior alavanca imediata; os guards existentes tornam o critério objetivo.

**Independent Test**: Rodar `npm run guard:seo-registry` e `npm run lint:seo-metadata` de dentro de `dashboard/` e confirmar que passam sem os dois erros conhecidos (rotas `/cadastro` e `/parcerias` ausentes do registro; título duplicado entre `/conteudos` e `/blog/comecar-afiliado-whatsapp-sem-grupo-grande`). Verificar que o sitemap gerado lista `/cadastro` e `/parcerias`.

**Acceptance Scenarios**:

1. **Given** o registro de SEO sem `/cadastro` e `/parcerias`, **When** essas rotas públicas são registradas, **Then** `npm run guard:seo-registry` passa e o sitemap gerado inclui ambas as URLs.
2. **Given** `/conteudos` e o artigo `comecar-afiliado-whatsapp-sem-grupo-grande` com títulos idênticos, **When** um dos títulos é diferenciado, **Then** `npm run lint:seo-metadata` não reporta título duplicado entre essas duas páginas.
3. **Given** a suíte agregadora `npm run validate:seo-p0`, **When** executada após as correções, **Then** ela passa (guard + lint verdes).

---

### User Story 2 - Medir qual conteúdo orgânico vira cadastro (Priority: P1)

Como dona do produto, quero saber por qual página de entrada (e UTMs, se houver) cada pessoa que se cadastra chegou, para descobrir qual artigo/landing orgânico realmente gera leads e onde investir a seguir.

**Why this priority**: É o "medir". Sem atribuição, não há como decidir o que priorizar nas próximas semanas — o tráfego cresce às cegas. Reaproveita a infra existente (`OrganicPageTracker`, `marketing-attribution`), então é baixo custo.

**Independent Test**: Entrar por uma URL de artigo com parâmetros UTM, navegar até o cadastro, concluir o registro e confirmar que o cadastro ficou associado à página de entrada e às UTMs capturadas — visível em um relatório/consulta de atribuição, sem PII sensível exposta.

**Acceptance Scenarios**:

1. **Given** um visitante que entra por `/blog/<artigo>` com `utm_source`/`utm_medium`/`utm_campaign`, **When** ele conclui o cadastro, **Then** o registro guarda a página/rota de entrada e os UTMs capturados no momento da primeira visita.
2. **Given** um visitante que entra sem UTMs, **When** ele se cadastra, **Then** a página de entrada (landing) ainda é registrada e os campos de UTM ficam vazios/nulos sem quebrar o cadastro.
3. **Given** múltiplos cadastros vindos de páginas diferentes, **When** a dona consulta a atribuição, **Then** consegue ver a contagem de cadastros agrupada por página de entrada.

---

### User Story 3 - Transformar visita de artigo em lead com captura de e-mail (Priority: P2)

Como visitante lendo um artigo do blog, quero um bloco simples para deixar meu e-mail em troca de um material/checklist, para receber conteúdo útil — e, como dona do produto, quero capturar esse lead antes que a visita orgânica se perca.

**Why this priority**: Fecha o funil ("virar visita em lead"), mas depende de tráfego já chegando e sendo medido (US1/US2). Reaproveita `ArticleShell` e o fluxo de lead magnet/checklist já existente.

**Independent Test**: Abrir uma página de artigo, ver o bloco de captura de e-mail, submeter um e-mail válido e confirmar que o lead é registrado; submeter e-mail inválido/vazio e confirmar validação amigável sem registrar.

**Acceptance Scenarios**:

1. **Given** uma página de artigo/blog, **When** ela é renderizada, **Then** um bloco de captura de e-mail (lead magnet) aparece dentro do layout do artigo.
2. **Given** o bloco de captura, **When** o visitante envia um e-mail válido, **Then** o lead é registrado e o visitante recebe confirmação/acesso ao material.
3. **Given** o bloco de captura, **When** o visitante envia e-mail vazio ou inválido, **Then** vê mensagem de validação e nenhum lead é registrado.

---

### User Story 4 - Sitemap/robots refletem todas as rotas indexáveis novas (Priority: P2)

Como dona do produto, quero que o `sitemap.xml` e o `robots` incluam corretamente as 6 páginas de blog recém-criadas, além de `/cadastro` e `/parcerias`, e ter documentado como submeter o sitemap no Google Search Console e Bing Webmaster, para acelerar a indexação do conteúdo novo.

**Why this priority**: Complementa US1 garantindo cobertura completa de descoberta; a parte de código (corretude do sitemap) é verificável, e a submissão nos webmasters é passo operacional documentado, não código.

**Independent Test**: Inspecionar o sitemap gerado e confirmar que as 6 páginas de blog novas + `/cadastro` + `/parcerias` estão presentes e que o `robots` não bloqueia essas rotas; conferir que existe documentação clara do passo de submissão.

**Acceptance Scenarios**:

1. **Given** as 6 páginas de blog novas registradas, **When** o sitemap é gerado, **Then** todas as 6 URLs aparecem, além de `/cadastro` e `/parcerias`.
2. **Given** o `robots`, **When** inspecionado, **Then** nenhuma das rotas indexáveis novas está bloqueada.
3. **Given** a documentação da feature, **When** a dona segue o passo a passo, **Then** consegue submeter o sitemap no Google Search Console e no Bing Webmaster sem ambiguidade.

---

### Edge Cases

- Página nova de blog criada depois desta feature: o guard deve continuar cobrando registro no seo-registry (não regredir a cobertura).
- Visitante que troca de página de entrada em visitas separadas antes de se cadastrar: qual entrada conta? (Assunção: primeira visita — first-touch — conforme a semântica da infra de atribuição existente.)
- Visitante com cookies/rastreamento bloqueado: o cadastro deve funcionar mesmo sem dado de atribuição (campos ficam vazios).
- E-mail já cadastrado no bloco de captura: não deve gerar erro bruto nem duplicar de forma quebrada; tratar como sucesso idempotente ou mensagem amigável.
- Marca pública em todo texto novo (bloco de captura, cópia de artigo, títulos) deve ser **BOTinho** — nunca outro nome interno.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST registrar as rotas públicas `/cadastro` e `/parcerias` no registro de SEO de forma que ambas entrem no sitemap gerado.
- **FR-002**: O sistema MUST eliminar a duplicidade de título entre `/conteudos` e o artigo `/blog/comecar-afiliado-whatsapp-sem-grupo-grande`, diferenciando um dos títulos.
- **FR-003**: `npm run guard:seo-registry` e `npm run lint:seo-metadata` (executados de dentro de `dashboard/`) MUST passar sem os dois erros descritos em FR-001/FR-002; a suíte `npm run validate:seo-p0` MUST ficar verde.
- **FR-004**: No momento do cadastro/registro, o sistema MUST capturar e persistir a página de entrada (landing/rota de origem) associada àquele cadastro.
- **FR-005**: Quando UTMs estiverem presentes na entrada, o sistema MUST capturá-los e associá-los ao cadastro; quando ausentes, o cadastro MUST concluir normalmente com os campos de UTM vazios/nulos.
- **FR-006**: A atribuição de cadastro MUST reaproveitar a infra existente (`OrganicPageTracker` e `marketing-attribution`), sem criar sistema paralelo de rastreamento.
- **FR-007**: A dona MUST conseguir visualizar/consultar cadastros agrupados por página de entrada (contagem por landing).
- **FR-008**: O `sitemap.xml` gerado MUST incluir as 6 páginas de blog recém-criadas, além de `/cadastro` e `/parcerias`; o `robots` MUST NOT bloquear essas rotas indexáveis.
- **FR-009**: A feature MUST incluir documentação do passo operacional de submissão do sitemap no Google Search Console e Bing Webmaster (verificação de propriedade + submissão), como passo manual — não é código.
- **FR-010**: As páginas de artigo/blog MUST exibir um bloco de captura de e-mail (lead magnet) dentro do layout `ArticleShell`, reaproveitando o fluxo de lead magnet/checklist já existente.
- **FR-011**: O bloco de captura MUST validar o e-mail (rejeitar vazio/inválido com mensagem amigável) e registrar o lead somente para e-mail válido.
- **FR-012**: Todo texto/rótulo público novo MUST usar a marca **BOTinho**.
- **FR-013**: A feature MUST NOT introduzir novo processo PM2, worker, dependência de Redis/BullMQ, cache em memória adicional ou aumento de heap; deve permanecer no envelope de "mudança leve" (política de memória do repo).
- **FR-014**: A captura de atribuição/lead MUST NOT expor PII sensível em claro em logs/analytics além do necessário; o e-mail de lead segue o tratamento de PII já adotado no repo.

### Key Entities *(include if feature involves data)*

- **Atribuição de cadastro**: vínculo entre um cadastro e sua origem — página de entrada (landing/rota), UTMs (source/medium/campaign, opcionais), momento da captura. Reaproveita a estrutura de `marketing-attribution`.
- **Lead de artigo**: e-mail deixado no bloco de captura de um artigo, com referência ao artigo/página de origem e material ofertado; alimenta o funil de lead.
- **Entrada do SEO registry**: rota pública indexável (path, título) que determina presença no sitemap e é verificada pelos guards.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `npm run validate:seo-p0` passa (guard + lint verdes) sem os dois erros pré-existentes.
- **SC-002**: 100% das rotas indexáveis-alvo (6 blogs novos + `/cadastro` + `/parcerias`) aparecem no sitemap gerado e nenhuma está bloqueada no robots.
- **SC-003**: Nenhum par de páginas públicas compartilha título idêntico (zero duplicatas reportadas pelo lint).
- **SC-004**: A partir do deploy, 100% dos novos cadastros têm página de entrada registrada (UTMs quando presentes), consultáveis agrupados por landing.
- **SC-005**: Toda página de artigo/blog exibe o bloco de captura de e-mail; e-mail válido registra lead, inválido não.
- **SC-006**: A feature não adiciona nenhum processo PM2/worker/serviço novo nem eleva o teto de heap (verificável no ecosystem e nas mudanças).

## Assumptions

- A infra `OrganicPageTracker`, `marketing-attribution` (dashboard), `ArticleShell` e o fluxo de lead magnet/checklist já existem e estão funcionais — serão reaproveitados, não recriados.
- Atribuição é first-touch (primeira página de entrada da sessão) conforme a semântica já implementada pela infra de atribuição existente; se a infra atual for last-touch, mantém-se o comportamento dela em vez de reescrever.
- As "6 páginas de blog recém-criadas" já existem no código; a feature garante apenas seu registro/cobertura no sitemap, não a criação de conteúdo novo.
- A submissão no Google Search Console / Bing Webmaster é passo manual operacional (requer login/propriedade da dona) — o escopo de código cobre a corretude do sitemap/robots e a documentação do passo.
- O registro do lead de e-mail usa o mesmo backend de lead/lead-magnet já presente; nenhum provedor de e-mail novo é pré-requisito (envio segue o comportamento no-op-sem-SMTP já documentado, se aplicável).
- Marca pública em toda cópia = **BOTinho**.
- Fluxo de entrega: branch a partir de `develop` → validar em staging → PR `develop` → `main`, sem tocar em `.env`, portas ou deploy além do necessário.
