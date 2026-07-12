---

description: "Task list template for feature implementation"
---

# Tasks: Etapa 0 — Rede de segurança contra regressão e acoplamento

**Input**: Design documents from `/specs/002-regression-safety-net/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/dependency-cruiser-rules.md, contracts/ci-quality-gate.md, quickstart.md

**Tests**: Não há testes automatizados de novo código de produção (esta feature não toca `src/**/*.js` de runtime). A "prova" de cada entrega é executar a própria ferramenta (`arch:check`, `npm test`, o workflow) contra o repo — isso está modelado como tasks de verificação explícitas dentro de cada história, conforme os Acceptance Scenarios e Success Criteria da spec.

**Organization**: Tasks agrupadas por user story (US1 = barreira de import, US2 = merge gate de testes, US3 = livro-razão de acoplamento), na ordem de prioridade da spec (P1, P1, P2).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependência)
- **[Story]**: A qual user story a task pertence (US1, US2, US3)
- Caminhos de arquivo exatos em cada descrição

## Path Conventions

Monorepo Node ESM na raiz, com `dashboard/` Next.js co-localizado (ver plan.md → Project Structure). Todos os artefatos desta feature são novos arquivos de config/CI/doc na raiz do repo, mais uma edição pontual de `package.json`/`package-lock.json`. **Zero arquivos de `src/**/*.js` de runtime são modificados.**

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Preparar o terreno para instalar a devDependency e confirmar o estado atual do repo antes de qualquer mudança.

- [ ] T001 Confirmar branch atual `002-regression-safety-net` criada a partir de `develop` (`git status`, `git log --oneline -1 develop`) — pré-condição do FR-019.
- [ ] T002 Registrar hash de referência do `deploy.yml` antes de qualquer mudança: `sha256sum .github/workflows/deploy.yml` (deve bater com `158b331b16686a4b98107026d2ae7027933e997c94030cb2da0d3adf50f6ad54` do quickstart.md) — baseline para a verificação SC-005 na Phase 6.
- [ ] T003 Instalar `dependency-cruiser` como devDependency: `npm install --save-dev dependency-cruiser` (atualiza `package.json` e `package-lock.json`; nenhuma `dependencies` de runtime é tocada — FR-016/FR-017).

**Checkpoint**: devDependency instalada, hash de baseline do `deploy.yml` registrado. Pronto para configurar as regras da barreira.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Nenhuma infraestrutura de runtime compartilhada é necessária (esta feature não tem camada de dados/serviço). A única pré-condição bloqueante real é a devDependency instalada na Phase 1. Não há tasks de Phase 2 — as user stories começam diretamente após o Setup.

**Checkpoint**: N/A — prosseguir direto para US1.

---

## Phase 3: User Story 1 - Barreira de import protege as fronteiras de arquitetura (Priority: P1) 🎯 MVP

**Goal**: Um comando único (`npm run arch:check`) falha quando uma nova violação de fronteira (`src → dashboard`, `routes → sessionCore`) é introduzida, e passa hoje com as 2 exceções de baseline conhecidas allowlisted.

**Independent Test**: Rodar `npm run arch:check` no estado atual do repo dá exit 0 (verde). Introduzir de propósito um novo import proibido faz o comando sair com exit ≠ 0, apontando o arquivo infrator. Reverter a violação volta a verde. Tudo isso é verificável sem depender do CI ou das outras histórias.

### Implementation for User Story 1

- [ ] T004 [US1] Criar `.dependency-cruiser.cjs` na raiz do repo (CommonJS — `module.exports`, projeto é ESM) com `options.doNotFollow = { path: 'node_modules' }` e array `forbidden` vazio, conforme Entidade 1 do data-model.md.
- [ ] T005 [US1] Adicionar a regra `no-src-to-dashboard` em `.dependency-cruiser.cjs`: `severity: 'error'`, `from.path: '^src/'`, `from.pathNot` contendo exatamente os 2 arquivos de baseline (`src/offerAutomation/dispatcher\.js` e `src/core/mirrorTemplate\.js`), `to.path: '^dashboard/'`, com `comment` referenciando o AGENTS.md e a Etapa 1 (FR-002, FR-003).
- [ ] T006 [US1] Adicionar a regra `routes-must-use-manager` em `.dependency-cruiser.cjs`: `severity: 'error'`, `from.path: '^src/api/routes/'`, `to.path: 'src/core/sessionCore\\.js$'`, `comment` indicando que o acesso deve passar por `src/manager.js` (FR-004).
- [ ] T007 [US1] Adicionar a regra dormente `domain-no-infra` em `.dependency-cruiser.cjs`: `severity: 'error'`, `from.path: '^src/domain/'`, `to.path` casando `@prisma/client`, `baileys`/`@whiskeysockets/baileys` e `ioredis`, com `comment` explicando que fica dormente enquanto `src/domain/` não existir (FR-006).
- [ ] T008 [US1] Adicionar o script `"arch:check": "depcruise src dashboard/lib --config .dependency-cruiser.cjs"` em `package.json` (FR-001, FR-007) — nenhuma outra entrada de `scripts` é alterada.

### Verificação para User Story 1 (prova dos Acceptance Scenarios / SC-001, SC-002)

- [ ] T009 [US1] Rodar `npm run arch:check` no estado atual do repo e confirmar exit 0 (verde), validando que as 2 exceções de baseline (`dispatcher.js`, `mirrorTemplate.js`) não disparam a regra `no-src-to-dashboard` — corresponde ao caso de contrato C1 e ao SC-001.
- [ ] T010 [P] [US1] Injetar de propósito uma violação nova e não-allowlisted (`printf "import x from '../dashboard/lib/mobileOfferComposer.js'\n" > src/__viol.js`), rodar `npm run arch:check`, confirmar exit ≠ 0 apontando `src/__viol.js`, depois `rm src/__viol.js` e confirmar que `npm run arch:check` volta a exit 0 — corresponde ao caso de contrato C2 e ao SC-002 (Acceptance Scenario 2 da US1).
- [ ] T011 [P] [US1] Criar temporariamente um arquivo em `src/api/routes/` importando `../../core/sessionCore.js` direto, rodar `npm run arch:check`, confirmar exit ≠ 0 indicando o uso de `src/manager.js`, depois remover o arquivo temporário e confirmar retorno a exit 0 — corresponde ao caso de contrato C3 e ao Acceptance Scenario 3 da US1.
- [ ] T012 [US1] Confirmar que `src/domain/` não existe hoje (`ls src/domain 2>/dev/null || echo ausente`) e que `npm run arch:check` continua exit 0 mesmo com a regra `domain-no-infra` presente na config — corresponde ao caso de contrato C5 e ao edge case "Novo arquivo em src/domain/".

**Checkpoint**: A barreira de import está completa, versionada e comprovadamente funcional local (verde no baseline, vermelha sob violação, dormente sem quebrar sem `src/domain/`). Pode ser testada e usada de forma independente do CI ou do livro-razão.

---

## Phase 4: User Story 2 - Suíte de testes vira gate obrigatório de merge (Priority: P1)

**Goal**: Toda PR contra `develop`/`main` roda automaticamente `npm ci` + `npm test` + `npm run arch:check` (US1) em um workflow novo e separado, sem tocar `deploy.yml`.

**Independent Test**: Uma PR com um teste quebrado fica com o check "Quality gate" vermelho e o merge bloqueado (via branch protection); uma PR com todos os testes e a barreira passando fica verde. Verificável inspecionando o workflow YAML e, se possível, abrindo uma PR de teste — não depende do conteúdo do livro-razão (US3).

**Dependency**: Depende do script `arch:check` da US1 (T008) já existir, pois o workflow o invoca no último step (FR-012).

### Implementation for User Story 2

- [ ] T013 [US2] Confirmar que não existe workflow de testes hoje: `ls .github/workflows/` deve listar apenas `backend-lint.yml` e `deploy.yml` (verificação do FR-010 antes de criar o novo arquivo).
- [ ] T014 [US2] Criar `.github/workflows/quality-gate.yml` com gatilho `on.pull_request.branches: [develop, main]`, job único `quality` em `runs-on: ubuntu-latest`, steps na ordem: `actions/checkout@v4` → `actions/setup-node@v4` com `node-version: 22` → `npm ci` → `npm test` → `npm run arch:check` (FR-008, FR-009, FR-012; Entidade 3 do data-model.md).
- [ ] T015 [US2] Validar localmente que os comandos do workflow (`npm ci`, `npm test`, `npm run arch:check`) rodam em sequência sem erro no ambiente de desenvolvimento, replicando os steps do `quality-gate.yml` antes de depender do runner do GitHub Actions.

### Verificação para User Story 2 (prova dos Acceptance Scenarios / SC-003, SC-005)

- [ ] T016 [US2] Confirmar que `.github/workflows/deploy.yml` permanece byte a byte inalterado: `sha256sum .github/workflows/deploy.yml` deve reproduzir o mesmo hash registrado em T002, e `git diff --stat -- .github/workflows/deploy.yml` não deve ter saída — corresponde ao SC-005 e ao caso de contrato G5.
- [ ] T017 [US2] Confirmar que `.github/workflows/backend-lint.yml` também não foi alterado (`git diff --stat -- .github/workflows/backend-lint.yml` sem saída) — nenhum workflow existente é tocado além da criação do novo arquivo.
- [ ] T018 [P] [US2] Rodar `npm test` isoladamente e confirmar que a suíte completa (~150 arquivos) passa sem nenhuma alteração de asserts de comportamento — corresponde ao SC-006 e ao Acceptance Scenario 3 da US2.
- [ ] T019 [US2] Documentar (comentário no PR ou nota de handoff) que a marcação do check `quality-gate` como *required* em branch protection é um passo manual de configuração no GitHub, fora deste diff — conforme a Assumption da spec sobre "gate obrigatório de merge".

**Checkpoint**: O workflow de qualidade existe, roda `npm test` + `arch:check` em PRs contra `develop`/`main`, e `deploy.yml`/`backend-lint.yml` seguem intocados. US1 e US2 juntas entregam a rede de segurança executável completa (P1 + P1).

---

## Phase 5: User Story 3 - Livro-razão de acoplamento registra elos escondidos (Priority: P2)

**Goal**: `docs/architecture/coupling-ledger.md` existe com um template de entrada reutilizável e ao menos uma entrada seed documentando as 2 violações `src/ → dashboard/lib` já conhecidas como dívida de baseline.

**Independent Test**: Abrir o arquivo e confirmar que ele contém o template (campos Data / O que quebrou / Acoplamento causador / Como foi mitigado / Status) e a entrada seed — verificável por leitura direta do markdown, sem depender do CI rodando.

### Implementation for User Story 3

- [ ] T020 [US3] Criar o diretório `docs/architecture/` (se não existir) e o arquivo `docs/architecture/coupling-ledger.md` com um cabeçalho explicando o propósito do documento e instruções de quando registrar uma nova entrada (FR-013, FR-014).
- [ ] T021 [US3] Adicionar ao `coupling-ledger.md` o template de entrada reutilizável com os campos obrigatórios: Data, O que quebrou, Acoplamento causador, Como foi mitigado, e o campo recomendado Status (Aberto/Mitigado/Removido) — conforme Entidade 4 do data-model.md (FR-014).
- [ ] T022 [US3] Adicionar ao `coupling-ledger.md` a entrada seed preenchida documentando as 2 violações `src/ → dashboard/lib` (`src/offerAutomation/dispatcher.js` → `dashboard/lib/mobileOfferComposer.js` e `src/core/mirrorTemplate.js` → `dashboard/lib/mobileTemplateStore.js`), com Status "Aberto (dívida de baseline)" e nota de que serão removidas na Etapa 1 (FR-015).

### Verificação para User Story 3 (prova do SC-004)

- [ ] T023 [US3] Confirmar `test -f docs/architecture/coupling-ledger.md && echo OK` e revisar visualmente que o arquivo contém o template completo e a entrada seed — corresponde ao SC-004 e ao Acceptance Scenario 1/2 da US3.

**Checkpoint**: As três histórias (US1, US2, US3) estão completas e verificáveis de forma independente.

---

## Phase 6: Polish & Cross-Cutting Concerns (Etapa 0 — critério de saída)

**Purpose**: Validação final de ponta a ponta cruzando as três histórias, conforme o quickstart.md e os Success Criteria da spec como um todo.

- [ ] T024 Rodar o quickstart.md completo (`specs/002-regression-safety-net/quickstart.md`, passos 1–7) em sequência: barreira verde no baseline, barreira vermelha sob violação injetada (e reversão), regra dormente de domínio não quebra o CI, suíte de testes passando, inspeção do workflow, `deploy.yml` inalterado, livro-razão presente.
- [ ] T025 Conferir que o diff completo da feature toca **apenas**: `.dependency-cruiser.cjs`, `.github/workflows/quality-gate.yml`, `docs/architecture/coupling-ledger.md`, `package.json`, `package-lock.json` — nenhum arquivo `src/**/*.js` de runtime aparece no diff (`git diff --stat develop...HEAD`), confirmando FR-016/SC-006.
- [ ] T026 Abrir a Pull Request desta branch contra `develop` (nunca direto para `main`, FR-019) e observar o workflow `quality-gate.yml` rodar e reportar status verde na própria PR, encerrando a validação end-to-end do gate em condição real de CI (SC-003, caso de contrato G1).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sem dependências — pode começar imediatamente.
- **Foundational (Phase 2)**: Vazia nesta feature (não há infraestrutura de runtime compartilhada além da devDependency da Phase 1).
- **User Story 1 (Phase 3)**: Depende só do Setup (T003, devDependency instalada). Pode começar assim que a Phase 1 terminar.
- **User Story 2 (Phase 4)**: Depende do Setup **e** do script `arch:check` da US1 (T008), porque o workflow invoca `npm run arch:check` no último step (FR-012). Não pode ser finalizada (T014 em diante) antes de T004–T008.
- **User Story 3 (Phase 5)**: Depende só do Setup. É textualmente independente de US1/US2, mas documenta as mesmas 2 violações de baseline que US1 allowlista — por isso vem depois na ordem de prioridade (P2), embora pudesse ser feita em paralelo por outra pessoa.
- **Polish (Phase 6)**: Depende de US1 + US2 + US3 completas (o quickstart e o critério de saída cruzam as três).

### User Story Dependencies

- **US1 (P1)**: Sem dependência de outras histórias.
- **US2 (P1)**: Integra o artefato de US1 (`arch:check`) no workflow — não é independente de US1 em termos de conteúdo do step final, mas o workflow em si (steps 1–4: checkout/setup-node/npm ci/npm test) poderia ser escrito em paralelo; o step 5 exige T008 concluída.
- **US3 (P2)**: Sem dependência técnica de US1/US2; pode ser feita em paralelo por um segundo desenvolvedor a qualquer momento após o Setup.

### Within Each User Story

- Config antes de script (US1: T004–T007 antes de T008).
- Implementação antes de verificação (tasks de "Verificação" sempre por último em cada história).
- Workflow antes de validação do hash/diff (US2: T014 antes de T016/T017).
- Template antes da entrada seed (US3: T021 antes de T022).

### Parallel Opportunities

- T010 e T011 (injeção de violação em `src/` e em `src/api/routes/`) podem rodar em paralelo — são casos de teste manual independentes sobre a mesma config já pronta.
- T018 (rodar `npm test` isolado) pode rodar em paralelo com as tasks de verificação de hash de workflow (T016/T017).
- US3 inteira (T020–T023) pode ser conduzida em paralelo com US1/US2 por outra pessoa, já que não compartilha arquivos.

---

## Parallel Example: User Story 1

```bash
# Depois de T004-T009 completas, os dois casos de violação podem ser verificados em paralelo:
Task: "Injetar violação src -> dashboard em src/__viol.js, confirmar exit != 0, reverter, confirmar exit 0"
Task: "Injetar import direto de sessionCore.js em src/api/routes/, confirmar exit != 0, reverter, confirmar exit 0"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Phase 1: Setup (instalar dependency-cruiser, registrar hash do deploy.yml).
2. Completar Phase 3: User Story 1 (barreira de import completa e verificada localmente).
3. **PARE e VALIDE**: `npm run arch:check` verde no baseline e vermelho sob violação injetada — já é valor entregável e testável isoladamente, mesmo sem CI.

### Incremental Delivery

1. Setup → devDependency pronta.
2. US1 (barreira de import) → testar independentemente → já reduz risco de regressão de acoplamento em qualquer PR local.
3. US2 (merge gate) → testar independentemente (abrir PR de teste) → agora a barreira e os testes rodam automaticamente no CI.
4. US3 (livro-razão) → testar independentemente (ler o markdown) → processo de documentação de acoplamento fica disponível.
5. Phase 6 (Polish) → quickstart.md completo de ponta a ponta → critério de saída da Etapa 0 atingido.

### Parallel Team Strategy

Com duas pessoas:

1. Ambas completam Phase 1 (Setup) juntas.
2. Depois do Setup:
   - Dev A: US1 (barreira de import) → depois integra o step final em US2 (workflow).
   - Dev B: US3 (livro-razão de acoplamento), em paralelo, sem esperar US1/US2.
3. US2 só fecha depois que Dev A terminar US1 (T008), pois o workflow depende do script `arch:check`.

---

## Notes

- [P] tasks = arquivos/ações diferentes, sem dependência entre si.
- [Story] mapeia cada task à história correspondente para rastreabilidade.
- Nenhuma task desta feature edita `src/**/*.js` de runtime — o diff inteiro é config/CI/doc + `package.json`/`package-lock.json` (Constraint dura da spec, FR-016/FR-017).
- As tasks de "Verificação" (T009–T012, T016–T019, T023, T024–T026) são a forma desta feature de "escrever teste primeiro": como não há código de produção sendo testado por `node:test`, a prova de cada Acceptance Scenario é rodar a própria ferramenta (`arch:check`, `npm test`, inspeção de workflow/hash) e observar o resultado esperado.
- Task de verificação dupla explicitamente pedida: T010/T011 (violação nova falha) + T009 (estado atual passa) cobrem exatamente o par "vermelho sob violação nova" / "verde no baseline atual" do SC-001/SC-002.
- Commit após cada task ou grupo lógico de tasks.
- Pare em qualquer checkpoint para validar a história isoladamente antes de seguir para a próxima.
- Evitar: tocar `deploy.yml`, adicionar exceções novas à allowlist além das 2 de baseline, mover a config da barreira para dentro de `startBotInner`-like escopo reexecutado (não se aplica aqui, mas por analogia: manter tudo em arquivos de config estáticos e versionados).
