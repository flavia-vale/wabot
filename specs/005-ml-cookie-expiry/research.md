# Research & Diagnóstico: Expiração rápida dos cookies/tokens do Mercado Livre

**Feature**: 005-ml-cookie-expiry | **Date**: 2026-07-13

Este documento atende a **US2 / FR-001 / FR-002 / SC-005**: veredito (confirmada / descartada / inconclusiva) para cada causa provável, com evidência de código, e o mapa completo dos pontos que leem/consomem a credencial ML.

## Natureza do ML: dois mecanismos de sessão (≠ Amazon)

A credencial ML (`Credential.data`, `platform='mercadolivre'`) carrega **dois** tipos de segredo, cifrados juntos no mesmo JSON:

1. **Cookie de sessão de afiliado** (`ssid` / `cookie` / `csrf` / `id`): usado por `createLink`/probe (`src/converters/mercadolivre.js`) para gerar o short link de afiliado e checar a saúde da sessão. Rotaciona via `Set-Cookie` — **análogo direto** ao caso Amazon.
2. **Tokens OAuth** (`oauthAccessToken` / `oauthRefreshToken` / `oauthTokenExpiry`): escritos por `src/api/routes/mlOAuth.js` (callback de autorização) e consumidos por `getMlUserToken` em `src/converters/productInfoScraper.js` para chamar a API pública `api.mercadolibre.com/items/...`. **Sem equivalente na Amazon.**

O padrão da Amazon (persistir rotação de `Set-Cookie` + cache TTL no probe) cobre o eixo (1). O eixo (2) é **específico do ML** e é onde está a causa raiz nova.

## Mapa de TODOS os pontos que consomem a credencial ML (FR-002)

| # | Ponto | Arquivo | Segredo usado | Recebe rotação? | Persiste? |
|---|---|---|---|---|---|
| 1 | Sondagem de sessão do painel | `src/api/routes/credentials.js:37-53` (`GET /mercadolivre/session`) | cookie `ssid` | Sim (`Set-Cookie`) | **Sim** — retorna `credentialPatch`, rota cifra via `encryptCredential`. **Gap: sem cache TTL** (bate no ML a cada load) |
| 2 | Checagem de sessão (converter) | `src/converters/mercadolivre.js:605` (`checkMercadoLivreSession`) | cookie `ssid` | Sim | **Sim** — retorna `credentialPatch` (chamador persiste); serializado por `withMercadoLivreCredentialLock` |
| 3 | Geração de link de afiliado | `src/converters/mercadolivre.js:625` (`createAffiliateLink` → `callCreateLinkApi`) | cookie `ssid` | Sim | **Sim** — `credentialPatch` propagado via `notifyCredentialPatch`/`__onCredentialPatch` |
| 4 | Conversão em grupo (bot) | `src/bot-worker.js` (fornece `__onCredentialPatch`) | cookie `ssid` | Sim | **Sim** — gancho persiste patch |
| 5 | Painel "converter link" | `src/api/routes/linkConversion.js` | cookie `ssid` + OAuth (via `fetchProductInfo`) | Sim (cookie) | **Sim** (cookie); OAuth ver #7 |
| 6 | Callback OAuth (troca code→token) | `src/api/routes/mlOAuth.js:98-111` | OAuth (grava tokens iniciais) | N/A (grava, não rotaciona) | **Sim** — `encryptCredential`, merge com dados existentes |
| 7 | **Scrape de item via API OAuth** | `src/converters/productInfoScraper.js` (`getMlUserToken`) | OAuth `oauthRefreshToken` | **Sim** (refresh → novo access + novo refresh token) | **Sim (pós-fix T009/T010)** — retorna `{ token, credentialPatch }`; `fetchMercadoLivreItemInfo` persiste via `mlCredentials.__onCredentialPatch('mercadolivre', credentialPatch)` quando o gancho está disponível (mesmo padrão do eixo cookie). ~~Antes: descartava o token renovado~~ |
| 8 | Motor de oferta / template espelhado | `src/converters/offerEngine.js:151,205`; `src/core/mirrorTemplate.js:89` | OAuth (passa `mlCredentials` puro) | via #7 | **Persiste quando `__onCredentialPatch` disponível** (herda o fix de #7); sem o gancho, comportamento é best-effort no-op (patch calculado mas não gravado) — consistente com o contrato "retorna patch, chamador persiste" |
| 9 | Validação/health de credencial | `src/credentialHealth.js` (`parseCredentialData`/`validateCredentialData`) | leitura apenas | Não | N/A (só decifra/valida) |

## Vereditos por causa provável

### C1 — Rotação de cookie `ssid` não persistida em algum caminho → **DESCARTADA (já tratada, cobrir regressão)**
Evidência: `buildCredentialPatchFromSetCookie` (`mercadolivre.js:500`) gera o patch a partir do `Set-Cookie`; `checkMercadoLivreSession` (`:605`) e `createAffiliateLink` (`:625`) o **retornam**; a rota `/mercadolivre/session` (`credentials.js:44-51`) persiste cifrando via `encryptCredential`; worker/linkConversion persistem via `notifyCredentialPatch` (`:521`). Diferente da Amazon, aqui **nenhum caminho de cookie descarta a rotação**. Manter coberto por teste de regressão (SC-002).

### C2 — **Refresh OAuth descarta o token rotacionado → CONFIRMADA (causa raiz primária do eixo OAuth) — CORRIGIDA (T009/T010)**
Evidência original: `getMlUserToken` (`productInfoScraper.js:353-379`) detectava access token expirado (`Date.now() >= oauthTokenExpiry`), fazia `grant_type=refresh_token` e retornava `data.access_token` — **sem persistir** `oauthAccessToken`, o novo `oauthTokenExpiry`, nem o `refresh_token` que o ML devolve na resposta. O refresh token do ML é **rotativo/single-use**: cada refresh invalida o refresh token anterior e emite um novo. Como o novo não era gravado, o próximo refresh reenviava um refresh token já invalidado → o ML recusava → a sessão OAuth "morria" e a cliente precisava refazer o fluxo OAuth. Não havia `__onCredentialPatch` nesse caminho (o `mlCredentials` chega como objeto puro de `offerEngine`/`mirrorTemplate`). Era o análogo funcional exato do bug de "reenviar token velho" da Amazon, no eixo OAuth.

**Status pós-implementação**: `getMlUserToken` agora usa `buildOAuthRefreshDecision`/`applyOAuthTokenResponse` (`mlOAuthTokenPolicy.js`, módulo puro) e retorna `{ token, credentialPatch }`; `fetchMercadoLivreItemInfo` persiste o patch via `mlCredentials.__onCredentialPatch('mercadolivre', credentialPatch)` quando o gancho está disponível (best-effort, não quebra o scrape em caso de falha na persistência). Coberto por `test/ml-oauth-token-policy.test.js` e pelos novos casos de `test/product-info-scraper.test.js` (T006). Verificado: T011/T022 (suíte completa verde).

### C3 — Sondagem do painel sem cache batendo no ML a cada load → **CONFIRMADA (agravante) — CORRIGIDA (T014-T017)**
Evidência original: a rota `GET /mercadolivre/session` (`credentials.js:37-53`) **não** tinha cache TTL — compare com `GET /amazon/session`, que ganhou `getCachedProbe`/`setCachedProbe`/`invalidateCachedProbe` na feature 001. Cada carregamento do painel disparava um `createLink`-probe real (via `checkMercadoLivreSession`). N aberturas = N chamadas ao ML, aumentando tráfego, consumo de rotação de cookie e risco de padrão anômalo.

**Status pós-implementação**: novo módulo puro `mercadolivreSessionProbeCache.js` (espelha 1:1 `amazonSessionProbeCache.js`) injetado em `credentialsRoutes` via `opts.getMlProbeCache`/`opts.setMlProbeCache`/`opts.invalidateMlProbeCache`. `GET /mercadolivre/session` consulta o cache antes de sondar; só cacheia resultado definitivo (`alive true/false`); `PUT /mercadolivre` invalida a entrada do usuário. Logs `debug` diferenciam sondagem servida por cache vs. efetiva (FR-013). Coberto por `test/mercadolivre-session-probe-cache.test.js` e `test/credentials-mercadolivre-session-route.test.js` (T012/T013/T018). Validação objetiva de queda de chamadas em staging fica deferida (T024, pós-merge).

### C4 — Uso concorrente da mesma credencial por múltiplos processos → **INCONCLUSIVA (baixo risco no eixo cookie; a verificar no OAuth)**
Evidência: o eixo cookie **já** é serializado por `withMercadoLivreCredentialLock` (`mercadolivreCredentialLock.js`, lock de arquivo por hash de `id|ssid`), usado em `checkMercadoLivreSession`/`createAffiliateLink`. Isso mitiga rotações conflitantes de cookie. No eixo OAuth **não** há lock: dois refreshes concorrentes poderiam ambos consumir o mesmo refresh token rotativo e um invalidar o outro. Mitigação suficiente no escopo: reusar o access token válido em cache até `oauthTokenExpiry` (reduz drasticamente refreshes) e persistir sempre o token mais fresco; lock explícito no refresh OAuth fica como follow-up se a métrica de recadastro não melhorar.

### C5 — User-Agent / headers inconsistentes → **DESCARTADA (documentar)**
Evidência: `callCreateLinkApi` (`mercadolivre.js:528`) usa UA e headers fixos consistentes (iPhone Safari, `Referer`/`Origin` do linkbuilder) em todas as chamadas de afiliado; o probe usa a mesma função. O caminho OAuth usa `fetch` com `Content-Type: application/x-www-form-urlencoded` conforme a spec do ML. Não há inconsistência que justifique invalidação de sessão. (FR-007 satisfeito e documentado.)

### C6 — `Set-Cookie` de limpeza (valor vazio) sobrescrevendo cookie válido → **DESCARTADA (já tratado)**
Evidência: `parseSetCookieLine` (`mercadolivre.js:459`) detecta deleção (`value === ''` / `Max-Age=0` / `Expires` no passado) e `mergeSetCookieIntoJar` (`:479`) a ignora; `serializeCookieJar` (`:491`) nunca serializa par com valor vazio. O patch nunca apaga o `ssid`. (FR-011 já satisfeito; manter coberto por regressão.)

### C7 — Falha transitória contada como expiração → **DESCARTADA (já tratado, manter)**
Evidência: `checkMercadoLivreSession` (`:615-621`) mapeia 401→`expired` (alive:false), 403→`forbidden`/429→`rate_limited`/rede→`network_error`/lock→`busy` todos como `alive:null` (não alarma). No OAuth, `getMlUserToken` já retorna `null` em `!res.ok`/erro de rede (não confunde com token inválido). A correção deve preservar isso: falha transitória de refresh **não** pode zerar/apagar os tokens persistidos (FR-008/SC-006).

## Aplicabilidade do padrão Amazon (FR / US2 AC3)

| Parte do padrão Amazon (001) | Aplica ao ML? | Observação |
|---|---|---|
| Persistir rotação de `Set-Cookie` no probe do painel | **Já aplicado** | ML já retorna `credentialPatch` e a rota persiste; nada a mudar |
| Cache TTL curto por usuário na sondagem | **Aplicado (T014-T017)** | `GET /mercadolivre/session` agora usa `mercadolivreSessionProbeCache.js` |
| Retornar patch em vez de persistir via gancho ausente | **Aplicado ao OAuth (T009/T010)** | contrato "retorna patch, chamador persiste" estendido ao refresh OAuth via `__onCredentialPatch` |
| Distinguir transitório vs. sessão morta | **Já aplicado** | manter no eixo OAuth (falha de refresh transitória ≠ token inválido) |
| Ignorar `Set-Cookie` de limpeza | **Já aplicado** | não há análogo no OAuth |

## Decisões de design

### Decisão 1 — `getMlUserToken` retorna `{ token, credentialPatch }`; chamador persiste (cifrado)
- **Decision**: extrair a lógica de refresh para um módulo puro `mlOAuthTokenPolicy.js` (`buildOAuthRefreshDecision`, `applyOAuthTokenResponse`), fazer `getMlUserToken` retornar o patch OAuth (`oauthAccessToken`, `oauthTokenExpiry`, `oauthRefreshToken` novos), e persistir onde há DB/gancho (`__onCredentialPatch` quando presente; rota/worker cifrando via `encryptCredential`).
- **Rationale**: mantém o scraper puro/testável (sem DB), reusa o contrato já em produção no eixo cookie, e garante que o `refresh_token` rotacionado seja gravado — atacando a causa raiz. Idempotente (não regride para refresh token mais velho).
- **Alternatives considered**: (a) persistir DB direto dentro de `getMlUserToken` (acopla DB ao scraper, quebra teste db-free); (b) parar de usar OAuth e cair só no cookie (reduz cobertura de scrape de item, rejeitado).

### Decisão 2 — Cache TTL curto por usuário para a sondagem ML
- **Decision**: módulo puro `mercadolivreSessionProbeCache.js` espelhando `amazonSessionProbeCache.js` (`Map` por `userId` → `{ result, expiresAt }`, TTL configurável por env com default seguro). A rota consulta o cache antes de sondar; só cacheia resultado definitivo (`alive true/false`); `PUT /mercadolivre` invalida.
- **Rationale**: N aberturas do painel = 1 chamada real (SC-003); reduz consumo de rotação e tráfego anômalo. In-memory, footprint desprezível, sem Redis.
- **Alternatives considered**: sem cache (ainda gasta 1 rotação por load); cache em Redis (infra/memória desnecessária, viola "solução mais leve").
- **Nota de memória**: `Map` pequeno por usuário com poda de expirados; não sinaliza aumento relevante de RAM.

### Decisão 3 — Visibilidade operacional (FR-013)
- **Decision**: log `debug` de sondagem efetiva vs. servida por cache (espelha o bloco Amazon), e log/contador de refresh OAuth persistido vs. reuso de access token válido.
- **Rationale**: permite medir objetivamente SC-001 (frequência de recadastro) e SC-003 (queda de chamadas) antes/depois, sem instrumentação pesada.

## Riscos e mitigações
- **Refresh OAuth concorrente (C4)**: mitigado por reuso de access token em cache até `oauthTokenExpiry`; lock explícito é follow-up se a métrica não melhorar.
- **Falha transitória de refresh não pode apagar tokens (FR-008)**: `applyOAuthTokenResponse` só produz patch quando a resposta traz `access_token` novo; erro/`!res.ok` retorna sem patch (tokens persistidos intactos).
- **Formatos de credencial (só cookie / só OAuth / ambos) — FR-012**: a correção é aditiva por eixo; credenciais só-cookie não têm `oauthRefreshToken` (o refresh é no-op) e vice-versa. Cobrir os três formatos em teste.
- **Mudança de semântica (cache/refresh)**: validar em staging antes de prod (fluxo canônico), medindo frequência de recadastro e chamadas de sondagem.
