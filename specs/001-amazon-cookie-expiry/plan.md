# Implementation Plan: Investigação e correção da expiração rápida dos cookies da Amazon

**Branch**: `001-amazon-cookie-expiry` | **Date**: 2026-07-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-amazon-cookie-expiry/spec.md`

## Summary

A sessão de afiliada da Amazon (cookie do SiteStripe em `Credential.data`, cifrado em repouso) expira em horas/poucos dias em vez de semanas. A causa raiz confirmada por leitura de código: **a rotação de token que a Amazon devolve no `Set-Cookie` do `getShortUrl` só é persistida quando `creds.__onCredentialPatch` existe** — gancho presente apenas nos caminhos do `bot-worker.js` e do `linkConversion.js`. A sondagem do painel `GET /api/credentials/amazon/session` (`credentials.js`) lê a credencial direto do banco via `parseCredentialData` — um objeto simples **sem** o gancho — e chama `checkAmazonSession → createAmazonShortLink`, que executa um `getShortUrl` real (que **rotaciona** a sessão), captura o novo token no `Set-Cookie` e o **descarta silenciosamente** (o `persistRotatedAmazonCookies` vira no-op sem o gancho). Cada abertura do painel gasta uma rotação e reenvia o token velho na próxima chamada → a sessão morre cedo. Agrava porque o dashboard chama `amazonSession()` a cada carregamento do painel, sem cache/throttle.

**Correção mínima e segura** (espelha o padrão já validado do Mercado Livre): (1) fazer `checkAmazonSession`/`createAmazonShortLink` **retornarem** o `credentialPatch` (em vez de tentar persistir internamente via um gancho que a rota do painel não fornece); (2) a rota `/amazon/session` persiste o patch cifrando com `encryptCredential` (idêntico ao que a rota `/mercadolivre/session` já faz); (3) **cache curto por usuário** do resultado da sondagem para que N aberturas do painel = 1 chamada à Amazon. Mantém-se o gancho `__onCredentialPatch` nos caminhos de worker/linkConversion (backward-compatible). Sem novos processos PM2, sem Redis, sem aumento relevante de memória.

## Technical Context

**Language/Version**: Node.js (ESM), mesma versão do runtime do repo (sem bump)

**Primary Dependencies**: `axios` (chamada `getShortUrl`), Prisma/SQLite (`Credential`), Fastify (rota do painel), `src/credentialCrypto.js` (D-3 AES-256-GCM), `src/credentialHealth.js` (`parseCredentialData`)

**Storage**: SQLite via Prisma — tabela `Credential` (`userId_platform` único), campo `data` cifrado (`v1:...`). Sem migration de schema (o patch reusa o campo existente).

**Testing**: `node --test` (node:test). Alvos existentes: `test/converters-amazon.test.js`, `test/credential-health-amazon.test.js`. Novos testes puros/db-free para o patch de rotação e o cache de sondagem.

**Target Platform**: API Fastify em prod/staging (VPS Linux, PM2 `api`/`api-staging`); consumido pelo dashboard Next (`dashboard/lib/api.js → amazonSession()`).

**Project Type**: web-service (backend Node + dashboard Next) — a correção é backend-only; o dashboard não precisa mudar (mesma forma de resposta `{ configured, alive, reason }`).

**Performance Goals**: reduzir chamadas à Amazon por abertura de painel de N→~1 (cache TTL curto); não introduzir latência perceptível no `getShortUrl` do caminho de conversão.

**Constraints**: seguir D-3 (toda escrita de `Credential.data` cifra via `encryptCredential`, idempotente; leitura tolera texto puro via `decryptCredential`/`parseCredentialData`); preservar distinção transitório vs. sessão morta (FR-007); nunca encaminhar link original; fluxo canônico feature→develop→staging→main. Sem aumento significativo de RAM (cache in-memory por usuário é pequeno; sinalizar se crescer).

**Scale/Scope**: correção localizada em `src/converters/amazon.js` + `src/api/routes/credentials.js` (rota `/amazon/session`), com módulo puro auxiliar para o cache TTL. Baixo risco de regressão; sem tocar no caminho ML nem no caminho de produto do worker.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

O arquivo `.specify/memory/constitution.md` está no estado template (não ratificado), portanto não impõe gates formais. Na ausência dele, os gates canônicos aplicáveis vêm do `AGENTS.md` do projeto e estão todos satisfeitos por design:

- **Fluxo de branches**: trabalho nasce em `001-amazon-cookie-expiry` → PR para `develop` → autodeploy staging → validação manual → PR `develop→main`. Nunca direto para `main`; nunca amend em commit mergeado. **PASS**
- **Criptografia D-3**: a rota persiste o patch via `encryptCredential(JSON.stringify(...))` (idempotente); leitura via `parseCredentialData`/`decryptCredential`. Nenhuma credencial em texto puro é escrita. **PASS**
- **Testes node:test**: lógica de patch e cache extraída em funções puras/db-free testáveis; sem depender de rede/DB no teste. **PASS**
- **Política de memória (SUPER SINALIZAR)**: o cache é um `Map` por `userId` com TTL curto e poda — footprint desprezível; documentado em research.md com alternativa ainda mais leve (sem cache, só persistência). Nenhum processo/serviço novo. **PASS**
- **Sem troca de portas / processos PM2 / migrations**: nenhuma. **PASS**

Sem violações a justificar em Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/001-amazon-cookie-expiry/
├── plan.md              # Este arquivo (/speckit-plan)
├── research.md          # Fase 0: diagnóstico com evidências (US2)
├── data-model.md        # Fase 1: entidades (Credencial, rotação, sondagem, cache)
├── quickstart.md        # Fase 1: guia de validação (node:test + staging)
├── contracts/
│   └── amazon-session-probe.md   # Contrato do GET /api/credentials/amazon/session e do retorno de checkAmazonSession
└── tasks.md             # Fase 2 (/speckit-tasks — NÃO criado aqui)
```

### Source Code (repository root)

```text
src/
├── converters/
│   └── amazon.js                 # ALTERAR: createAmazonShortLink e checkAmazonSession passam a RETORNAR
│                                 #          credentialPatch (não mais persistir via gancho ausente na rota).
│                                 #          buildAmazonCredentialPatchFromSetCookie já existe e é reusado.
│                                 #          Manter compat: caminho worker/linkConversion continua persistindo via __onCredentialPatch.
├── api/routes/
│   └── credentials.js            # ALTERAR: rota GET /amazon/session persiste result.credentialPatch com
│                                 #          encryptCredential (espelha o bloco já existente de /mercadolivre/session)
│                                 #          e aplica cache curto por userId antes de sondar.
└── converters/
    └── amazonSessionProbeCache.js  # NOVO (módulo puro, db-free): TTL cache por userId da última sondagem
                                     #        (getCachedProbe/setCachedProbe/pruneExpired) — testável sem rede/DB.

test/
├── converters-amazon.test.js     # ESTENDER: assert de que checkAmazonSession devolve credentialPatch quando há Set-Cookie
│                                 #          rotacionado, e NÃO devolve em diretiva de limpeza (value vazio) nem sem mudança.
├── credentials-amazon-session-route.test.js  # NOVO: rota persiste patch cifrado; cache evita 2ª sondagem na janela.
└── amazon-session-probe-cache.test.js         # NOVO: TTL/poda/expiração do cache puro.
```

**Structure Decision**: web-service existente; correção **backend-only** e cirúrgica em dois arquivos já existentes (`src/converters/amazon.js`, `src/api/routes/credentials.js`) mais um módulo puro novo para o cache TTL. A escolha de **retornar `credentialPatch`** (em vez de só atachar o gancho `__onCredentialPatch` na rota) segue o padrão canônico já em produção do Mercado Livre (`checkMercadoLivreSession` retorna `credentialPatch`; a rota persiste cifrando) — mantém `checkAmazonSession` puro/testável sem acoplar DB ao converter, e reduz risco por reuso de padrão validado.

## Complexity Tracking

> Sem violações de constituição. Tabela não aplicável.
