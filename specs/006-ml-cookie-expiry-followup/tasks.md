---

description: "Task list for feature implementation"
---

# Tasks: Follow-up da expiração de credenciais do Mercado Livre (vetores remanescentes)

**Input**: Design documents from `/specs/006-ml-cookie-expiry-followup/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/cookie-rotation-scrape.md, contracts/oauth-double-check.md, contracts/persist-failure-signal.md, quickstart.md

**Tests**: Solicitados explicitamente por spec/plan (node:test, db-free/env-free, injeção via `opts`) — incluídos.

**Organization**: Tarefas agrupadas por user story (US1/US2/US3 do spec.md), com Setup e Foundational primeiro. Tarefas marcadas `[~]` (em vez de `- [ ]`) são **deferidas**: só podem ser validadas em ambiente de staging/produção pós-merge (celular, painel, VPS) e não são executáveis pelo agente de implementação neste ambiente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependência de tarefa incompleta)
- **[Story]**: US1, US2 ou US3 conforme spec.md
- Caminhos de arquivo exatos em cada descrição

## Path Conventions

Projeto single (Node.js backend): `src/`, `test/` na raiz do repo — sem `backend/`/`frontend/` separados.

---

## Phase 1: Setup

**Purpose**: Nenhuma inicialização de projeto necessária — correção cirúrgica em arquivos já existentes. Fase reduzida a confirmar baseline antes de mexer.

- [X] T001 Rodar `node --test test/mercadolivre-session.test.js test/mercadolivre-lock.test.js test/mercadolivre-resolve.test.js test/product-info-scraper.test.js test/observability-operational-signals.test.js test/offer-engine.test.js test/mirror-template.test.js` para confirmar baseline verde antes de qualquer alteração; anotar a contagem de testes existentes para comparar com o pós-implementação (Phase 6). Baseline: 113 pass / 0 fail.

**Checkpoint**: Baseline verde confirmado — seguro começar a Fase 2.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Extrair, **sem mudar comportamento**, os helpers de cookie hoje module-private em `src/converters/mercadolivre.js` (`parseCookieHeader`, `getSetCookieLines`, `parseSetCookieLine`, `mergeSetCookieIntoJar`, `serializeCookieJar`, `buildCredentialPatchFromSetCookie`, linhas ~432–520) para um módulo puro compartilhado. É pré-requisito bloqueante da US1 (FR-002/FR-015: reutilizar, nunca duplicar) — o scrape web só pode persistir rotação de cookie reusando esta lógica já validada do eixo de afiliado.

**⚠️ CRITICAL**: T002–T005 bloqueiam a Fase 3 (US1). US2 e US3 não dependem desta extração (mexem em `getMlUserToken`/catches, não no eixo cookie), mas seguem a Fase 3 na ordem de execução deste documento.

- [X] T002 Criar módulo puro `src/converters/mercadolivreCookieRotation.js` (db-free/env-free, sem import de `db.js`/`analytics.js`/rede) exportando `parseCookieHeader`, `getSetCookieLines`, `parseSetCookieLine`, `mergeSetCookieIntoJar`, `serializeCookieJar`, `buildCredentialPatchFromSetCookie` — corpo **idêntico** ao hoje definido em `src/converters/mercadolivre.js` (linhas ~432–520), só tornando as funções `export function` em vez de module-private.
- [X] T003 Em `src/converters/mercadolivre.js`, remover as definições locais dos 6 helpers extraídos em T002 e substituir por `import { parseCookieHeader, getSetCookieLines, parseSetCookieLine, mergeSetCookieIntoJar, serializeCookieJar, buildCredentialPatchFromSetCookie } from './mercadolivreCookieRotation.js'`; nenhum outro trecho de `mercadolivre.js` muda (o eixo de afiliado — `checkMercadoLivreSession`, `notifyCredentialPatch`, `convert`/`createLink` — permanece com comportamento idêntico, só trocando a origem do import).
- [X] T004 [P] Criar `test/mercadolivre-cookie-rotation.test.js` cobrindo os helpers extraídos: `mergeSetCookieIntoJar` mescla rotação real e ignora deleção (`ssid=;`/`Max-Age=0`/`Expires` no passado); `serializeCookieJar` nunca emite par com valor vazio; `buildCredentialPatchFromSetCookie` retorna patch com `ssid` novo quando rotaciona, `null` quando nenhum nome mudou (FR-006), e preserva o `ssid` conhecido de `creds` quando a linha de `Set-Cookie` é só deleção (FR-004); `getSetCookieLines` lê tanto `headers['set-cookie']` quanto `headers['Set-Cookie']` e retorna `[]` quando ausente.
- [X] T005 Rodar `node --test test/mercadolivre-cookie-rotation.test.js test/mercadolivre-session.test.js test/mercadolivre-lock.test.js test/mercadolivre-resolve.test.js` e confirmar 0 regressões no eixo de afiliado após a extração (comportamento byte-a-byte idêntico, FR-002/FR-015). Resultado: 73 pass / 0 fail.

**Checkpoint**: Módulo de cookie compartilhado pronto e testado, eixo de afiliado sem regressão — Fase 3 pode prosseguir.

---

## Phase 3: User Story 1 - Rotação de cookie no scrape web de título/preço passa a ser persistida (Priority: P1) 🎯 MVP

**Goal**: `fetchHtml` (`src/converters/productInfoScraper.js`) passa a expor `Set-Cookie` ao chamador; `fetchProductInfo`, no ramo ML autenticado (cookie enviado via `mlCookieHeader`), constrói o patch de cookie reusando `buildCredentialPatchFromSetCookie` (do módulo extraído em T002) e persiste via `mlCredentials.__onCredentialPatch` — eliminando o descarte de rotação no caminho de mais alta frequência (painel "Criar oferta" + espelhamento em modo template).

**Independent Test**: Cadastrar uma credencial ML válida, disparar `fetchProductInfo` com `fetch` stubado devolvendo `Set-Cookie` com `ssid` rotacionado, e confirmar que `mlCredentials.__onCredentialPatch('mercadolivre', patch)` é chamado com o `ssid` novo — sem depender do caminho de afiliado.

### Tests for User Story 1 ⚠️

> Escrever estes testes PRIMEIRO; confirmar que falham antes de implementar.

- [X] T006 [P] [US1] Estender `test/product-info-scraper.test.js`: `fetchHtml(url, opts)` passa a retornar `{ html, finalUrl, setCookie }` — com `fetch` mockado (`t.mock.method(global, 'fetch', ...)`) devolvendo um header `Set-Cookie` (via `Headers`/objeto com `getSetCookie()`), `setCookie` é um array não vazio contendo a linha bruta; sem `Set-Cookie` na resposta, `setCookie` é `[]`; o campo é populado inclusive quando `!res.ok` ou content-type não é HTML (os dois retornos antecipados de `fetchHtml`) — nenhum outro campo do retorno muda.
- [X] T007 [P] [US1] Estender `test/product-info-scraper.test.js`: `fetchProductInfo(url, opts)` no ramo ML autenticado (`opts.mlCredentials` com `ssid`/`__onCredentialPatch` presentes) — quando a resposta do ML inclui `Set-Cookie` com `ssid` rotacionado, `opts.mlCredentials.__onCredentialPatch` é chamado com `('mercadolivre', patch)` onde `patch.ssid` é o valor novo; quando a resposta **não** inclui `Set-Cookie` relevante, `__onCredentialPatch` **não** é chamado (FR-006); quando a resposta tenta apagar o `ssid` (`Set-Cookie` de deleção), `__onCredentialPatch` **não** é chamado com `ssid` vazio (FR-004 — ou não é chamado, ou é chamado preservando o `ssid` conhecido, nunca com valor vazio); sem `opts.mlCredentials` (uso não-autenticado, comportamento hoje existente), nada quebra e nenhuma tentativa de persistência ocorre.
- [X] T008 [P] [US1] Estender `test/mercadolivre-session.test.js` (se ainda não coberto por T005/T007 da 005): confirmar que `checkMercadoLivreSession` (eixo de afiliado, `mercadolivre.js`) continua com o mesmo comportamento de rotação/deleção de cookie após a extração de T002/T003 — teste de regressão explícito, não apenas leitura de código.

### Implementation for User Story 1

- [X] T009 [US1] Em `src/converters/productInfoScraper.js`, alterar `fetchHtml` (linha ~179) para capturar `const setCookie = res.headers.getSetCookie?.() ?? []` logo após a resposta chegar e incluir `setCookie` nos **três** pontos de retorno (`!res.ok`, content-type não-HTML, retorno de sucesso com `html`) — nenhum outro comportamento muda.
- [X] T010 [US1] Em `src/converters/productInfoScraper.js`, importar os helpers de `./mercadolivreCookieRotation.js` (`getSetCookieLines`, `buildCredentialPatchFromSetCookie` — os únicos necessários aqui) no topo do arquivo.
- [X] T011 [US1] Em `src/converters/productInfoScraper.js`, na função `fetchProductInfo` (linha ~777), nos dois pontos onde `fetchHtml` é chamado com `cookieHeader: mlCookieHeader` (fetch inicial ~linha 827 e o retry ML ~linha 901): capturar `setCookie` do retorno; quando `opts.mlCredentials` existir, construir `const patch = buildCredentialPatchFromSetCookie(opts.mlCredentials, mlCookieHeader, { 'set-cookie': setCookie })` e, se `patch` e `typeof opts.mlCredentials.__onCredentialPatch === 'function'`, chamar `await opts.mlCredentials.__onCredentialPatch('mercadolivre', patch)` dentro de um `try/catch` que **não** propaga exceção ao scrape (best-effort — o `catch` aqui fica temporariamente vazio/comentado; T028 da US3 o substitui por log + sinal). `fetchProductInfo` continua retornando `{ title, oldPrice, newPrice, finalUrl }` — superfície pública inalterada (FR-005 cumprido automaticamente: `offerEngine.buildScrapedOffer` e `mirrorTemplate` já entregam `mlCredentials` com `__onCredentialPatch`, então ambos passam a persistir sem mudança neles).
- [X] T012 [US1] Rodar `node --test test/product-info-scraper.test.js test/mercadolivre-session.test.js test/mercadolivre-cookie-rotation.test.js` e confirmar que os testes de T006–T008 passam.

**Checkpoint**: US1 completa e testável de forma independente — rotação de cookie no scrape web passa a ser persistida nos dois consumidores de alta frequência (SC-001/SC-002/FR-001–FR-006).

---

## Phase 4: User Story 2 - Refresh OAuth concorrente deixa de queimar o refresh_token single-use (Priority: P2)

**Goal**: `getMlUserToken` relê a credencial **fresca** do banco dentro do lock (`withMercadoLivreCredentialLock`) e recomputa a decisão antes de renovar — se outra chamada concorrente já renovou, reaproveita o token novo em vez de tentar renovar de novo com o `refresh_token` já invalidado.

**Independent Test**: Simular duas chamadas concorrentes que decidem renovar sobre o mesmo snapshot inicial; confirmar que, após a primeira persistir a renovação, a segunda — ao entrar no lock — relê a credencial fresca via `opts.readFreshCredential` stubado, a decisão recalculada indica `reuse`, e `refreshMlOAuthToken` (com `fetch` stubado) **não** é chamado uma segunda vez.

### Tests for User Story 2 ⚠️

> Escrever estes testes PRIMEIRO; confirmar que falham antes de implementar.

- [X] T013 [P] [US2] Estender `test/product-info-scraper.test.js`: `getMlUserToken(mlCredentials, opts)` — cenário de concorrência: snapshot pré-lock indica `refresh` (access expirado), `opts.readFreshCredential` (stub) devolve uma credencial já renovada por outra operação (access token válido) → resultado é `{ token: <token fresco>, credentialPatch: null }` e `fetch` (mock global) **NÃO** é chamado (0 chamadas ao endpoint de refresh do ML).
- [X] T014 [P] [US2] Mesmo arquivo: cenário single-caller — `opts.readFreshCredential` devolve a mesma credencial ainda expirada (sem concorrência) → a renovação ocorre normalmente via `fetch` stubado devolvendo `access_token`/`refresh_token`/`expires_in` novos, e `credentialPatch` reflete os tokens rotacionados (comportamento idêntico ao pré-006, FR-009 — double-check não introduz renovação desnecessária nem bloqueia a legítima).
- [X] T015 [P] [US2] Mesmo arquivo: `opts.readFreshCredential` retorna `null` (indisponível) → `getMlUserToken` cai no snapshot original (`mlCredentials`) sem quebrar, recomputando a decisão sobre ele; e caso `opts.readFreshCredential` não seja passado (chamada sem `opts`), o comportamento usa o default real (T017) sem lançar exceção mesmo sem `userId` disponível em `mlCredentials` (default deve devolver `null` graciosamente nesse caso, ver T017).
- [X] T016 [P] [US2] Mesmo arquivo: `decision.action === 'reuse'` (access token do snapshot pré-lock ainda válido) **não** adquire o lock nem chama `opts.readFreshCredential` (caminho feliz permanece sem lock, FR-009); `decision.action === 'skip'` idem.

### Implementation for User Story 2

- [X] T017 [US2] Em `src/converters/productInfoScraper.js`, implementar o leitor de credencial fresca **default** (usado quando `opts.readFreshCredential` não é passado): função assíncrona que, dado `mlCredentials`, só atua se `mlCredentials.userId` estiver presente — faz **dynamic import lazy** de `../db.js` e `../credentialHealth.js` (`parseCredentialData`) dentro do próprio corpo da função (não no topo do módulo, para manter `productInfoScraper.js` sem import estático de `db.js` — mesmo padrão de `emitDurable` em `src/observability/operationalSignals.js`), consulta `db.credential.findUnique({ where: { userId_platform: { userId: mlCredentials.userId, platform: 'mercadolivre' } } })` e retorna `parseCredentialData(row.data)` decifrado (D-3) ou `null` (linha não encontrada, `userId` ausente, ou qualquer exceção — nunca lança).
- [X] T018 [US2] Em `src/converters/productInfoScraper.js`, reescrever `getMlUserToken(mlCredentials, opts = {})` (assinatura ganha `opts`) seguindo o contrato: `decision = buildOAuthRefreshDecision(mlCredentials, Date.now())`; `skip`/`reuse` retornam imediatamente **sem** adquirir o lock (comportamento hoje existente preservado); só em `decision.action === 'refresh'` entra em `withMercadoLivreCredentialLock`, dentro do qual: `const fresh = (await (opts.readFreshCredential ?? defaultReadFreshCredential)(mlCredentials)) ?? mlCredentials`; `const reDecision = buildOAuthRefreshDecision(fresh, Date.now())`; se `reDecision.action === 'reuse'` retorna `{ token: reDecision.token, credentialPatch: null }` (reaproveita, **não** chama `refreshMlOAuthToken`); se `reDecision.action === 'skip'` retorna `{ token: null, credentialPatch: null }`; senão chama `await refreshMlOAuthToken(fresh)` (renova com o `refresh_token` **fresco**, não mais o do snapshot pré-lock). Timeout/erro do lock continua caindo em `{ token: null, credentialPatch: null }` (comportamento já existente, inalterado).
- [X] T019 [US2] Em `src/converters/productInfoScraper.js`, atualizar o chamador `fetchMercadoLivreItemInfo` (linha ~420/426) para repassar `opts` (ou os campos necessários) à chamada de `getMlUserToken(mlCredentials, opts)` quando `fetchMercadoLivreItemInfo`/`fetchProductInfo` expuserem um `opts.readFreshCredential` externo (injeção em teste); em produção, sem override, usa o default de T017.
- [X] T020 [US2] Threading de `userId` para o default de T017 funcionar em produção — em `src/api/routes/linkConversion.js`, na função `attachCredentialPatchHandler(credentialsMap, userId, logger)`, adicionar (ao lado da `Object.defineProperty` de `__onCredentialPatch`) uma segunda `Object.defineProperty(credentialsMap, 'userId', { enumerable: false, value: userId })`.
- [X] T021 [US2] Mesmo threading em `src/bot-worker.js`, na função `loadConfig` (~linha 526): ao lado da `Object.defineProperty(credentials, '__onCredentialPatch', ...)`, adicionar `Object.defineProperty(credentials, 'userId', { enumerable: false, value: userId })` (usando a `userId` já em escopo de módulo do worker).
- [X] T022 [US2] Propagar `userId` (do mesmo jeito que `__onCredentialPatch` já é propagado) na derivação de `mlCredentials` em `src/converters/offerEngine.js` (`buildScrapedOffer`, ~linha 151) e `src/core/mirrorTemplate.js` (`resolveMirrorOfferFromLink`, ~linha 88): quando `credentialsMap.__onCredentialPatch` é função, incluir também `userId: credentialsMap.userId` no objeto `mlCredentials` montado — sem isso, o default de T017 não teria como localizar a credencial e cairia sempre em `null` (degradação graciosa, mas sem o benefício do double-check).
- [X] T023 [US2] Rodar `node --test test/product-info-scraper.test.js test/offer-engine.test.js test/mirror-template.test.js` e confirmar que os testes de T013–T016 passam e não há regressão nos consumidores de produção (`offerEngine`, `mirrorTemplate`).

**Checkpoint**: US2 completa e testável de forma independente — refresh OAuth concorrente reaproveita token novo em vez de queimar o `refresh_token` single-use (SC-003/FR-007–FR-010).

---

## Phase 5: User Story 3 - Falha ao persistir rotação passa a ser visível em vez de silenciosa (Priority: P3)

**Goal**: Os `catch` que hoje engolem em silêncio uma falha de persistência de rotação (cookie, em T011; OAuth, já existente em `fetchMercadoLivreItemInfo`) passam a emitir `logger.warn` + `recordOperationalSignal('ml_patch_persist_failed', { axis })`, sem alterar o contrato best-effort (nem a falha de persistência nem o registro do evento podem quebrar o fluxo de scrape).

**Independent Test**: Forçar `__onCredentialPatch` a lançar (eixo cookie e eixo OAuth, separadamente) e confirmar que (a) `logger.warn` é chamado, (b) `recordOperationalSignal('ml_patch_persist_failed', { axis })` é chamado (spy), e (c) o retorno de `fetchProductInfo`/`fetchMercadoLivreItemInfo` para o chamador permanece normal (não propaga erro).

### Tests for User Story 3 ⚠️

> Escrever estes testes PRIMEIRO; confirmar que falham antes de implementar.

- [X] T024 [P] [US3] Estender `test/observability-operational-signals.test.js`: `recordOperationalSignal('ml_patch_persist_failed', { axis: 'cookie' })` incrementa o contador in-memory do sinal `ml_patch_persist_failed` e roteia para o evento durável `ops_ml_patch_persist_failed` (mock/spy de `trackAnalyticsEventSafe` via o mesmo padrão já usado no arquivo para os demais `ops_*`); testar para `axis: 'oauth'` também.
- [X] T025 [P] [US3] Estender `test/product-info-scraper.test.js`: com `opts.mlCredentials.__onCredentialPatch` (stub) lançando uma exceção no ramo de persistência de **cookie** (dentro de `fetchProductInfo`), o scrape retorna o resultado normal (não lança, não retorna `null` por causa disso) e um spy sobre `recordOperationalSignal` (injetado via mock de módulo, ex. `t.mock.module` ou stub equivalente já usado no arquivo) confirma a chamada com `('ml_patch_persist_failed', { axis: 'cookie' })`; e `logger.warn` (spy) foi chamado.
- [X] T026 [P] [US3] Mesmo arquivo: com `mlCredentials.__onCredentialPatch` lançando no ramo de persistência **OAuth** (dentro de `fetchMercadoLivreItemInfo`), o scrape retorna o resultado normal e o mesmo par de spies confirma `logger.warn` + `recordOperationalSignal('ml_patch_persist_failed', { axis: 'oauth' })`.

### Implementation for User Story 3

- [X] T027 [US3] Em `src/analytics.js`, adicionar `'ops_ml_patch_persist_failed'` ao `Set` `ANALYTICS_EVENTS` (allowlist) — sem essa linha o evento durável é descartado silenciosamente por `trackAnalyticsEventSafe`.
- [X] T028 [US3] Em `src/observability/operationalSignals.js`, adicionar a entrada `ml_patch_persist_failed: 'ops_ml_patch_persist_failed'` ao mapa `ANALYTICS_EVENT_BY_SIGNAL`, com um comentário curto no padrão dos demais `wa_*`/`sqlite_busy` explicando o gatilho (falha ao persistir rotação de cookie/OAuth do ML).
- [X] T029 [US3] Em `src/converters/productInfoScraper.js`, importar `logger` de `../logger.js` e `recordOperationalSignal` de `../observability/operationalSignals.js` no topo do arquivo (ambos módulos leaf, seguros para import estático — nenhum importa `db.js`).
- [X] T030 [US3] Em `src/converters/productInfoScraper.js`, no bloco de persistência de rotação de **cookie** dentro de `fetchProductInfo` (introduzido em T011), substituir o `catch` best-effort vazio/comentado por `catch (err) { logger.warn({ err, axis: 'cookie' }, 'ML credential rotation persist failed'); recordOperationalSignal('ml_patch_persist_failed', { axis: 'cookie' }) }` — sem relançar, sem alterar o retorno de `fetchProductInfo`.
- [X] T031 [US3] Em `src/converters/productInfoScraper.js`, no bloco de persistência de rotação **OAuth** dentro de `fetchMercadoLivreItemInfo` (~linha 430, hoje `catch (err) { /* comentário best-effort */ }`), aplicar a mesma substituição com `axis: 'oauth'`.
- [X] T032 [US3] Rodar `node --test test/product-info-scraper.test.js test/observability-operational-signals.test.js` e confirmar que os testes de T024–T026 passam.

**Checkpoint**: US3 completa e testável de forma independente — falhas de persistência (cookie e OAuth) tornam-se visíveis em log + evento durável, sem alterar o contrato best-effort (SC-004/SC-005/FR-011–FR-013).

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validação fim-a-fim (db-free/env-free) e checklist de conformidade D-3, seguindo `quickstart.md`. As validações que dependem de staging/produção real são deferidas (`[~]`) — fora do alcance deste ambiente de implementação.

- [X] T033 [P] Rodar a suíte completa (`node --test`) e confirmar 0 regressões em relação ao baseline de T001, com foco nos arquivos desta feature: `test/mercadolivre-cookie-rotation.test.js`, `test/mercadolivre-session.test.js`, `test/mercadolivre-lock.test.js`, `test/mercadolivre-resolve.test.js`, `test/product-info-scraper.test.js`, `test/observability-operational-signals.test.js`, `test/offer-engine.test.js`, `test/mirror-template.test.js`, `test/credentials-mercadolivre-session-route.test.js`, `test/mercadolivre-session-probe-cache.test.js`.
- [X] T034 [P] Confirmar por leitura de código (checklist manual, D-3/SC-007) que: (a) nenhuma escrita nova de `Credential.data` bypassa `persistCredentialPatch`/`encryptCredential`; (b) o leitor de credencial fresca (T017) usa `parseCredentialData` (tolera texto puro/legado) e nunca lança para fora do double-check; (c) `mercadolivreCookieRotation.js` e o leitor default de T017 são, de fato, db-free/env-free na importação estática (sem `import db from '../db.js'` no topo do arquivo — só dynamic import lazy dentro da função, quando aplicável); (d) nenhum segredo/cookie/token aparece na metadata do evento `ops_ml_patch_persist_failed` (apenas `{ axis }`).
- [X] T035 [P] Confirmar que o item **#2 do diagnóstico** (consolidar chamadas de `fetchProductInfo` no `offerEngine`) permanece **fora de escopo** — nenhuma tarefa desta feature tocou nisso (FR-016); revisar `git diff` final contra o `Scale/Scope` do `plan.md` para confirmar que os arquivos tocados são exatamente os listados lá (`productInfoScraper.js`, `mercadolivreCookieRotation.js` novo, `mercadolivre.js`, `analytics.js`, `operationalSignals.js`, mais o threading mínimo de `userId` em `linkConversion.js`/`bot-worker.js`/`offerEngine.js`/`mirrorTemplate.js` necessário para US2).
- [~] T036 (DEFERIDO — validação manual em staging pós-merge, fora deste ambiente) Seguir `quickstart.md` seção "Validação em staging": após merge em `develop` (autodeploy), cadastrar credencial ML válida em staging e criar ofertas reais de produtos ML pelo painel "Criar oferta" repetidamente ao longo de uma janela — confirmar via `AnalyticsEvent`/`/metrics` que **não** há `ops_ml_patch_persist_failed` recorrente (persistência saudável na prática, não só em teste stubado). Valida SC-004/SC-005 em condições reais.
- [~] T037 (DEFERIDO — validação manual em staging pós-merge, fora deste ambiente) Medir a rotação real do cookie `ssid` no scrape web em staging: disparar múltiplas criações de oferta/espelhamentos em modo template para o MESMO produto ML ao longo do tempo e confirmar, inspecionando `Credential.data` (decifrado) do usuário de teste, que o `ssid` persistido muda quando o ML rotaciona — prova de que SC-001 se sustenta fora do `fetch` stubado dos testes unitários.
- [~] T038 (DEFERIDO — validação manual em staging/produção pós-merge, fora deste ambiente) Confirmar no painel/celular que a sessão ML cadastrada em staging sobrevive por mais tempo do que o baseline pós-005, sem recadastro manual dentro da janela de observação (SC-006) — só conclusivo com credencial real e uso ao vivo, conforme `Assumptions` do `spec.md`.
- [~] T039 (DEFERIDO — condicional a T036–T038, staging pós-merge) Se a validação em staging revelar necessidade de ajuste (ex.: `userId` não propagado em algum consumidor de produção não coberto pelos testes db-free, double-check não disparando na prática), atualizar `research.md`/`data-model.md` com o achado antes de promover `develop → main`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências — pode começar imediatamente.
- **Foundational (Phase 2)**: depende de Setup; T002–T005 (extração do módulo de cookie) bloqueiam a Fase 3 (US1).
- **US1 (Phase 3)**: depende de T002–T005 concluídos.
- **US2 (Phase 4)**: independente de US1 no código de `getMlUserToken`, mas mexe no mesmo arquivo (`productInfoScraper.js`) — executar em sequência após US1 para evitar conflito de merge; não depende funcionalmente da rotação de cookie.
- **US3 (Phase 5)**: depende de US1 (T011/T030 — precisa existir o bloco de persistência de cookie para o `catch` ser substituído) e referencia o bloco OAuth já existente (T031, independente de US2 ter mudado `getMlUserToken` por dentro — a wrapper de persistência em `fetchMercadoLivreItemInfo` não muda de posição).
- **Polish (Phase 6)**: depende de todas as fases anteriores.

### User Story Dependencies

- **US1 (P1)**: depende apenas da Fase 2 (extração do módulo de cookie); sem dependência de outra story.
- **US2 (P2)**: independente de US1/US3 em termos de requisito funcional; sequenciada após US1 só por conflito de arquivo.
- **US3 (P3)**: depende de US1 (bloco de persistência de cookie precisa existir antes de instrumentar seu `catch`).

### Within Each User Story

- Testes escritos e falhando antes da implementação (T006–T008 antes de T009–T011; T013–T016 antes de T017–T022; T024–T026 antes de T027–T031).
- Dentro de US1: `fetchHtml` expõe `setCookie` (T009) antes de `fetchProductInfo` consumir (T011).
- Dentro de US2: leitor default (T017) antes da reescrita de `getMlUserToken` (T018); threading de `userId` (T020–T022) pode ser feito em paralelo a T017–T019 (arquivos diferentes) mas precisa estar pronto antes de T023 (validação end-to-end).
- Dentro de US3: allowlist + mapa (T027–T028) antes da emissão nos `catch` (T030–T031).

### Parallel Opportunities

- T004 (novo teste de cookie) pode ser escrito em paralelo com T002 (módulo) antes de rodar juntos em T005.
- T006, T007, T008 podem ser escritos em paralelo (mesmo arquivo em dois casos — T006/T007 —, então dentro de um mesmo arquivo cuidar de não colidir na mesma edição; T008 é arquivo distinto).
- T013–T016 podem ser escritos em paralelo entre si (mesmo arquivo, casos independentes).
- T020 e T021 (threading de `userId` em `linkConversion.js` e `bot-worker.js`) são arquivos diferentes — paralelizáveis.
- T024 pode rodar em paralelo com T025/T026 (arquivos diferentes: `observability-operational-signals.test.js` vs. `product-info-scraper.test.js`).
- T033–T035 (Polish, verificação) podem rodar em paralelo entre si.

---

## Parallel Example: Foundational (extração do módulo de cookie)

```bash
# Em paralelo: módulo extraído e seu teste dedicado
Task: "Criar src/converters/mercadolivreCookieRotation.js (T002)"
Task: "Criar test/mercadolivre-cookie-rotation.test.js (T004)"
```

---

## Implementation Strategy

### MVP First (User Story 1 apenas)

1. Completar Fase 1 (baseline).
2. Completar Fase 2 (T002–T005): módulo de cookie extraído, eixo de afiliado sem regressão.
3. Completar Fase 3 (US1): rotação de cookie no scrape web passa a ser persistida.
4. **PARAR e VALIDAR**: rodar T012, confirmar o vetor #1 (ALTA prioridade) isoladamente.
5. Esse é o MVP mínimo que já fecha o vetor de maior impacto (alta frequência) desta feature.

### Incremental Delivery

1. Setup + Foundational → módulo de cookie compartilhado pronto.
2. US1 → testar isoladamente → vetor #1 fechado (rotação de cookie persistida).
3. US2 → testar isoladamente → vetor #3 fechado (double-check elimina refresh concorrente perdido).
4. US3 → testar isoladamente → vetor #4 fechado (falha de persistência visível).
5. Polish → suíte completa + checklist D-3, depois validação em staging (`quickstart.md`, tarefas `[~]`) antes de PR `develop → main` (fluxo canônico do AGENTS.md).

---

## Notes

- [P] = arquivos diferentes, sem dependência entre si.
- [Story] mapeia a tarefa à user story correspondente para rastreabilidade.
- `[~]` = tarefa **deferida**: só validável em staging/produção pós-merge (celular, painel, VPS real); não executável neste ambiente de implementação. Todas as demais tarefas (código, migrations conceituais/nenhuma, testes unitários db-free, docs) são normais e executáveis agora.
- Sem migration de schema, sem novo processo PM2, sem Redis — mudança backend-only em arquivos já existentes (`src/converters/productInfoScraper.js`, `src/converters/mercadolivre.js`, `src/api/routes/linkConversion.js`, `src/bot-worker.js`, `src/converters/offerEngine.js`, `src/core/mirrorTemplate.js`, `src/analytics.js`, `src/observability/operationalSignals.js`) + 1 módulo puro novo (`src/converters/mercadolivreCookieRotation.js`).
- O item **#2 do diagnóstico** (consolidar chamadas de `fetchProductInfo` no `offerEngine`) permanece **fora de escopo** (FR-016) — nenhuma tarefa deste documento o implementa.
- Seguir D-3 em toda escrita/leitura de `Credential.data` (sempre `encryptCredential`/`parseCredentialData`, nunca texto puro sem tolerância a legado; idempotente).
- Testes `node:test`, db-free/env-free, injeção via `opts`/stubs de `fetch`/leitor de credencial — sem rede/DB real.
- `AnalyticsEvent` só persiste tipos presentes na allowlist de `src/analytics.js` — qualquer evento novo precisa entrar lá (T027) antes de `operationalSignals.js` conseguir emiti-lo de verdade.
- Módulos puros (`mercadolivreCookieRotation.js`, leitor default de credencial fresca) não importam `db.js`/`analytics.js` estaticamente no topo — dynamic import lazy dentro da função quando inevitável (mesmo padrão de `operationalSignals.js`).
- Validar em staging antes de promover a `main` (fluxo canônico do AGENTS.md — nunca pular staging); tarefas `[~]` desta lista são exatamente esse passo.
- Commitar após cada tarefa ou grupo lógico; parar em cada checkpoint para validar a story isoladamente.
