---

description: "Task list for Etapa 0.5 — Smoke list (subconjunto crítico rápido + checklist manual de staging)"
---

# Tasks: Etapa 0.5 — Smoke list (subconjunto crítico rápido + checklist manual de staging)

**Input**: Design documents from `/specs/003-smoke-list/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/smoke-cli.md, quickstart.md

**Tests**: Não há testes novos a escrever (a feature apenas SELECIONA testes já existentes — FR-012). As "tasks de verificação" abaixo rodam comandos manuais/CLI para provar os critérios de aceitação, não criam arquivos `*.test.js` novos.

**Organization**: Tasks agrupadas pelas 3 user stories de spec.md (US1 = script `smoke`/`presmoke`, P1; US2 = doc Nível 2, P1; US3 = lição comportamento-vs-regex, P2).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependência)
- **[Story]**: US1, US2 ou US3 (mapeiam para spec.md)
- Caminhos de arquivo exatos em cada descrição

## Path Conventions

Single repo (Node.js/CommonESM misto). Únicos arquivos tocados: `package.json` (raiz) e `docs/testing/regression-checklist.md` (novo). Nenhum arquivo sob `src/` ou `test/` é criado/alterado (FR-012).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirmar a base sobre a qual a feature será aplicada, sem alterar nada ainda.

- [X] T001 Confirmar branch `003-smoke-list` criada a partir de `develop` atualizado (`git rev-parse --abbrev-ref HEAD` e `git merge-base --is-ancestor develop HEAD`), conforme FR-014.
- [X] T002 Confirmar que os 26 arquivos de teste curados em `specs/003-smoke-list/plan.md` (seção "Source Code") existem em `test/` rodando `ls -la <cada caminho>` ou um loop de verificação — nenhuma alteração de arquivo, apenas leitura (pré-condição para T004/T005).

**Checkpoint**: Branch correta e lista de 26 arquivos confirmada como existente antes de editar `package.json`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Nenhuma infraestrutura nova é necessária — a feature reaproveita 100% o padrão de env/DB do script `test`/`pretest` já existente em `package.json` (linhas `pretest`/`test`). Esta fase apenas documenta essa dependência para as user stories seguintes.

- [X] T003 Ler `package.json` (raiz) e confirmar que as chaves `pretest` (`rm -f /tmp/wabot-test.db*; NODE_ENV=test DATABASE_URL="file:/tmp/wabot-test.db" prisma db push --skip-generate --force-reset`) e `test` (`NODE_ENV=test DATABASE_URL="file:/tmp/wabot-test.db" node --test --test-concurrency=1 test/*.test.js test/**/*.test.js`) permanecerão **inalteradas** — nenhuma task desta feature edita essas duas chaves (contrato `smoke-cli.md`, observação de implementação).

**Checkpoint**: Padrão de env/DB confirmado como reaproveitável sem invenção de mecanismo novo — US1 pode prosseguir.

---

## Phase 3: User Story 1 - Rodar o smoke antes de subir um fix/feature (Priority: P1) 🎯 MVP

**Goal**: Um único comando (`npm run smoke`) roda apenas os 26 arquivos curados via `node --test`, sai com código 0 no `develop` atual, roda significativamente mais rápido que `npm test`, e falha de forma visível se qualquer arquivo do subconjunto for removido/renomeado.

**Independent Test**: Rodar `npm run smoke` no `develop` atual → exit code 0, cobrindo os 26 arquivos, em tempo de parede visivelmente menor que `npm test`.

### Implementation for User Story 1

- [X] T004 [US1] Adicionar o script `presmoke` ao `package.json` (raiz), espelhando exatamente o `pretest` existente, trocando apenas o nome da chave: `"presmoke": "rm -f /tmp/wabot-test.db /tmp/wabot-test.db-wal /tmp/wabot-test.db-shm; NODE_ENV=test DATABASE_URL=\"file:/tmp/wabot-test.db\" prisma db push --skip-generate --force-reset"` (contrato `smoke-cli.md`, FR-005).
- [X] T005 [US1] Adicionar o script `smoke` ao `package.json` (raiz) logo após `presmoke`, com a lista dos 26 arquivos **enumerada explicitamente** (sem glob), na mesma ordem do plan.md/data-model.md: `"smoke": "NODE_ENV=test DATABASE_URL=\"file:/tmp/wabot-test.db\" node --test --test-concurrency=1 test/reconnect-policy.test.js test/session-persistence-policy.test.js test/supervisor-env-guard.test.js test/ops-mode-regression-guard.test.js test/env-modes.test.js test/message-dedup.test.js test/core/global-dedup.test.js test/core/mirror-dedup-key.test.js test/coupon-dedup-window.test.js test/offer-automation.test.js test/converters-amazon.test.js test/shopee-affiliate-info.test.js test/shopee-shortlink-resolve.test.js test/mercadolivre-resolve.test.js test/mobile-converter.test.js test/send-queue-backend.test.js test/send-queue-backend-dlq.test.js test/credential-crypto.test.js test/auth.test.js test/auth-rate-limit.test.js test/payments-webhook.test.js test/payments-service.test.js test/group-entitlements.test.js test/groups-route-image-mode.test.js test/bot-worker-retry-cache-wiring.test.js test/core/worker-spawn-options.test.js"` (FR-001, FR-002, FR-005, D1 em plan.md). Depende de T004 (presmoke precisa existir antes, já que npm roda `pre<script>` automaticamente).
- [X] T006 [US1] Validar sintaticamente o `package.json` após a edição (`node -e "require('./package.json')"` ou `npm pkg get scripts.smoke scripts.presmoke`) para garantir que o JSON não quebrou com a string longa da lista de arquivos. Depende de T005.

  > **Desvio de implementação (achado em T010):** o script `smoke` literal de T005 (só `node --test <lista>`) foi testado em T010 e **não** satisfaz FR-007 — o `node --test` (Node v22) com lista explícita de arquivos **ignora silenciosamente** um caminho inexistente quando pelo menos um arquivo da lista existe (exit `0`, menos testes rodados, nenhum aviso). Corrigido adicionando um pré-check `ls <mesma lista> > /dev/null &&` antes do `node --test` no mesmo script `smoke` (ainda só `package.json`, nenhum arquivo novo). Revalidado: arquivo ausente agora falha com exit `2` e mensagem `ls: cannot access '<arquivo>': No such file or directory` **antes** de qualquer teste rodar; regressão real continua saindo com exit `1` como antes. `presmoke`/`test` continuam intocados.

### Verification for User Story 1

- [X] T007 [US1] Rodar `time npm run smoke` no estado atual do `develop`-equivalente (branch `003-smoke-list` recém criada) e confirmar: (a) exit code `0`; (b) resumo `node:test` reporta `# fail 0` cobrindo os 26 arquivos; (c) `presmoke` rodou antes automaticamente (reset de `/tmp/wabot-test.db*` visível no log). Depende de T006. (SC-001, FR-002, Acceptance Scenario US1.1 e US1.4).
- [X] T008 [US1] Comparar tempo de parede: rodar `time npm run smoke` vs. `time npm test` (mesmo ambiente, execuções consecutivas) e confirmar que `smoke` é significativamente mais rápido (26 de 176 arquivos, ~15%). Registrar os dois tempos como evidência do PR. Depende de T007. (SC-002, FR-004, Acceptance Scenario US1.2).
- [X] T009 [US1] Validar falha visível por regressão real (FR-007, Acceptance Scenario US1.3): editar **temporariamente e sem commitar** uma asserção em `test/reconnect-policy.test.js` para forçar falha, rodar `npm run smoke` e confirmar exit code ≠ 0 com o `node:test` apontando o arquivo/teste que falhou; reverter a edição (`git checkout -- test/reconnect-policy.test.js`) e confirmar que `npm run smoke` volta a sair 0. Depende de T007.
- [X] T010 [US1] Validar falha visível por arquivo ausente (FR-007, edge case "arquivo renomeado"): renomear **temporariamente** um dos 26 arquivos listados (ex.: `mv test/core/worker-spawn-options.test.js test/core/worker-spawn-options.test.js.bak`), rodar `npm run smoke` e confirmar que o comando falha com erro visível de arquivo não encontrado (exit code ≠ 0), **não** pulando o eixo em silêncio; reverter o rename (`mv` de volta) e confirmar que `npm run smoke` volta a sair 0. Depende de T007.

**Checkpoint**: `npm run smoke` funcional, verde, rápido, e comprovadamente falha de forma visível tanto em regressão de teste quanto em arquivo ausente — User Story 1 completa e testável de forma independente.

---

## Phase 4: User Story 2 - Executar o ritual manual de staging antes de promover para produção (Priority: P1)

**Goal**: `docs/testing/regression-checklist.md` existe com Nível 1 (o que o smoke cobre + como rodar) e Nível 2 (ritual manual de staging: QR ponta-a-ponta, teste de aceitação do modo remote, espelhamento real com foto/link/cupom, clique no celular, dashboard, pagamento sandbox), referenciando (sem duplicar) os 3 smoke de deploy já existentes.

**Independent Test**: Abrir `docs/testing/regression-checklist.md` e verificar que contém, como itens acionáveis, todos os passos do Nível 2 e a referência aos 3 smoke de `scripts/deploy_safe_staging.sh`.

### Implementation for User Story 2

- [X] T011 [P] [US2] Criar `docs/testing/regression-checklist.md` com o cabeçalho e a seção **Nível 1** contendo: (a) a tabela eixo crítico → arquivo(s) → toca DB? (copiada/adaptada de `specs/003-smoke-list/data-model.md`, os 11 eixos e 26 arquivos); (b) instrução de como rodar (`npm run smoke`, o que `presmoke` faz); (c) marcação explícita de quais dos 26 arquivos tocam banco (`auth.test.js`, `auth-rate-limit.test.js`, `payments-webhook.test.js`, `payments-service.test.js` = sim; `supervisor-env-guard`, `ops-mode-regression-guard`, `env-modes`, `message-dedup`, `core/global-dedup`, `core/mirror-dedup-key`, `coupon-dedup-window`, `offer-automation`, `group-entitlements`, `groups-route-image-mode` = parcial; demais = não) (FR-003, FR-006, SC-003, SC-004, Acceptance Scenario US2.1).
- [X] T012 [US2] Adicionar a seção **Nível 2** em `docs/testing/regression-checklist.md` com os itens acionáveis mínimos exigidos por FR-009, cada um redigido como verificação de comportamento observável: (1) conectar QR ponta-a-ponta e verificar status honesto no painel; (2) teste de aceitação do modo remote — `pm2 restart api-staging` com sessão conectada → sessão **continua conectada**; (3) espelhamento real — postar em grupo monitorado → oferta chega ao destino **com foto**, link convertido (afiliado nosso) e cupom preservado, em card preview clicável; (4) clicar o link convertido no celular → abre o app / credita comissão (nota especial: ML com cupom só valida na vida real); (5) dashboard — `/login` renderiza (não 404 do Next), "Criar oferta" raspa título/preço, página de grupos abre; (6) pagamento sandbox — checkout → webhook → plano ativa. Depende de T011 (mesmo arquivo). (FR-009, Acceptance Scenarios US2.2 e US2.3).
- [X] T013 [US2] Adicionar, dentro da seção Nível 2 de `docs/testing/regression-checklist.md`, a referência explícita (não duplicação) aos 3 smoke de deploy já automatizados em `scripts/deploy_safe_staging.sh`: `GET http://178.105.54.0:3006/login`, `GET http://127.0.0.1:3004/health`, `POST http://178.105.54.0:3006/api/auth/login` (retornando JSON, não 404 do Next) — deixar claro que esses 3 já rodam automaticamente no deploy e não precisam ser repetidos manualmente. Depende de T012 (mesmo arquivo). (FR-010, Acceptance Scenario US2.4).
- [X] T014 [US2] Adicionar ao final de `docs/testing/regression-checklist.md` uma nota explícita de que "smoke verde ≠ suíte completa verde": o smoke (Nível 1) é uma checagem rápida local/pré-PR e **não substitui** o merge gate da suíte completa de 176 arquivos (Etapa 0) — cobre o edge case "Smoke verde mas suíte completa vermelha" de spec.md. Depende de T013 (mesmo arquivo).

### Verification for User Story 2

- [X] T015 [US2] Abrir `docs/testing/regression-checklist.md` e conferir manualmente, item a item, que todos os 6 pontos de FR-009 estão presentes e redigidos como verificação observável, que a referência aos 3 smoke de deploy aparece (não duplicada) e que a nota "smoke ≠ merge gate" está presente. Depende de T014. (Independent Test da US2, SC-004).

**Checkpoint**: `docs/testing/regression-checklist.md` completo com Nível 1 e Nível 2 — User Story 2 completa e testável de forma independente (não depende de US1 ter sido implementada em código, mas referencia o mesmo doc que ganhará a seção da US3 a seguir).

---

## Phase 5: User Story 3 - Documentar a lição "comportamento > regex de source" (Priority: P2)

**Goal**: O doc registra a lição de preferir testes de comportamento a testes que casam string do código-fonte, ilustrada pelos testes estruturais que deram falso-positivo em refatoração legítima.

**Independent Test**: Abrir o doc e verificar que há uma seção explicando a diferença entre testar comportamento e testar regex de source, com o exemplo dos testes estruturais que quebraram.

### Implementation for User Story 3

- [X] T016 [US3] Adicionar a `docs/testing/regression-checklist.md` uma seção "Lição aprendida: comportamento > regex de source", explicando que um teste que verifica se uma string (ex.: nome de variável como `msgRetryCounterCache`) aparece literalmente no código-fonte quebra quando alguém renomeia a variável mesmo preservando o comportamento correto — e que a recomendação para qualquer novo teste de smoke é testar comportamento observável (efeito/output), não a forma textual do código. Referenciar o caso real do `test/bot-worker-retry-cache-wiring.test.js` (teste estrutural existente no subconjunto, mantido como está — FR-012) como contexto do porquê a lição foi aprendida nesta etapa. Depende de T014 (mesmo arquivo, adicionado após a seção Nível 2). (FR-011, Acceptance Scenario US3.1).

### Verification for User Story 3

- [X] T017 [US3] Abrir `docs/testing/regression-checklist.md` e confirmar que a seção da lição existe, contém a explicação da diferença comportamento-vs-regex e cita o exemplo concreto. Depende de T016.

**Checkpoint**: Doc completo com as 3 seções (Nível 1, Nível 2, lição aprendida) — todas as user stories entregues.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Confirmar que o diff da feature respeita as restrições canônicas (FR-012, FR-013, SC-005) antes de abrir o PR.

- [X] T018 [P] Rodar `git diff --name-only develop...HEAD` (ou `main...HEAD`, conforme a base da branch) e confirmar que a lista de arquivos alterados contém **apenas** `package.json`, `docs/testing/regression-checklist.md` e os artefatos de `specs/003-smoke-list/` — nenhum arquivo sob `src/`, nenhum teste existente, nenhum `.env`/banco/porta/`deploy.yml` (quickstart.md Cenário 5, SC-005, FR-012).
- [X] T019 [P] Confirmar que nenhuma mudança desta feature aumenta uso de memória de runtime — o smoke roda só em dev/CI, nunca em produção; não há novo processo PM2, worker ou dependência pesada (FR-013). Nada a super-sinalizar nesta feature.
- [X] T020 Rodar a suíte completa (`npm test`) uma vez ao final, para confirmar que a feature não quebrou nada fora do subconjunto do smoke (não é gate desta feature, mas evidência adicional de segurança antes do PR contra `develop`).
- [ ] T021 Abrir PR de `003-smoke-list` contra `develop` (nunca direto para `main`), seguindo o fluxo canônico do AGENTS.md (FR-014).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sem dependências — pode começar imediatamente.
- **Foundational (Phase 2)**: Depende do Setup — é só uma confirmação de não-alteração, não bloqueia de fato, mas deve ser lida antes de T004/T005.
- **User Story 1 (Phase 3)**: Depende de Phase 2. Fonte única do MVP — pode ser entregue sozinha (Nível 1 completo).
- **User Story 2 (Phase 4)**: Depende de Phase 2. **Não depende de US1** — o doc de Nível 2 pode ser escrito em paralelo, embora T011 (tabela Nível 1) reaproveite os mesmos 26 arquivos já validados em US1 conceitualmente. Recomenda-se rodar US1 antes para que a tabela do doc já reflita um `npm run smoke` comprovadamente verde.
- **User Story 3 (Phase 5)**: Depende de T014 (adiciona seção ao MESMO arquivo criado/editado em US2) — portanto **depende de US2 estar com Phase 4 até T014 concluída**, mesmo sendo P2 e conceitualmente independente em conteúdo.
- **Polish (Phase 6)**: Depende de todas as user stories desejadas estarem completas (T018 precisa do diff final).

### User Story Dependencies

- **User Story 1 (P1)**: Pode começar após Phase 2 — sem dependência de US2/US3. Único arquivo tocado: `package.json`.
- **User Story 2 (P1)**: Pode começar após Phase 2 — sem dependência de código de US1, mas mesmo arquivo (`docs/testing/regression-checklist.md`) que US3 estende depois.
- **User Story 3 (P2)**: Depende de US2 ter criado o arquivo do doc primeiro (T011–T014) — mesma restrição de arquivo compartilhado, não de conteúdo.

### Within Each User Story

- US1: T004 (presmoke) → T005 (smoke, depende do presmoke existir) → T006 (validação sintática) → T007..T010 (verificação, sequenciais pois todos rodam o mesmo comando `npm run smoke` no mesmo working tree).
- US2: T011 → T012 → T013 → T014 (todas no mesmo arquivo, sequenciais) → T015 (verificação).
- US3: T016 (depende de T014) → T017 (verificação).

### Parallel Opportunities

- T001 e T002 (Setup) podem rodar em paralelo — são leituras independentes.
- T004 e T005 são **sequenciais** (mesmo arquivo `package.json`, e `smoke` depende conceitualmente de `presmoke` já estar presente pela convenção npm `pre<script>`) — não marcar como [P].
- US1 (Phase 3) e US2 (Phase 4) podem ser trabalhadas em paralelo por pessoas diferentes, já que tocam arquivos diferentes (`package.json` vs. `docs/testing/regression-checklist.md`) — mas US3 só pode começar depois que US2 criar o arquivo do doc.
- T018 e T019 (Polish) podem rodar em paralelo — checagens independentes.

---

## Parallel Example: Setup + User Stories 1/2 em paralelo

```bash
# Setup (podem rodar juntas):
Task: "Confirmar branch 003-smoke-list a partir de develop"
Task: "Confirmar existência dos 26 arquivos de teste curados"

# Depois do Setup, duas pessoas em paralelo:
# Pessoa A (US1 — package.json):
Task: "Adicionar presmoke ao package.json"
Task: "Adicionar smoke ao package.json"
Task: "Rodar npm run smoke e validar exit 0 + velocidade + falha visível"

# Pessoa B (US2 — doc, pode começar em paralelo, mas aguarda US1 terminar para citar 'npm run smoke comprovadamente verde'):
Task: "Criar docs/testing/regression-checklist.md com Nível 1"
Task: "Adicionar Nível 2 (ritual de staging)"
Task: "Referenciar os 3 smoke de deploy_safe_staging.sh"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Phase 1: Setup
2. Completar Phase 2: Foundational (confirmação, não bloqueia de verdade)
3. Completar Phase 3: User Story 1 (`presmoke` + `smoke` no `package.json`, verificado verde/rápido/falha-visível)
4. **PARAR e VALIDAR**: `npm run smoke` sai 0, mais rápido que `npm test`, falha visível em regressão e em arquivo ausente
5. Isso já satisfaz o entregável Nível 1 completo (o "coração da feature", conforme spec.md)

### Incremental Delivery

1. Setup + Foundational → base confirmada
2. Adicionar US1 → validar independentemente → Nível 1 pronto (MVP!)
3. Adicionar US2 → validar independentemente → Nível 2 pronto
4. Adicionar US3 → validar independentemente → lição registrada, doc completo
5. Polish → diff mínimo confirmado, PR aberto contra `develop`

### Parallel Team Strategy

Com duas pessoas:

1. Ambas completam Setup + Foundational juntas (leitura rápida).
2. Pessoa A: User Story 1 (`package.json`).
   Pessoa B: User Story 2 (`docs/testing/regression-checklist.md`, Nível 1 + Nível 2).
3. Depois que B terminar US2, uma das duas faz User Story 3 (extensão do mesmo doc).
4. Qualquer uma faz o Polish final (diff mínimo + memória + PR).

---

## Notes

- [P] tasks = arquivos diferentes, sem dependência.
- [Story] label mapeia a task para US1/US2/US3 (spec.md).
- Nenhuma task cria ou modifica arquivo sob `src/` ou teste existente — restrição canônica FR-012 vale para TODAS as fases.
- T009 e T010 fazem edições **temporárias e não commitadas** para provar FR-007; sempre reverter antes de seguir (não deixar `test/reconnect-policy.test.js` quebrado nem arquivo renomeado no commit final).
- As chaves `pretest`/`test` do `package.json` NUNCA são tocadas por esta feature — apenas `presmoke`/`smoke` são adicionadas.
- Commit após cada task ou grupo lógico de tasks.
- Parar em qualquer checkpoint para validar a story isoladamente.
- Evitar: tasks vagas, conflito no mesmo arquivo sem ordenação, dependências cross-story que quebrem independência (exceto a dependência de arquivo compartilhado US2→US3, documentada explicitamente acima).
