# Feature Specification: Follow-up da expiração de credenciais do Mercado Livre (vetores remanescentes)

**Feature Branch**: `006-ml-cookie-expiry-followup`

**Created**: 2026-07-21

**Status**: Draft

**Input**: User description: "A feature 005-ml-cookie-expiry corrigiu a causa-raiz principal (persistir rotação do refresh_token OAuth single-use + cache TTL na sondagem do painel), mas ainda não está satisfatório. Um pente fino encontrou 3 vetores remanescentes: (#1 ALTA) rotação do cookie ssid descartada no scrape web de título/preço em fetchHtml; (#3 MÉDIA) OAuth sem double-check dentro do lock queima refresh_token single-use na concorrência; (#4 BAIXA) falha ao persistir rotação engolida em silêncio. Escopo = APENAS #1, #3 e #4 (o #2 — consolidar chamadas de fetchProductInfo no offerEngine — fica FORA)."

## Contexto e natureza do trabalho

Este documento descreve uma **correção de follow-up** (não uma feature nova de produto), continuação direta de `specs/005-ml-cookie-expiry`. A feature 005 corrigiu a causa-raiz principal da expiração rápida da credencial do Mercado Livre (ML): persistiu a rotação do `refresh_token` OAuth single-use no caminho de afiliado e adicionou cache TTL na sondagem de saúde do painel. Isso prolongou a vida da sessão, mas a cliente **ainda** observa expiração mais rápida do que o esperado.

Um pente fino posterior no código identificou **três vetores remanescentes** que continuam encurtando a vida da sessão ou escondendo falhas. O research da 005 auditou apenas a API de afiliado (`createLink` em `src/converters/mercadolivre.js`, que **já persiste corretamente** a rotação) e o probe do painel, mas **não** auditou o caminho de scrape web de título/preço nem o comportamento sob concorrência. Esta feature fecha essas lacunas.

Os três vetores (numeração preservada do diagnóstico original; o item **#2 — consolidar as múltiplas chamadas de `fetchProductInfo` por oferta no `offerEngine` — está explicitamente FORA de escopo**, é otimização separada):

- **#1 (ALTA)** — A rotação do cookie `ssid` é **descartada** no scrape web. `fetchHtml` (`src/converters/productInfoScraper.js`) envia o cookie `ssid` do usuário para a página web do produto ML mas retorna só `{ html, finalUrl }`; o cabeçalho `Set-Cookie` da resposta é jogado fora. É a mesma classe do bug de rotação já corrigido, mas no eixo **cookie** e num caminho de **alta frequência** (painel "Criar oferta" via `buildScrapedOffer`; espelhamento em modo template via `src/core/mirrorTemplate.js`).
- **#3 (MÉDIA)** — Sob concorrência, o refresh OAuth **queima** o `refresh_token` single-use. A decisão de refresh é calculada **antes** de adquirir o lock de credencial, sobre um snapshot possivelmente obsoleto; dentro do lock não há releitura fresca do banco. Duas chamadas concorrentes podem cada uma tentar refresh com o mesmo token single-use já invalidado pelo ML.
- **#4 (BAIXA, visibilidade)** — Falhas de persistência da rotação (OAuth ou cookie) são **engolidas em silêncio** por blocos `catch` vazios. Uma escrita perdida (ex.: `SQLITE_BUSY`) queima uma rotação single-use sem nenhum sinal, indistinguível de sucesso.

O objetivo é fechar estes três vetores respeitando as convenções canônicas do `AGENTS.md`: criptografia D-3 via `encryptCredential` (idempotente, no-op sem env), invariante de nunca gravar cookie/segredo vazio (deleção não sobrescreve), reutilização da lógica robusta de cookie já existente em `src/converters/mercadolivre.js` (sem duplicar), lógica testável em módulos puros com injeção de dependência via `opts` (testes db-free/env-free com `node:test`), e `AnalyticsEvent` com allowlist em `src/analytics.js`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Rotação de cookie no scrape web de título/preço passa a ser persistida (Priority: P1)

Como afiliada que cadastrou a credencial do Mercado Livre uma vez, quero que toda vez que o sistema busca título/preço de um produto ML pela página web (ao criar uma oferta no painel ou ao espelhar em modo template) qualquer cookie rotacionado que o ML devolva seja capturado e salvo, em vez de descartado, para que a sessão não morra por continuar reenviando um cookie `ssid` velho num caminho de uso muito frequente.

**Why this priority**: É o vetor de **alta prioridade** e de **alta frequência** — o scrape web de título/preço roda em cada criação de oferta e em cada espelhamento em modo template, muito mais vezes que o caminho de afiliado que a 005 já corrigiu. Descartar a rotação aqui reabre exatamente a classe de bug que a 005 se propôs a matar, só que num eixo (cookie) e num caminho que o research anterior não cobriu.

**Independent Test**: Cadastrar uma credencial ML válida, disparar buscas de título/preço via o caminho de scrape web (criar oferta / espelhar em template) simulando o ML devolvendo um `Set-Cookie` com `ssid` rotacionado, e confirmar que o novo cookie é persistido re-encriptado e reutilizado na chamada seguinte, sem depender do caminho de afiliado.

**Acceptance Scenarios**:

1. **Given** uma credencial ML com cookie `ssid` válido, **When** o scrape web de título/preço é executado e a resposta do ML inclui `Set-Cookie` com um `ssid` novo, **Then** o cookie rotacionado é mesclado no jar e persistido (re-encriptado via D-3), e a próxima chamada usa o cookie novo.
2. **Given** a mesma credencial, **When** a resposta do ML **não** inclui `Set-Cookie` (ou inclui apenas cookies irrelevantes), **Then** nenhuma escrita de credencial é feita e o cookie existente é preservado.
3. **Given** uma resposta do ML que tenta **apagar** o cookie `ssid` (`Set-Cookie` de deleção / valor vazio / expirado), **When** o scrape processa esse `Set-Cookie`, **Then** o `ssid` existente **não** é sobrescrito por vazio (invariante de deleção, idêntica à do eixo de afiliado).
4. **Given** os dois consumidores do scrape web (painel "Criar oferta" via `buildScrapedOffer` e espelhamento em modo template via `mirrorTemplate`), **When** qualquer um deles executa o scrape, **Then** ambos passam pela mesma persistência de rotação de cookie — nenhum caminho fica descartando.

---

### User Story 2 - Refresh OAuth concorrente deixa de queimar o refresh_token single-use (Priority: P2)

Como operadora do sistema, quero que, quando duas operações precisam do token OAuth do ML ao mesmo tempo, apenas uma execute a renovação e a outra **reaproveite** o token recém-renovado, em vez de tentar renovar de novo com um `refresh_token` já gasto, para que a concorrência normal do sistema não invalide a sessão do ML por reenvio de token morto.

**Why this priority**: É o vetor de **prioridade média**: acontece só sob concorrência de duas operações sobre a mesma credencial, mas quando acontece desperdiça uma renovação e pode matar a sessão (o `refresh_token` do ML é single-use — usar o velho após a rotação da primeira chamada falha). Depende de existir o lock de credencial (já presente); a correção é fazer a decisão de refresh sob leitura fresca dentro do lock (double-checked locking).

**Independent Test**: Simular duas chamadas concorrentes que decidem renovar sobre o mesmo snapshot inicial e confirmar que, após a primeira renovar e persistir, a segunda — ao entrar no lock — relê a credencial fresca, percebe que já há um access token válido e o **reaproveita** em vez de tentar renovar com o `refresh_token` já invalidado.

**Acceptance Scenarios**:

1. **Given** duas operações que, sobre o mesmo snapshot de credencial, decidem que é preciso renovar o token OAuth, **When** a primeira adquire o lock, renova (RT1→RT2) e persiste, **Then** a segunda, ao adquirir o lock, relê a credencial fresca e a decisão recalculada indica reaproveitar o token novo — **não** há segunda tentativa de renovação com o token morto.
2. **Given** uma única operação que precisa renovar sem concorrência, **When** ela adquire o lock e a releitura fresca confirma que ainda é preciso renovar, **Then** a renovação ocorre normalmente (o double-check não introduz renovação desnecessária nem a bloqueia).
3. **Given** o módulo que decide renovar/reaproveitar, **When** ele é exercitado em teste, **Then** o leitor de credencial fresca é injetado por dependência (`opts`) e a lógica é testável sem banco de dados nem variáveis de ambiente.

---

### User Story 3 - Falha ao persistir rotação passa a ser visível em vez de silenciosa (Priority: P3)

Como responsável pela operação, quero que, quando a gravação de uma rotação de credencial do ML (cookie ou token OAuth) falhar, isso gere um aviso em log e um evento durável de observabilidade, em vez de ser engolido por um `catch` vazio, para que eu consiga detectar em produção que rotações estão sendo perdidas antes que a sessão morra por isso.

**Why this priority**: É o vetor de **baixa prioridade / observabilidade**: não muda o resultado do scrape (a persistência continua best-effort e o fluxo do chamador não pode quebrar), mas hoje uma falha de escrita (ex.: `SQLITE_BUSY`) é indistinguível de sucesso — perdemos silenciosamente uma rotação single-use que pode matar a sessão. Tornar a falha visível é o que permite diagnosticar recorrência em produção.

**Independent Test**: Forçar a persistência da rotação (OAuth e cookie) a falhar e confirmar que (a) um aviso de log é emitido, (b) um evento durável de observabilidade é registrado, e (c) o fluxo de scrape para o chamador **não** é interrompido pela falha.

**Acceptance Scenarios**:

1. **Given** uma rotação de token OAuth a persistir, **When** a escrita falha, **Then** um `logger.warn` é emitido e um `AnalyticsEvent` durável de falha de persistência é registrado, e o scrape continua retornando normalmente ao chamador.
2. **Given** uma rotação de cookie a persistir, **When** a escrita falha, **Then** o mesmo aviso de log + evento durável são emitidos, sem interromper o fluxo.
3. **Given** o novo tipo de evento de observabilidade, **When** ele é emitido, **Then** ele está na allowlist de eventos analíticos (senão seria descartado) e segue o padrão dos demais sinais operacionais existentes.

---

### Edge Cases

- **`Set-Cookie` com múltiplos cookies** (ex.: `ssid` + cookies irrelevantes): apenas os cookies relevantes ao jar são mesclados; os demais são ignorados sem erro.
- **Cookie de deleção real** (expiração no passado / `Max-Age=0` / valor vazio): tratado como deleção segundo a lógica já existente do eixo de afiliado, **sem** sobrescrever o `ssid` válido por vazio.
- **Ambiente sem `CREDENTIAL_ENCRYPTION_KEY`** (dev/test): `encryptCredential` é no-op; a rotação ainda é persistida em texto compatível, sem quebrar o fluxo nem os testes db-free.
- **Snapshot sem OAuth (só cookie) ou sem cookie (só OAuth)**: cada eixo de persistência age só quando há o segredo correspondente a rotacionar; a ausência de um não impede o outro.
- **Releitura fresca dentro do lock retorna a mesma credencial** (sem concorrência): a decisão recalculada é idêntica à original e a renovação ocorre normalmente.
- **Falha de persistência quando o evento durável também não consegue ser escrito** (ex.: mesmo `SQLITE_BUSY`): o registro do evento é best-effort e não pode, ele próprio, quebrar o fluxo.
- **Escrita concorrente da mesma linha de credencial**: a invariante de não sobrescrever segredo por vazio precisa valer mesmo quando duas rotações chegam próximas.

## Requirements *(mandatory)*

### Functional Requirements

**Vetor #1 — persistir rotação de cookie no scrape web (P1)**

- **FR-001**: O caminho de scrape web de título/preço do ML MUST capturar o cabeçalho `Set-Cookie` da resposta do produto (hoje descartado) e expô-lo ao chamador que detém a credencial, para que a rotação possa ser persistida.
- **FR-002**: Qualquer cookie rotacionado devolvido pelo ML no scrape web MUST ser mesclado no jar de cookie **reutilizando a lógica já existente** de tratamento de `Set-Cookie` do eixo de afiliado (`buildCredentialPatchFromSetCookie` / `mergeSetCookieIntoJar` / `parseSetCookieLine` em `src/converters/mercadolivre.js`), sem reimplementar nem duplicar essa lógica.
- **FR-003**: A rotação de cookie capturada no scrape web MUST ser persistida pelo mesmo mecanismo de patch de credencial usado no eixo de afiliado (`__onCredentialPatch` / `persistCredentialPatch`), com re-encriptação em repouso via D-3 (`encryptCredential`).
- **FR-004**: O sistema MUST NUNCA sobrescrever o cookie `ssid` existente por um valor vazio — uma resposta de deleção/expiração de cookie não pode apagar um `ssid` válido (mesma invariante do eixo de afiliado).
- **FR-005**: Ambos os consumidores do scrape web (painel "Criar oferta" via `buildScrapedOffer`/`offerEngine` e espelhamento em modo template via `mirrorTemplate`) MUST passar pela mesma persistência de rotação — nenhum caminho pode continuar descartando a rotação.
- **FR-006**: Quando a resposta do ML não contém rotação de cookie relevante, o sistema MUST NÃO realizar escrita de credencial (nenhuma gravação desnecessária).

**Vetor #3 — double-check do refresh OAuth sob concorrência (P2)**

- **FR-007**: Dentro do lock de credencial ML, o sistema MUST reler a credencial **fresca** do banco e **reavaliar** a decisão de renovação antes de executar o refresh, em vez de agir sobre o snapshot capturado antes do lock.
- **FR-008**: Se a releitura fresca dentro do lock indicar que outra operação já renovou (existe access token válido / a decisão passa a ser "reaproveitar"), o sistema MUST reaproveitar o token novo e **NÃO** tentar renovar novamente com o `refresh_token` já invalidado.
- **FR-009**: O double-check MUST NÃO introduzir renovação desnecessária nem impedir a renovação legítima quando não há concorrência (comportamento single-caller preservado).
- **FR-010**: O leitor de credencial fresca usado no double-check MUST ser injetável por dependência (`opts`), mantendo a lógica de decisão testável sem banco de dados nem variáveis de ambiente.

**Vetor #4 — visibilidade da falha de persistência (P3)**

- **FR-011**: Quando a persistência de uma rotação de credencial ML falhar (eixo OAuth **ou** eixo cookie), o sistema MUST emitir um aviso de log (`logger.warn`) identificando a falha, em vez de engolir silenciosamente a exceção.
- **FR-012**: A mesma falha de persistência MUST registrar um evento durável de observabilidade (novo tipo, ex.: `ops_ml_patch_persist_failed`), seguindo o padrão dos sinais operacionais existentes e presente na allowlist de eventos analíticos.
- **FR-013**: A visibilidade da falha MUST NÃO alterar o contrato best-effort: a persistência que falha **não** pode interromper nem propagar erro para o fluxo de scrape do chamador; o registro do próprio evento durável também é best-effort.

**Transversais (convenções canônicas)**

- **FR-014**: A lógica nova de decisão (double-check) e de tratamento de rotação de cookie no scrape MUST ser exercitada por testes `node:test` db-free/env-free, com dependências injetadas por `opts`.
- **FR-015**: O trabalho MUST NÃO duplicar a lógica de cookie que já existe em `src/converters/mercadolivre.js` (reutilizar/extrair, não reimplementar) e MUST NÃO alterar a superfície pública de `manager.js`.
- **FR-016**: O item **#2 do diagnóstico** (consolidar as múltiplas chamadas de `fetchProductInfo` por oferta no `offerEngine`) MUST permanecer FORA de escopo desta feature.

### Key Entities *(include if feature involves data)*

- **Credencial do Mercado Livre (`Credential.data`)**: segredo cifrado em repouso (D-3) que contém o cookie de sessão (`ssid`) e/ou tokens OAuth (`access_token`, `refresh_token`, validade). É lida e potencialmente **rotacionada** tanto no eixo de afiliado quanto no scrape web; é a entidade cuja vida útil esta feature busca preservar.
- **Rotação de cookie (`Set-Cookie` da resposta web)**: cookie(s) que o ML devolve na resposta do scrape web e que, se não persistidos, fazem o sistema reenviar um `ssid` velho. Pode representar atualização (novo valor) ou deleção (a ser ignorada como sobrescrita).
- **Decisão de renovação OAuth**: resultado (renovar / reaproveitar) computado a partir do estado da credencial; passa a ser recalculado sob leitura fresca dentro do lock.
- **Evento de falha de persistência (`ops_ml_patch_persist_failed`)**: registro durável de observabilidade emitido quando uma rotação (OAuth ou cookie) não pôde ser gravada.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em uma janela de uso representativa que exercita o scrape web de título/preço, 100% das rotações de cookie `ssid` devolvidas pelo ML são persistidas e reutilizadas na chamada seguinte (nenhuma rotação descartada nesse caminho).
- **SC-002**: Nenhuma resposta de deleção/expiração de cookie do ML resulta em `ssid` válido apagado — 0 ocorrências de sobrescrita por vazio.
- **SC-003**: Sob duas operações concorrentes que decidiriam renovar o mesmo token, no máximo uma renovação OAuth é executada; a outra reaproveita o token novo — 0 tentativas de refresh com `refresh_token` já invalidado atribuíveis a este cenário.
- **SC-004**: 100% das falhas de persistência de rotação (OAuth ou cookie) produzem um aviso de log e um evento durável de observabilidade; 0 falhas silenciosas.
- **SC-005**: Nenhuma falha de persistência interrompe o fluxo de scrape — a taxa de sucesso de leitura de título/preço para o chamador é preservada mesmo quando a gravação da rotação falha.
- **SC-006**: A vida útil observada da credencial ML entre recadastros aumenta de forma mensurável em relação ao baseline pós-005, sem recadastro manual dentro da janela.
- **SC-007**: A lógica nova é coberta por testes automatizados que rodam sem banco de dados nem variáveis de ambiente, todos passando.

## Assumptions

- O mecanismo de lock de credencial (`withMercadoLivreCredentialLock`) e o mecanismo de patch de credencial (`__onCredentialPatch` / `persistCredentialPatch`) já existentes na base são a fundação reutilizada — esta feature os estende, não os substitui.
- A lógica de tratamento de `Set-Cookie` do eixo de afiliado (`buildCredentialPatchFromSetCookie` / `mergeSetCookieIntoJar` / `parseSetCookieLine`) já trata corretamente a deleção de cookie e é a fonte a reutilizar; se necessário, será extraída para um ponto compartilhado sem mudar seu comportamento.
- O padrão de allowlist de `AnalyticsEvent` (`src/analytics.js`) e o padrão de sinais operacionais (`src/observability/operationalSignals.js`) são a referência para o novo evento de falha de persistência.
- A validação de vida útil real da sessão (SC-006) só é conclusiva em staging/produção com credencial ML real; os demais critérios são verificáveis por testes db-free/env-free.
- O fluxo de desenvolvimento segue a convenção canônica do repositório: branch a partir de `develop`, PR contra `develop`, validação em staging antes de `main`.
- O item #2 do diagnóstico (consolidação de chamadas no `offerEngine`) será tratado, se for o caso, em uma feature separada.
