# Implementation Plan: Anti-banimento — unificar a proteção do número num lugar só (recurso PRO)

**Branch**: `018-unificar-protecao-anti-ban` | **Date**: 2026-09-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/018-unificar-protecao-anti-ban/spec.md`

## Summary

Juntar as três telas do grupo "Preservação avançada" numa tela única
**"Anti-banimento"** (`/painel/anti-banimento`, item do grupo "Configuração"),
com três partes (Situação, Ritmo por grupo, Ajustes da conta), linguagem leiga e
selo PRO. Os campos técnicos saem da tela e passam a valer por um **piso
anti-banimento** aplicado num **chokepoint único de leitura**
(`src/core/antiBanFloor.js`, consumido pelo resolver de destino e pelo
`getConfig()` do robô): vale sempre o mais conservador entre o gravado e o fixo,
sem migration e com os valores antigos dormentes no banco. O gate de plano passa
a ter uma fonte só: a tela importa `canUseAdvancedPreservation` do backend
(corrige o Premium bloqueado por engano). Um diagnóstico read-only mede, antes do
deploy, quantas contas mudam.

## Technical Context

**Language/Version**: Node.js (ESM) no backend; Next.js (App Router, React) no dashboard

**Primary Dependencies**: Fastify, Prisma (SQLite/WAL), Next.js — **nenhuma dependência nova**

**Storage**: SQLite (`PreservationPreset`, `Group`, `BotConfig`, `User`) — **sem mudança de schema, sem migration**

**Testing**: `node:test` em `test/*.test.js`; funções puras sem banco; guardas estruturais que leem o código-fonte

**Target Platform**: VPS Linux (PM2: `api`, `dashboard`, `bot-supervisor` + workers)

**Project Type**: web app (API + dashboard) + processo do robô

**Performance Goals**: piso é aritmética O(1) por envio; zero consulta nova no robô

**Constraints**: zero RAM adicional; nenhum processo novo; compatibilidade retroativa de API; linguagem leiga

**Scale/Scope**: ~80 vagas de robô; dezenas de destinos por conta; 1 tela nova, 4 redirecionamentos, 1 módulo puro, 1 script de diagnóstico

## Constitution Check

`.specify/memory/constitution.md` ainda é o template vazio; os gates vêm das
regras canônicas do `AGENTS.md`.

| Gate (AGENTS.md) | Situação |
|---|---|
| Fluxo branch → PR `develop` → staging → `main` | ✅ branch a partir de `develop`, sem push |
| Nada destrutivo; campos que saem da UI ficam dormentes | ✅ sem migration; dormência documentada (R2, data-model) |
| Chokepoint único para regra de precedência | ✅ `antiBanFloor.js`; guarda estrutural proíbe comparar contra o fixo fora dele |
| Compatibilidade retroativa das rotas | ✅ PUT/POST aceitam e gravam como hoje; GET só ganha campos aditivos |
| Gate por plano com fonte única | ✅ tela importa `canUseAdvancedPreservation`; `canAccessAdvancedPreservation` removida |
| Linguagem leiga + teste de jargão | ✅ teste de lista proibida (contrato de UI) |
| Política de memória (REGRA #1) | ✅ **zero RAM**, nenhum processo novo |
| **"Código novo não carregado pelos bots" / reconexão** | ⚠️ **SINALIZADO**: muda `src/core/preservationConfig.js`, novo `src/core/antiBanFloor.js` e `getConfig()` do `src/bot-worker.js` → o deploy de `main` **reinicia o `bot-supervisor` e reconecta TODAS as sessões**. Exige anúncio/agendamento (ver Riscos) |
| Celular: sem largura fixa (RCA 2026-09-05) | ✅ contrato de UI |
| SEO: não mudar título/URL de página indexada; não prometer que não bane | ✅ só troca nome do recurso no corpo (research R9) |

Re-check pós-design: sem violação nova. Nenhuma complexidade a justificar.

## Decisões sobre os pontos em aberto da spec

1. **Conexão WhatsApp (FR-006a)** — confirmado no código: **nenhum controle de
   proteção** na tela; a única ocorrência ("rajada") é um comentário JSX. **Nada
   a mover nem redirecionar.** (research R1)
2. **Medição antes do deploy** — `scripts/diag-antiban-valores.mjs`, read-only,
   importa a regra do produto, compara efetivo antes × depois por destino e
   separa por acesso ao plano. Rodar em staging e produção antes do merge em
   `main`; saída anexada à PR. (research R4)
3. **Onde aplicar "mais conservador"** — **leitura**, chokepoint único
   `src/core/antiBanFloor.js`, consumido por `resolveDestinationPreservation`
   (destino) e `getConfig()` do worker (conta). **Sem migration DML**: valores
   ficam no banco, os menos conservadores ficam dormentes. Escape hatch
   `ANTI_BAN_FLOOR=off`. Justificativa: padrão `Group.imageMode`/`toMonitorGroup`
   e `searchListType.js`; vale para sempre, inclusive requisição antiga (FR-013).
   (research R2)
4. **UX de destino mais cuidadoso** — etiqueta só leitura "🐢 Ritmo mais
   cuidadoso — este grupo usa um ritmo mais devagar que o padrão, escolhido
   antes. Ele continua valendo.", calculada no backend (`ritmoMaisCuidadoso`),
   sem número técnico e sem reabrir edição; botão "Voltar ao ritmo padrão" limpa
   overrides pela rota existente. (research R6)
5. **Perder o plano (FR-019)** — mantém o comportamento de hoje: tela volta a
   ficar bloqueada; valores seguem gravados **e valendo** no ritmo por destino
   (agora com piso); defesas de conta que já dependem de plano seguem desligando
   sem plano. Nenhum reset, nenhum gate novo no robô. (research R8)
6. **Gate único** — tela importa `canUseAdvancedPreservation` de
   `src/billing/plans.js` (módulo puro; mesmo padrão de `mirrorWizard.js`);
   `hasProLikeAccess` passa a delegar para `getPlanEntitlements`; teste compara
   tela × backend nos 5 perfis. (research R5)

## Pontos que precisam de aprovação humana antes de tasks/implement

- **A. Variação de imagem NÃO é "ligada por padrão"** (research R3, Achado A). O
  campo que o robô lê (`imageMutationActive`) nasce **desligado**. Fixar "ligado"
  ligaria a variação para quase toda conta com acesso — mudança de comportamento
  contra FR-014. **Recomendação do plano: variação de imagem sai da lista de
  fixos e continua editável** (ficam 4 campos fixos). Alternativa: fixar ligado
  como a spec diz. O diagnóstico traz o número de contas afetadas.
- **B. Preset "Leve" fica 40% mais lento na rajada** (Achado B): 10/hora vira
  6/hora pela regra campo a campo. Seguro, mas perceptível — pedir ciência.
- **C. `throttleEnabled` forçado liga também intervalo mínimo e limite diário**
  gravados nesses destinos (Achado C) — coerente com "mais seguro", pedir ciência.
- **D. FR-019 / US3-5**: a spec diz "passa ao ritmo padrão" sem plano; o plano
  mantém os valores gravados valendo (com piso). Pedir OK e ajustar a redação da
  spec.
- **E. Reconexão de todas as sessões no deploy de `main`**: escolher entre (1)
  anunciar e deixar o deploy reiniciar o supervisor; (2) `RESTART_SUPERVISOR=0` e
  reiniciar em janela combinada; (3) alternativa sem restart (DML + clamp nas
  rotas, research R2), que perde os valores antigos.

## Project Structure

### Documentation (this feature)

```text
specs/018-unificar-protecao-anti-ban/
├── spec.md
├── plan.md                        # este arquivo
├── research.md                    # R1–R9
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── anti-ban-floor.md          # módulo puro do piso
│   ├── api-preservation.md        # rotas (compatibilidade + campos aditivos)
│   └── ui-anti-banimento.md       # tela, menu, redirects, linguagem
└── tasks.md                       # próxima fase (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── core/
│   ├── antiBanFloor.js            # NOVO — piso, puro (chokepoint único)
│   └── preservationConfig.js      # resolveDestinationPreservation aplica o piso
├── billing/plans.js               # mensagem do gate: "Anti-banimento"
├── bot-worker.js                  # getConfig(): applyAccountFloor no botConfig (1 ponto)
└── api/routes/preservation.js     # GET: effective + ritmoMaisCuidadoso (aditivo)

dashboard/
├── app/painel/
│   ├── anti-banimento/            # NOVO — layout (gate) + page (3 partes)
│   ├── preservacao/**             # vira redirects
│   ├── nav.js                     # 1 item "Anti-banimento" (pro) em Configuração
│   └── espelhamento/page.js       # atalho com ?destino=
├── components/preservacao/*       # reaproveitados; textos leigos; sem burst/stagger
└── lib/
    ├── plan.js                    # remove canAccessAdvancedPreservation
    └── planEntitlements.js        # hasProLikeAccess delega a getPlanEntitlements

scripts/diag-antiban-valores.mjs   # NOVO — read-only

test/
├── anti-ban-floor.test.js                    # tabela de verdade + guarda de chokepoint
├── anti-banimento-gate-fonte-unica.test.js   # 5 perfis tela × backend + remoção da função antiga
├── anti-banimento-linguagem.test.js          # lista proibida + sem promessa de "não bane"
├── anti-banimento-rotas-antigas.test.js      # 4 redirects + menu com 1 item
├── anti-banimento-rotas-compat.test.js       # PUT aceita campos fixos; GET aditivo
└── diag-antiban-valores.test.js              # read-only + importa a regra do produto
```

**Structure Decision**: estrutura existente do repositório (backend em `src/`,
painel em `dashboard/`, testes em `test/`); nenhum diretório de topo novo.

## Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Reconexão de todas as sessões no deploy (supervisor reinicia) | anunciar/agendar; ou `RESTART_SUPERVISOR=0` + restart combinado; parte de tela pode ir em PR separada antes |
| Conta sentir o robô mais lento (Leve, throttle desligado, stagger < 20 s) | medir com o diagnóstico antes; aviso à dona com a lista de contas |
| Tela e robô parecerem discordar | etiqueta "Ritmo mais cuidadoso" + `effective` no GET |
| Nova segunda fonte de plano surgir | teste de 5 perfis + guarda estrutural |
| Jargão voltar | teste de lista proibida |
| Rollback | `ANTI_BAN_FLOOR=off` (pm2 delete/start + restart supervisor); tela antiga não volta sem revert |

## Complexity Tracking

Sem violações a justificar.
