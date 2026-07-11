---

description: "Task list for feature implementation"
---

# Tasks: Investigação e correção da expiração rápida dos cookies da Amazon

**Input**: Design documents from `/specs/001-amazon-cookie-expiry/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/amazon-session-probe.md, quickstart.md

**Tests**: Solicitados explicitamente por spec/plan (node:test, db-free) — incluídos.

**Organization**: Tarefas agrupadas por user story (US1/US2/US3 do spec.md), com Setup e Foundational primeiro.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependência de tarefa incompleta)
- **[Story]**: US1, US2 ou US3 conforme spec.md
- Caminhos de arquivo exatos em cada descrição

## Path Conventions

Projeto single (Node.js backend): `src/`, `test/` na raiz do repo — sem `backend/`/`frontend/` separados.

---

## Phase 1: Setup

**Purpose**: Nenhuma inicialização de projeto necessária — correção cirúrgica em arquivos já existentes. Fase reduzida a confirmar baseline antes de mexer.

- [ ] T001 Rodar a suíte completa (`node --test`) e `node --test test/converters-amazon.test.js test/credential-health-amazon.test.js` para confirmar baseline verde antes de qualquer alteração; anotar contagem de testes existentes para comparação pós-implementação.

**Checkpoint**: Baseline verde confirmado — seguro começar a Fase 2.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Nenhuma infraestrutura nova bloqueia as user stories (sem migration, sem novo processo). US2 (diagnóstico) já está documentada em `research.md` — a única tarefa foundational é criar o módulo de cache TTL puro, que US1 e US3 consomem.

**⚠️ CRITICAL**: T002–T003 bloqueiam a Fase 4 (US3) e o item de cache da Fase 3 (US1); podem começar imediatamente.

- [ ] T002 [P] Criar módulo puro `src/converters/amazonSessionProbeCache.js` com `getCachedProbe(userId, now=Date.now())`, `setCachedProbe(userId, result, now=Date.now())`, `pruneExpired(now=Date.now())` sobre um `Map` interno por `userId`; TTL configurável via env (ex.: `AMAZON_SESSION_PROBE_CACHE_TTL_MS`, default seguro em minutos, ver research.md Decisão 2); sem import de DB/rede/Prisma.
- [ ] T003 [P] Criar `test/amazon-session-probe-cache.test.js` cobrindo: miss inicial retorna `null`; hit dentro do TTL retorna o resultado salvo sem recomputar; após expirar o TTL o cache não serve mais o valor antigo (`getCachedProbe` retorna `null`); `pruneExpired` remove entradas expiradas sem afetar as válidas.

**Checkpoint**: Módulo de cache pronto e testado — Fases 3 e 4 podem prosseguir.

---

## Phase 3: User Story 1 - A sessão da Amazon dura o tempo esperado sem recadastro frequente (Priority: P1) 🎯 MVP

**Goal**: A rotação de cookie que a Amazon devolve no `Set-Cookie` do `getShortUrl` passa a ser persistida também no caminho da sondagem do painel (o único caminho hoje sem o gancho `__onCredentialPatch`), igual ao padrão já em produção do Mercado Livre.

**Independent Test**: Cadastrar um cookie Amazon válido, simular (em teste) uma resposta de `getShortUrl` com `Set-Cookie` rotacionado via `checkAmazonSession`/rota `/amazon/session`, e confirmar que `Credential.data` é atualizado (cifrado) com o token novo — a próxima chamada usa o token fresco em vez do velho.

### Tests for User Story 1 ⚠️

> Escrever estes testes PRIMEIRO; confirmar que falham antes de implementar.

- [ ] T004 [P] [US1] Estender `test/converters-amazon.test.js`: `checkAmazonSession` devolve `{ configured:true, alive:true, reason:'ok', credentialPatch }` quando `createAmazonShortLink`/`axios.get` simulado retorna `Set-Cookie` com cookie rotacionado (mock via `t.mock.method(axios, 'get', ...)`, espelhando o padrão de `mercadolivre-session.test.js`); `credentialPatch` ausente quando a resposta não traz `Set-Cookie` ou quando nada mudou; `credentialPatch` ausente/não regressivo quando o `Set-Cookie` só traz diretiva de limpeza (valor vazio) — reusa `buildAmazonCredentialPatchFromSetCookie` já testado indiretamente.
- [ ] T005 [P] [US1] Criar `test/credentials-amazon-session-route.test.js`: monta a rota `credentialsRoutes` (fastify) com `db` mockado (`findUnique`/`update`) e `checkAmazonSession` mockado para devolver `credentialPatch`; assert que `GET /amazon/session` chama `db.credential.update` com `data` cifrado (`encryptCredential`, valor começando com `v1:`) contendo o merge `{ ...data, ...credentialPatch }`, e que a resposta HTTP **não** expõe `credentialPatch` (mesma forma pública de hoje).
- [ ] T006 [P] [US1] No mesmo arquivo de T005, cobrir: quando `checkAmazonSession` devolve `reason:'network_error'` (transitório), a rota **não** chama `db.credential.update` (nada a persistir) e a resposta mantém `alive:null, reason:'network_error'` (FR-007, não mascarar).

### Implementation for User Story 1

- [ ] T007 [US1] Em `src/converters/amazon.js`, alterar `createAmazonShortLink` para **retornar** `credentialPatch` (via `buildAmazonCredentialPatchFromSetCookie(cookieHeader, res.headers)`) no caso de sucesso (`shortUrl` presente), além de manter a chamada best-effort a `persistRotatedAmazonCookies` quando `creds.__onCredentialPatch` existir (backward-compat worker/linkConversion — não duplicar escrita, só não quebrar quem já depende do gancho). Retorno passa a ser `{ shortUrl, transient, credentialPatch? }` (contracts/amazon-session-probe.md §3).
- [ ] T008 [US1] Em `src/converters/amazon.js`, alterar `checkAmazonSession` para repassar o `credentialPatch` recebido de `createAmazonShortLink` no objeto de retorno quando `shortUrl` (sessão viva): `{ configured:true, alive:true, reason:'ok', credentialPatch? }`. Não incluir `credentialPatch` nos ramos `transient`/`expired`/sem cookie/sem tag.
- [ ] T009 [US1] Em `src/api/routes/credentials.js`, alterar a rota `GET /amazon/session` para espelhar o bloco já existente de `/mercadolivre/session`: destructuring `const { credentialPatch, ...publicResult } = result`; se `credentialPatch` presente, `await db.credential.update({ where: { userId_platform: { userId: req.user.sub, platform: 'amazon' } }, data: { data: encryptCredential(JSON.stringify({ ...data, ...credentialPatch })) } })`; retornar `{ ...publicResult, checkedAt: new Date().toISOString() }`.
- [ ] T010 [US1] Rodar `node --test test/converters-amazon.test.js test/credentials-amazon-session-route.test.js` e confirmar que os testes de T004–T006 passam.

**Checkpoint**: US1 completa e testável de forma independente — rotação de token é persistida em todos os caminhos (SC-002).

---

## Phase 4: User Story 3 - Chamadas excessivas/desnecessárias à Amazon são reduzidas (Priority: P2)

**Goal**: N aberturas do painel de credenciais em uma janela curta resultam em 1 chamada real de sondagem à Amazon (as demais servidas pelo cache), reduzindo consumo de rotação e risco de padrão anômalo.

**Independent Test**: Chamar `GET /amazon/session` repetidamente (ex.: 10x) para o mesmo usuário dentro da janela TTL e confirmar, via mock/contador, que `checkAmazonSession` (e portanto a chamada real à Amazon) só é invocado 1 vez; após expirar o TTL, uma nova chamada real ocorre.

### Tests for User Story 3 ⚠️

- [ ] T011 [P] [US3] Em `test/credentials-amazon-session-route.test.js` (mesmo arquivo de T005/T006), adicionar caso: duas chamadas consecutivas de `GET /amazon/session` para o mesmo `userId` dentro da janela TTL resultam em **apenas 1** chamada ao mock de `checkAmazonSession` (segunda chamada serve do cache, mesma resposta pública, incluindo `checkedAt` da 1ª sondagem ou comportamento documentado); chamadas para `userId` diferentes não compartilham cache.
- [ ] T012 [P] [US3] Em `test/amazon-session-probe-cache.test.js` (mesmo arquivo de T003), garantir cobertura explícita de "janela TTL expira → próxima chamada é miss" (já coberto por T003, mas confirmar aqui o caso de reuso pela rota real via mock de `Date.now()`/tempo injetado).

### Implementation for User Story 3

- [ ] T013 [US3] Em `src/api/routes/credentials.js`, na rota `GET /amazon/session`: antes de chamar `checkAmazonSession`, consultar `getCachedProbe(req.user.sub)`; em hit, retornar o resultado cacheado (com `checkedAt` apropriado) **sem** chamar `checkAmazonSession`/Amazon; em miss/expirado, sondar normalmente, persistir `credentialPatch` se houver (T009) e gravar o resultado público em `setCachedProbe(req.user.sub, publicResultWithCheckedAt)` antes de retornar.
- [ ] T014 [US3] Adicionar log leve (ex.: `app.log.debug`/`logger.debug`) diferenciando "sondagem servida por cache" vs. "sondagem efetiva" na rota `/amazon/session`, para permitir medir objetivamente a queda de chamadas (FR-011/SC-003) sem instrumentação pesada.
- [ ] T015 [US3] Rodar `node --test test/credentials-amazon-session-route.test.js test/amazon-session-probe-cache.test.js` e confirmar que os testes de T011–T012 passam.

**Checkpoint**: US1 e US3 funcionam juntas — rotação persistida E chamadas redundantes evitadas (SC-002 + SC-003).

---

## Phase 5: User Story 2 - Diagnóstico das causas da expiração rápida documentado com evidências (Priority: P1)

**Goal**: Diagnóstico escrito com veredito (confirmada/descartada/inconclusiva) para cada causa provável, já produzido na Fase 0 do plano.

**Independent Test**: Revisar `research.md` e confirmar que cada causa provável (C1–C7) tem veredito + evidência, e que nenhuma foi deixada sem classificação.

**Nota**: Esta user story já está satisfeita por `specs/001-amazon-cookie-expiry/research.md` (produzido na fase de planejamento, antes de tasks.md). As tarefas abaixo são de **checagem/consolidação**, não de redação do zero.

- [ ] T016 [US2] Revisar `specs/001-amazon-cookie-expiry/research.md` e confirmar que os 7 itens (C1–C7) têm veredito e evidência (SC-005); se a implementação das Fases 3–4 revelar um fato novo que contradiga alguma evidência do diagnóstico (ex.: comportamento real diferente do esperado ao rodar os testes), atualizar o veredito correspondente em `research.md` antes de finalizar a feature.
- [ ] T017 [US2] Confirmar em `test/converters-amazon.test.js` que os casos de C6 (Set-Cookie de limpeza não sobrescreve token válido) e C7 (falha transitória não conta como expiração) permanecem cobertos por teste de regressão após as mudanças de T007–T008 (não apenas documentados em research.md).

**Checkpoint**: Diagnóstico revisado e sincronizado com o comportamento final implementado.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validação fim-a-fim e não regressão, seguindo `quickstart.md`.

- [ ] T018 [P] Rodar a suíte completa (`node --test`) e confirmar 0 regressões em relação ao baseline de T001 (em particular `test/converters-amazon.test.js`, `test/credential-health-amazon.test.js`, `test/credentials-amazon-session-route.test.js`, `test/amazon-session-probe-cache.test.js`).
- [ ] T019 Executar o roteiro `quickstart.md` §3 em staging após merge em `develop` (autodeploy): abrir/recarregar o painel de credenciais Amazon ~10x em poucos minutos e confirmar no log que houve 1 sondagem efetiva (SC-003); confirmar que após uma conversão bem-sucedida o `Credential.data` foi atualizado com o token rotacionado (`rotatedCookie:true` no log) e a sessão permanece viva na chamada seguinte (SC-002).
- [ ] T020 Executar `quickstart.md` §3 itens 3–4 em staging: sessão genuinamente expirada continua exibindo aviso "renovar cookies" com fallback `?tag=` (SC-004/FR-008); simular resposta 5xx/rede e confirmar estado indeterminado, não "cookies expirados" (SC-006/FR-007).
- [ ] T021 Atualizar `specs/001-amazon-cookie-expiry/research.md` (seção "Riscos e mitigações") se a validação em staging (T019–T020) revelar necessidade de ajuste na causa C3 (uso concorrente) ou no TTL do cache escolhido em T002.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências — pode começar imediatamente.
- **Foundational (Phase 2)**: depende de Setup; T002/T003 (cache) bloqueiam Fase 4 e o consumo de cache dentro da Fase 3 (T013 é Fase 4, mas T009 da Fase 3 não depende do cache — só da rotação).
- **US1 (Phase 3)**: depende de Foundational concluída (o módulo de cache não é usado por US1 em si, mas a ordem de fases é sequencial neste plano). Pode, na prática, começar em paralelo com a Fase 2 já que T007–T009 não tocam `amazonSessionProbeCache.js`.
- **US3 (Phase 4)**: depende de Foundational (T002/T003) **e** de US1 (T009 — a rota precisa já persistir o patch antes de adicionar o cache por cima, para não confundir os dois comportamentos nos testes).
- **US2 (Phase 5)**: independente de código; pode rodar a qualquer momento, mas faz mais sentido depois de US1/US3 para confirmar que nada mudou o diagnóstico.
- **Polish (Phase 6)**: depende de todas as fases anteriores.

### User Story Dependencies

- **US1 (P1)**: depende apenas da Fase 2 (nominalmente); sem dependência de outra story.
- **US3 (P2)**: depende de US1 (reusa a rota já alterada por T009) e da Fase 2 (módulo de cache).
- **US2 (P1)**: independente de código; documental.

### Within Each User Story

- Testes escritos e falhando antes da implementação (T004–T006 antes de T007–T009; T011–T012 antes de T013–T014).
- Dentro de US1: `createAmazonShortLink` (T007) antes de `checkAmazonSession` (T008) antes da rota (T009).
- Dentro de US3: módulo de cache (Fase 2) antes do consumo na rota (T013).

### Parallel Opportunities

- T002 e T003 podem rodar em paralelo com T004–T006 (arquivos diferentes, sem dependência de código entre si).
- T004, T005, T006 podem ser escritos em paralelo (mesmo arquivo T005/T006, mas descrevem casos distintos — coordenar merge no mesmo arquivo).
- T016 e T017 (US2) podem rodar em paralelo com qualquer fase de código.

---

## Parallel Example: Foundational + US1 tests

```bash
# Em paralelo: módulo de cache e seus testes vs. testes de US1
Task: "Criar src/converters/amazonSessionProbeCache.js"
Task: "Criar test/amazon-session-probe-cache.test.js"
Task: "Estender test/converters-amazon.test.js com casos de credentialPatch"
Task: "Criar test/credentials-amazon-session-route.test.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 apenas)

1. Completar Fase 1 (baseline).
2. Completar Fase 2 (cache — pode ser adiada se o MVP for só "persistir rotação"; mas como é rápida e desbloqueia US3, fazer junto).
3. Completar Fase 3 (US1): rotação persistida em todos os caminhos.
4. **PARAR e VALIDAR**: rodar T010, confirmar SC-002 isoladamente.
5. Esse é o MVP mínimo que já resolve a causa raiz primária (C1) da expiração rápida.

### Incremental Delivery

1. Setup + Foundational → base pronta (cache disponível).
2. US1 → testar isoladamente → já resolve a causa raiz (rotação persistida).
3. US3 → testar isoladamente → reduz consumo de rotação por chamadas redundantes (agravante C2/C5).
4. US2 → revisão/consolidação do diagnóstico já escrito.
5. Polish → validação em staging conforme quickstart.md, depois PR `develop → main` (fluxo canônico do AGENTS.md).

---

## Notes

- [P] = arquivos diferentes, sem dependência entre si.
- [Story] mapeia a tarefa à user story correspondente para rastreabilidade.
- Sem migration de schema, sem novo processo PM2, sem Redis — mudança backend-only em 2 arquivos existentes + 1 módulo puro novo.
- Seguir D-3 em toda escrita de `Credential.data` (sempre `encryptCredential`, nunca texto puro).
- Validar em staging antes de promover a `main` (fluxo canônico do AGENTS.md — nunca pular staging).
- Commitar após cada tarefa ou grupo lógico; parar em cada checkpoint para validar a story isoladamente.
