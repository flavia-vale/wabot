# Research & Diagnóstico: Expiração rápida dos cookies da Amazon

**Feature**: 001-amazon-cookie-expiry | **Date**: 2026-07-10

Este documento atende a **US2 / FR-001 / SC-005**: veredito (confirmada / descartada / inconclusiva) para cada causa provável, com evidência de código.

## Mapa de caminhos que tocam o cookie Amazon

| Caminho | Arquivo | Fornece `__onCredentialPatch`? | Persiste rotação? |
|---|---|---|---|
| Bot worker (conversão em grupo) | `src/bot-worker.js:526` | Sim (`Object.defineProperty`) | Sim, via `persistCredentialPatch` |
| Painel "converter link" | `src/api/routes/linkConversion.js:57` (`attachCredentialPatchHandler`) | Sim | Sim, via `persistCredentialPatch` |
| **Sondagem de sessão do painel** | `src/api/routes/credentials.js:53-61` (`GET /amazon/session`) | **NÃO** (`parseCredentialData` → objeto puro) | **NÃO** (rotação descartada) |

O gerador de link e a sondagem chegam ambos em `createAmazonShortLink` (`src/converters/amazon.js:307`), que chama `persistRotatedAmazonCookies` (`amazon.js:291`). Este retorna imediatamente `false` quando `typeof creds?.__onCredentialPatch !== 'function'` (`amazon.js:293`) — exatamente o caso da sondagem do painel.

## Vereditos por causa provável

### C1 — Rotação de token não persistida em algum caminho de chamada → **CONFIRMADA (causa raiz primária)**
Evidência: `checkAmazonSession` (`amazon.js:414`) chama `createAmazonShortLink` com a `AMAZON_SESSION_PROBE_URL`; um `getShortUrl` bem-sucedido devolve `Set-Cookie` com token rotacionado, mas na rota do painel `creds` vem de `parseCredentialData(cred.data)` (`credentials.js:60`) sem o gancho → `persistRotatedAmazonCookies` no-op. A rotação é consumida na Amazon (o token velho passa a ser inválido) e **não** é gravada de volta. Na próxima chamada reenvia-se o token velho → parede "Acessar Amazon" → sessão "morta" cedo. O comentário em `amazon.js:265-268` já registra o RCA de cookie completo expirando em ~3h ao reenviar token velho.

### C2 — Chamadas de sondagem/probe que consomem rotação sem persistir → **CONFIRMADA (agravante)**
Evidência: `dashboard/lib/api.js:183` expõe `amazonSession()`; o painel chama isso **a cada carregamento**, sem cache. Cada chamada é um `getShortUrl` real que **rotaciona** a sessão (a sondagem não é read-only). Sem persistência (C1) e sem cache, abrir o painel repetidamente queima N rotações. Corrige-se com cache curto por usuário (FR-004/SC-003) + persistência da rotação (FR-002/FR-003).

### C3 — Uso concorrente da mesma credencial por múltiplos processos → **INCONCLUSIVA (baixo risco com o merge atual)**
Evidência: worker, linkConversion e sondagem podem tocar a mesma credencial. `buildAmazonCredentialPatchFromSetCookie` (`amazon.js:269`) faz **merge por nome de cookie** sobre o jar enviado, então um patch não zera cookies que não mudaram. O risco residual é "last write wins" gravar um token mais velho por corrida. Mitigação suficiente no escopo: persistir sempre o token mais fresco recebido e evitar sondagens redundantes (cache). Serialização/lock explícito **não** é adotado agora (custo/complexidade desproporcionais); documentado como follow-up se a métrica de recadastro não melhorar.

### C4 — User-Agent / headers inconsistentes entre chamadas → **DESCARTADA**
Evidência: todas as chamadas passam por `createAmazonShortLink` (`amazon.js:319-327`) com o mesmo bloco de headers fixos (mesmo `User-Agent` Chrome/124, `Accept`, `Referer`, `X-Requested-With`). A sondagem usa a mesma função, logo os mesmos headers. Não há inconsistência hoje. (FR-006 satisfeito e documentado.)

### C5 — Ausência de cache → re-scraping/re-probe repetido → **CONFIRMADA (subconjunto de C2)**
Evidência: nenhum cache no caminho `GET /amazon/session`. Resolvido pelo cache TTL curto por usuário.

### C6 — `Set-Cookie` de limpeza (valor vazio) sobrescrevendo token válido → **DESCARTADA (já tratado)**
Evidência: `buildAmazonCredentialPatchFromSetCookie` ignora diretivas com valor vazio (`amazon.js:288`: `if (!name || !value) continue`). O patch nunca apaga o token. (FR-010 já satisfeito; manter coberto por teste de regressão.)

### C7 — Falha transitória contada como expiração → **DESCARTADA (já tratado, manter)**
Evidência: `createAmazonShortLink` distingue `transient` (5xx/rede/timeout) de parede de login (`amazon.js:353-372`); `checkAmazonSession` mapeia `transient → reason:'network_error'`, `alive:null` (não alarma). (FR-007 satisfeito; manter coberto.)

## Decisões de design

### Decisão 1 — `checkAmazonSession`/`createAmazonShortLink` retornam `credentialPatch`; a rota persiste
- **Decision**: espelhar o Mercado Livre: `checkMercadoLivreSession` retorna `credentialPatch` e a rota `/mercadolivre/session` (`credentials.js:30-46`) faz `db.credential.update({ data: encryptCredential(JSON.stringify(patchedData)) })`. Fazer o mesmo para Amazon.
- **Rationale**: mantém o converter puro/testável (sem DB), reusa padrão já em produção, e cobre a rota do painel — o único caminho sem o gancho. O gancho `__onCredentialPatch` continua funcionando nos caminhos worker/linkConversion (backward-compatible: `createAmazonShortLink` pode tanto retornar o patch quanto continuar chamando `persistRotatedAmazonCookies` quando o gancho existe, sem dupla-escrita se a rota do painel não passa o gancho).
- **Alternatives considered**: (a) atachar `__onCredentialPatch` na rota do painel (acopla DB/encrypt ao converter indiretamente e diverge do padrão ML); (b) trocar a sondagem por um GET não-rotacionante — muda semântica, risco de falso-vivo, rejeitado.

### Decisão 2 — Cache TTL curto por usuário para a sondagem
- **Decision**: módulo puro `src/converters/amazonSessionProbeCache.js` (`Map` por `userId` → `{ result, expiresAt }`), TTL curto (ordem de minutos, configurável via env com default seguro). A rota consulta o cache antes de sondar; em hit dentro da janela, devolve o último resultado sem chamar a Amazon.
- **Rationale**: N aberturas do painel em poucos minutos = 1 chamada real (SC-003), reduzindo consumo de rotação e risco de padrão anômalo. In-memory, footprint desprezível, sem Redis.
- **Alternatives considered**: sem cache, só persistindo a rotação (ainda gasta 1 rotação por load — pior para SC-003); cache em Redis (memory/infra desnecessária, viola "solução mais leve").
- **Nota de memória**: `Map` pequeno por usuário com poda de expirados; não sinaliza aumento relevante de RAM.

### Decisão 3 — Visibilidade operacional (FR-011)
- **Decision**: logar `rotatedCookie`/cache-hit no caminho de sondagem (já há `logger.info` com `rotatedCookie` em `createAmazonShortLink`); opcionalmente contador leve de sondagens efetivas vs. servidas por cache para medir SC-003 antes/depois.
- **Rationale**: permite verificar objetivamente a queda de chamadas e a persistência da rotação sem instrumentação pesada.

## Riscos e mitigações
- **Corrida de escrita concorrente (C3)**: aceita como risco baixo; token sempre avança para o mais fresco recebido; follow-up se a métrica não melhorar.
- **Formato legado (3 cookies nomeados) vs. cookie completo (FR-009)**: `buildCookieHeader`/`buildAmazonCredentialPatchFromSetCookie` operam sobre o jar por nome — funcionam para ambos; cobrir os dois formatos em teste.
- **Mudança de semântica**: validar em staging antes de prod (fluxo canônico), medindo `ratio de recadastro` e chamadas de sondagem.
