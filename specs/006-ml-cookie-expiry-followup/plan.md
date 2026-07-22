# Implementation Plan: Follow-up da expiração de credenciais do Mercado Livre (vetores remanescentes)

**Branch**: `006-ml-cookie-expiry-followup` | **Date**: 2026-07-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-ml-cookie-expiry-followup/spec.md`

## Summary

Follow-up direto de `specs/005-ml-cookie-expiry`. A 005 matou a causa-raiz principal (persistir a rotação do `refresh_token` OAuth single-use em `getMlUserToken` + cache TTL na sondagem do painel), mas um pente fino encontrou **três vetores remanescentes** que continuam encurtando a vida da sessão ou escondendo falhas. Esta feature fecha **apenas** #1, #3 e #4 (o #2 — consolidar chamadas de `fetchProductInfo` no `offerEngine` — fica **fora**).

**#1 (ALTA) — rotação de cookie `ssid` descartada no scrape web.** `fetchHtml` (`src/converters/productInfoScraper.js`) envia o cookie `ssid` do usuário para a página web do produto ML mas retorna só `{ html, finalUrl }` — o `Set-Cookie` da resposta é jogado fora. É a mesma classe do bug de rotação já corrigido, mas no eixo **cookie** e num caminho de **alta frequência** (painel "Criar oferta" via `buildScrapedOffer`/`offerEngine`; espelhamento em modo template via `mirrorTemplate`). Correção: `fetchHtml` passa a expor os cabeçalhos `Set-Cookie` ao chamador; `fetchProductInfo`, no ramo autenticado de ML (o retry com `mlCookieHeader`, onde há `mlCredentials.__onCredentialPatch`), constrói o patch de cookie **reutilizando** `buildCredentialPatchFromSetCookie`/`mergeSetCookieIntoJar`/`parseSetCookieLine` já existentes em `src/converters/mercadolivre.js` (extraídos para um ponto compartilhado, sem duplicar nem mudar comportamento) e persiste via `__onCredentialPatch` (→ `persistCredentialPatch`, D-3). A invariante de deleção (`ssid=` vazio / `Max-Age=0` / `Expires` no passado nunca sobrescreve) vem de graça por reusar exatamente essa lógica.

**#3 (MÉDIA) — refresh OAuth concorrente queima o `refresh_token` single-use.** `getMlUserToken` calcula `buildOAuthRefreshDecision` sobre o snapshot capturado **antes** de entrar em `withMercadoLivreCredentialLock`; dentro do lock não há releitura fresca. Duas chamadas concorrentes decidem "refresh" sobre o mesmo snapshot e a segunda tenta renovar com um `refresh_token` já invalidado pela primeira. Correção: **double-checked locking** — dentro do lock, reler a credencial fresca do banco e recomputar a decisão; se já houver access token válido, **reaproveitar** em vez de renovar. O leitor de credencial fresca é injetado por `opts` (default lê `Credential` por `userId`; testes injetam stub) para manter a lógica pura e db-free.

**#4 (BAIXA, visibilidade) — falha de persistência engolida em silêncio.** Os `catch {}` que envolvem `__onCredentialPatch` (eixos OAuth e cookie) escondem uma escrita perdida (ex.: `SQLITE_BUSY`) — queima uma rotação single-use indistinguível de sucesso. Correção: no `catch`, emitir `logger.warn` + registrar sinal operacional durável `ops_ml_patch_persist_failed` (novo tipo na allowlist de `src/analytics.js`, roteado por `src/observability/operationalSignals.js`), mantendo o contrato best-effort (a falha de persistência — e o próprio registro do evento — nunca quebram o fluxo de scrape do chamador).

Sem novos processos PM2, sem Redis, sem migration de schema, sem aumento relevante de RAM. Correção **backend-only**, cirúrgica, concentrada em `productInfoScraper.js` + um módulo de cookie compartilhado + a allowlist de analytics.

## Technical Context

**Language/Version**: Node.js (ESM), mesma versão do runtime do repo (sem bump).

**Primary Dependencies**: `fetch` nativo/undici (scrape de HTML + OAuth token/refresh; `res.headers.getSetCookie()` para expor `Set-Cookie`), Prisma/SQLite (`Credential`), `src/credentialCrypto.js` (D-3 AES-256-GCM via `encryptCredential`), `src/credentialHealth.js` (`parseCredentialData`), `src/credentialPatch.js` (`persistCredentialPatch`), `src/converters/mercadolivreCredentialLock.js` (`withMercadoLivreCredentialLock`), `src/converters/mlOAuthTokenPolicy.js` (`buildOAuthRefreshDecision`/`applyOAuthTokenResponse`, da 005), `src/observability/operationalSignals.js` (`recordOperationalSignal`).

**Storage**: SQLite via Prisma — tabela `Credential` (`userId_platform` único), campo `data` cifrado (`v1:<iv>:<tag>:<ct>`). **Sem migration de schema**: o patch de cookie reusa os mesmos campos (`cookie`/`ssid`/`csrf`/`id`) já escritos pelo eixo de afiliado; o novo evento durável grava em `AnalyticsEvent`, tabela existente.

**Testing**: `node --test` (node:test), db-free/env-free, injeção de dependência via `opts`/parâmetros e stubs de `fetch`/leitor de credencial. Novos testes puros: tratamento de rotação de cookie no scrape (a partir de `Set-Cookie` simulado), decisão double-check sob releitura fresca, e emissão de sinal na falha de persistência. Alvos a estender: `test/product-info-scraper.test.js`, `test/mercadolivre-session.test.js` (regressão do eixo cookie do afiliado após a extração), `test/observability-operational-signals.test.js`.

**Target Platform**: API Fastify em prod/staging (VPS Linux, PM2 `api`/`api-staging`); scrape web de ML consumido pelo painel "Criar oferta" (`POST /api/link-conversion/scrape-offer` → `offerEngine.buildScrapedOffer`) e pelo espelhamento em modo template (`src/core/mirrorTemplate.js`, no `bot-worker`). Ambos já entregam `mlCredentials` com `__onCredentialPatch` ligado.

**Project Type**: web-service (backend Node + dashboard Next) — correção **backend-only**; nenhuma superfície pública muda (`fetchProductInfo` continua retornando `{ title, oldPrice, newPrice, finalUrl }`; a persistência de rotação é efeito colateral best-effort via `__onCredentialPatch`).

**Performance Goals**: capturar 100% das rotações de cookie no caminho de alta frequência sem custo perceptível (uma leitura de cabeçalho já disponível na resposta); o double-check adiciona no máximo **uma** leitura de `Credential` por refresh de token efetivo (só quando `decision.action === 'refresh'`), atrás do lock que já existe — sem chamada extra à API do ML e eliminando a chamada desperdiçada do 2º caller concorrente.

**Constraints**: D-3 (toda escrita de `Credential.data` cifra via `encryptCredential`, idempotente; leitura tolera texto puro via `parseCredentialData`); invariante de deleção — nunca sobrescrever `ssid` válido por vazio (herdada da lógica reutilizada); **não duplicar** a lógica de cookie de `mercadolivre.js` (extrair para ponto compartilhado sem mudar comportamento — FR-002/FR-015); **não alterar** a superfície pública de `manager.js` (FR-015); best-effort — persistência que falha não interrompe nem propaga erro ao scrape (FR-013); `AnalyticsEvent` só persiste tipos na allowlist (FR-012); item #2 permanece fora (FR-016); fluxo canônico feature→develop→staging→main. Sem aumento relevante de RAM (nenhum cache/estado novo; sinais operacionais reusam o buffer in-memory existente).

**Scale/Scope**: alterações localizadas em `src/converters/productInfoScraper.js` (fetchHtml expõe Set-Cookie; ramo ML autenticado persiste rotação de cookie; `getMlUserToken` double-check dentro do lock; catches de persistência emitem sinal), **extração** dos helpers de cookie de `src/converters/mercadolivre.js` para `src/converters/mercadolivreCookieRotation.js` (novo, puro), 1 linha nova na allowlist de `src/analytics.js`, 1 entrada no mapa de `src/observability/operationalSignals.js`. Baixo risco: reusa mecanismos já em produção (patch/lock/D-3) e não toca no eixo de afiliado (`createLink`) nem no caminho de produto/fallback não-ML.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` está no estado template (não ratificado), portanto não impõe gates formais. Na ausência dele, os gates canônicos aplicáveis vêm do `AGENTS.md` e estão todos satisfeitos por design:

- **Fluxo de branches**: trabalho em `006-ml-cookie-expiry-followup` → PR para `develop` → autodeploy staging → validação manual → PR `develop→main`. Nunca direto para `main`; nunca amend em commit mergeado. **PASS**
- **Criptografia D-3**: toda persistência de rotação (cookie e OAuth) passa por `persistCredentialPatch` → `encryptCredential(JSON.stringify(...))` (idempotente); leitura via `parseCredentialData` (tolera texto puro/legado). Nenhum segredo em texto puro; a releitura fresca do double-check decifra pelo mesmo caminho. **PASS**
- **Testes node:test db-free/env-free**: tratamento de cookie no scrape, decisão double-check e emissão de sinal na falha são exercitados por funções puras com `fetch`/leitor de credencial/`recordOperationalSignal` injetados ou stubbed; sem rede/DB real. **PASS**
- **Injeção de dependência via `opts`**: o leitor de credencial fresca do double-check é injetado por `opts` (default real + override em teste); o gancho de persistência já chega via `mlCredentials.__onCredentialPatch`. **PASS**
- **Reutilizar, não duplicar (FR-002/FR-015)**: os helpers de cookie são **extraídos** para `mercadolivreCookieRotation.js` e reimportados por `mercadolivre.js` **sem mudar comportamento** — uma única fonte de verdade para os dois eixos (afiliado e scrape). `manager.js` não muda. **PASS**
- **AnalyticsEvent allowlist**: `ops_ml_patch_persist_failed` é adicionado a `ANALYTICS_EVENTS` em `src/analytics.js` e ao mapa de `operationalSignals.js`, seguindo o padrão dos demais `ops_*`. **PASS**
- **Política de memória (SUPER SINALIZAR)**: nenhum cache/serviço/processo novo, sem Redis; os sinais operacionais reusam contadores in-memory já existentes (footprint desprezível). **PASS**
- **Sem troca de portas / processos PM2 / migrations / mudança de RAM relevante**: nenhuma. **PASS**

Sem violações a justificar em Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/006-ml-cookie-expiry-followup/
├── plan.md              # Este arquivo (/speckit-plan)
├── research.md          # Fase 0: evidências por vetor + decisões técnicas
├── data-model.md        # Fase 1: entidades (credencial, rotação cookie, decisão OAuth, evento de falha)
├── quickstart.md        # Fase 1: guia de validação (node:test + staging)
├── contracts/
│   ├── cookie-rotation-scrape.md   # Contrato do módulo de cookie compartilhado + fetchHtml/fetchProductInfo
│   ├── oauth-double-check.md       # Contrato de getMlUserToken com releitura fresca sob lock
│   └── persist-failure-signal.md   # Contrato do sinal ops_ml_patch_persist_failed
└── tasks.md             # Fase 2 (/speckit-tasks — NÃO criado aqui)
```

### Source Code (repository root)

```text
src/
├── converters/
│   ├── mercadolivreCookieRotation.js   # NOVO (módulo puro, db-free/env-free): buildCredentialPatchFromSetCookie,
│   │                                   #   mergeSetCookieIntoJar, parseSetCookieLine, getSetCookieLines,
│   │                                   #   parseCookieHeader, serializeCookieJar — EXTRAÍDOS de mercadolivre.js
│   │                                   #   SEM mudar comportamento (fonte única para afiliado + scrape).
│   ├── mercadolivre.js                 # ALTERAR (mínimo): passa a IMPORTAR os helpers do módulo novo em vez
│   │                                   #   de defini-los localmente (eixo afiliado inalterado; regressão coberta).
│   ├── productInfoScraper.js           # ALTERAR:
│   │                                   #   (a) fetchHtml expõe Set-Cookie (setCookie[]/headers) ao chamador (#1);
│   │                                   #   (b) ramo ML autenticado constrói patch de cookie via módulo novo e
│   │                                   #       persiste via mlCredentials.__onCredentialPatch (#1);
│   │                                   #   (c) getMlUserToken relê credencial fresca DENTRO do lock e recomputa
│   │                                   #       a decisão (double-check); leitor injetado por opts (#3);
│   │                                   #   (d) catches de __onCredentialPatch (cookie e OAuth) emitem
│   │                                   #       logger.warn + recordOperationalSignal('ml_patch_persist_failed') (#4).
│   └── mlOAuthTokenPolicy.js           # SEM MUDANÇA (buildOAuthRefreshDecision/applyOAuthTokenResponse já puros);
│                                       #   reusado pela releitura fresca do double-check.
├── observability/
│   └── operationalSignals.js           # ALTERAR: +1 entrada no mapa nome→evento
│                                       #   (ml_patch_persist_failed → ops_ml_patch_persist_failed).
└── analytics.js                        # ALTERAR: +1 linha em ANALYTICS_EVENTS ('ops_ml_patch_persist_failed').

test/
├── mercadolivre-cookie-rotation.test.js      # NOVO: helpers extraídos (rotação mescla; deleção ignorada;
│                                             #   patch null quando nada muda; jar nunca serializa valor vazio).
├── product-info-scraper.test.js              # ESTENDER: fetchHtml expõe Set-Cookie; ramo ML persiste rotação
│                                             #   de cookie via __onCredentialPatch; getMlUserToken double-check
│                                             #   reaproveita token novo sob releitura fresca; falha de persistência
│                                             #   emite sinal sem quebrar o fluxo.
├── mercadolivre-session.test.js              # ESTENDER: regressão do eixo afiliado após a extração (comportamento
│                                             #   idêntico ao anterior).
└── observability-operational-signals.test.js # ESTENDER: ml_patch_persist_failed roteia para ops_ml_patch_persist_failed.
```

**Structure Decision**: web-service existente; correção **backend-only** e cirúrgica. A decisão-chave é **extrair** os helpers de cookie de `mercadolivre.js` para um módulo puro compartilhado (`mercadolivreCookieRotation.js`) e reimportá-los nos dois eixos — cumpre FR-002/FR-015 (reutilizar sem duplicar) mantendo o eixo de afiliado byte-a-byte no mesmo comportamento (protegido por regressão). O eixo #1 reusa o gancho `__onCredentialPatch`/`persistCredentialPatch` e o D-3 já em produção; o #3 reusa `withMercadoLivreCredentialLock` e `mlOAuthTokenPolicy.js` da 005, adicionando só a releitura fresca injetável; o #4 reusa `operationalSignals.js` + allowlist de `analytics.js`. Nada de cache/processo/Redis novo, nenhuma superfície pública alterada.

## Complexity Tracking

> Sem violações de constituição. Tabela não aplicável.
