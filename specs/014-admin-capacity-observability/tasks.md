# Tasks: Capacidade e previsibilidade da infraestrutura no ADMIN

**Input**: Design documents from `/specs/014-admin-capacity-observability/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: A especificação exige testes puros, de contrato, de resiliência e guardas do dashboard. As tarefas de teste abaixo devem ser escritas primeiro e observadas falhando antes da implementação correspondente.

**Organization**: Tarefas agrupadas por história de usuário, em ordem de prioridade e dependência, para permitir entregas incrementais e validação independente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode ser executada em paralelo por tocar arquivos diferentes e não depender de tarefa incompleta
- **[Story]**: história de usuário correspondente (`US1`–`US5`)
- Cada tarefa identifica os arquivos exatos que deve alterar

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Criar a estrutura da feature e a persistência necessária sem adicionar processo PM2 ou dependência pesada.

- [X] T001 Criar o diretório modular de capacidade e exports vazios documentados em `src/ops/capacity/contract.js`, `src/ops/capacity/policy.js`, `src/ops/capacity/collector.js`, `src/ops/capacity/repository.js` e `src/ops/capacity/service.js`
- [X] T002 Modelar `CapacityHostProfile`, `CapacitySnapshot`, `CapacityRollup`, `CapacityEvent` e `CapacityAlert`, com relações, índices, unicidades e campos nullable do data model, em `prisma/schema.prisma`
- [X] T003 Gerar a migration aditiva das tabelas de capacidade em `prisma/migrations/<timestamp>_admin_capacity_observability/migration.sql`
- [X] T004 [P] Registrar as envs opcionais e seguras `HCLOUD_READ_TOKEN`, `HCLOUD_PROJECT_ID`, `HCLOUD_SERVER_ID`, roots allowlisted, intervalo e TTL em `.env.example`, sem valor secreto nem alteração do modo do supervisor

**Checkpoint**: Estrutura e schema estão prontos; nenhuma coleta ou rota está ativa ainda.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Construir adaptadores locais, contrato sanitizado, persistência e ciclo de coleta usados por todas as histórias.

**⚠️ CRITICAL**: Nenhuma história pode ser concluída antes desta fundação.

- [X] T005 [P] Escrever fixtures e testes de parsing Linux para `MemAvailable`, cache, CPU por delta, load, uptime, disco/inodes e swap por delta/reboot em `test/ops-capacity-linux-metrics.test.js`
- [X] T006 [P] Escrever testes de PM2 e `/proc` que validem timeout, campos ausentes, separação prod/staging e exclusão do próprio coletor em `test/ops-capacity-process-metrics.test.js`
- [X] T007 [P] Implementar coleta injetável de `os`, `/proc/meminfo`, `/proc/vmstat`, `/proc/stat` e `statfs`, retornando `null` em fonte desconhecida e rates monotônicos em `src/ops/capacity/linuxMetrics.js`
- [X] T008 [P] Implementar `pm2 jlist` via `execFile` sem shell e enumeração numérica de `/proc`, reconhecendo somente scripts Node exatamente allowlisted como `src/bot-worker.js`, em `src/ops/capacity/processMetrics.js`
- [X] T009 [P] Escrever testes de serialização que rejeitem env, token, Authorization, cmdline, stdout/stderr e caminhos completos em `test/ops-capacity-contract.test.js`
- [X] T010 Implementar tipos, allowlists, normalização de unidades, `null` para desconhecido e sanitização/versionamento `admin-capacity-v1` em `src/ops/capacity/contract.js`
- [X] T011 [P] Escrever testes de CRUD, último snapshot, séries limitadas, rollup idempotente e retenção raw/horária/diária em `test/ops-capacity-repository.test.js`
- [X] T012 Implementar bootstrap do perfil baseline `wabot-prod/CX33/x86/4 vCPU/8192 MB/40960 MB/eu-central` e repositório de snapshots, rollups, eventos, alertas e retenção em `src/ops/capacity/repository.js`
- [X] T013 Implementar `collectCapacitySnapshot()` com dependências injetáveis, timeout global ≤10 s, isolamento por fonte, trava in-process e resultado parcial em `src/ops/capacity/collector.js`
- [X] T014 Implementar `startCapacitySweep()` com coleta best-effort no boot, intervalo padrão de 5 minutos, `unref()`, persistência raw, rollup, alert evaluation hook e retenção best-effort em `src/ops/capacity/sweep.js`
- [X] T015 Integrar `startCapacitySweep()` ao boot da API somente após banco disponível, sem bloquear startup nem criar processo PM2, em `src/api/server.js`

**Checkpoint**: A API coleta e persiste amostras locais sanitizadas de forma leve e resiliente, sem interface pública.

---

## Phase 3: User Story 1 — Entender capacidade e ação necessária imediatamente (Priority: P1) 🎯 MVP

**Goal**: Entregar uma aba protegida cujo primeiro bloco converta o snapshot atual em estado, limite seguro, headroom, gargalo, horizonte/confiança e recomendação explicável.

**Independent Test**: Com fixture CX33 de 17 sessões, abrir `/admin/capacidade` e confirmar estado, limite, headroom, gargalo, recomendação, fontes e idade; sem snapshot, mostrar dados insuficientes, nunca zeros saudáveis.

### Tests for User Story 1

- [X] T016 [P] [US1] Escrever testes da política `capacity-policy-v1` para reserva `max(20%,1536 MB,fixedBaseP95)`, custo `max(350 MB,p95 confiável)`, limite arredondado, contador conservador e gargalo em `test/ops-capacity-policy.test.js`
- [X] T017 [P] [US1] Escrever testes de contrato de `GET /api/admin/capacity/current`, incluindo `tech:read`, snapshot ausente/parcial, idade/fontes e ausência de segredos em `test/admin-capacity-routes.test.js`
- [X] T018 [P] [US1] Escrever guarda da rota/navegação, lazy fetch, estados textuais não dependentes de cor, timestamp e responsividade em `test/admin-capacity-page.test.js`

### Implementation for User Story 1

- [X] T019 [US1] Implementar cálculo puro de reserva, custo conservador por sessão, limite seguro/máximo estimado, headroom em sessões/MB, severidade e razões versionadas em `src/ops/capacity/policy.js`
- [X] T020 [US1] Consolidar último snapshot, contagens confiáveis, decisão e estado `insufficient_data|stale` em `src/ops/capacity/service.js`
- [X] T021 [US1] Registrar `GET /api/admin/capacity/current` com `tech:read`, validação, resposta parcial sanitizada e auditabilidade de leitura consistente com rotas técnicas em `src/api/routes/admin.js`
- [X] T022 [P] [US1] Adicionar cliente tipado por contrato para `capacityCurrent`, tratamento de 403/falha parcial e nenhuma serialização de segredo em `dashboard/lib/api.js`
- [X] T023 [US1] Adicionar entrada **Capacidade** visível somente com `tech:read`, apontando para `/admin/capacidade` sem incluir capacidade no `Promise.all` existente, em `dashboard/app/admin/page.js`
- [X] T024 [P] [US1] Criar componentes acessíveis de estado, decisão, origem/idade e explicação da política em `dashboard/app/admin/capacidade/components/CapacityDecisionCard.js` e `dashboard/app/admin/capacidade/components/CapacitySourceStatus.js`
- [X] T025 [US1] Criar a rota lazy `/admin/capacidade`, buscar `/current` somente no mount, fazer polling de 30 s somente com `document.visibilityState === 'visible'` e preservar último valor em falha em `dashboard/app/admin/capacidade/page.js`

**Checkpoint**: US1 fornece uma decisão atual utilizável e protegida, independente de histórico ou Hetzner online.

---

## Phase 4: User Story 2 — Investigar recursos, processos e ambientes (Priority: P1)

**Goal**: Explicar a decisão por RAM, CPU, disco, inodes, swap, processos e workers reais separados entre produção e staging.

**Independent Test**: Com medições conhecidas, conferir totais conciliados, `MemAvailable` separado de livre/cache, 17 workers reais sem falso positivo, swap ocupado sem pressão e staging parcialmente ligado sem rótulo falso de desligado.

### Tests for User Story 2

- [X] T026 [P] [US2] Expandir testes da política para swap inativo versus pressão sustentada, thresholds de CPU/disco/inodes, divergência sessão-worker e precedência do primeiro gargalo em `test/ops-capacity-policy.test.js`
- [X] T027 [P] [US2] Expandir testes de rota para recursos, componentes sanitizados, ambientes, divergências e sugestões de staging em `test/admin-capacity-routes.test.js`
- [X] T028 [P] [US2] Expandir guarda de UI para unidades, tabelas de processos, staging parcial e ausência de ação automática em `test/admin-capacity-page.test.js`

### Implementation for User Story 2

- [X] T029 [US2] Consolidar recursos, percentis de RSS, base fixa, conciliação host/ambiente, divergências e sugestão conservadora de staging em `src/ops/capacity/service.js`
- [X] T030 [P] [US2] Criar cartões acessíveis de RAM, CPU/load, disco/inodes e swap/atividade com estados textuais em `dashboard/app/admin/capacidade/components/CapacityResourceCards.js`
- [X] T031 [P] [US2] Criar decomposição de componentes e workers com p50/p95/máximo e tabela alternativa em `dashboard/app/admin/capacidade/components/CapacityProcessBreakdown.js`
- [X] T032 [P] [US2] Criar visão por ambiente que mostre todos os apps de staging, custo de memória e estado parcial, reutilizando somente o fluxo existente de staging-power após confirmação/autorização em `dashboard/app/admin/capacidade/components/CapacityEnvironments.js`
- [X] T033 [US2] Integrar recursos, decomposição, divergências e staging à rota em `dashboard/app/admin/capacidade/page.js`

**Checkpoint**: US2 explica cada recomendação sem depender de comandos da VPS e não executa mudança automática.

---

## Phase 5: User Story 3 — Acompanhar histórico e prever o limite (Priority: P2)

**Goal**: Exibir séries 24h/7d/30d/90d, eventos e forecast de 7/30/90 dias com faixa e confiança, sem data artificial.

**Independent Test**: Com 90 dias sintéticos, alternar períodos e validar tendências, anotações, intervalo/confiança; com menos de 7 dias ou crescimento não positivo, as datas permanecem `null` com explicação.

### Tests for User Story 3

- [X] T034 [P] [US3] Escrever testes puros de forecast para cobertura mínima, inclinação positiva, janelas 7/30/90, faixa residual, confiança, mudança de host/política e crescimento zero/negativo em `test/ops-capacity-forecast.test.js`
- [X] T035 [P] [US3] Expandir testes de repositório para downsampling ≤600 pontos, cobertura, eventos UTC e preservação de rollups antes da retenção em `test/ops-capacity-repository.test.js`
- [X] T036 [P] [US3] Expandir testes de rota para `GET /history` e `GET /forecast`, períodos inválidos, lacunas `null` e eventos em `test/admin-capacity-routes.test.js`
- [X] T037 [P] [US3] Expandir guarda de dashboard para seletores 24h/7d/30d/90d, SVG acessível e tabela equivalente em `test/admin-capacity-page.test.js`

### Implementation for User Story 3

- [X] T038 [US3] Implementar tendências robustas, exclusão de segmentos após host/policy change, faixa provável, confiança e seleção explicável da janela adotada em `src/ops/capacity/forecast.js`
- [X] T039 [US3] Implementar consultas de histórico downsampled, eventos e forecast derivado com cobertura e `reasonUnavailable` em `src/ops/capacity/service.js`
- [X] T040 [US3] Registrar `GET /api/admin/capacity/history`, `GET /api/admin/capacity/forecast` e validação estrita de `period` em `src/api/routes/admin.js`
- [X] T041 [P] [US3] Adicionar métodos `capacityHistory(period)` e `capacityForecast()` em `dashboard/lib/api.js`
- [X] T042 [P] [US3] Criar gráfico SVG/HTML acessível com séries, projeção tracejada, faixa, eventos, legendas e tabela alternativa em `dashboard/app/admin/capacidade/components/CapacityHistoryChart.js`
- [X] T043 [US3] Integrar carregamento separado de histórico/forecast, seleção de período, lacunas e confiança à rota em `dashboard/app/admin/capacidade/page.js`

**Checkpoint**: US3 transforma snapshots em tendência previsível e reproduzível sem falsa precisão.

---

## Phase 6: User Story 4 — Simular crescimento de clientes (Priority: P2)

**Goal**: Permitir cenários consultivos de aquisição/ativação e informar sessões, margem/déficit, memória, gargalo e prazo, sem persistência ou efeito operacional.

**Independent Test**: Simular 10 clientes em 3 meses com 90% de ativação, validar projeção e déficit/margem, e comprovar que nenhum processo, staging, snapshot ou configuração muda.

### Tests for User Story 4

- [X] T044 [P] [US4] Escrever testes de cenário puro para limites `0–10000`, horizonte `1–36`, ativação `0–100`, arredondamento, staging esperado e entradas extremas em `test/ops-capacity-scenario.test.js`
- [X] T045 [P] [US4] Expandir testes de rota para `POST /scenario` com `tech:read`, 400 explicável, ausência de persistência/audit mutation e nenhum campo operacional aceito em `test/admin-capacity-routes.test.js`
- [X] T046 [P] [US4] Expandir guarda de UI para validação acessível, resultado consultivo e ausência de controles de infraestrutura em `test/admin-capacity-page.test.js`

### Implementation for User Story 4

- [X] T047 [US4] Implementar validação e cálculo puro de sessões projetadas, headroom/déficit, memória incremental, gargalo, assumptions e recommendedBy em `src/ops/capacity/scenario.js`
- [X] T048 [US4] Registrar `POST /api/admin/capacity/scenario` como cálculo read-only sob `tech:read`, recusando campos desconhecidos e efeitos colaterais em `src/api/routes/admin.js`
- [X] T049 [P] [US4] Adicionar método `capacityScenario(input)` em `dashboard/lib/api.js`
- [X] T050 [P] [US4] Criar formulário acessível e resultado de cenário com limites, mensagens compreensíveis e aviso consultivo em `dashboard/app/admin/capacidade/components/CapacityScenarioSimulator.js`
- [X] T051 [US4] Integrar o simulador à rota sem polling ou persistência do cenário em `dashboard/app/admin/capacidade/page.js`

**Checkpoint**: US4 permite planejar campanhas além da tendência histórica sem alterar o ambiente.

---

## Phase 7: User Story 5 — Consultar contratado, inventário e alertas (Priority: P3)

**Goal**: Comparar inventário Hetzner read-only/cacheado com uso local e manter alertas persistentes, auditáveis e anti-spam, sem qualquer endpoint destrutivo.

**Independent Test**: Com fetch injetado, alternar sucesso/503/cache stale e confirmar inventário/fonte sem token; provocar duas violações, cooldown, piora e duas recuperações, mantendo a visão local disponível.

### Tests for User Story 5

- [X] T052 [P] [US5] Escrever testes do cliente Hetzner para GET allowlisted, timeout, cache ≥6h, baseline/fallback stale, inventário sanitizado e token ausente dos resultados/logs em `test/ops-capacity-hetzner-client.test.js`
- [X] T053 [P] [US5] Escrever testes do lifecycle `pending→active→recovered`, duas amostras, cooldown 24h, piora e dedupe por host/tipo em `test/ops-capacity-alerts.test.js`
- [X] T054 [P] [US5] Expandir testes de rota para `GET /alerts` e `POST /refresh`, permissões, 202/409, audit log, corpo vazio e falha externa localizada em `test/admin-capacity-routes.test.js`
- [X] T055 [P] [US5] Expandir guarda de UI para inventário/fonte stale, alertas/recuperações e inexistência de create/delete/rescale/power Hetzner em `test/admin-capacity-page.test.js`

### Implementation for User Story 5

- [X] T056 [P] [US5] Implementar cliente Hetzner server-side somente GET com endpoints allowlisted, fetch injetável, timeout, cache persistente de 6 h, baseline e erros seguros em `src/ops/capacity/hetznerClient.js`
- [X] T057 [P] [US5] Implementar avaliação e persistência do lifecycle de alertas, evidências sanitizadas, cooldown, piora e recuperação sem ação automática em `src/ops/capacity/alerts.js`
- [X] T058 [US5] Integrar refresh Hetzner cacheado, inventário, detecção de host/policy change e avaliação de alertas ao coletor/sweep em `src/ops/capacity/collector.js` e `src/ops/capacity/sweep.js`
- [X] T059 [US5] Implementar consultas de alertas e refresh local single-flight em `src/ops/capacity/service.js`
- [X] T060 [US5] Registrar `GET /api/admin/capacity/alerts` com filtros/limites e `POST /api/admin/capacity/refresh` com `tech:write`, 202/409 e `AdminAuditLog(admin.capacity.refresh)` em `src/api/routes/admin.js`
- [X] T061 [P] [US5] Adicionar métodos `capacityAlerts(status,limit)` e `capacityRefresh()` em `dashboard/lib/api.js`
- [X] T062 [P] [US5] Criar inventário contratado versus utilizado, fonte/idade/cache e lista acessível de alertas/recuperações em `dashboard/app/admin/capacidade/components/CapacityInventory.js` e `dashboard/app/admin/capacidade/components/CapacityAlerts.js`
- [X] T063 [US5] Integrar inventário, alertas e refresh manual confirmado/autorizado à rota em `dashboard/app/admin/capacidade/page.js`

**Checkpoint**: US5 completa contratado versus utilizado e alerta antecipadamente, mantendo falhas externas isoladas e nenhuma mutação Hetzner.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Validar desempenho, segurança, acessibilidade, documentação e regressões da entrega completa.

- [X] T064 [P] Adicionar documentação operacional da aba, fórmulas, thresholds, envs opcionais, cache, retenção, alertas e procedimento staging-first em `AGENTS.md`
- [X] T065 [P] Adicionar eventos explicativos de deploy/staging/process restart/OOM com dedupe e payload sanitizado usando fontes já disponíveis em `src/ops/capacity/events.js`
- [X] T066 Instrumentar duração/falha segura da coleta sem labels de alta cardinalidade e validar orçamento de <1% CPU média/<50 MB em `src/ops/capacity/collector.js` e `src/ops/capacity/sweep.js`
- [X] T067 Revisar foco, teclado, contraste, alvo ≥44 px, `prefers-reduced-motion`, números tabulares, mobile e layout estável em `dashboard/app/admin/capacidade/page.js` e `dashboard/app/admin/capacidade/components/*.js`
- [X] T068 Executar a validação focada backend e dashboard descrita em `specs/014-admin-capacity-observability/quickstart.md` e registrar qualquer limitação ambiental em `specs/014-admin-capacity-observability/checklists/requirements.md`
- [X] T069 Executar `npm test`, `npm run typecheck`, `npm run arch:check`, `git diff --check` e `cd dashboard && npm run lint && npm run build`, corrigindo regressões nos arquivos da feature
- [X] T070 ⏸️ DEFERIDA (validação manual pós-merge, NÃO executada nesta sessão) — Validar em staging por 24 h o consumo do coletor (<1% CPU média e <50 MB adicionais), polling apenas visível, falhas parciais, divergência 17 workers/16 sessões, swap informativo/pressão e ausência de botões Hetzner destrutivos conforme `specs/014-admin-capacity-observability/quickstart.md`. **BLOQUEADA nesta sessão**: exige merge em `develop`, autodeploy real em `http://178.105.54.0:3006` e uma janela contínua de 24 h; nenhuma validação de staging é inferida dos testes locais.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências; começa imediatamente.
- **Foundational (Phase 2)**: depende de Setup e bloqueia todas as histórias.
- **US1 (Phase 3, P1)**: depende da fundação e entrega o MVP de decisão atual.
- **US2 (Phase 4, P1)**: depende da fundação e integra-se ao contrato/current de US1; pode ter testes e componentes preparados em paralelo com US1.
- **US3 (Phase 5, P2)**: depende da persistência foundational e da política US1 para preservar limite/versão no histórico.
- **US4 (Phase 6, P2)**: depende da política US1; não depende de US3 para calcular cenários, embora possa usar sua recomendação quando disponível.
- **US5 (Phase 7, P3)**: depende do collector/repository foundational; integra ao current de US1 e ao sweep após os contratos locais estarem estáveis.
- **Polish (Phase 8)**: depende de todas as histórias selecionadas para entrega.

### User Story Dependency Graph

```text
Setup → Foundational → US1 ─┬→ US2
                            ├→ US3
                            ├→ US4
                            └→ US5
US2 + US3 + US4 + US5 → Polish
```

### Within Each User Story

1. Escrever testes e confirmar falha pelo motivo esperado.
2. Implementar módulos puros/modelos antes do serviço.
3. Implementar serviço antes da rota.
4. Implementar cliente de API antes da integração da página.
5. Validar o critério independente antes de avançar de fase.

---

## Parallel Opportunities

### Foundation

```text
T005 + T006 + T009 + T011  # suites em arquivos distintos
T007 + T008                 # adaptadores Linux e processos independentes
```

### User Story 1

```text
T016 + T017 + T018          # testes política, rota e UI
T022 + T024                 # cliente API e componentes visuais
```

### User Story 2

```text
T026 + T027 + T028          # testes independentes
T030 + T031 + T032          # cartões, processos e ambientes
```

### User Story 3

```text
T034 + T035 + T036 + T037  # forecast, repositório, rota e UI
T041 + T042                 # cliente e gráfico
```

### User Story 4

```text
T044 + T045 + T046          # cenário puro, rota e UI
T049 + T050                 # cliente e formulário
```

### User Story 5

```text
T052 + T053 + T054 + T055  # Hetzner, alertas, rota e UI
T056 + T057                 # cliente externo e lifecycle independentes
T061 + T062                 # cliente dashboard e componentes
```

---

## Implementation Strategy

### MVP First

1. Completar Setup e Foundational.
2. Completar US1 com política conservadora e snapshot local.
3. Validar independentemente a CX33 com 17 sessões e estado de dados ausentes.
4. Entregar/demonstrar a decisão atual antes de adicionar gráficos, simulador ou Hetzner.

### Incremental Delivery

1. **US1**: decisão imediata protegida e explicável.
2. **US2**: diagnóstico detalhado e staging co-localizado.
3. **US3**: histórico e previsão confiável.
4. **US4**: planejamento de campanhas via cenário consultivo.
5. **US5**: inventário externo e alertas persistentes.
6. **Polish**: staging por 24 h, regressão completa e preparação de PR para `develop`.

### Guardrails de implementação

- Nenhum processo PM2, biblioteca de gráfico ou agente externo novo.
- Nenhuma importação direta de `sessionCore`; contagens de sessão vêm da fonte autorizada existente.
- Nenhum shell com entrada variável; PM2 somente via `execFile` e argumentos constantes.
- Token Hetzner permanece server-side e somente leitura; não existem create/delete/rescale/power.
- Falha de fonte produz `null` e estado localizado, nunca zero fabricado ou verde por ausência.
- Swap não compõe capacidade; staging nunca é desligado automaticamente.
- PR da feature segue para `develop` e validação em staging precede qualquer promoção.

---

## Task Completeness Validation

- **US1**: independentemente verificável por fixture CX33/17 sessões e estado sem dados.
- **US2**: independentemente verificável por métricas locais e separação prod/staging.
- **US3**: independentemente verificável com 90 dias sintéticos e histórico insuficiente.
- **US4**: independentemente verificável com cenário 10/3 meses/90%, sem efeitos.
- **US5**: independentemente verificável com fetch injetado e lifecycle de alertas.
- Todas as tarefas usam checkbox, ID sequencial, label de história quando aplicável e caminhos explícitos.

## Phase 9: Convergence

- [x] T071 [US1] Enriquecer cada snapshot antes da persistência com `connectedSessions` e `activeCustomers` vindos das fontes autorizadas do banco, calcular e persistir a decisão completa (`policyVersion`, limites, headroom, gargalo, estado e razões), e derivar `processRssTotalMb`, base fixa conservadora e confiabilidade histórica do p95 em `src/ops/capacity/collector.js`, `src/ops/capacity/sweep.js`, `src/ops/capacity/policy.js` e `src/api/server.js`, com testes que provem que uma coleta CX33 real deixa de permanecer artificialmente em `insufficient_data` e habilita cenário/forecast/alertas per FR-003, FR-012, FR-015–FR-021 (partial)
- [x] T072 [US1] Corrigir o isolamento de fontes e o refresh manual para que timeout/falha de Linux ou processos preserve a outra medição confiável, o timeout global não descarte resultados já concluídos, e `POST /capacity/refresh` diferencie coleta não inicializada de coleta em andamento e exponha o estado single-flight real em `src/ops/capacity/collector.js`, `src/ops/capacity/sweep.js`, `src/ops/capacity/service.js` e `src/api/routes/admin.js`, ampliando os testes de resiliência/contrato per FR-005, FR-041, FR-042, SC-006 (contradicts)
- [x] T073 [US3] Completar o histórico e a previsão para servir e visualizar todas as séries obrigatórias (sessões, RAM, swap, CPU, disco, workers, limite e estado), eventos/anotações no mesmo eixo, crescimento líquido explícito de 7/30/90 dias, faixa provável e confiança; integrar o forecast verdadeiro ao primeiro bloco em vez do resumo constante `minimum_history`, preservando lacunas e mudanças de host/política em `src/ops/capacity/repository.js`, `src/ops/capacity/service.js`, `src/ops/capacity/forecast.js`, `dashboard/app/admin/capacidade/page.js` e `dashboard/app/admin/capacidade/components/CapacityHistoryChart.js` per FR-003, FR-023, FR-025–FR-029 (partial)
- [x] T074 [US2] Completar a explicabilidade visual do estado atual: adicionar ícones aos estados, exibir gargalo, headroom em MB, máximo não recomendado, horizonte/confiança/recomendação; distinguir RAM livre/cache/processos, mostrar load 1/5/15, totais/usado/disponível de disco e inodes, swap total e taxas, e uptime dos processos, mantendo estados desconhecidos e layout acessível em `dashboard/app/admin/capacidade/components/CapacityDecisionCard.js`, `CapacityResourceCards.js`, `CapacityProcessBreakdown.js` e `CapacitySourceStatus.js` per FR-003–FR-008, FR-009, FR-019, FR-021 (partial)
- [x] T075 [US5] Ampliar a sincronização Hetzner read-only para atualizar o perfil contratado substituindo o baseline e apresentar inventário sanitizado de servidores, volumes, IPs, backups, quota e custo com fonte (`provider|manual|baseline`) e data da última conferência; corrigir o cache para reutilizar o último sucesso persistido sem sobrescrevê-lo como stale e manter TTL mínimo de 6 h em `src/ops/capacity/hetznerClient.js`, `src/ops/capacity/repository.js`, `src/api/server.js` e `dashboard/app/admin/capacidade/components/CapacityInventory.js`, com testes sem vazamento de token per FR-034–FR-039 (partial)
- [x] T076 [US5] Implementar todas as condições e o lifecycle de alertas especificados — margem baixa, horizonte próximo, pressão contínua de swap, disco, OOM, coleta atrasada, divergência worker/sessão e staging ocioso — incluindo duas amostras, cooldown/piora/recuperação, recomendação/evidência sanitizada e uma notificação administrativa existente quando devida, em `src/ops/capacity/alerts.js`, `src/ops/capacity/sweep.js` e `src/ops/capacity/service.js`, com testes por tipo per FR-043–FR-046, SC-009 (partial)
- [x] T077 [US3] Coletar evidência confiável de OOM e registrar, com dedupe idempotente, eventos de deploy, staging, reinício, OOM, mudança de política e mudança de host/capacidade; evitar tratar todo restart de API/dashboard como deploy e renderizar essas anotações no histórico em `src/ops/capacity/linuxMetrics.js`, `src/ops/capacity/events.js`, `src/ops/capacity/repository.js` e `dashboard/app/admin/capacidade/components/CapacityHistoryChart.js` per FR-028, SC-011 (partial)
- [x] T078 Atualizar as suites da feature para exercer comportamento de produção, não apenas presença textual: integração `coleta → decisão persistida → current/history/forecast/scenario/alerts`, falha independente das fontes, inventário completo/cache stale, todas as condições de alerta e conteúdo acessível dos cards/gráfico; executar novamente os gates do quickstart sem marcar a validação manual T070 como concluída em `test/ops-capacity-collector.test.js`, `test/ops-capacity-sweep.test.js`, `test/admin-capacity-routes.test.js`, `test/admin-capacity-page.test.js` e suites focadas relacionadas per SC-002–SC-009, SC-011–SC-012 (partial)

## Phase 10: Convergence 2

- [x] T079 [US1] Fazer `GET /capacity/current` apresentar fielmente a decisão versionada persistida no snapshot (ou persistir todos os insumos históricos necessários para recalculá-la de forma idêntica), em vez de chamar `evaluateCapacity(raw)` sem `workerHistoryDays`/`fixedBaseP95Mb` e silenciosamente voltar ao piso de 350 MB; manter `current`, histórico, cenário e alertas sobre a mesma decisão e adicionar regressão com p95 confiável acima de 350 MB em `src/ops/capacity/service.js`, `src/ops/capacity/sweep.js`, `prisma/schema.prisma` se necessário e `test/ops-capacity-sweep.test.js`/`test/admin-capacity-routes.test.js` per FR-016, FR-018, FR-021, SC-002 (contradicts)
- [x] T080 [US5] Tornar os alertas de horizonte e coleta atrasada operantes em produção: calcular/anexar o forecast vigente antes da avaliação, detectar atraso mesmo quando nenhuma nova coleta bem-sucedida chega (sem depender da diferença entre dois snapshots recém-criados), exigir o período prolongado especificado para staging ocioso, e entregar a notificação por um canal administrativo observável além de apenas registrar analytics; testar relógio/timer, falhas consecutivas, recuperação, horizonte ≤30 dias e staging ocioso por 24 h em `src/ops/capacity/sweep.js`, `src/ops/capacity/alerts.js`, `src/api/server.js` e `test/ops-capacity-alerts.test.js`/`test/ops-capacity-sweep.test.js` per FR-043–FR-045, SC-009 (contradicts)
- [x] T081 [US5] Completar a proveniência do contratado: carregar quota/custo manual configurável no wiring real, persistir e exibir fonte e data de conferência próprias para inventário, quota e custo (sem rotular quota manual sob a fonte global `provider`), e preservar o último perfil/inventário bem-sucedido com idade explícita em toda falha; cobrir resposta real e UI com fontes mistas em `src/api/server.js`, `src/ops/capacity/hetznerClient.js`, `src/ops/capacity/repository.js`, `dashboard/app/admin/capacidade/components/CapacityInventory.js` e testes focados per FR-038, FR-039 (partial)
- [x] T082 [US2] Fechar a conciliação do host e o estado parcial de staging: expor total contabilizado e não contabilizado contra o RSS observado, identificar componentes não classificados sem convertê-los em zero, mostrar CPU/memória/reinícios/uptime de cada app na visão de ambientes e deixar explícito que o controle existente para somente `api-staging`/`visual-staging` não implica que `bot-supervisor-staging` foi desligado; ampliar testes comportamentais em `src/ops/capacity/service.js`, `dashboard/app/admin/capacidade/components/CapacityEnvironments.js`, `CapacityProcessBreakdown.js` e suites relacionadas per FR-009, FR-011, FR-013, FR-014, SC-002 (partial)
- [x] T083 Substituir/acompanhar as guardas predominantemente textuais de `test/admin-capacity-page.test.js` por testes que renderizem e interajam com a rota/componentes: permissão, lazy mount, visibility polling, preservação do último valor, períodos, lacunas, simulador, confirmação/erro de refresh e staging, estados `null|stale|partial` e ausência de mutação Hetzner; adicionar uma prova de contrato ponta a ponta que falhe nas lacunas T079–T082, sem marcar T070, per SC-001–SC-009, SC-012 (partial)

## Phase 11: Convergence 3

- [X] T084 [US5] Corrigir o lifecycle temporal dos alertas no caminho real do sweep: `collection_stale` deve comparar a idade do último snapshot com o relógio mesmo quando a coleta falha (hoje snapshot e `previous` iguais produzem idade zero), OOM deve permanecer conclusivo tempo suficiente para satisfazer a confirmação em duas amostras (hoje o delta existe em uma única amostra e nunca ativa), `firstObservedAt` deve representar o início da violação/reincidência e staging ocioso deve completar 24 h apesar da borda móvel da consulta; entregar a notificação por um canal administrativo observável além do evento analytics e testar falhas consecutivas/timer, OOM único, reincidência, recuperação e cooldown em `src/ops/capacity/sweep.js`, `src/ops/capacity/alerts.js`, `src/api/server.js` e `test/ops-capacity-alerts.test.js`/`test/ops-capacity-sweep.test.js` per FR-043–FR-045, SC-009 (contradicts)
- [X] T085 [US5] Fazer a proveniência manual funcionar no wiring sem token Hetzner e alinhar as envs operacionais: um cache baseline vazio (`inventoryJson='{}'`) não pode impedir `CAPACITY_HETZNER_QUOTA_JSON`/`CAPACITY_MONTHLY_COST_EUR` de entrarem no inventário, e `.env.example` deve usar `CAPACITY_SWEEP_INTERVAL_MS` (lido pelo código) em vez de `CAPACITY_COLLECTION_INTERVAL_MS`, removendo ou conectando também `CAPACITY_HETZNER_CACHE_TTL_MS`; adicionar teste de integração do mesmo `loadCache` usado por `src/api/server.js` com token ausente e fonte/data manual preservadas em `src/ops/capacity/hetznerClient.js`, `src/api/server.js`, `.env.example` e `test/ops-capacity-hetzner-client.test.js` per FR-034, FR-038, FR-039, FR-041 (contradicts)
- [X] T086 [US3] Alinhar contrato, implementação e observabilidade histórica: atualizar `specs/014-admin-capacity-observability/contracts/admin-capacity-api.md` para os payloads reais (`points`, estrutura atual de forecast/inventário/reconciliação) e tornar RAM, swap, CPU e disco visualmente inspecionáveis no período selecionado, não apenas disponíveis na tabela recolhida enquanto o único gráfico desenha sessões/workers/limite; manter e testar lacunas, unidades, eventos no eixo e alternativa tabular em `dashboard/app/admin/capacidade/components/CapacityHistoryChart.js`, `test/admin-capacity-page.test.js` e `test/admin-capacity-routes.test.js` per FR-023, FR-025–FR-029, SC-002, SC-004 (partial)

## Phase 12: Convergence 4

- [X] T087 [US2] Tornar a conciliação de memória do host uma medição independente em vez de uma identidade por construção: hoje `processRssTotalMb` é calculado exatamente como a soma dos mesmos componentes PM2 e workers usados em `productionRssMb + stagingRssMb`, portanto `unaccountedRssMb` tende artificialmente a zero e não representa Redis, PM2 daemon, sistema nem outros processos do host. Coletar um total RSS confiável e limitado via `/proc` (sem cmdline bruto/segredos), manter separadamente o total classificado, expor desconhecido quando a varredura falhar e testar consumo não classificado real. Na mesma conciliação, comparar explicitamente os três contadores exigidos (`productionWorkers`, `connectedSessions` e `activeCustomers`) sem assumir qual é correto, em `src/ops/capacity/processMetrics.js`, `src/ops/capacity/collector.js`, `src/ops/capacity/service.js`, contrato/UI e testes focados per FR-010–FR-012, FR-042, SC-002 (contradicts)
- [X] T088 [US3] Corrigir a cobertura temporal do período de 30 dias: `history('30d')` pede rollups horários (720 pontos), mas `repository.listRollups()` limita silenciosamente a 600, de modo que a visão entrega apenas os primeiros 25 dias da janela e ainda declara `expectedPoints: 720`. Escolher/downsamplear uma granularidade que cubra toda a janela dentro do limite contratual, preservar começo e fim da série e lacunas, tornar `coverage` fiel ao intervalo realmente retornado e adicionar regressão com 30 dias completos em `src/ops/capacity/service.js`, `src/ops/capacity/repository.js`, `specs/014-admin-capacity-observability/contracts/admin-capacity-api.md` e `test/admin-capacity-routes.test.js`/`test/ops-capacity-repository.test.js` per FR-023, FR-025–FR-029, SC-004 (contradicts)

## Phase 13: Convergence 5

- [X] T089 [US3] Tornar anotações de deploy e mudança de host/capacidade alcançáveis no wiring real. Hoje `deriveCapacityEvents(previous, saved)` compara campos de host (`hostKey`, `serverType`, `vcpu`, `memoryTotalMb`, `diskTotalMb`) que não existem nos snapshots persistidos, enquanto `refreshInventory(host)` só roda depois e em paralelo; assim um rescale/sync do perfil nunca gera `host_capacity_changed`. Também não existe uma fonte conclusiva de deploy: apenas `process_restart`, embora FR-028 exija deploys anotados e T077 tenha sido marcada concluída. Persistir uma identidade/versão contratada suficiente por snapshot ou comparar perfis antes/depois do refresh, registrar deploy somente a partir de evidência confiável já disponível (por exemplo SHA/marker sanitizado, nunca inferido de restart), manter dedupe idempotente e expor ambos os eventos no histórico; adicionar teste de integração do sweep que execute o wiring real e prove `deploy` e `host_capacity_changed` após as respectivas transições em `src/ops/capacity/sweep.js`, `src/ops/capacity/events.js`, `src/ops/capacity/repository.js`, `src/api/server.js`, schema/migration se necessário e `test/ops-capacity-sweep.test.js`/`test/ops-capacity-events.test.js` per FR-028, SC-011 (contradicts)

## Phase 14: Flow review

- [X] T090 [US2] Fazer CPU e atividade de swap funcionarem no coletor real, preservando entre ticks o `sample` retornado por `collectLinuxMetrics` e fornecendo `nowMs` e um boot id confiável. Hoje o wiring chama `collectLinuxMetrics(options.linuxOptions)` sempre sem `previous`, `nowMs` ou `bootId`; por isso `cpuPercent`, `swapInKbPerSec` e `swapOutKbPerSec` ficam permanentemente `null` em produção, embora os parsers isolados passem nos testes. Manter o estado somente em memória, descartar deltas após reboot/contador regressivo e adicionar teste de integração com dois ticks reais do collector/sweep em `src/ops/capacity/collector.js`, `src/ops/capacity/linuxMetrics.js`, `src/api/server.js` e `test/ops-capacity-collector.test.js`/`test/ops-capacity-sweep.test.js` per FR-005–FR-007, FR-042, SC-002 (contradicts)
- [X] T091 [US5] Corrigir o cache Hetzner no wiring do servidor para recarregar do repositório a cada refresh, em vez de fechar sobre o objeto `host` obtido antes da primeira sincronização. Atualmente `loadCache` em `src/api/server.js` devolve sempre `inventoryJson`, `checkedAt` e `lastSuccessAt` do perfil baseline capturado no tick; com token configurado, cada sweep de 5 minutos volta a consultar os cinco endpoints externos e ignora o TTL mínimo de 6 h. Adicionar `getHostProfile(id)`/releitura equivalente, selecionar o servidor por `HCLOUD_SERVER_ID` injetado (sem ler global dentro do cliente), preservar o último sucesso em falha e provar por integração que sweeps sucessivos dentro de 6 h não fazem novo fetch em `src/api/server.js`, `src/ops/capacity/repository.js`, `src/ops/capacity/hetznerClient.js` e `test/ops-capacity-hetzner-client.test.js`/`test/ops-capacity-sweep.test.js` per FR-034–FR-039, FR-041 (contradicts)
- [X] T092 [US1] Manter o contador conservador da decisão persistida em todas as superfícies. `evaluateCapacity()` calcula `sessions = max(connectedSessions, productionWorkers)`, mas `persistedDecision()` volta a apresentar `connectedSessions ?? productionWorkers`, fazendo o card e o simulador subestimarem uso quando há mais workers do que sessões conectadas, mesmo que headroom/estado persistidos tenham sido calculados com o maior contador. Persistir explicitamente o contador adotado ou reconstruí-lo com `Math.max` sem transformar desconhecido em zero, e testar divergência nos dois sentidos em `src/ops/capacity/service.js`, schema/migration se necessário, `test/admin-capacity-routes.test.js` e `test/ops-capacity-scenario.test.js` per FR-012, FR-015, FR-021, SC-002 (contradicts)
- [X] T093 [US5] Tornar `collection_stale` alcançável quando o coletor continua sendo agendado mas nenhuma fonte essencial produz uma amostra confiável. Hoje `collectCapacitySnapshot()` converte falha total em um snapshot `completeness='failed'` com `collectedAt` novo, o sweep o persiste e `buildCapacityAlertConditions()` mede a idade desse registro recém-criado; assim falhas consecutivas renovam artificialmente a idade para zero e o alerta nunca ativa. Rastrear a última coleta utilizável (ou não persistir/promover failed como sucesso), avaliar atraso pelo relógio mesmo durante ticks falhos e provar ativação após duas avaliações, recuperação e preservação do último snapshot bom em `src/ops/capacity/collector.js`, `src/ops/capacity/sweep.js`, `src/ops/capacity/alerts.js`, `src/ops/capacity/service.js` e `test/ops-capacity-alerts.test.js`/`test/ops-capacity-sweep.test.js` per FR-041–FR-045, SC-006, SC-009 (contradicts)

## Phase 14: Convergence 6

- [X] T094 [US5] Impedir que a sincronização Hetzner associe o perfil do Wabot ao servidor errado quando `HCLOUD_SERVER_ID` não estiver na primeira página ou não existir. Hoje `createHetznerClient()` consulta `/servers` sem paginação e faz fallback silencioso para `cleanServers[0]`; em projeto com mais de uma VPS isso pode sobrescrever hostname/tipo/RAM/disco/IP do host monitorado com os de outra máquina. Consultar o servidor explicitamente por ID (mantendo allowlist estrita somente leitura) ou paginar de forma limitada e, se o ID não for encontrado, preservar o último perfil/baseline com erro localizado; também tornar listas paginadas honestas (completas ou explicitamente truncadas) e testar projeto multi-servidor, ID ausente e ID fora da primeira página em `src/ops/capacity/hetznerClient.js`, contrato/UI de inventário e `test/ops-capacity-hetzner-client.test.js` per FR-034–FR-039, FR-041, SC-006 (contradicts)
- [X] T095 Reduzir a escrita de auditoria gerada pelo polling de leitura. A página chama `GET /capacity/current` a cada 30 s enquanto visível e a rota grava um novo `AdminAuditLog` em toda chamada; uma aba aberta continuamente cria ~2.880 linhas/dia por administrador, consome o disco que a própria feature monitora e acrescenta escrita SQLite desnecessária. Manter auditoria obrigatória das mutações (`refresh`/staging), mas remover, amostrar ou deduplicar/throttlear a leitura automática com uma política explícita e teste que prove polling sem crescimento ilimitado do log em `src/api/routes/admin.js`, `dashboard/app/admin/capacidade/page.js` e `test/admin-capacity-routes.test.js` per FR-001, FR-030, FR-040, SC-001, SC-012 (performance)
- [X] T096 Conectar ou remover as configurações operacionais documentadas para as raízes de processos. `.env.example` declara `CAPACITY_PRODUCTION_ROOT` e `CAPACITY_STAGING_ROOT`, mas o wiring de `startCapacitySweep()` não as repassa a `collectProcessMetrics`, que continua usando somente `/home/deploy/wabot` e `/home/deploy/wabot-staging`; uma instalação em diretório diferente reportaria zero workers sem avisar. Validar caminhos absolutos server-side, injetá-los via `collectOptions.processOptions.roots` (sem shell nem retorno do caminho ao browser), alinhar AGENTS/quickstart e adicionar teste de wiring com roots customizados em `src/api/server.js`, `src/ops/capacity/processMetrics.js`, `.env.example` e `test/ops-capacity-sweep.test.js`/`test/ops-capacity-process-metrics.test.js` per FR-010–FR-012, FR-041–FR-042, SC-002, SC-006 (contradicts)
