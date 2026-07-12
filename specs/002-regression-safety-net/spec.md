# Feature Specification: Etapa 0 — Rede de segurança contra regressão e acoplamento

**Feature Branch**: `002-regression-safety-net`

**Created**: 2026-07-12

**Status**: Draft

**Input**: User description: "Etapa 0 — Rede de segurança contra regressão e acoplamento (saneamento técnico do Wabot). Tornar regressões visíveis e impossíveis de reintroduzir ANTES de qualquer refatoração de lógica, sem mudar comportamento de produção. Três entregáveis: barreira de import automatizada no CI, merge gate dos testes, e livro-razão de acoplamento."

## Visão geral

Esta é a **Etapa 0** do plano de refatoração incremental do Wabot. Seu propósito
é instalar uma **rede de segurança de qualidade/CI** que torne regressões de
arquitetura e de comportamento **visíveis e impossíveis de reintroduzir**, antes
que qualquer refatoração de lógica comece (Etapa 1 em diante).

**Invariante central:** nada de produção pode mudar de comportamento nesta etapa.
Não há alteração de lógica de negócio, socket WhatsApp, conversores, pipeline de
envio ou rotas de runtime. Os únicos artefatos adicionados são: uma
devDependency de análise estática, um arquivo de configuração de fronteiras de
import, um workflow de CI para os testes, e documentação de processo.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Barreira de import protege as fronteiras de arquitetura (Priority: P1)

Como mantenedor do Wabot, quero que o CI **falhe automaticamente** quando alguém
introduzir uma nova violação de fronteira de import (por exemplo, um novo arquivo
de `src/` importando de `dashboard/`, ou uma rota Fastify importando
`sessionCore.js` direto em vez de passar por `manager.js`), para que as regras
hoje apenas convencionais do `AGENTS.md` passem a ser aplicadas por máquina.

**Why this priority**: É o entregável de maior valor estrutural — sem uma
barreira executável, todas as refatorações das etapas seguintes correm o risco de
reintroduzir o acoplamento que estamos tentando remover. As regras existem no
`AGENTS.md` mas hoje dependem de disciplina humana.

**Independent Test**: Rodar a barreira localmente no estado atual do repositório
resulta em **verde** (as 2 violações conhecidas estão allowlisted como baseline).
Introduzir de propósito um novo import de `dashboard/` em um arquivo de `src/`, ou
um import direto de `sessionCore.js` em `src/api/routes/`, faz a barreira sair
**vermelha** — sem depender do restante do pipeline.

**Acceptance Scenarios**:

1. **Given** o repositório no estado atual (com as 2 violações `dashboard/lib`
   conhecidas), **When** a barreira de import é executada, **Then** ela termina
   com sucesso (exit 0 / verde), tratando as 2 violações como exceções de
   baseline explicitamente listadas.
2. **Given** um novo arquivo em `src/` que importa de `dashboard/`, **When** a
   barreira é executada, **Then** ela termina com falha (exit ≠ 0 / vermelho) e
   aponta o arquivo infrator.
3. **Given** um arquivo em `src/api/routes/` que importa `src/core/sessionCore.js`
   diretamente, **When** a barreira é executada, **Then** ela termina com falha e
   indica que o acesso deve passar por `src/manager.js`.
4. **Given** a barreira configurada no CI, **When** uma Pull Request é aberta
   contra `develop` ou `main`, **Then** a barreira roda como parte do CI e seu
   resultado é um status de check da PR.
5. **Given** uma das 2 violações de baseline for removida do código no futuro
   (Etapa 1), **When** a barreira é executada, **Then** ela continua verde e a
   allowlist pode encolher sem falso positivo.

---

### User Story 2 - Suíte de testes vira gate obrigatório de merge (Priority: P1)

Como mantenedor do Wabot, quero que a suíte de testes existente (`npm test`) rode
no CI do GitHub Actions em toda PR contra `develop` e `main`, e que a PR fique
bloqueada quando qualquer teste falhar, para que regressões de comportamento sejam
pegas antes do merge — hoje os testes existem mas não são executados
automaticamente em nenhum workflow.

**Why this priority**: Existe uma suíte substancial (150 arquivos de teste) que
hoje **não é executada por nenhum CI** — os workflows atuais só rodam lint de
backend (`backend-lint.yml`) e o deploy (`deploy.yml`). Sem gate de teste, uma
regressão coberta por teste passa despercebida até quebrar em staging/produção.

**Independent Test**: Abrir uma PR com um teste que falha resulta em CI vermelho e
merge bloqueado; abrir uma PR com todos os testes passando resulta em CI verde.

**Acceptance Scenarios**:

1. **Given** uma PR aberta contra `develop`, **When** o CI roda, **Then** ele
   executa `npm ci` seguido de `npm test` e reporta o resultado como status de
   check.
2. **Given** uma PR onde algum teste da suíte falha, **When** o CI roda, **Then**
   o job termina com falha (vermelho) e o merge fica bloqueado pelo gate.
3. **Given** uma PR onde todos os testes passam, **When** o CI roda, **Then** o
   job termina com sucesso (verde).
4. **Given** o workflow de deploy existente (`deploy.yml`), **When** o CI de
   testes é adicionado, **Then** o `deploy.yml` **não** é alterado — o gate de
   testes vive em workflow(s) separado(s).
5. **Given** o mesmo CI, **When** ele roda, **Then** a barreira de import da User
   Story 1 é executada no mesmo pipeline de CI.

---

### User Story 3 - Livro-razão de acoplamento registra elos escondidos (Priority: P2)

Como mantenedor do Wabot, quero um documento vivo (`docs/architecture/coupling-ledger.md`)
onde toda vez que subir algo e quebrar outra coisa aparentemente não relacionada,
registra-se o elo escondido (data, o que quebrou, qual acoplamento causou, como
foi mitigado), para que o conhecimento sobre acoplamentos ocultos deixe de viver
só na memória das pessoas e vire histórico consultável.

**Why this priority**: É documentação/processo, de valor real mas sem efeito
técnico sobre o CI. Complementa as barreiras automatizadas com o registro dos
acoplamentos que ferramentas ainda não capturam. Vem depois das duas barreiras
executáveis.

**Independent Test**: O arquivo `docs/architecture/coupling-ledger.md` existe,
contém um template de entrada reutilizável e ao menos uma entrada seed preenchida
(as 2 violações `dashboard/lib` conhecidas).

**Acceptance Scenarios**:

1. **Given** o repositório após esta etapa, **When** um mantenedor abre
   `docs/architecture/coupling-ledger.md`, **Then** ele encontra um template de
   entrada claro (campos: data, o que quebrou, acoplamento causador, mitigação) e
   instruções de quando registrar.
2. **Given** o mesmo documento, **When** o mantenedor lê a primeira entrada,
   **Then** ela documenta as 2 violações `src/ → dashboard/lib` conhecidas como
   dívida de baseline, referenciando que serão removidas na Etapa 1.

---

### Edge Cases

- **Novo arquivo em `src/domain/`** (diretório que ainda não existe): a regra de
  defesa em profundidade que proíbe módulos puros de domínio de importar
  Prisma/Baileys/Redis deve poder existir de forma dormente sem quebrar o CI
  enquanto `src/domain/` estiver vazio ou ausente.
- **Baseline encolhendo**: quando uma das 2 violações allowlisted for removida na
  Etapa 1, a barreira não pode gerar falso positivo por "exceção não utilizada" a
  ponto de quebrar o CI de forma bloqueante — a redução da allowlist deve ser um
  passo tranquilo.
- **Instalação de devDependency**: adicionar a ferramenta de análise não pode
  disparar efeitos colaterais de build de produção (ex.: postinstall pesado) nem
  aumentar o consumo de memória em runtime — ela roda só em CI/dev.
- **Falso positivo de import dinâmico ou de tipo**: a barreira deve mirar imports
  reais de módulo entre as fronteiras declaradas, sem quebrar em construções que
  não representam acoplamento de runtime.
- **PR que toca só documentação**: uma PR que altera apenas `docs/` ainda passa
  pelo CI, e o resultado deve ser verde (nenhuma fronteira violada).

## Requirements *(mandatory)*

### Functional Requirements

**Barreira de import (User Story 1)**

- **FR-001**: O sistema DEVE prover uma verificação automatizada de fronteiras de
  import, adicionada como **devDependency** (ferramenta de análise estática de
  dependências, preferência por uma leve que não exija modificar código de
  produção), configurada por arquivo versionado no repositório.
- **FR-002**: A barreira DEVE **falhar** (exit ≠ 0) quando qualquer módulo em
  `src/**` importar de `dashboard/**`, exceto pelas exceções de baseline
  explicitamente listadas.
- **FR-003**: A barreira DEVE nascer com **exatamente 2 exceções de baseline**
  allowlisted, correspondentes às violações hoje existentes:
  `src/offerAutomation/dispatcher.js` e `src/core/mirrorTemplate.js` importando de
  `dashboard/lib/mobileOfferComposer.js` e `dashboard/lib/mobileTemplateStore.js`.
- **FR-004**: A barreira DEVE **falhar** quando qualquer módulo em
  `src/api/routes/**` importar `src/core/sessionCore.js` diretamente (o acesso
  deve passar por `src/manager.js`).
- **FR-005**: O sistema DEVE documentar que a allowlist de baseline do FR-003 deve
  **encolher para zero na Etapa 1**, e a redução da allowlist não deve exigir
  reescrita da barreira.
- **FR-006**: A barreira DEVE incluir, de forma dormente/preparada, uma regra de
  defesa em profundidade que proíba módulos puros de domínio (`src/domain/**`) de
  importar Prisma, Baileys ou Redis — válida mesmo que `src/domain/` ainda não
  exista, sem quebrar o CI enquanto o diretório estiver ausente.
- **FR-007**: A barreira DEVE poder ser executada localmente por um comando único
  (ex.: script npm) e produzir o mesmo resultado que produz no CI.

**Merge gate dos testes (User Story 2)**

- **FR-008**: O sistema DEVE executar a suíte de testes existente (`npm test`,
  baseada em `node --test`) no CI do GitHub Actions em Pull Requests contra
  `develop` e `main`.
- **FR-009**: O CI de testes DEVE executar `npm ci` seguido de `npm test` e
  **falhar** o check da PR se qualquer teste falhar.
- **FR-010**: Antes de criar o CI de testes, o sistema DEVE verificar se já existe
  workflow que rode os testes; se não existir, DEVE criar um novo workflow em
  `.github/workflows/*.yml`. (Verificado: hoje não existe — só há
  `backend-lint.yml` e `deploy.yml`.)
- **FR-011**: O sistema NÃO DEVE alterar o workflow de deploy existente
  (`.github/workflows/deploy.yml`).
- **FR-012**: A barreira de import (FR-001–FR-007) DEVE ser executada no mesmo CI
  em que os testes rodam (mesmo pipeline/workflow de qualidade).

**Livro-razão de acoplamento (User Story 3)**

- **FR-013**: O sistema DEVE criar o documento `docs/architecture/coupling-ledger.md`.
- **FR-014**: O documento DEVE conter um **template de entrada** reutilizável com,
  no mínimo, os campos: data, o que quebrou, qual acoplamento causou, como foi
  mitigado — além de instruções de quando registrar.
- **FR-015**: O documento DEVE conter **ao menos 1 entrada seed** preenchida,
  documentando as 2 violações `src/ → dashboard/lib` conhecidas e apontando que
  serão removidas na Etapa 1.

**Invariantes de não-regressão (todas as histórias)**

- **FR-016**: Nenhum arquivo de runtime de produção (qualquer `src/**/*.js`, exceto
  configuração de barreira e artefatos de CI) DEVE ter seu comportamento alterado
  por esta etapa.
- **FR-017**: A rede de segurança NÃO DEVE aumentar o consumo de memória de
  produção — todos os novos artefatos rodam apenas em CI/desenvolvimento, nunca no
  runtime dos processos PM2.
- **FR-018**: Qualquer script novo que acompanhe a barreira DEVE ter seus testes
  rodáveis com `node:test` quando aplicável; a configuração da barreira em si é
  validada executando a ferramenta contra o repositório.
- **FR-019**: O trabalho DEVE seguir o fluxo canônico do repositório: branch a
  partir de `develop`, PR contra `develop` (nunca direto para `main`).

### Key Entities

- **Configuração da barreira de import**: arquivo versionado que declara as
  fronteiras proibidas (`src → dashboard`, `routes → sessionCore`,
  `domain → infra`) e a allowlist de baseline com as 2 exceções conhecidas.
- **Allowlist de baseline (dívida conhecida)**: lista explícita das 2 violações
  atuais que devem ser toleradas hoje e removidas na Etapa 1; encolhe para zero.
- **Workflow de CI de qualidade**: definição de GitHub Actions que roda `npm ci`,
  `npm test` e a barreira de import em PRs contra `develop`/`main`.
- **Livro-razão de acoplamento**: documento markdown vivo com template de entrada e
  histórico de elos escondidos entre módulos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Rodar a barreira de import no estado atual do repositório resulta em
  **verde** (0 violações reportadas fora da allowlist de 2 exceções de baseline).
- **SC-002**: Introduzir de propósito **1** nova violação (um novo import de
  `dashboard/` em um arquivo de `src/`, ou um import direto de `sessionCore.js` em
  `src/api/routes/`) faz a barreira sair **vermelha**, identificando o arquivo
  infrator.
- **SC-003**: Em uma PR contra `develop` ou `main`, o CI executa `npm test` e o
  check **falha** se ao menos 1 dos testes da suíte falhar, e **passa** quando
  todos passam.
- **SC-004**: O arquivo `docs/architecture/coupling-ledger.md` existe, contém o
  template de entrada e **≥ 1** entrada seed preenchida.
- **SC-005**: O workflow `deploy.yml` permanece **byte a byte inalterado** após
  esta etapa.
- **SC-006**: Nenhum arquivo de runtime de produção (`src/**/*.js` fora de
  configuração de barreira/CI) teve comportamento alterado — verificável por
  ausência de mudança funcional no diff e pela suíte de testes existente
  continuar passando sem modificação de asserts de comportamento.
- **SC-007**: A barreira e o gate de testes rodam **inteiramente em CI/dev** e não
  adicionam nenhum processo, cache ou dependência ao runtime de produção
  (consumo de memória de produção inalterado).

## Assumptions

- A ferramenta preferida para a barreira de import é **dependency-cruiser**
  (leve, não exige mudar código de produção); `eslint-plugin-boundaries` é
  alternativa aceitável se surgir impedimento — a escolha exata fica para a fase
  de planejamento.
- O CI de testes usa o mesmo runner GitHub Actions já em uso pelos workflows
  existentes (`ubuntu-latest`, Node compatível com o projeto), rodando em eventos
  de `pull_request` contra `develop` e `main`.
- "Gate obrigatório de merge" pressupõe que a proteção de branch do repositório
  (branch protection rules) seja configurada para exigir o novo check — a criação
  do workflow entrega o check; a marcação como *required* é ato de configuração no
  GitHub, fora do código.
- As 2 violações de baseline foram confirmadas por inspeção do código nesta data
  (`src/offerAutomation/dispatcher.js` e `src/core/mirrorTemplate.js` importando
  `dashboard/lib/mobileOfferComposer.js` e `dashboard/lib/mobileTemplateStore.js`).
- A suíte atual tem ~150 arquivos de teste executados por `npm test`
  (`node --test`); o gate roda a suíte como está, sem reescrevê-la.
- `src/domain/` ainda não existe; a regra FR-006 é preparada de forma dormente
  para quando módulos puros de domínio forem introduzidos.
- Etapa 0 depende do plano de refatoração da Etapa 1 apenas como contexto
  (remoção futura da allowlist); nenhuma refatoração de lógica ocorre aqui.
