---

description: "Task list for Estratégia de leads inbound — clique, indexação e ativação"
---

# Tasks: Estratégia de leads inbound — clique, indexação e ativação

**Input**: Design documents from `/specs/013-inbound-leads-strategy/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/credential-block-alert.md, contracts/seo-robots.md, quickstart.md

**Branch**: `claude/inbound-leads-strategy-yqtajg` — já existe, **não criar nem trocar**. PR final contra `develop`, nunca `main`.

**Tests**: incluídos — a spec (FR-041) exige teste automatizado para cada regra que possa regredir em silêncio, e `research.md`/`contracts/` já descrevem os quatro arquivos de teste novos.

**Organization**: tasks agrupadas por user story (P1..P6). Cada história é independentemente entregável e testável (constraint de organização desta rodada) — uma reprovação em revisão de uma história não derruba as demais. As dependências reais entre histórias (não apenas de prioridade) estão na seção **Dependencies & Execution Order**.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivo diferente, sem dependência de task incompleta)
- **[Story]**: US1..US6, mapeando P1..P6 da spec
- Toda descrição traz o caminho de arquivo exato

---

## 🚩 Itens BLOQUEADOS por política de memória — não incluídos como task executável

Nenhuma task abaixo precisa de processo novo, cache em memória, poll ou dependência pesada —
a Política de memória do `plan.md`/`research.md` (R5) já escolheu a alternativa mais leve em
cada ponto. Se, ao executar qualquer task, a alternativa mais leve deixar de ser suficiente e
qualquer um dos itens abaixo passar a parecer necessário, **a execução PARA e pergunta à
usuária antes de codar**, com estimativa de RAM — não presumir aprovação:

1. Pendurar a agregação de `GET /logs/credential-block` no poll de 10s do `/dashboard/status`.
2. Criar cache em memória para o aviso de credencial (segundo `Map` sem despejo).
3. Qualquer dependência nova em `dashboard/` para gerar metadata ou schema.
4. Qualquer processo, worker ou cron novo para varrer `MessageLog`.
5. Qualquer aumento de `instances`/concorrência para acelerar build ou validação.

---

## Phase 1: Setup

**Purpose**: confirmar ambiente antes de qualquer edição — sem inicialização de projeto (é
codebase existente, sem dependência nova).

- [X] T001 Confirmar branch ativa com `git branch --show-current` (deve ser
  `claude/inbound-leads-strategy-yqtajg`; **não criar nem trocar**) e instalar dependências com
  `npm ci` na raiz e `cd dashboard && npm ci` — conforme pré-requisitos de `quickstart.md`

---

## Phase 2: Foundational

**Nenhuma task foundational bloqueia todas as histórias.** Cada user story (P1..P6) é
independentemente entregável (ver `plan.md` "Ordem de execução: dependência, não preferência").
As duas dependências reais que existem — P1 antes de P2 por conviverem no mesmo arquivo
`seo-registry.mjs`, e P2 bloqueando P5/P6 por FR-014 — estão descritas na seção **Dependencies &
Execution Order** abaixo e nas próprias fases de US2/US5/US6. Não há infraestrutura, schema de
banco, autenticação ou roteamento novos a montar antes das histórias — tudo isso já existe no
repositório.

---

## Phase 3: User Story 1 — Título que dá motivo para clicar (Priority: P1) 🎯 MVP

**Goal**: reescrever título e descrição das 11 páginas alvo de FR-004 (10 caminhos nomeados
explicitamente no requisito) para caber em 55 caracteres de texto próprio e trazer o motivo
para clicar no início — sem tocar `/bot-achadinhos-whatsapp` (FR-005) — e consolidar título e
descrição em uma fonte única por página (FR-001), fechando a divergência já confirmada entre
`dashboard/lib/seo-registry.mjs` e os módulos de conteúdo.

**Independent Test**: ler título e descrição das páginas alvo direto da fonte e medir; rodar
`node --test test/inbound-titulos-clique.test.js test/pagina-achadinhos-clique.test.js` e
`cd dashboard && npm run lint:seo-metadata`. Não depende de nenhuma outra história.

### Tests for User Story 1

- [X] T002 [P] [US1] Criar `test/inbound-titulos-clique.test.js` (reaproveitar o padrão de
  `test/pagina-achadinhos-clique.test.js`: ler a fonte, extrair `title`/`description`, medir).
  Para os 10 caminhos de FR-004 (`/blog/melhores-horarios-para-postar-ofertas-no-whatsapp`,
  `/programa-de-afiliados`, `/alternativas/fluxopromo`, `/bot-ofertas-afiliados-whatsapp`,
  `/blog/conferir-converter-link-afiliado-whatsapp`, `/bot-ofertas-whatsapp`,
  `/blog/como-montar-grupo-de-ofertas-no-whatsapp-do-zero`, `/alternativas/achadinhos-bot`,
  `/blog/como-divulgar-ofertas-amazon-whatsapp`, `/blog/como-divulgar-ofertas-mercado-livre-whatsapp`)
  assertar: (a) título cru ≤ 55 chars, com a mensagem de falha mostrando
  `tituloEntregue = bruto + ' | Espelha Grupos'` (SUFIXO_TEMPLATE constante local, igual a R2 do
  research.md — **não reabrir essa decisão**); (b) descrição ≤ 160 chars; (c) título de
  `/alternativas/fluxopromo` e `/alternativas/achadinhos-bot` casa com `/^alternativa (a|ao)/i`
  e não se apresenta como o concorrente (FR-030); (d) nenhum título/descrição duplicado entre as
  páginas do site; (e) **guarda de fonte única (FR-001)**: para cada um dos 10 caminhos, falha
  se `title`/`description` existir simultaneamente em `dashboard/lib/seo-registry.mjs` **e** no
  módulo de conteúdo da página — é a divergência que hoje existe em `/bot-achadinhos-whatsapp`
  (registry com 66 chars antigos, módulo com 56 novos) se repetindo por engano numa página nova.
  Este teste deve **falhar** antes das próximas tasks (nada foi reescrito ainda).

### Implementation for User Story 1

- [X] T003 [US1] Estender `dashboard/scripts/lint-seo-metadata-duplicates.mjs`: hoje o parser só
  entende `_lpShared.js`. Adicionar leitura de título/descrição de
  `dashboard/app/_preservationCommercialPages.js` e `dashboard/app/_comparisonContent.js`, e uma
  checagem nova: se um mesmo `path` tiver `title`/`description` no `seo-registry.mjs` **e** no
  módulo de conteúdo, reprovar (mensagem citando os dois locais). Espelha o teste T002(e) como
  portão de CI real (`npm run lint:seo-metadata`).
- [X] T004 [US1] Reescrever `title`/`description` em
  `dashboard/app/blog/_preservationBlogPosts.js` para as chaves
  `melhores-horarios-para-postar-ofertas-no-whatsapp`,
  `como-montar-grupo-de-ofertas-no-whatsapp-do-zero`, `como-divulgar-ofertas-amazon-whatsapp` e
  `como-divulgar-ofertas-mercado-livre-whatsapp`: ≤ 55 chars, motivo para clicar nas primeiras
  posições, padrão derivado das 4 páginas que já convertem (FR-006: `/`,
  `/bot-afiliados-whatsapp`, `/automatizar-divulgacao-em-grupos-whatsapp`,
  `/padronizar-divulgacao-afiliado-whatsapp`). **Duas pontas na mesma task**: remover os campos
  `title`/`description` duplicados dessas 4 rotas em `dashboard/lib/seo-registry.mjs` (hoje
  presentes e divergentes) — o módulo passa a ser a única fonte.
- [X] T005 [US1] Reescrever `title`/`description` (consts literais no topo do arquivo) em
  `dashboard/app/programa-de-afiliados/page.js`: ≤ 55 chars, motivo no início. Remover o
  `title`/`description` duplicado de `/programa-de-afiliados` em
  `dashboard/lib/seo-registry.mjs` na mesma task.
- [X] T006 [US1] Reescrever `title`/`description` das entradas `fluxopromo` e `achadinhos-bot`
  em `dashboard/app/_comparisonContent.js`: ≤ 55 chars, motivo no início, **e obrigatoriamente**
  no formato "Alternativa a/ao X" — em nenhum momento o título se apresenta como o concorrente
  (FR-030, cenário 4 da US1). Remover `title`/`description` duplicados de `/alternativas/fluxopromo`
  e `/alternativas/achadinhos-bot` em `dashboard/lib/seo-registry.mjs` na mesma task.
- [X] T007 [P] [US1] Reescrever `title`/`description` da entrada `bot-ofertas-afiliados-whatsapp`
  em `dashboard/app/_lpShared.js`: ≤ 55 chars, motivo no início. (Sem duplicata a remover no
  registry — confirmado: essa rota já só tem `indexable`/`template` lá, nunca teve `title`.)
- [X] T008 [P] [US1] Reescrever `title`/`description` (consts literais no topo do arquivo) em
  `dashboard/app/blog/conferir-converter-link-afiliado-whatsapp/page.js`: ≤ 55 chars, motivo no
  início. (Sem duplicata a remover no registry — mesma confirmação de T007.)
- [X] T009 [US1] Reescrever `title`/`description` da entrada `bot-ofertas-whatsapp` em
  `dashboard/app/_seoHubShared.js`: ≤ 55 chars, motivo no início. Remover o `title`/`description`
  duplicado de `/bot-ofertas-whatsapp` em `dashboard/lib/seo-registry.mjs` na mesma task.
- [X] T010 [US1] Corrigir o bug de divergência já confirmado em `/bot-achadinhos-whatsapp`
  (R2 do research.md): remover o `title`/`description` desatualizado (66 chars, texto de antes
  do PR #1420) dessa rota em `dashboard/lib/seo-registry.mjs`. **Não tocar** no texto que já está
  no ar (`dashboard/app/_preservationCommercialPages.js`, 56 chars) — FR-005 proíbe reescrevê-lo;
  esta task só remove a cópia velha e divergente do registry, fazendo o módulo virar a única
  fonte também para esta rota.
- [X] T011 [US1] Rodar o portão de P1 e confirmar 100% verde:
  `node --test test/inbound-titulos-clique.test.js test/pagina-achadinhos-clique.test.js` e
  `cd dashboard && npm run lint:seo-metadata`. Conferência manual (não automatizável): ler as 55
  primeiras posições de cada título reescrito em voz alta — se o motivo para clicar não apareceu
  ali, a task não está feita (edge case da spec).

**Checkpoint**: US1 entregável e testável isoladamente. Resultado de campo (Search Console) só
em 30 dias — não bloqueia o merge.

---

## Phase 4: User Story 2 — Destravar a indexação antes de publicar qualquer coisa nova (Priority: P2)

**Goal**: emitir a instrução real de `noindex, follow` no HTML das páginas triadas como "sem
intenção própria", mantendo as três pontas (HTML, sitemap, IndexNow) sincronizadas, sem apagar
nenhuma página — e **sem quebrar `guard:seo-registry`**, que reprova assim que a primeira rota
vira `indexable: false` se não for ajustado antes.

**Independent Test**: inspecionar o HTML servido de uma rota marcada, conferir sitemap.xml e a
lista de notificação de URLs, rodar `node --test test/seo-noindex-guard.test.js` e
`cd dashboard && npm run validate:seo-consistency && npm run guard:seo-registry`. Não depende de
US1 tecnicamente, mas convive no mesmo arquivo (`seo-registry.mjs`) — por isso vem depois na
ordem de execução, para evitar conflito de merge no mesmo bloco.

### Tests for User Story 2

- [X] T014 [P] [US2] Criar `test/seo-noindex-guard.test.js`: reprova se (a) qualquer rota com
  `indexable === false` no registry não tiver o construtor de metadata correspondente
  referenciando `buildSeoRobots`/emitindo `robots: { index: false }`; (b) qualquer rota sumir de
  `generateStaticParams()`/da lista de builds (FR-010); (c) `title`/`description` de uma mesma
  rota existir em dois lugares (espelha a checagem de `validate-seo-consistency.mjs`, mesmo
  motivo do T002(e): o portão da raiz roda no CI de todo PR). Este teste deve **falhar** antes
  das próximas tasks.

### Implementation for User Story 2

- [X] T012 [US2] Em `dashboard/lib/seo-registry.mjs`, adicionar três funções puras novas
  (build-time, zero custo de memória — contracts/seo-robots.md):
  `getSeoRoute(path)` (entrada do registro, indexável ou não),
  `buildSeoRobots(path)` (devolve `{ index: false, follow: true }` quando
  `indexable === false`, e `undefined` quando indexável — **nunca** emitir `index: true`
  explícito), `getAllSeoRoutes()` (todas as rotas, sem filtro de indexação — base de cobertura).
- [X] T013 [US2] ⚠️ **AJUSTE OBRIGATÓRIO E ANTERIOR a qualquer marcação `indexable: false`**:
  em `dashboard/scripts/guard-seo-registry-coverage.mjs`, trocar a base de comparação de
  `getIndexableSeoRoutes()` para `getAllSeoRoutes()` (T012). Hoje o guard trata "rota pública
  fora do conjunto indexável" como erro — reprova assim que a 1ª rota virar `indexable: false`.
  Depois do ajuste: cobertura = estar no registro; indexação = decisão separada. Rodar
  `cd dashboard && npm run guard:seo-registry` e confirmar verde **antes** de T018.
- [X] T015 [US2] Em `dashboard/scripts/validate-seo-consistency.mjs`, adicionar a 4ª checagem:
  para toda rota com `indexable === false`, o arquivo que gera a metadata daquela rota precisa
  referenciar `buildSeoRobots` (ou declarar `robots: { index: false` diretamente, caso do
  precedente `promo-vip-7dias`). Checagem estática de fonte, sem build, mesmo estilo dos
  validadores existentes. Mensagem de falha conforme `contracts/seo-robots.md`.
- [X] T016 [US2] Ligar `buildSeoRobots(path)` (T012) nos quatro chokepoints de metadata, sempre
  no formato `...(robots ? { robots } : {})` (nunca `index: true` explícito):
  `dashboard/app/_lpShared.js` (`getLpMetadata()`),
  `dashboard/app/_seoHubShared.js` (`getSeoHubMetadata()`),
  `dashboard/app/_preservationCommercialPages.js` (`getPreservationCommercialMetadata()`),
  `dashboard/app/_comparisonContent.js` (construtor de metadata de `/alternativas/*`).
- [X] T017 [US2] Criar `specs/013-inbound-leads-strategy/triagem-indexacao.md` (FR-012): para
  cada rota `template: 'programmatic-lp'` sem conteúdo exclusivo declarado (critério medível no
  código, R9 do research.md), registrar lado a lado as duas evidências — (i) a parte medível no
  repositório e (ii) zero impressão nos últimos 3 meses no Search Console, **com a data da
  consulta** — e a decisão final por página: "engordar" (ganha conteúdo exclusivo, permanece
  indexável) ou "sai do índice". Página com qualquer impressão ou intenção própria é sempre
  engordada, nunca retirada (edge case da spec).
- [X] T018 [US2] Marcar `indexable: false` em `dashboard/lib/seo-registry.mjs` apenas para as
  páginas que `triagem-indexacao.md` (T017) decidiu como "sem intenção própria". **Depende de**
  T013 (guard já ajustado) e T016 (chokepoints já ligados) — marcar antes disso reprova o guard
  e/ou não emite `robots` no HTML.
- [X] T019 [US2] Documentar a conclusão de FR-013 sobre `/promo-vip-7dias` em
  `specs/013-inbound-leads-strategy/triagem-indexacao.md` (seção própria): página
  `/promo-vip-7dias`, bloqueio intencional confirmado em duas camadas (`Disallow` em
  `dashboard/public/robots.txt` + `robots: { index: false, follow: false }` em
  `dashboard/app/promo-vip-7dias/layout.js`), landing promocional sem links internos de
  interesse — por isso `follow: false` ali é correto e **diferente** do `follow: true` que
  `buildSeoRobots()` aplica às páginas de grade (que têm links internos a preservar, FR-009).
  Nenhuma mudança de código nesta task — só registro escrito.
- [X] T020 [US2] Rodar o portão de P2 e confirmar 100% verde:
  `node --test test/seo-noindex-guard.test.js` e
  `cd dashboard && npm run validate:seo-consistency && npm run guard:seo-registry`. Verificação
  manual: `curl` numa rota marcada mostrando `<meta name="robots" content="noindex, follow">` e
  ausência dela em `sitemap.xml`; conferir que `SEO_ROUTES.length` não caiu (FR-010/SC-007 —
  nenhuma página apagada) e que `getIndexableSeoRoutes().length` caiu exatamente pelas páginas
  de T018.

**Checkpoint**: US2 entregável e testável isoladamente. **A partir daqui, US5 e US6 estão
liberadas (FR-014)** — nenhuma delas pode começar antes deste checkpoint.

---

## Phase 5: User Story 3 — Avisar quem parou na etapa da credencial (Priority: P3)

**Goal**: avisar no painel, sem exigir abertura do histórico, quando um envio for bloqueado por
falta de credencial de loja — com o vocabulário certo por loja (Shopee é o **oposto** de
ML/Amazon) e sem duplicar o aviso de código vencido já existente.

**Independent Test**: simular conta com WhatsApp conectado e sem credencial, checar que o aviso
aparece no painel sem abrir o histórico; rodar
`node --test test/painel-aviso-credencial.test.js test/painel-linguagem-leiga.test.js`. Não
depende de nenhuma outra história (não toca SEO) — pode ser feita em paralelo com US1/US2/US4.

### Tests for User Story 3

- [X] T021 [P] [US3] Criar `test/painel-aviso-credencial.test.js` (contrato completo em
  `contracts/credential-block-alert.md`), reprovando se: (a) o texto do aviso contiver `cookie`,
  `SSID`, `tag`, `partner_id`, `?tag=` ou `amzn.to` (FR-017); (b) para `platform: 'shopee'`, o
  `body` não disser que as ofertas **param de sair** (FR-018); (c) para
  `platform ∈ {'mercadolivre','amazon'}`, o `body` não disser "continuam saindo... link mais
  comprido" ou disser "parou"/"pausado" (FR-019); (d) **guarda dedicada contra fusão de texto**:
  os dois blocos de texto (Shopee vs. ML/Amazon) não vierem de **constantes estruturalmente
  separadas** em `src/credentialBlockAlert/message.js` — ou seja, falha se alguém unificar num
  template único com a consequência como variável (é exatamente a regressão que este teste
  existe para pegar); (e) uma loja com `Credential` já cadastrada aparecer em `stores[]`
  (FR-020/FR-021 — o aviso novo se cala quando existe credencial, mesmo vencida: quem avisa esse
  caso é `src/credentialExpiry/`); (f) `stores: []` não resultar em nenhum aviso renderizado
  (cenário 6 da US3). Este teste deve **falhar** antes das próximas tasks.

### Implementation for User Story 3

- [X] T022 [US3] Criar módulo puro `src/credentialBlockAlert/message.js`, espelhando o desenho
  de `src/credentialExpiry/message.js` (mesma inversão de vocabulário já resolvida lá). Exporta
  `buildCredentialBlockAlerts({ blockedByPlatform, configuredPlatforms }) -> stores[]`. Duas
  famílias de constantes de texto **estruturalmente separadas**, nunca um template único:
  `shopee` → "as ofertas da Shopee param de sair"; `mercadolivre`/`amazon` → "as ofertas
  continuam saindo, só com link mais comprido". Reusa vocabulário canônico de
  `src/credentialHealth.js` (`friendlyFieldName`, `describeMissingCredentials`): "etiqueta de
  afiliada", "código de acesso" (e "chave" no caso específico da Shopee). Sem `cookie`, `SSID`,
  `tag`.
- [X] T023 [US3] Criar rota `GET /logs/credential-block` em `src/api/routes/logs.js`
  (autenticada via `app.authenticate`, escopo só do próprio `req.user.sub`, sem query params,
  janela fixa de 7 dias — contrato completo em `contracts/credential-block-alert.md`). Consulta
  única indexada em `MessageLog` (`@@index([userId, status, sentAt])`):
  `userId`, `status: 'skipped'`, `sentAt >= agora - 7d`,
  `errorMsg` começando em `'skip:no_valid_conversions'`, agregada por `platform`. Cruza com
  `db.credential.findMany({ where: { userId }, select: { platform: true } })` — loja com
  credencial cadastrada é **descartada** da resposta (FR-020). Monta `stores[]` via
  `buildCredentialBlockAlerts()` (T022). **Sem cache, sem estrutura em memória nova** — não
  replicar o padrão `Map` sem despejo de `summaryCache` no mesmo arquivo.
- [X] T024 [US3] Consumir `GET /logs/credential-block` em
  `dashboard/components/ActivationChecklist.js`: chamar **no mount e no evento `focus` da
  janela, sem intervalo** — nunca pendurado no poll de 10s existente do `/dashboard/status` (ver
  bloco 🚩 no topo deste arquivo). Renderizar cada item de `stores[]` com `headline`/`body`/
  `nextStep` e link para `href: '/painel/ids-afiliada'` (FR-016). Como o componente já é
  renderizado tanto em `dashboard/app/painel/page.js` quanto em
  `dashboard/app/painel/checklist/page.js`, os dois pontos da Assumption ficam cobertos de graça.
- [X] T025 [US3] Reescrever `explainErrorMsg` em `dashboard/lib/painel/logsCopy.js` para o
  prefixo `skip:no_valid_conversions`: hoje é genérico ("Nenhum link da mensagem pôde ser
  convertido em link de afiliado.") e não distingue loja. Trocar pelo texto por loja (mesma
  fonte de vocabulário de T022 — Shopee invertida em relação a ML/Amazon), nomeando a loja e o
  próximo passo. É o terceiro ponto de exibição da Assumption (histórico de envios), que já
  existe — só o texto muda.
- [X] T026 [US3] Confirmar por leitura de `src/email/registry.js` que os oito e-mails do grupo
  `contato` (grupo "Contato e escuta") continuam `trigger: 'manual'` (FR-022). Nenhuma mudança
  de código é esperada nesta task — se algo estiver diferente, é regressão a reportar, não a
  corrigir criando disparo automático.
- [X] T027 [US3] Rodar o portão de P3 e confirmar 100% verde:
  `node --test test/painel-aviso-credencial.test.js test/painel-linguagem-leiga.test.js`. Teste
  manual em staging (passo a passo completo em `quickstart.md` P3): conta com WhatsApp conectado
  e sem credencial → aviso aparece sem abrir histórico → cadastrar credencial → aviso some;
  conta com credencial cadastrada e vencida → aparece o aviso antigo de código vencido, não o
  novo; conta com tudo em ordem → nenhum aviso.

**Checkpoint**: US3 entregável e testável isoladamente. Resultado de campo (SC-008) em 60 dias —
não bloqueia o merge.

---

## Phase 6: User Story 4 — Ser citada por motor de IA, não só ranquear (Priority: P4)

**Goal**: fazer `/bot-afiliados-whatsapp` (página existente) responder de forma direta e
extraível as quatro perguntas de decisão (o que é, como funciona, quanto custa, como escolher),
sem criar página nova (FR-024) e sem prometer que a conta não será banida (FR-029).

**Independent Test**: ler a página e conferir que as quatro perguntas são respondidas de forma
direta; rodar `node --test test/marketing-limites-que-nao-se-cruzam.test.js`. Não depende de
US2 — reforça página existente (FR-024) — nem de nenhuma outra história.

### Tests for User Story 4

- [X] T030 [P] [US4] Criar `test/marketing-limites-que-nao-se-cruzam.test.js` (primeira versão,
  cobrindo o texto de `dashboard/app/_preservationCommercialPages.js` entrada
  `bot-afiliados-whatsapp`): reprova se encontrar qualquer padrão de promessa de não-banimento
  (`não será banido`, `sem risco de ban`, `100% seguro`, `anti-ban garantido`, `nunca bane`, e
  variações equivalentes) no texto publicado (FR-029). Entrar pela palavra "banido"/"anti-ban"
  continua permitido — só a promessa reprova. Este arquivo é **estendido** nas fases US5 e US6
  com as checagens de preço/fonte/data, `bestFit` e frentes congeladas — não recriar um segundo
  arquivo de limites.

### Implementation for User Story 4

- [X] T028 [US4] Revisar/completar a entrada `bot-afiliados-whatsapp` em
  `dashboard/app/_preservationCommercialPages.js` para responder, de forma direta e localizável
  (formato extraível por IA — parágrafo curto ou bloco de resposta direta, não espalhado em
  texto longo), as quatro perguntas de decisão: o que é o produto, como funciona, quanto custa,
  como escolher entre as opções (FR-023). Não criar página nova (FR-024) — só reforçar a
  existente.
- [X] T029 [US4] No mesmo arquivo/entrada, revisar o trecho sobre risco de banimento de conta:
  explicar o risco com honestidade, sem em nenhum momento prometer que a conta não será banida
  (FR-029, cenário 3 da US4). Confirma manualmente que T030 passa contra o texto final.
- [X] T031 [US4] Rodar o portão de P4 e confirmar 100% verde: revisão de conteúdo (as quatro
  perguntas aparecem de forma direta, sem jargão técnico) e
  `node --test test/marketing-limites-que-nao-se-cruzam.test.js`.

**Checkpoint**: US4 entregável e testável isoladamente. Resultado de campo (SC-010) em 60 dias.

---

## Phase 7: User Story 5 — Uma página de comparação nova por vez (Priority: P5)

**⛔ BLOQUEADA por FR-014 — não iniciar antes do checkpoint de US2 (T020) estar 100% verde.**
Publicar página nova com o rastreamento ainda racionado desperdiça o trabalho (research.md R4).

**Goal**: publicar **exatamente uma** página de comparação nova — `/alternativas/achadinho-pro`,
escolhida por maior evidência e por já ter dado verificado com fonte e data em
`dashboard/lib/competitors-data.js` — e deixar um checklist reaproveitável para as próximas
cinco, no ritmo de uma por semana com verificação de entrada no índice antes da seguinte.

**Independent Test**: conferir que só uma página nova foi publicada, que ela cita preço com
fonte e data, que existe o trecho `bestFit`, e que o checklist está escrito. Rodar
`cd dashboard && npm run validate:editorial-freshness && npm run validate:schema-templates &&
npm run guard:seo-registry` e `node --test test/marketing-limites-que-nao-se-cruzam.test.js`.

### Implementation for User Story 5

- [X] T032 [US5] Criar `dashboard/app/alternativas/achadinho-pro/page.js` (mesmo padrão de
  `dashboard/app/alternativas/fluxopromo/page.js`: importa `ComparisonPage`/`getComparisonMetadata`
  de `@/app/_comparisonContent`) e a entrada correspondente em
  `dashboard/app/_comparisonContent.js`, seguindo a estrutura de `/alternativas/proafiliados`:
  `title`/`description` (≤ 55 chars cru, "Alternativa ao Achadinho Pro", nunca se apresentando
  como ele — FR-030), `tldr`, `directAnswer` (resposta direta e extraível por IA), `rows[]`,
  `criteria`, `botinhoDifferentials`, **`bestFit[]`** (obrigatório — onde o Achadinho Pro é a
  melhor escolha, FR-032, cenário 3 da US5), `notIdealFit[]`, `competitorSlugs: ['achadinho-pro']`,
  `productPage` (link recíproco de volta à página comercial).
- [X] T033 [US5] Garantir que toda citação de preço/plano/comissão do Achadinho Pro na página
  nova vem de `dashboard/lib/competitors-data.js` (`slug: 'achadinho-pro'`, já com
  `verifiedAt: '2026-07-31'` e `source` preenchidos — nenhuma coleta nova necessária). Nenhum
  número solto direto no texto sem passar por esse arquivo (FR-031).
- [X] T034 [US5] Adicionar a entrada `/alternativas/achadinho-pro` em
  `dashboard/lib/seo-registry.mjs`: `indexable: true`, `template: 'alternatives'`, `schemaTypes`
  coerente (exigido por `validate-schema-templates.mjs`), `lastModified` via `EDITORIAL_DATES`
  (exigido por `validate-editorial-freshness.mjs`). **Sem `title`/`description`** — a fonte
  única continua sendo `_comparisonContent.js` (FR-001, mesma regra de T003/T002(e)).
- [X] T035 [US5] Criar `specs/013-inbound-leads-strategy/checklist-comparativos.md` (FR-026):
  checklist reaproveitável para as cinco páginas de comparação restantes (Afilira, IA
  Divulgadora, Shark Pomo Bot, Lumi Ofertas Inteligentes, Gigi Bot), com o padrão de campos de
  T032, o ritmo de uma por semana, e a regra explícita "só publica a próxima depois que a
  anterior entrar no índice do Google" (SC-011, ≤ 14 dias).
- [X] T036 [US5] Estender `test/marketing-limites-que-nao-se-cruzam.test.js` (criado em T030):
  reprova se `/alternativas/achadinho-pro` citar preço sem correspondência em
  `competitors-data.js` com `verifiedAt`+`source`, se faltar o bloco `bestFit`, ou se o
  título/texto se apresentar como o concorrente em vez de "alternativa a".
- [X] T037 [US5] Rodar o portão de P5 e confirmar 100% verde:
  `cd dashboard && npm run validate:editorial-freshness && npm run validate:schema-templates &&
  npm run guard:seo-registry` e `node --test test/marketing-limites-que-nao-se-cruzam.test.js`.
  Confirmar que exatamente uma página nova foi publicada (as outras cinco continuam pendentes) e
  registrar em `checklist-comparativos.md` a data em que ela deve ser checada no índice do
  Google (≤ 14 dias) antes de autorizar a próxima da fila.

**Checkpoint**: US5 entregável e testável isoladamente (depois de US2 concluída).

---

## Phase 8: User Story 6 — Abrir a frente de quem está virando afiliado (Priority: P6)

**⛔ BLOQUEADA por FR-014 — não iniciar antes do checkpoint de US2 (T020) estar 100% verde.**

**Goal**: aprofundar o guia Tier 1 da Shopee já existente
(`/blog/como-ser-afiliado-shopee-whatsapp`) para cobrir cadastro, comissão, regras e como
divulgar de ponta a ponta, com a menção ao BOTinho só no fim.

**Achado de código a resolver nesta história**: a página já existe (não é criação do zero) e já
tem uma chamada de produto (`midBridge`, CTA "Ver preços e testar grátis") posicionada logo após
o `intro`, **antes** das seções técnicas — o que contraria FR-027/cenário 3 da US6 ("a menção ao
produto está no fim"). É achado, não suposição — confirmado lendo
`dashboard/app/blog/_preservationBlogPosts.js`.

**Independent Test**: ler o guia e conferir que cobre cadastro/comissão/regras/divulgação de
ponta a ponta e que a menção ao produto está só no fim; rodar
`cd dashboard && npm run validate:editorial-freshness && npm run validate:schema-templates` e
`node --test test/marketing-limites-que-nao-se-cruzam.test.js`.

### Implementation for User Story 6

- [X] T038 [US6] Auditar a entrada `como-ser-afiliado-shopee-whatsapp` em
  `dashboard/app/blog/_preservationBlogPosts.js` contra FR-027: confirmar/completar cobertura
  de cadastro, comissão, regras e como divulgar, de ponta a ponta — nenhuma das quatro pode
  faltar ou ficar rasa.
- [X] T039 [US6] Mover o `midBridge`/CTA do produto (hoje logo após o `intro`) para o **fim** do
  artigo, depois de todas as seções técnicas de cadastro/comissão/regras/divulgação (FR-027,
  cenário 3 da US6: "a menção ao produto está no fim, apresentada como a ferramenta que resolve
  a parte repetitiva"). Confirmar que nenhuma outra chamada de produto ficou no meio do texto.
- [X] T040 [US6] Conferir que o conteúdo é denso e único (FR-028): comparar manualmente com
  `/programa-de-afiliados` e com os demais posts de `_preservationBlogPosts.js` para garantir
  que não há trecho repetido de outra página do site.
- [X] T041 [US6] Estender `test/marketing-limites-que-nao-se-cruzam.test.js` (criado em T030):
  reprova se o guia Shopee prometer não-banimento (mesma lista de padrões de T030) ou se a
  chamada de produto (`midBridge`/CTA) aparecer antes das seções técnicas em vez de depois.
- [X] T042 [US6] Rodar o portão de P6 e confirmar 100% verde:
  `cd dashboard && npm run validate:editorial-freshness && npm run validate:schema-templates` e
  `node --test test/marketing-limites-que-nao-se-cruzam.test.js`.

**Checkpoint**: US6 entregável e testável isoladamente (depois de US2 concluída). Resultado de
campo (SC-012) em 60 dias.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: guardas transversais que dizem respeito ao conjunto da entrega (FR-033..FR-040), não
a uma história específica — e o portão final antes do PR.

- [X] T043 [P] Estender `test/marketing-limites-que-nao-se-cruzam.test.js`: guarda de **frentes
  congeladas** (FR-033/FR-034/AGENTS.md "SEO orgânico — linhas CONGELADAS") — reprova se
  aparecer rota nova por cidade (`espelhar-grupos-whatsapp-<cidade>`), rota de nicho novo, uso de
  "robô" como termo próprio de cluster, Magalu tratado como frente nova, ou páginas visando
  "automação whatsapp"/"disparo em massa" como termo de entrada; e confirma que a contagem de
  páginas das linhas já congeladas (cidade/nicho) em `dashboard/lib/seo-registry.mjs` não caiu
  em relação ao estado antes desta feature (nenhuma foi apagada, FR-034).
- [X] T044 Rodar o portão completo antes de abrir o PR (checklist de `quickstart.md`, seção
  "Antes de abrir o PR"): `npm test` (raiz, FR-040); `cd dashboard && npm run guard:config-page
  && npm run guard:seo-registry && npm run lint:seo-metadata && npm run validate:seo-consistency
  && npm run validate:editorial-freshness && npm run validate:schema-templates` (FR-038/FR-039);
  `git status` confirmando que nenhum `.env`/`.db` foi tocado (FR-035); `git branch
  --show-current` confirmando que a branch continua `claude/inbound-leads-strategy-yqtajg`.

---

## Dependencies & Execution Order

### Dependência real entre histórias (não é só prioridade)

```
US1 (P1) ──> US2 (P2) ──> US5 (P5)
                 │      └─> US6 (P6)
                 └──────── bloqueia (FR-014)

US3 (P3) — independente de tudo, pode rodar em paralelo com qualquer uma das acima
US4 (P4) — independente de US2 (FR-024: reforça página existente, não cria rota)
```

- **US1 antes de US2**: convenção de merge, não bloqueio técnico — as duas mexem em
  `dashboard/lib/seo-registry.mjs`; fazer os títulos primeiro e o campo `indexable`/helpers
  depois evita conflito no mesmo bloco.
- **US2 bloqueia US5 e US6** (FR-014, portão explícito): T032 e T038 **não podem começar** antes
  do checkpoint de US2 (T020) estar 100% verde.
- **US3 é totalmente independente**: não toca SEO, pode ser feita a qualquer momento, inclusive
  em paralelo com US1/US2.
- **US4 não é bloqueada por US2**: reforça `/bot-afiliados-whatsapp`, que já existe (FR-024).
- **T030** (criação de `test/marketing-limites-que-nao-se-cruzam.test.js`) é o único artefato
  compartilhado entre US4, US5 e US6 — nasce em US4 e é estendido (não recriado) em US5 (T036) e
  US6 (T041). Isso é aceitável dentro da regra de independência: US4 sozinha já deixa o arquivo
  passando: as tasks de extensão são aditivas e não quebram as asserções anteriores.

### Dentro de cada história

- Teste (quando existir) escrito e **falhando** antes da implementação.
- Dentro de US1: T003 (guarda de fonte única) antes das reescritas de conteúdo (T004–T010), para
  que a regra já esteja ativa quando o conteúdo for movido.
- Dentro de US2: T012 (helpers) → T013 (ajuste do guard, ⚠️ pré-requisito) → T014 (teste) →
  T015 (checagem nova) → T016 (chokepoints) → T017 (triagem escrita) → T018 (marcação
  `indexable: false`) → T019 (registro de FR-013) → T020 (portão).

### Parallel Opportunities

- T002 (teste de US1) pode ser escrito em paralelo com T014 (teste de US2) e T021 (teste de
  US3) — arquivos diferentes, histórias diferentes.
- Dentro de US1: T007 e T008 são `[P]` entre si (arquivos sem duplicata de registry a remover,
  sem conflito). T004, T005, T006, T009, T010 tocam `dashboard/lib/seo-registry.mjs` além do
  arquivo de conteúdo — não marcadas `[P]` entre si para evitar conflito de edição no mesmo
  bloco do registry.
- US3 inteira (T021–T027) pode rodar em paralelo com US1 (Phase 3) e, depois de T013, com US2.
- US4 (T028–T031) pode rodar em paralelo com US1/US2/US3.
- T043 (Polish) pode ser escrita em paralelo com qualquer história em andamento, mas só faz
  sentido rodar de verdade depois que US4/US5/US6 tiverem conteúdo publicado para varrer.

---

## Parallel Example: início da feature

```bash
# Três testes de três histórias diferentes, sem dependência entre si:
Task: "T002 [US1] Criar test/inbound-titulos-clique.test.js"
Task: "T014 [US2] Criar test/seo-noindex-guard.test.js"
Task: "T021 [US3] Criar test/painel-aviso-credencial.test.js"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1: Setup (T001).
2. Phase 2: Foundational — nada a fazer (ver nota da fase).
3. Phase 3: User Story 1 completa (T002–T011).
4. **PARE e VALIDE**: `node --test test/inbound-titulos-clique.test.js
   test/pagina-achadinhos-clique.test.js`, `npm run lint:seo-metadata`. É o maior retorno por
   hora de trabalho da lista (research.md) — dá para parar aqui e já ter valor em produção.

### Incremental Delivery

1. Setup → MVP (US1) → validar → considerar merge/deploy isolado.
2. US2 → validar (T020) → **libera US5 e US6**.
3. US3 e US4 podem entrar a qualquer momento depois do Setup, em paralelo com US1/US2 ou depois.
4. US5 só depois do checkpoint de US2. Publicar, esperar entrar no índice (≤14 dias, SC-011)
   antes de iniciar a próxima da fila (fora do escopo desta rodada — fica em
   `checklist-comparativos.md`).
5. US6 só depois do checkpoint de US2.
6. Phase 9 (Polish) fecha a entrega: guarda de frentes congeladas + portão completo antes do PR.

---

## Notes

- [P] = arquivos diferentes, sem dependência de task incompleta.
- Toda task de P1 que reescreve título/descrição cobre as duas pontas (módulo de conteúdo **e**
  remoção da duplicata em `seo-registry.mjs`) na mesma task — nunca numa task de limpeza
  separada, para não deixar a divergência aberta entre um commit e outro.
- Nenhuma task desta lista precisa de processo novo, cache em memória, poll adicional ou
  dependência pesada — ver bloco 🚩 no topo. Se isso mudar durante a execução, parar e perguntar
  antes de codar.
- FR-035 (nenhuma mudança de `.env`/banco de produção): nenhuma task desta lista toca ambiente
  ou banco — confirmado no portão final (T044).
- Verificar que os testes falham antes da implementação (T002, T014, T021, T030).
- Parar em qualquer checkpoint para validar a história isoladamente antes de seguir.

---

## Phase 10: Convergence

**Origem**: avaliação do código atual contra `spec.md`/`plan.md`/`tasks.md` em 2026-08-19, depois
da decisão revista de triagem de indexação (25 rotas de grade fora do índice). US2 foi confirmada
satisfeita de fato (mecanismo ligado nos 4 chokepoints **e** aplicado; nenhuma página apagada;
sitemap/IndexNow/HTML sincronizados). As lacunas abaixo são as que sobraram — nenhuma delas
bloqueia o que já foi entregue.

- [X] T045 Cobrir a **SHEIN** no aviso de credencial do painel per FR-015/FR-016 (partial).
  `src/credentialBlockAlert/message.js` mapeia só `shopee`/`mercadolivre`/`amazon`/`magazineluiza`
  e descarta em silêncio qualquer outra loja (fail-safe de "loja desconhecida"). Mas a SHEIN é
  conversor vivo (`src/converters/shein.js`) e plataforma canônica em `src/credentialHealth.js`
  (`PLATFORMS`), e o `convert()` dela faz `if (!tag) return null` — sem credencial, **nada da
  SHEIN é publicado** e o envio vira `skip:no_valid_conversions` com `platform: 'shein'`
  (`src/bot-worker.js`, ~linha 3037). Hoje esse caso não gera nenhum aviso no painel: é
  exatamente o silêncio que US3 existe para acabar. Adicionar a SHEIN à **família da Shopee**
  ("as ofertas da SHEIN param de sair" — sem a etiqueta de afiliada nada sai; NUNCA o texto de
  ML/Amazon de "continuam saindo, só com link mais comprido"), mantendo as constantes
  estruturalmente separadas exigidas por T021(d). Estender
  `test/painel-aviso-credencial.test.js` com (a) a asserção de inversão para `platform: 'shein'`
  e (b) uma guarda de cobertura que reprove quando uma plataforma de
  `src/credentialHealth.js#PLATFORMS` não tiver texto em `STORE_LABELS`/`ALERT_BUILDERS` — para
  que a próxima loja nova não repita este buraco em silêncio.
- [X] T046 Estender a guarda de **fonte única** ao módulo de blog per FR-001 (partial).
  11 rotas de `/blog/*` ainda têm `title`/`description` em dois lugares ao mesmo tempo
  (`dashboard/lib/seo-registry.mjs` **e** `dashboard/app/blog/_preservationBlogPosts.js`),
  inclusive `/blog/como-ser-afiliado-shopee-whatsapp`, que US6 editou nesta mesma rodada — é o
  mesmo padrão que já divergiu em silêncio em `/bot-achadinhos-whatsapp` (R2 do research.md).
  Hoje nem `dashboard/scripts/lint-seo-metadata-duplicates.mjs` nem
  `test/seo-noindex-guard.test.js` olham esse módulo (deferimento registrado no comentário do
  teste, linhas 137-146). Ensinar o parser do lint a ler `_preservationBlogPosts.js`, remover a
  cópia de `title`/`description` dessas rotas do registry (módulo vira a única fonte, como já
  foi feito para as 4 rotas de FR-004) e ampliar a checagem (c) de
  `test/seo-noindex-guard.test.js` para incluir os paths de blog.
- [X] T047 Generalizar os guards dos **limites que não se cruzam** per FR-041 (partial).
  `test/marketing-limites-que-nao-se-cruzam.test.js` prende cada regra a uma página específica,
  enquanto a spec escreve "nenhum texto" (FR-029) e "todo comparativo" (FR-030/031/032):
  (a) FR-029 só varre `bot-afiliados-whatsapp` e o post da Shopee — `/anti-ban-whatsapp`, a
  página mais exposta à promessa, fica de fora; (b) FR-030/FR-031/FR-032 só varrem
  `/alternativas/achadinho-pro`. Como `checklist-comparativos.md` prevê **cinco** comparativos
  novos, uma página futura sem `bestFit`, com preço sem `verifiedAt`+`source` em
  `dashboard/lib/competitors-data.js`, ou com título se passando pelo concorrente **passa o CI
  hoje**. Trocar as asserções por iteração sobre todas as entradas de
  `dashboard/app/_comparisonContent.js` (FR-030/031/032) e sobre todas as entradas de
  `dashboard/app/_preservationCommercialPages.js` + `_preservationBlogPosts.js` (FR-029). As 9
  entradas de comparativo já têm `bestFit` hoje — a mudança é de cobertura de guarda, não de
  conteúdo.
- [X] T048 Documentar o **caminho de uso** dos oito e-mails de "Contato e escuta" per FR-022
  (partial). T026 confirmou o que o requisito proíbe (todos seguem `trigger: 'manual'` em
  `src/email/registry.js` — verificado), mas a outra metade do FR ("apenas o caminho de uso MUST
  ser documentado") não gerou artefato nesta entrega. Escrever em
  `specs/013-inbound-leads-strategy/` (seção nova em `quickstart.md` ou arquivo próprio) como a
  usuária dispara esses e-mails na prática: aba E-mails do admin, escolha de público, escolha do
  momento, e a razão de nunca virarem automáticos (pergunta disparada na hora errada queima o
  canal — `AGENTS.md`, grupo "Contato e escuta"). Nenhuma mudança de código.

---

## Phase 11: Convergence

**Origem**: segunda avaliação do código atual contra `spec.md`/`plan.md`/`tasks.md` em 2026-08-19,
depois de T045–T048 implementadas. T045 (SHEIN na família da Shopee), T046 (fonte única do módulo
de blog), T047 (guards de FR-029..FR-032 varrendo todas as páginas) e T048 (caminho de uso dos
e-mails de escuta) foram **confirmadas satisfeitas de fato**, não só marcadas. FR-008..FR-011
seguem íntegros: `buildSeoRobots()` devolve `{ index: false, follow: true }`, `sitemap.js` e
`scripts/notify-indexnow.mjs` leem `getIndexableSeoRoutes()` enquanto
`guard-seo-registry-coverage.mjs` lê `getAllSeoRoutes()` — as três pontas sincronizadas e nenhuma
página apagada. Os quatro arquivos de teste da feature passam (40 asserções). Sobrou **uma**
lacuna, da mesma família que T046 acabou de fechar para o blog.

- [X] T049 Estender a guarda de **fonte única** às páginas com `page.js` próprio per FR-001
  (partial). A checagem de FR-001 em `dashboard/scripts/lint-seo-metadata-duplicates.mjs`
  (linhas 176-181) compara o registry apenas contra `contentMetaByPath` — a união dos cinco
  módulos de conteúdo (`_lpShared`, `_preservationCommercialPages`, `_comparisonContent`,
  `_seoHubShared`, `_preservationBlogPosts`). O parser `parseMetadataFromPage()` (linha 12) já
  sabe ler `app/<rota>/page.js`, mas seu resultado só é usado como **preenchimento** quando falta
  metadata (linhas 131-135); ele **nunca** entra em `sourceConflicts`. Resultado: a rota que
  declara `title`/`description` no `seo-registry.mjs` **e** no seu próprio `page.js` passa o
  `npm run lint:seo-metadata` (hoje verde, 77/80) sem ninguém comparar os dois valores — é
  exatamente o buraco que deixou `/bot-achadinhos-whatsapp` divergir em silêncio (R2 do
  `research.md`), reaberto por outra porta. Cinco rotas estão nessa situação
  (`/precos`, `/parcerias`, `/bot-canais-whatsapp`, `/parceiro-influenciador`, `/conteudos`) e
  **três já divergiram de fato**: `/parcerias` (registry `'Parcerias BOTinho | Co-marketing para
  admins e afiliados'` vs. no ar `'Parcerias | Co-marketing para admins e afiliados de ofertas'`),
  `/conteudos` (diverge em `title` **e** `description`) e `/bot-canais-whatsapp` (diverge em
  `description`). Note que as cópias paradas no registry ainda carregam o texto de marca
  `BOTinho` que esta mesma rodada removeu de 38 títulos — a limpeza alcançou a cópia servida e
  não a do registry, que é a prova de que a duplicação continua produzindo deriva. Alimentar
  `parseMetadataFromPage()` no laço de `sourceConflicts` (mesma mensagem de erro, citando os dois
  arquivos), remover do registry o `title`/`description` dessas rotas — o `page.js` vira a fonte
  única, como já foi feito para as rotas de FR-004 e para as 11 de blog em T046 — e ampliar a
  checagem (c) de `test/seo-noindex-guard.test.js` para cobrir essa classe de rota. Conferir
  antes de remover que a cópia mantida é a que está no ar (o `page.js`), nunca a do registry, para
  não reintroduzir os títulos com `BOTinho`.

---

## Phase 12: Convergence

**Origem**: terceira avaliação do código atual contra `spec.md`/`plan.md`/`tasks.md` em 2026-08-19,
depois de T049 implementada. T049 foi **confirmada satisfeita de fato**: `parseMetadataFromPage()`
entra no laço de `sourceConflicts` com o sinal `ownsMetadata`, as 11 rotas perderam a cópia do
registry e `npm run lint:seo-metadata` fecha com zero conflito em 77/80. **Os três títulos de risco
reescritos respeitam FR-029 — texto lido, não presumido**: `/diagnostico-antiban-whatsapp` ("Ninguém
garante imunidade — dá para reduzir risco"), `/ferramentas/calculadora-risco-whatsapp` ("Estimativa,
não garantia") e `/materiais/checklist-antiban-whatsapp` ("Nenhuma ferramenta garante imunidade");
os FAQ das três respondem "Nenhuma ferramenta séria garante banimento zero"; os títulos medem 47, 47
e 45 caracteres. FR-008..FR-011, FR-012, FR-013, FR-015..FR-022, FR-025..FR-027 seguem íntegros e os
quatro arquivos de teste da feature passam (40 asserções). Sobraram três lacunas, todas de
**cobertura de guarda** — nenhuma delas é violação de conteúdo hoje, e nenhuma bloqueia o entregue.

- [X] T050 Fechar a fonte única nos **dois últimos módulos de conteúdo** per FR-001 (partial).
  O parser de `dashboard/scripts/lint-seo-metadata-duplicates.mjs` conhece cinco dos **sete**
  módulos de conteúdo de `dashboard/app/`. Faltam `_preservationDecisionPages.js` e
  `_organicNicheLanding.js` — e o primeiro tem duplicação real agora: `/bot-comum-vs-botinho`,
  `/faq-antiban-whatsapp`, `/como-funciona-botinho-canais` e `/protecao-antiban-botinho` declaram
  `title` **e** `description` no `dashboard/lib/seo-registry.mjs` **e** no módulo. Os valores ainda
  são idênticos — que é exatamente o estado em que `/bot-achadinhos-whatsapp` estava antes de
  divergir (R2 do `research.md`) e em que `/parcerias`, `/conteudos` e `/bot-canais-whatsapp`
  estavam antes de T049 medi-las já divergidas. O laço de `sourceConflicts` (linhas 182-200) não
  acusa porque `contentMetaByPath` não tem esses paths e o `page.js` dessas rotas não traz literal
  de `title` (chama `getDecisionPageMetadata(...)`), então cai no `continue` do `ownsMetadata`.
  `_organicNicheLanding.js` não tem duplicação hoje (o registry não guarda cópia das suas duas
  rotas), mas suas rotas `/bot-ofertas-restaurantes-whatsapp` e `/bot-ofertas-marketplace-whatsapp`
  são duas das três da linha `AVISO: 3 rotas indexáveis sem metadata completa` — ficam **fora da
  validação de duplicidade de FR-007 inteira**, além de fora do guard de fonte única. Ensinar o
  parser os dois módulos (os blocos de `_preservationDecisionPages.js` são chaveados por `slug:`
  com o path já barrado, como `_preservationBlogPosts.js`; os de `_organicNicheLanding.js` também
  usam `slug:`), remover do registry o `title`/`description` das quatro rotas de decisão — o módulo
  vira a fonte única, como já foi feito em T046 e T049 — e ampliar a checagem (c) de
  `test/seo-noindex-guard.test.js` para cobrir essa classe. Conferir que as duas rotas de nicho
  saem do `AVISO` e entram na contagem de rotas avaliadas (hoje 77/80). Nada de página nova nem de
  reabrir a linha congelada de nicho (FR-033/FR-034): as duas rotas continuam existindo como estão.
- [X] T051 Estender a varredura de **FR-029** às páginas que ficaram fora dela per FR-041 (partial).
  T047 trocou os alvos fixos por varredura, mas só sobre `_preservationCommercialPages.js` (5) e
  `_preservationBlogPosts.js` (15) — 20 páginas. Ficaram de fora justamente as mais expostas à
  promessa: `dashboard/app/_preservationDecisionPages.js`, que contém `/faq-antiban-whatsapp`
  ("WhatsApp banido divulgando ofertas: perguntas e respostas") e `/protecao-antiban-botinho`
  ("Como evitar que o WhatsApp seja banido divulgando ofertas"); e as três páginas de risco com
  `page.js` próprio — `/diagnostico-antiban-whatsapp`, `/ferramentas/calculadora-risco-whatsapp`,
  `/materiais/checklist-antiban-whatsapp` — cujo título e descrição **esta mesma entrega
  reescreveu** em T049. Como FR-029 diz "nenhum texto" e está na seção que reprova a entrega em
  revisão, o texto que a feature escreveu não pode ficar sem guarda. **Nenhuma das cinco viola
  FR-029 hoje** — verificado aplicando o próprio `encontrarPromessaProibida` do teste a todas elas.
  ⚠️ Armadilha medida, resolver junto: estender a varredura como está produz **dois falsos
  positivos** em pergunta honesta de FAQ — "A calculadora garante que meu WhatsApp não será
  banido?" e "Este diagnóstico garante que meu WhatsApp não será banido?", ambas respondidas com
  "Não. Nenhuma ferramenta séria garante banimento zero." O `NEGACAO_ANTES_RE` só olha para trás
  dentro da mesma sentença, e aqui a negação está no campo `answer` vizinho, não antes do trecho.
  Tratar o par pergunta+resposta como uma unidade de contexto (ou aceitar a negação na `answer`
  adjacente) — nunca afrouxar os padrões de `PADROES_PROMESSA_NAO_BANIMENTO`, que são a guarda de
  verdade. Manter a asserção de piso de contagem de páginas varridas (hoje `>= 20`), subindo-a, para
  que uma quebra futura do parser não passe como "varredura vazia".
- [X] T052 Medir os **55 caracteres** também nos títulos com `page.js` próprio per FR-002/FR-041
  (partial). `test/inbound-titulos-clique.test.js` mede o orçamento de 55 sobre a lista fixa
  `ALVOS` (as 10/11 rotas de FR-004). T049 reescreveu mais três títulos fora dessa lista
  (`/diagnostico-antiban-whatsapp` 47, `/ferramentas/calculadora-risco-whatsapp` 47,
  `/materiais/checklist-antiban-whatsapp` 45) — **todos dentro do orçamento hoje**, mas nenhum teste
  reprova se um deles crescer. FR-041 nomeia "o limite de caracteres do título" como a primeira
  regra que não pode regredir em silêncio, e agora existem títulos escritos por esta entrega que
  nenhuma medição cobre. Incluir essas três rotas na medição (mesma mensagem de falha, com o sufixo
  reportado à parte pela decisão D1 do `plan.md`), sem mexer no teto de 60 preservado para
  `/bot-achadinhos-whatsapp` e sem afrouxar nada existente.

---

## Phase 13: Convergence

**Origem**: quarta avaliação do código atual contra `spec.md`/`plan.md`/`tasks.md` em 2026-08-27,
depois de T050–T052 marcadas como concluídas. T051 e T052 foram confirmadas satisfeitas: a guarda
de FR-029 agora cobre 27 páginas (incluindo os módulos de decisão e os três `page.js` de risco), e
os três títulos de risco reescritos estão sob o teto automatizado de 55 caracteres. T050 ficou
parcial: a duplicação das quatro rotas de decisão foi removida e o lint aprendeu esse módulo, mas
a segunda metade expressamente pedida — `_organicNicheLanding.js` — não foi implementada.

- [X] T053 Completar T050 ensinando as duas guardas de **fonte única** a ler
  `_organicNicheLanding.js` per FR-001/FR-007/FR-041 (partial). O arquivo
  `dashboard/scripts/lint-seo-metadata-duplicates.mjs` adicionou
  `parsePreservationDecisionMeta()`, porém não tem parser para `_organicNicheLanding.js` e seu
  `contentMetaByPath` continua unindo somente seis módulos. Por isso
  `/bot-ofertas-restaurantes-whatsapp` e `/bot-ofertas-marketplace-whatsapp` seguem fora da
  validação de duplicidade: `npm run lint:seo-metadata` ainda avisa que 3 das 82 rotas indexáveis
  não têm metadata completa, em vez de avaliar essas duas rotas. Além disso,
  `test/seo-noindex-guard.test.js#contentModulePaths()` ainda não inclui nem
  `_preservationDecisionPages.js` nem `_organicNicheLanding.js`, apesar de T050 pedir que a
  checagem (c) cobrisse essa classe. Criar o parser do módulo orgânico usando os blocos com
  `slug:`/`title:`/`description:`, incluí-lo em `contentMetaByPath`, e espelhar no teste a
  cobertura dos módulos de decisão e nicho. Confirmar que as duas rotas orgânicas passam a
  integrar `completeRecords` (restando no máximo a única rota incompleta não relacionada), sem
  publicar, apagar ou alterar conteúdo das linhas congeladas (FR-033/FR-034).

---

## Phase 14: Review

**Origem**: revisão de código após T053 em 2026-08-27. O parser novo funciona com o formato
atual e o lint informa `81/82`, porém nenhuma asserção torna essa cobertura obrigatória. Tanto o
lint quanto a checagem (c) continuam retornando sucesso se o regex de
`_organicNicheLanding.js` deixar de casar silenciosamente; como as duas rotas não têm cópia no
registry, o `Set` vazio também não produz conflito e o teste segue verde. Isso reabre exatamente
o buraco que T053 deveria fechar.

- [X] T054 Tornar a inclusão das duas rotas orgânicas uma **guarda que falha**, não apenas uma
  observação manual, per FR-001/FR-007/FR-041. Em `test/seo-noindex-guard.test.js`, afirmar
  explicitamente que `contentModulePaths()` contém
  `/bot-ofertas-restaurantes-whatsapp` e `/bot-ofertas-marketplace-whatsapp` (e, para evitar a
  mesma falha silenciosa no outro módulo acrescentado por T050, os quatro paths de
  `_preservationDecisionPages.js`). Adicionar também uma asserção automatizada sobre o lint para
  provar que as duas rotas entram em `completeRecords` — por exemplo, executar
  `dashboard/scripts/lint-seo-metadata-duplicates.mjs` no teste e exigir a cobertura mínima
  conhecida de `81/82`, ou extrair/exportar o parser para testá-lo diretamente. A solução deve
  falhar se qualquer regex retornar vazio/parcial e continuar permitindo somente a única rota
  incompleta não relacionada; não afrouxar o lint nem alterar conteúdo congelado.

---

## Phase 15: Review

**Origem**: revisão de código após T054 em 2026-08-27. A nova asserção de paths prova que o
parser duplicado dentro do teste reconhece as seis rotas esperadas, e a asserção `81/82` prova
somente a cardinalidade global produzida pelo lint. Ela não prova que **o parser do lint** incluiu
as duas rotas orgânicas em `completeRecords`: se esse parser regredir enquanto outra rota passar a
ter metadata completa, a cardinalidade continua `81/82` e ambas as asserções ficam verdes. Os dois
parsers são implementações regex independentes, portanto o sucesso de um não valida o outro.

- [X] T055 Fazer o teste observar diretamente quais paths o lint colocou em `completeRecords`,
  per FR-001/FR-007/FR-041 e o requisito expresso de T054. Expor do
  `dashboard/scripts/lint-seo-metadata-duplicates.mjs` uma saída estruturada/testável (por exemplo,
  função exportada sem efeitos colaterais, módulo auxiliar compartilhado, ou flag de relatório
  JSON) e afirmar que ela contém `/bot-ofertas-restaurantes-whatsapp` e
  `/bot-ofertas-marketplace-whatsapp`, além de manter a guarda de que resta exatamente uma rota
  incompleta. Evitar validar apenas a string agregada `81/82` e evitar dois parsers independentes
  como evidência da mesma propriedade. A execução CLI existente e sua mensagem devem continuar
  compatíveis; não alterar conteúdo congelado.
