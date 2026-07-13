# Implementation Plan: Investigação e correção da expiração rápida dos cookies/tokens do Mercado Livre

**Branch**: `005-ml-cookie-expiry` | **Date**: 2026-07-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-ml-cookie-expiry/spec.md`

## Summary

A credencial de afiliada do Mercado Livre (`Credential.data`, `platform='mercadolivre'`, cifrada em repouso via D-3) expira em horas/poucos dias em vez do horizonte natural de dias/semanas. A investigação por leitura de código encontrou **dois eixos independentes**, e o padrão da Amazon (`specs/001-amazon-cookie-expiry`) só se aplica **parcialmente** porque o ML tem dois mecanismos de sessão (cookie `ssid` + OAuth) e não um só.

**Eixo cookie `ssid` — já em conformidade (nada a regredir).** Diferente da Amazon (que descartava a rotação na sondagem do painel por falta do gancho), o caminho de cookie do ML **já** persiste a rotação em todos os pontos: `buildCredentialPatchFromSetCookie`/`mergeSetCookieIntoJar` produzem o patch, `checkMercadoLivreSession` o **retorna** como `credentialPatch`, a rota `GET /mercadolivre/session` persiste cifrando via `encryptCredential`, e os caminhos worker/linkConversion persistem via `notifyCredentialPatch`/`__onCredentialPatch`. Deleção de cookie (valor vazio/`Max-Age=0`/`Expires` no passado) já é ignorada; transitório (rede/403/429) já é `alive:null`; uso concorrente já é serializado por `withMercadoLivreCredentialLock`. Esse eixo entra na investigação como **causas CONFIRMADAS-já-tratadas** (cobrir por teste de regressão), não como correção nova.

**Eixo OAuth — causa raiz nova CONFIRMADA (a corrigir).** `getMlUserToken` em `src/converters/productInfoScraper.js` faz `grant_type=refresh_token` quando o access token expirou, mas **descarta** o resultado: retorna `data.access_token` e **nunca persiste** `oauthAccessToken`/`oauthTokenExpiry` nem o `refresh_token` rotacionado que o ML devolve. Como o refresh token do ML é **rotativo/single-use** (cada refresh invalida o anterior e emite um novo), não persistir o novo `refresh_token` invalida a sessão OAuth no refresh seguinte → a credencial "morre" e exige recadastro. Não há gancho de persistência nesse caminho (o `mlCredentials` chega como objeto puro de `offerEngine`/`mirrorTemplate`, sem `__onCredentialPatch`).

**Sondagem do painel sem cache — agravante CONFIRMADO (a corrigir).** A rota `GET /mercadolivre/session` **não** tem cache TTL (a `GET /amazon/session` ganhou um na feature 001). Cada carregamento do painel dispara um `createLink`-probe real ao ML; N aberturas = N chamadas, aumentando tráfego e consumo de rotação de cookie.

**Correção mínima e segura:** (1) `getMlUserToken` passa a **retornar o patch OAuth** (`oauthAccessToken`, `oauthTokenExpiry`, `oauthRefreshToken` novos) além do token, extraindo a decisão de refresh para um **módulo puro/testável** (`buildOAuthRefreshDecision`/`applyOAuthTokenResponse`); a persistência é feita por quem tem acesso ao DB (rota/worker) via `encryptCredential`, ou por um gancho `__onCredentialPatch` quando disponível — espelhando o mesmo contrato "retorna patch, chamador persiste" já usado no cookie. (2) **cache TTL curto por usuário** na sondagem `GET /mercadolivre/session`, reusando o padrão do `amazonSessionProbeCache.js` (módulo puro por `userId`, só cacheia resultado definitivo `alive true/false`, invalida no `PUT /mercadolivre`). (3) visibilidade operacional (log/contador) de sondagem efetiva vs. servida por cache e de refresh OAuth persistido, para medir SC-001/SC-003. Sem novos processos PM2, sem Redis, sem migration de schema, sem aumento relevante de RAM.

## Technical Context

**Language/Version**: Node.js (ESM), mesma versão do runtime do repo (sem bump)

**Primary Dependencies**: `axios` (`createLink`/probe do ML), `fetch` nativo (OAuth token/refresh), Prisma/SQLite (`Credential`), Fastify (rotas do painel), `src/credentialCrypto.js` (D-3 AES-256-GCM), `src/credentialHealth.js` (`parseCredentialData`), `src/converters/mercadolivreCredentialLock.js` (lock de credencial), `src/converters/amazonSessionProbeCache.js` (referência do cache TTL)

**Storage**: SQLite via Prisma — tabela `Credential` (`userId_platform` único), campo `data` cifrado (`v1:<iv>:<tag>:<ct>`). Sem migration de schema (o patch OAuth reusa o mesmo campo/JSON: `oauthAccessToken`/`oauthRefreshToken`/`oauthTokenExpiry` já existem, escritos por `mlOAuth.js`).

**Testing**: `node --test` (node:test), db-free/env-free, injeção de dependência via `opts`/parâmetros e stubs de `fetch`/`axios`. Alvos existentes: `test/mercadolivre-session.test.js`, `test/mercadolivre-lock.test.js`, `test/mercadolivre-resolve.test.js`. Novos testes puros para a decisão de refresh OAuth e para o cache TTL da sondagem ML.

**Target Platform**: API Fastify em prod/staging (VPS Linux, PM2 `api`/`api-staging`); credencial ML consumida também pelo `bot-worker` (fork), `offerEngine` e `mirrorTemplate`. Dashboard Next chama `GET /mercadolivre/session` ao carregar o painel de credenciais.

**Project Type**: web-service (backend Node + dashboard Next) — correção **backend-only**; a resposta pública da sondagem (`{ configured, alive, reason, checkedAt }`) não muda de forma, então o dashboard não precisa mudar.

**Performance Goals**: reduzir chamadas ao ML por abertura do painel de N→~1 (cache TTL curto); não introduzir latência perceptível no caminho de conversão/scrape; evitar refresh OAuth redundante (reusar access token válido em cache até `oauthTokenExpiry`).

**Constraints**: seguir D-3 (toda escrita de `Credential.data` cifra via `encryptCredential`, idempotente; leitura tolera texto puro via `decryptCredential`/`parseCredentialData`); persistir o `refresh_token` rotacionado (invariante nova: nunca reenviar refresh token velho); preservar distinção transitório vs. sessão morta (FR-008); resiliência a `Set-Cookie` de limpeza (FR-011, já garantida); nunca encaminhar link de terceiro / preservar invariante de comissão (FR-010); fluxo canônico feature→develop→staging→main; validar mudança de semântica de frequência de chamadas em staging antes de prod. Sem aumento significativo de RAM (cache in-memory por usuário é pequeno; sinalizar se crescer — política de memória do projeto).

**Scale/Scope**: correção localizada em `src/converters/productInfoScraper.js` (`getMlUserToken` → retorna patch), `src/api/routes/credentials.js` (rota `/mercadolivre/session` ganha cache + persistência de patch OAuth quando a sondagem também tocar OAuth), um módulo puro para a decisão de refresh OAuth, e reuso/extensão do padrão de cache TTL. Baixo risco: não toca no caminho de cookie `ssid` já correto nem no caminho de produto/fallback do worker.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

O arquivo `.specify/memory/constitution.md` está no estado template (não ratificado), portanto não impõe gates formais. Na ausência dele, os gates canônicos aplicáveis vêm do `AGENTS.md` e estão todos satisfeitos por design:

- **Fluxo de branches**: trabalho em `005-ml-cookie-expiry` → PR para `develop` → autodeploy staging → validação manual → PR `develop→main`. Nunca direto para `main`; nunca amend em commit mergeado. **PASS**
- **Criptografia D-3**: toda persistência de rotação (cookie e OAuth) passa por `encryptCredential(JSON.stringify(...))` (idempotente); leitura via `parseCredentialData`/`decryptCredential` (tolera texto puro/legado). Nenhum segredo em texto puro. **PASS**
- **Testes node:test db-free/env-free**: a decisão de refresh OAuth e o cache TTL são extraídos em funções puras testáveis; `fetch`/`axios`/DB injetados/stubbed; sem rede/DB real no teste. **PASS**
- **Injeção de dependência via `opts`**: rotas já recebem `db`/handlers via `opts`; os novos handlers de cache/refresh seguem o mesmo padrão (default real + override em teste). **PASS**
- **Política de memória (SUPER SINALIZAR)**: o cache é um `Map` por `userId` com TTL curto e poda — footprint desprezível; documentado em research.md com alternativa ainda mais leve (só persistir, sem cache). Nenhum processo/serviço novo, sem Redis. **PASS**
- **Sem troca de portas / processos PM2 / migrations / mudança de RAM relevante**: nenhuma. **PASS**

Sem violações a justificar em Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/005-ml-cookie-expiry/
├── plan.md              # Este arquivo (/speckit-plan)
├── research.md          # Fase 0: diagnóstico com evidências + mapa de consumidores (US2)
├── data-model.md        # Fase 1: entidades (Credencial ML, rotação cookie, patch OAuth, sondagem, cache)
├── quickstart.md        # Fase 1: guia de validação (node:test + staging)
├── contracts/
│   └── mercadolivre-session-probe.md  # Contrato de GET /mercadolivre/session, checkMercadoLivreSession e refresh OAuth
├── checklists/          # (pré-existente do fluxo)
└── tasks.md             # Fase 2 (/speckit-tasks — NÃO criado aqui)
```

### Source Code (repository root)

```text
src/
├── converters/
│   ├── productInfoScraper.js        # ALTERAR: getMlUserToken passa a RETORNAR { token, credentialPatch }
│   │                                #          com oauthAccessToken/oauthTokenExpiry/oauthRefreshToken novos
│   │                                #          (persistir o refresh_token ROTACIONADO). Decisão de refresh
│   │                                #          extraída para módulo puro. Não descartar mais o token renovado.
│   ├── mlOAuthTokenPolicy.js        # NOVO (módulo puro, db-free/env-free): buildOAuthRefreshDecision(creds, now)
│   │                                #          (precisa refresh? reusa access token válido?) e
│   │                                #          applyOAuthTokenResponse(prev, tokenResponse, now) → credentialPatch
│   │                                #          (mescla novos tokens; nunca regride para refresh token velho).
│   ├── mercadolivreSessionProbeCache.js  # NOVO (módulo puro, db-free): TTL cache por userId da sondagem ML
│   │                                #          (getCachedProbe/setCachedProbe/invalidateCachedProbe/pruneExpired),
│   │                                #          espelha src/converters/amazonSessionProbeCache.js. Só cacheia
│   │                                #          resultado definitivo (alive true/false).
│   └── mercadolivre.js              # SEM MUDANÇA no eixo cookie (já persiste rotação corretamente);
│                                    #          coberto por teste de regressão (não regredir).
├── api/routes/
│   ├── credentials.js               # ALTERAR: rota GET /mercadolivre/session aplica cache TTL antes de sondar
│   │                                #          (espelha o bloco de /amazon/session) e, se a sondagem/refresh
│   │                                #          devolver credentialPatch OAuth, persiste cifrado via encryptCredential.
│   │                                #          PUT /mercadolivre invalida o cache do probe (renovação imediata).
│   └── mlOAuth.js                   # SEM MUDANÇA (troca de code→token no callback já persiste cifrado);
│                                    #          documentado no mapa de consumidores.

test/
├── ml-oauth-token-policy.test.js         # NOVO: buildOAuthRefreshDecision / applyOAuthTokenResponse (puro).
│                                         #        refresh token rotacionado é persistido; access válido é reusado;
│                                         #        falha transitória não zera tokens; idempotência de patch.
├── mercadolivre-session-probe-cache.test.js  # NOVO: TTL/poda/expiração/invalidação do cache puro.
├── credentials-mercadolivre-session-route.test.js  # NOVO: rota persiste patch cifrado; cache evita 2ª sondagem.
├── mercadolivre-session.test.js          # ESTENDER: regressão do eixo cookie (patch retornado; deleção ignorada).
└── product-info-scraper.test.js (se houver) # ESTENDER: getMlUserToken retorna patch e persiste refresh rotacionado.
```

**Structure Decision**: web-service existente; correção **backend-only** e cirúrgica. A escolha de **retornar o patch** (tanto no cookie — já feito — quanto no novo eixo OAuth) mantém os conversores/scrapers puros e testáveis sem acoplar DB, e reusa o padrão canônico já em produção (`checkMercadoLivreSession` retorna `credentialPatch`; a rota persiste cifrando). O cache TTL da sondagem ML reusa 1:1 o padrão de `amazonSessionProbeCache.js` (feature 001) para reduzir risco por reaproveitamento de código validado. O eixo cookie `ssid` **não é tocado** (já correto), reduzindo superfície de regressão.

## Complexity Tracking

> Sem violações de constituição. Tabela não aplicável.
