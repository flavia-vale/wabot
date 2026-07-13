---

description: "Task list for feature implementation"
---

# Tasks: Investigação e correção da expiração rápida dos cookies/tokens do Mercado Livre

**Input**: Design documents from `/specs/005-ml-cookie-expiry/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/mercadolivre-session-probe.md, quickstart.md

**Tests**: Solicitados explicitamente por spec/plan (node:test, db-free/env-free, injeção via `opts`) — incluídos.

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

- [X] T001 Rodar `node --test test/mercadolivre-session.test.js test/mercadolivre-lock.test.js test/mercadolivre-resolve.test.js test/product-info-scraper.test.js` para confirmar baseline verde antes de qualquer alteração; anotar contagem de testes existentes para comparação pós-implementação. (Baseline: 76 testes, 0 falhas.)

**Checkpoint**: Baseline verde confirmado — seguro começar a Fase 2.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Nenhuma infraestrutura nova bloqueia as user stories (sem migration, sem novo processo). US2 (diagnóstico) já está documentada em `research.md`. As duas fundações de código que as demais stories consomem são: (a) o módulo puro de decisão/aplicação de refresh OAuth (consumido por US1) e (b) o módulo puro de cache TTL da sondagem (consumido por US3).

**⚠️ CRITICAL**: T002–T003 bloqueiam a Fase 3 (US1); T004–T005 bloqueiam a Fase 4 (US3). Os dois pares podem ser feitos em paralelo entre si (arquivos diferentes).

- [X] T002 [P] Criar módulo puro `src/converters/mlOAuthTokenPolicy.js` com `buildOAuthRefreshDecision(creds, now = Date.now())` → `{ action: 'reuse'|'refresh'|'skip', token? }` (`reuse` quando `oauthAccessToken` presente e `now < oauthTokenExpiry`; `refresh` quando `oauthRefreshToken` presente e access ausente/expirado; `skip` sem `oauthRefreshToken`) e `applyOAuthTokenResponse(prevCreds, tokenResponse, now = Date.now())` → `credentialPatch|null` (`{ oauthAccessToken, oauthTokenExpiry, oauthRefreshToken }`; `oauthTokenExpiry = now + (expires_in - 300) * 1000`; mantém `oauthRefreshToken` anterior se a resposta não trouxer um novo; `null` quando `tokenResponse` não tem `access_token`; idempotente — reprocessar a mesma resposta não regride tokens). Sem import de DB/rede/Prisma (data-model.md "Decisão de refresh OAuth" e "Patch OAuth").
- [X] T003 [P] Criar `test/ml-oauth-token-policy.test.js` cobrindo: `buildOAuthRefreshDecision` retorna `reuse` com access válido (não expirado), `refresh` com access expirado/ausente + refresh presente, `skip` sem refresh token; `applyOAuthTokenResponse` calcula `oauthTokenExpiry` com a margem de -300s, persiste o `refresh_token` novo quando presente na resposta, mantém o anterior quando a resposta não traz `refresh_token` (nunca apaga), retorna `null` quando a resposta não tem `access_token`, e é idempotente (reaplicar a mesma resposta não regride os tokens).
- [X] T004 [P] Criar módulo puro `src/converters/mercadolivreSessionProbeCache.js` com `getCachedProbe(userId, now = Date.now())`, `setCachedProbe(userId, result, now = Date.now())`, `invalidateCachedProbe(userId)`, `pruneExpired(now = Date.now())` sobre um `Map` interno por `userId`; TTL configurável via env (`ML_SESSION_PROBE_CACHE_TTL_MS`, default seguro em minutos, espelhando `src/converters/amazonSessionProbeCache.js`); só armazena resultado definitivo (`alive === true || alive === false` — `alive === null`/transitório nunca é cacheado, espelhando o fix T023 do precedente Amazon); sem import de DB/rede/Prisma.
- [X] T005 [P] Criar `test/mercadolivre-session-probe-cache.test.js` cobrindo: miss inicial retorna `null`; hit dentro do TTL retorna o resultado salvo sem recomputar; após expirar o TTL o cache não serve mais o valor antigo; `pruneExpired` remove entradas expiradas sem afetar as válidas; `setCachedProbe` com `alive: null` (transitório) NÃO é armazenado (próxima leitura continua sendo miss); `invalidateCachedProbe` remove a entrada de um `userId` específico sem afetar outros.

**Checkpoint**: Módulos de política OAuth e cache prontos e testados — Fases 3 e 4 podem prosseguir.

---

## Phase 3: User Story 1 - A credencial do Mercado Livre dura o tempo esperado sem recadastro frequente (Priority: P1) 🎯 MVP

**Goal**: O `refresh_token` rotacionado que o ML devolve no refresh OAuth passa a ser persistido (em vez de descartado), eliminando a causa raiz nova confirmada em `research.md`; o eixo cookie `ssid` (já correto) ganha teste de regressão para não ser quebrado.

**Independent Test**: Simular (em teste) `oauthTokenExpiry` no passado + `oauthRefreshToken` presente, invocar `getMlUserToken` com `fetch` stubado devolvendo `access_token`/`refresh_token`/`expires_in` novos, e confirmar que o retorno inclui `credentialPatch` com o `refresh_token` novo (≠ do anterior) — pronto para ser persistido cifrado pelo chamador.

### Tests for User Story 1 ⚠️

> Escrever estes testes PRIMEIRO; confirmar que falham antes de implementar.

- [X] T006 [P] [US1] Estender `test/product-info-scraper.test.js`: `getMlUserToken(mlCredentials)` retorna `{ token, credentialPatch }` (não mais uma string solta); quando `oauthTokenExpiry` no passado e `fetch` mockado (`t.mock.method(global, 'fetch', ...)`) devolve `{ access_token, refresh_token, expires_in }`, `credentialPatch` traz os três campos frescos e `credentialPatch.oauthRefreshToken` é diferente do `oauthRefreshToken` de entrada; quando `now < oauthTokenExpiry` (access ainda válido), `fetch` NÃO é chamado e `credentialPatch` é `null`; quando `fetch` falha (`!res.ok`/rejeita), retorna `{ token: null, credentialPatch: null }` sem apagar os campos OAuth de entrada (não são reescritos por quem chama); sem `oauthRefreshToken`, retorna `{ token: null, credentialPatch: null }`.
- [X] T007 [P] [US1] Estender `test/mercadolivre-session.test.js` com casos de regressão do eixo cookie (não regredir, já correto hoje): `checkMercadoLivreSession` continua retornando `credentialPatch` quando `Set-Cookie` traz rotação; deleção de cookie (`Max-Age=0`/`Expires` no passado/valor vazio) é ignorada e não sobrescreve o cookie válido; 401 vira `expired` (`alive:false`); 403/429/erro de rede viram `alive:null` (transitório, não conta como expiração — FR-008/SC-006).
- [X] T008 [P] [US1] Criar `test/credentials-mercadolivre-session-route.test.js`: monta `credentialsRoutes` (fastify) com `db` mockado (`findUnique`/`update`) e `checkMercadoLivreSession` mockado devolvendo `credentialPatch`; assert que `GET /mercadolivre/session` chama `db.credential.update` com `data` cifrado (`encryptCredential`, valor começando com `v1:`) contendo o merge `{ ...data, ...credentialPatch }`, e que a resposta HTTP **não** expõe `credentialPatch`. Cobrir também: quando `checkMercadoLivreSession` devolve `reason:'network_error'`/`'busy'` (transitório), a rota **não** chama `db.credential.update` e a resposta mantém `alive:null` (FR-008, não mascarar).

### Implementation for User Story 1

- [X] T009 [US1] Em `src/converters/productInfoScraper.js`, reescrever `getMlUserToken(mlCredentials)` para usar `buildOAuthRefreshDecision`/`applyOAuthTokenResponse` (`src/converters/mlOAuthTokenPolicy.js`): em `reuse`, retornar `{ token: mlCredentials.oauthAccessToken, credentialPatch: null }` sem chamar `fetch`; em `refresh`, chamar `POST https://api.mercadolibre.com/oauth/token` (`grant_type=refresh_token`, mesmo endpoint/timeout de hoje) e, em sucesso, retornar `{ token: data.access_token, credentialPatch: applyOAuthTokenResponse(mlCredentials, data, Date.now()) }`; em falha (`!res.ok`/exceção)/`skip`, retornar `{ token: null, credentialPatch: null }`. **Nunca mais descartar o `refresh_token` rotacionado.**
- [X] T010 [US1] Em `src/converters/productInfoScraper.js`, atualizar `fetchMercadoLivreItemInfo` (chamador de `getMlUserToken`, linha ~392) para desestruturar `{ token: userToken, credentialPatch }`: se `credentialPatch` presente e `mlCredentials?.__onCredentialPatch` for função, chamar `await mlCredentials.__onCredentialPatch('mercadolivre', credentialPatch)` (best-effort, mesmo padrão de `persistRotatedAmazonCookies`/`__onCredentialPatch` do eixo cookie) sem quebrar o fluxo caso a chamada falhe.
- [X] T011 [US1] Rodar `node --test test/product-info-scraper.test.js test/mercadolivre-session.test.js test/ml-oauth-token-policy.test.js` e confirmar que os testes de T006–T007 (e T003) passam.

**Checkpoint**: US1 completa e testável de forma independente — refresh OAuth persiste o token rotacionado; eixo cookie coberto por regressão (SC-002/FR-003/FR-009).

---

## Phase 4: User Story 3 - Sondagem de saúde da credencial ML no painel deixa de bater no ML a cada abertura (Priority: P2)

**Goal**: N aberturas do painel de credenciais em uma janela curta resultam em 1 chamada real de sondagem ao ML (as demais servidas pelo cache), reduzindo consumo de rotação e risco de padrão anômalo; a rota também passa a persistir qualquer `credentialPatch` OAuth quando a sondagem tocar OAuth (defesa em profundidade, ainda que o probe atual do ML seja majoritariamente cookie).

**Independent Test**: Chamar `GET /mercadolivre/session` repetidamente (ex.: 10x) para o mesmo usuário dentro da janela TTL e confirmar, via mock/contador, que `checkMercadoLivreSession` só é invocado 1 vez; após `PUT /mercadolivre` (recadastro), a próxima `GET` sonda de novo (cache invalidado), não serve valor stale.

### Tests for User Story 3 ⚠️

- [X] T012 [P] [US3] Em `test/credentials-mercadolivre-session-route.test.js` (mesmo arquivo de T008), adicionar casos: (a) duas chamadas consecutivas de `GET /mercadolivre/session` para o mesmo `userId` dentro da janela TTL resultam em **apenas 1** chamada ao mock de `checkMercadoLivreSession` (2ª serve do cache, mesma resposta pública); chamadas para `userId` diferentes não compartilham cache; (b) resultado transitório (`alive:null`) NÃO é servido do cache na chamada seguinte (re-sonda); (c) `PUT /mercadolivre` invalida o cache do `userId` — a `GET` seguinte sonda de novo em vez de servir o resultado antigo.
- [X] T013 [P] [US3] Em `test/mercadolivre-session-probe-cache.test.js` (mesmo arquivo de T005), garantir cobertura explícita de "janela TTL expira → próxima chamada é miss" via `Date.now()`/tempo injetado, espelhando o uso real pela rota.

### Implementation for User Story 3

- [X] T014 [US3] Em `src/api/routes/credentials.js`, alterar `credentialsRoutes(app, opts)` para aceitar `opts.getMlProbeCache`/`opts.setMlProbeCache`/`opts.invalidateMlProbeCache` (defaults reais de `mercadolivreSessionProbeCache.js`, overrides em teste — mesmo padrão de injeção via `opts` já usado para `db`/`checkMercadoLivreSession`).
- [X] T015 [US3] Em `src/api/routes/credentials.js`, na rota `GET /mercadolivre/session`: antes de chamar `checkMercadoLivreSession`, consultar `getCachedProbe(req.user.sub)`; em hit, retornar o resultado cacheado (com `checkedAt` apropriado) **sem** chamar `checkMercadoLivreSession`/ML (log `debug` "servida por cache"); em miss/expirado, sondar normalmente, persistir `credentialPatch` (cookie e/ou OAuth) cifrado via `encryptCredential` quando presente (T008), e gravar o resultado público em `setCachedProbe(req.user.sub, publicResultWithCheckedAt)` **somente** quando `alive !== null` (definitivo) antes de retornar.
- [X] T016 [US3] Em `src/api/routes/credentials.js`, no handler `PUT /mercadolivre`, após o upsert da credencial, chamar `invalidateCachedProbe(req.user.sub)` para refletir a credencial recém-cadastrada imediatamente (mesmo padrão do fix T022 do precedente Amazon, aplicado desde já para o ML em vez de descoberto depois em review).
- [X] T017 [US3] Adicionar log leve (`app.log.debug`/`logger.debug`) diferenciando "sondagem servida por cache" vs. "sondagem efetiva" na rota `/mercadolivre/session`, para permitir medir objetivamente a queda de chamadas (FR-005/FR-013/SC-003) sem instrumentação pesada.
- [X] T018 [US3] Rodar `node --test test/credentials-mercadolivre-session-route.test.js test/mercadolivre-session-probe-cache.test.js` e confirmar que os testes de T012–T013 passam.

**Checkpoint**: US1 e US3 funcionam juntas — refresh OAuth persistido E chamadas redundantes de sondagem evitadas (SC-001/SC-002/SC-003).

---

## Phase 5: User Story 2 - Diagnóstico das causas da expiração rápida documentado com evidências (Priority: P1)

**Goal**: Diagnóstico escrito com veredito (confirmada/descartada/inconclusiva) para cada causa provável e mapa completo dos consumidores da credencial ML, já produzido na Fase 0 do plano (`research.md`).

**Independent Test**: Revisar `research.md` e confirmar que cada causa provável tem veredito + evidência, e que o mapa de consumidores (`src/converters/mercadolivre.js`, `src/credentialHealth.js`, `offerEngine`, `offerAutomation`, `bot-worker`, rotas de credenciais, `mlOAuth`) está completo e classificado (persiste/descarta rotação).

**Nota**: Esta user story já está satisfeita por `specs/005-ml-cookie-expiry/research.md` (produzido na fase de planejamento, antes de tasks.md). As tarefas abaixo são de **checagem/consolidação**, não de redação do zero.

- [X] T019 [US2] Revisar `specs/005-ml-cookie-expiry/research.md` e confirmar que todas as causas prováveis (rotação de cookie não persistida, sondagem sem cache, uso concorrente, headers inconsistentes, ausência de cache, refresh OAuth descartado) têm veredito e evidência (SC-005); se a implementação das Fases 3–4 revelar um fato novo que contradiga alguma evidência do diagnóstico, atualizar o veredito correspondente em `research.md` antes de finalizar a feature.
- [X] T020 [US2] Confirmar que o mapa de consumidores de `research.md` (`src/converters/mercadolivre.js`, `src/credentialHealth.js`, `offerEngine`, `offerAutomation`, `bot-worker`, rotas de credenciais, `mlOAuth`) reflete o estado final pós-implementação — em particular que `offerEngine`/`bot-worker` (via `fetchMercadoLivreItemInfo` → `getMlUserToken`) agora aparecem como "persiste quando `__onCredentialPatch` disponível" em vez de "descarta" (T010), atualizando a tabela se necessário.
- [X] T021 [US2] Confirmar em `test/mercadolivre-session.test.js` e `test/product-info-scraper.test.js` que os casos de deleção de cookie (Set-Cookie de limpeza não sobrescreve token válido) e falha transitória (não conta como expiração) permanecem cobertos por teste de regressão após as mudanças de T009–T010 (não apenas documentados em research.md).

**Checkpoint**: Diagnóstico revisado e sincronizado com o comportamento final implementado.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validação fim-a-fim e não regressão, seguindo `quickstart.md`.

- [X] T022 [P] Rodar a suíte completa (`node --test`) e confirmar 0 regressões em relação ao baseline de T001 (em particular `test/mercadolivre-session.test.js`, `test/mercadolivre-lock.test.js`, `test/mercadolivre-resolve.test.js`, `test/product-info-scraper.test.js`, `test/ml-oauth-token-policy.test.js`, `test/mercadolivre-session-probe-cache.test.js`, `test/credentials-mercadolivre-session-route.test.js`). (Suíte completa: 147 falhas pré-existentes/ambientais idênticas ao baseline via `git stash` — nenhuma nova; os 5 arquivos-alvo desta feature: 100% verdes, +17 testes novos.)
- [X] T023 [P] Confirmar por leitura de código que toda escrita nova de `Credential.data` (cookie e OAuth) passa por `encryptCredential(JSON.stringify(...))` (D-3, idempotente) e que nenhuma leitura nova ignora `decryptCredential`/`parseCredentialData` (tolerância a legado) — checklist manual contra `src/api/routes/credentials.js` e `src/converters/productInfoScraper.js` alterados nesta feature (SC-007). (Confirmado: `credentials.js` só escreve `Credential.data` via `encryptCredential(...)` em 3 pontos (GET /mercadolivre/session, GET /amazon/session, PUT /:platform); leituras via `parseCredentialData`. `productInfoScraper.js` não escreve no DB — só retorna `credentialPatch`, persistido pelo chamador.)
- [~] T024 (DEFERIDO — validação manual em staging pós-merge, fora deste ambiente) Executar `quickstart.md` §2 item 2 em staging após merge em `develop` (autodeploy): abrir/recarregar o painel de credenciais ML ~10x em poucos minutos e confirmar no log da `api-staging` que as sondagens efetivas ao ML caem para ~1 por janela (`grep "servida por cache"` vs. sondagem efetiva). Valida SC-003.
- [~] T025 (DEFERIDO — validação manual em staging pós-merge, fora deste ambiente) Executar `quickstart.md` §2 item 3 em staging: forçar `oauthTokenExpiry` no passado (ou aguardar o vencimento natural), disparar um scrape de item ML real e confirmar no banco que `oauthRefreshToken` foi atualizado (o antigo deixou de valer); repetir o scrape após novo vencimento e confirmar que o 2º refresh também funciona (prova de que o token rotacionado foi persistido, não o antigo). Valida SC-001/FR-003/FR-009.
- [~] T026 (DEFERIDO — validação manual em staging pós-merge, fora deste ambiente) Executar `quickstart.md` §2 itens 4–5 em staging: credencial genuinamente expirada continua exibindo "renovar credencial" com fallback seguro (`partner_id`, sem encaminhar link de terceiro — SC-004/FR-010); simular blip transitório (403/429/rede) e confirmar que o painel não fixa "expirada" (SC-006/FR-008).
- [~] T027 (DEFERIDO — condicional a T024–T026, staging pós-merge) Atualizar `specs/005-ml-cookie-expiry/research.md` (seção de riscos/mitigações, se houver) caso a validação em staging revele necessidade de ajuste no TTL do cache (`ML_SESSION_PROBE_CACHE_TTL_MS`) escolhido em T004 ou na margem de expiração OAuth de T002.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências — pode começar imediatamente.
- **Foundational (Phase 2)**: depende de Setup; T002–T003 (política OAuth) bloqueiam a Fase 3 (US1); T004–T005 (cache) bloqueiam a Fase 4 (US3). Os dois pares são independentes entre si (arquivos diferentes).
- **US1 (Phase 3)**: depende de T002–T003 concluídos.
- **US3 (Phase 4)**: depende de T004–T005 **e** de US1 (T008/T009 — a rota precisa já ter o bloco de persistência de `credentialPatch` funcionando antes de acrescentar o cache por cima, para não confundir os dois comportamentos nos testes de T012).
- **US2 (Phase 5)**: independente de código; pode rodar a qualquer momento, mas faz mais sentido depois de US1/US3 para confirmar que nada mudou o diagnóstico.
- **Polish (Phase 6)**: depende de todas as fases anteriores.

### User Story Dependencies

- **US1 (P1)**: depende apenas da Fase 2 (T002–T003); sem dependência de outra story.
- **US3 (P2)**: depende de US1 (reusa a rota já alterada por T008/T009) e da Fase 2 (T004–T005, cache).
- **US2 (P1)**: independente de código; documental.

### Within Each User Story

- Testes escritos e falhando antes da implementação (T006–T008 antes de T009–T010; T012–T013 antes de T014–T017).
- Dentro de US1: `getMlUserToken` (T009) antes do chamador `fetchMercadoLivreItemInfo` (T010).
- Dentro de US3: injeção de opts do cache (T014) antes do consumo na rota GET (T015) antes da invalidação no PUT (T016).

### Parallel Opportunities

- T002/T003 podem rodar em paralelo com T004/T005 (arquivos diferentes, sem dependência de código entre si).
- T006, T007, T008 podem ser escritos em paralelo (arquivos distintos, exceto T008 que é novo arquivo dedicado).
- T019–T021 (US2) podem rodar em paralelo com qualquer fase de código.

---

## Parallel Example: Foundational (política OAuth + cache)

```bash
# Em paralelo: módulo de política OAuth e seu teste vs. módulo de cache e seu teste
Task: "Criar src/converters/mlOAuthTokenPolicy.js"
Task: "Criar test/ml-oauth-token-policy.test.js"
Task: "Criar src/converters/mercadolivreSessionProbeCache.js"
Task: "Criar test/mercadolivre-session-probe-cache.test.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 apenas)

1. Completar Fase 1 (baseline).
2. Completar T002–T003 da Fase 2 (política OAuth — necessária para US1; T004–T005 do cache podem ser adiados se o MVP for só "persistir refresh OAuth").
3. Completar Fase 3 (US1): refresh OAuth persiste o `refresh_token` rotacionado em todos os caminhos.
4. **PARAR e VALIDAR**: rodar T011, confirmar a causa raiz nova (OAuth) isoladamente.
5. Esse é o MVP mínimo que já resolve a causa raiz nova confirmada em `research.md` (refresh OAuth descartado).

### Incremental Delivery

1. Setup + Foundational → bases prontas (política OAuth + cache disponíveis).
2. US1 → testar isoladamente → resolve a causa raiz nova (refresh OAuth persistido).
3. US3 → testar isoladamente → reduz chamadas redundantes de sondagem (agravante confirmado).
4. US2 → revisão/consolidação do diagnóstico já escrito.
5. Polish → validação em staging conforme `quickstart.md`, depois PR `develop → main` (fluxo canônico do AGENTS.md).

---

## Notes

- [P] = arquivos diferentes, sem dependência entre si.
- [Story] mapeia a tarefa à user story correspondente para rastreabilidade.
- Sem migration de schema, sem novo processo PM2, sem Redis — mudança backend-only em 2 arquivos existentes (`src/converters/productInfoScraper.js`, `src/api/routes/credentials.js`) + 2 módulos puros novos (`mlOAuthTokenPolicy.js`, `mercadolivreSessionProbeCache.js`).
- O eixo cookie `ssid` (`src/converters/mercadolivre.js`) **não é alterado** — já correto; só ganha teste de regressão (T007).
- Seguir D-3 em toda escrita de `Credential.data` (sempre `encryptCredential`, nunca texto puro; idempotente).
- Testes `node:test`, db-free/env-free, injeção via `opts`/stubs de `fetch` — sem rede/DB real.
- Validar em staging antes de promover a `main` (fluxo canônico do AGENTS.md — nunca pular staging).
- Commitar após cada tarefa ou grupo lógico; parar em cada checkpoint para validar a story isoladamente.

---

## Phase 7: Code Review Fixes

- [ ] T028 Re-anexar `__onCredentialPatch` ao `mlCredentials` nos caminhos de scrape do OfferEngine e do MirrorTemplate: em `src/converters/offerEngine.js` (~linha 151) e `src/core/mirrorTemplate.js` (~linha 89) a extração `credentialsMap?.mercadolivre || null` DESCARTA a propriedade não-enumerável `__onCredentialPatch` do map, então `fetchMercadoLivreItemInfo` recebe um `mlCredentials` sem gancho e o `credentialPatch` OAuth rotacionado (refresh_token single-use) é **silenciosamente descartado em produção** — a correção-raiz da US1 nunca persiste. Espelhar o padrão de `convertLink` (`src/converters/index.js:24-25`): quando `typeof credentialsMap.__onCredentialPatch === 'function'`, montar `mlCredentials = { ...credentialsMap.mercadolivre, __onCredentialPatch: credentialsMap.__onCredentialPatch }`. per achado crítico "OAuth patch descartado em offerEngine/mirrorTemplate (FR-003/SC-002)" (review)
- [ ] T029 Adicionar teste end-to-end (db-free, `fetch`/DB stubbed) que exercita `buildScrapedOffer`/`fetchProductInfo` a partir de um `credentialsMap` com `__onCredentialPatch` anexado (como em `attachCredentialPatchHandler`/`bot-worker`), com access token OAuth expirado, e assegura que `__onCredentialPatch('mercadolivre', patch)` É INVOCADO com o `refresh_token` novo — cobrindo o wiring de produção que os testes atuais de `getMlUserToken`/`fetchMercadoLivreItemInfo` não cobrem (eles anexam o gancho manualmente). per achado "sem cobertura do caminho real de persistência OAuth" (review)
- [ ] T030 Serializar o refresh OAuth do ML sob o mesmo lock do eixo cookie (`withMercadoLivreCredentialLock`) ou equivalente: dois scrapes concorrentes disparam `grant_type=refresh_token` com o MESMO refresh_token single-use; o segundo recebe `!res.ok` e degrada o scrape. Não é fatal para a sobrevivência da sessão (o primeiro persiste o token novo), mas contraria FR-006 / edge case "Persistência concorrente da rotação" e desperdiça uma chamada ao ML. per achado (severidade baixa) "refresh OAuth não serializado" (review)
