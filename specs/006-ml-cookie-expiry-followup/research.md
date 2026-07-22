# Phase 0 — Research: Follow-up da expiração de credenciais do ML

Diagnóstico por leitura de código (sem rede/DB real). Cada vetor abaixo tem evidência no source atual e a decisão técnica correspondente. O item **#2 (consolidar chamadas de `fetchProductInfo` no `offerEngine`) está FORA de escopo** (FR-016) e não é pesquisado aqui.

## Vetor #1 — rotação de cookie `ssid` descartada no scrape web (P1/ALTA)

### Evidência

- `fetchHtml` (`src/converters/productInfoScraper.js:179`) envia `Cookie: cookieHeader` mas retorna apenas `{ html, finalUrl }` (linhas 190/193/196). O `Set-Cookie` da resposta (`res.headers.getSetCookie()`) é **descartado**.
- No ramo autenticado de ML de `fetchProductInfo` (retry com `mlCookieHeader`, ~linhas 895-919) a credencial do usuário está em jogo e o objeto `mlCredentials` carrega `__onCredentialPatch` (montado por `offerEngine.js:151-152` e `mirrorTemplate.js:88-89`). Ou seja: **existe** gancho de persistência disponível nesse caminho, mas ele nunca é chamado para cookie de scrape.
- A lógica robusta de tratar `Set-Cookie` já existe em `src/converters/mercadolivre.js`: `buildCredentialPatchFromSetCookie` (500), `mergeSetCookieIntoJar` (479), `parseSetCookieLine` (459) + helpers `getSetCookieLines` (444), `parseCookieHeader` (432), `serializeCookieJar` (491). Todos **module-private** (não exportados) e usados hoje só no eixo de afiliado (`checkMercadoLivreSession`).

### Decisão

- **Extrair** os seis helpers para um módulo puro novo `src/converters/mercadolivreCookieRotation.js`, sem mudar comportamento; `mercadolivre.js` passa a importá-los (uma fonte de verdade). Cumpre FR-002/FR-015 (reutilizar sem duplicar) e evita exportar internals de um arquivo grande de conversão.
- `fetchHtml` passa a expor os `Set-Cookie` ao chamador. Formato escolhido: retornar `setCookie: string[]` (via `res.headers.getSetCookie?.() ?? []`) além de `{ html, finalUrl }` — array compatível com `getSetCookieLines` (que aceita `set-cookie` como array). Retorno vazio quando não há rotação.
- No ramo ML autenticado, construir o patch via `buildCredentialPatchFromSetCookie(creds, mlCookieHeader, { 'set-cookie': setCookie })` e, se não-nulo, persistir por `mlCredentials.__onCredentialPatch('mercadolivre', patch)`.
- **Invariante de deleção grátis**: `parseSetCookieLine` já ignora `ssid=` vazio / `Max-Age=0` / `Expires` no passado (mercadolivre.js:475-476, 484-485) e `serializeCookieJar` filtra valor vazio (492-497). Reusar = herdar FR-004/SC-002 sem reimplementar.
- **Sem escrita desnecessária (FR-006)**: `buildCredentialPatchFromSetCookie` retorna `null` quando nenhum nome muda (mercadolivre.js:505-506); só persistimos patch não-nulo.

### Alternativas rejeitadas

- **Exportar os helpers direto de `mercadolivre.js`**: funciona, mas expõe internals de um módulo de 1000+ linhas e acopla o scraper ao conversor. Extração para módulo puro é mais limpa e testável isoladamente.
- **Reimplementar parsing de cookie no scraper**: viola FR-002/FR-015 e duplicaria a lógica de deleção (fonte provável de regressão). Rejeitado.
- **Persistir direto via `persistCredentialPatch` no scraper**: acoplaria o scraper ao DB; o gancho `__onCredentialPatch` já resolve isso mantendo o scraper puro/testável.

## Vetor #3 — refresh OAuth concorrente queima o `refresh_token` single-use (P2/MÉDIA)

### Evidência

- `getMlUserToken` (`productInfoScraper.js:400-413`) chama `buildOAuthRefreshDecision(mlCredentials, Date.now())` **antes** de entrar em `withMercadoLivreCredentialLock` (406). Dentro do lock, `refreshMlOAuthToken` usa `mlCredentials.oauthRefreshToken` do **snapshot pré-lock** (386).
- O comentário em 364-373 já reconhece a corrida: o lock serializa, mas a 2ª chamada, ao entrar, ainda tenta refresh com o `refresh_token` que a 1ª já invalidou (ML rotaciona single-use), resultando em `!res.ok` (390) e uma chamada desperdiçada ao ML.

### Decisão

- **Double-checked locking**: mover a decisão para **dentro** do lock, sobre uma **releitura fresca** da credencial. Fluxo novo em `getMlUserToken`:
  1. `decision = buildOAuthRefreshDecision(mlCredentials, now)` — barato, fora do lock, para curto-circuitar `skip`/`reuse` sem lock (FR-009, single-caller inalterado no caminho feliz).
  2. Se `refresh`, entrar no lock e **reler** a credencial fresca: `const fresh = await opts.readFreshCredential(mlCredentials) ?? mlCredentials`.
  3. Recomputar `buildOAuthRefreshDecision(fresh, Date.now())`. Se agora for `reuse` (outra operação já renovou), devolver o token novo **sem** chamar o ML. Se ainda `refresh`, renovar usando o `refresh_token` **fresco** e persistir.
- **Leitor injetável por `opts` (FR-010)**: `getMlUserToken(mlCredentials, opts = {})` ganha `opts.readFreshCredential` (default: lê `Credential` por `userId` derivado de `mlCredentials`, decifra via `parseCredentialData`; testes injetam stub que devolve o estado "pós-primeira-renovação"). Mantém a lógica pura/testável sem DB.
- A releitura usa `parseCredentialData` (D-3): decifra `v1:...` transparentemente e tolera texto puro/legado.

### Alternativas rejeitadas

- **Cache in-memory do último access token por credencial**: adiciona estado/entropia e não cobre concorrência entre processos (worker vs. API). O lock + releitura fresca do banco é a fonte de verdade correta e sem novo estado.
- **Deixar como está (best-effort)**: aceitável para robustez do scrape, mas desperdiça uma rotação e uma chamada ao ML por corrida — exatamente o que a feature quer eliminar (SC-003).
- **Persistência atômica com CAS/optimistic lock no `refresh_token`**: sobre-engenharia; o lock por credencial já serializa, só faltava a releitura.

## Vetor #4 — falha de persistência engolida em silêncio (P3/visibilidade)

### Evidência

- O bloco que persiste o patch OAuth em `fetchMercadoLivreItemInfo` (`productInfoScraper.js:427-431`) tem `try { await __onCredentialPatch(...) } catch {}` vazio. O mesmo padrão silencioso se repetirá no novo caminho de cookie (#1). Uma escrita perdida (`SQLITE_BUSY`) queima rotação single-use sem sinal.
- `src/observability/operationalSignals.js` já define o padrão: mapa `name→ops_evento` (linhas 18-37), `recordOperationalSignal(name, metadata)` (59) com contador in-memory + emissão durável best-effort em `AnalyticsEvent` via `trackAnalyticsEventSafe`. A allowlist vive em `src/analytics.js` (`ANALYTICS_EVENTS`, 21-81).

### Decisão

- Novo sinal `ml_patch_persist_failed` → evento durável `ops_ml_patch_persist_failed`:
  - `src/observability/operationalSignals.js`: adicionar `ml_patch_persist_failed: 'ops_ml_patch_persist_failed'` ao mapa.
  - `src/analytics.js`: adicionar `'ops_ml_patch_persist_failed'` ao `ANALYTICS_EVENTS`.
- Nos dois `catch` (OAuth e cookie), substituir o bloco vazio por: `logger.warn` identificando o eixo + `recordOperationalSignal('ml_patch_persist_failed', { axis: 'oauth' | 'cookie' })`.
- **Contrato best-effort preservado (FR-013)**: `recordOperationalSignal` já trata a emissão durável como best-effort (o contador in-memory é a fonte confiável; a escrita do `AnalyticsEvent` pode falhar sob o mesmo `SQLITE_BUSY` e tudo bem). O `catch` continua não propagando — só passa a **registrar** antes de seguir.

### Alternativas rejeitadas

- **`logger.error` + throw**: violaria o contrato best-effort (FR-013) — a falha de persistência não pode quebrar o scrape.
- **Novo módulo de observabilidade dedicado**: `operationalSignals.js` já é exatamente o padrão canônico para isso; reusar reduz superfície.
- **Metadata com o valor do cookie/token**: proibido — nada de segredo em `AnalyticsEvent`; a metadata leva só o eixo (`oauth`/`cookie`), sem PII/segredo.

## Convenções canônicas aplicadas (AGENTS.md)

- **D-3**: toda escrita via `persistCredentialPatch`→`encryptCredential` (idempotente); toda leitura via `parseCredentialData`.
- **node:test db-free/env-free** com injeção por `opts` (leitor de credencial fresca, `fetch`, `recordOperationalSignal`).
- **Reutilizar, não duplicar**: extração dos helpers de cookie para módulo compartilhado; reuso de `mlOAuthTokenPolicy.js`, `withMercadoLivreCredentialLock`, `operationalSignals.js`.
- **AnalyticsEvent allowlist**: novo tipo registrado nos dois lugares (mapa + allowlist).
- **Sem RAM relevante / sem processo/Redis/migration**: nada novo persistente em memória; sem schema change.
- **Fora de escopo**: item #2 (consolidação no `offerEngine`) não é tocado.
