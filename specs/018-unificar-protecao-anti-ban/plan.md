# Implementation Plan: Anti-banimento — unificar a proteção do número num lugar só (recurso PRO)

**Branch**: `018-unificar-protecao-anti-ban` | **Date**: 2026-09-23 (revisado após a 2ª rodada de decisões da spec) | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/018-unificar-protecao-anti-ban/spec.md`

## Summary

Juntar as três telas do grupo "Preservação avançada" numa tela única
**"Anti-banimento"** (`/painel/anti-banimento`, item do grupo "Configuração"),
com três partes (Situação, Ritmo por grupo, Ajustes da conta), linguagem leiga e
selo PRO. Duas mudanças de envio, e só duas (FR-014):

1. **Piso anti-banimento** em **três** campos por destino/modelo — tamanho da
   rajada (6), janela da rajada (600 s) e limites do destino (sempre ligados) —
   aplicado num chokepoint único de leitura (`src/core/antiBanFloor.js`,
   consumido só por `resolveDestinationPreservation`). Regra geral: vale o mais
   conservador entre o gravado e o fixo, campo a campo. **Exceção deliberada**:
   destino/modelo que estava com os limites **desligados** passa a ligado
   **recomeçando do padrão do sistema** (`HARD_DEFAULT_PRESERVATION`), não dos
   valores antigos que estavam gravados sem efeito (decisão da dona do produto,
   "zerar e recomeçar do padrão"). Nenhum campo da conta vira fixo; variação de
   imagem fica exatamente como está.
2. **"Intervalo entre destinos"** (ex-"Atraso entre canais",
   `BotConfig.channelStaggerJitterMs`, mesma coluna, sem migration): passa a
   valer para **qualquer** destino (grupo, canal, status) e para **toda** origem
   de envio, com espera **fixa** (não mais sorteio) e implementada como
   **adiamento** (`deferSendJob`/`notBefore`), nunca como `sleep` dentro da fila
   serial. Decidido num chokepoint puro novo (`src/core/destinationSpacing.js`)
   chamado de `processSendJob`, que também decide a regra "vale a maior espera"
   contra o gate do próprio destino (`minIntervalSec` etc.). Continua editável.

O gate de plano passa a ter uma fonte só (`canUseAdvancedPreservation`,
corrige o Premium bloqueado). Um diagnóstico read-only mede, antes do deploy,
quem muda com o piso **e o impacto real do intervalo entre destinos na vazão** —
este último é **gate humano pendente** (ver seção própria abaixo).

## Technical Context

**Language/Version**: Node.js (ESM) no backend; Next.js (App Router, React) no dashboard

**Primary Dependencies**: Fastify, Prisma (SQLite/WAL), Next.js — **nenhuma dependência nova**

**Storage**: SQLite (`PreservationPreset`, `Group`, `BotConfig`, `User`, `MessageLog`) — **sem mudança de schema, sem migration** (nem DDL nem DML; `channelStaggerJitterMs` mantém o nome da coluna — research R10)

**Testing**: `node:test` em `test/*.test.js`; funções puras sem banco; guardas estruturais que leem o código-fonte

**Target Platform**: VPS Linux (PM2: `api`, `dashboard`, `bot-supervisor` + workers)

**Project Type**: web app (API + dashboard) + processo do robô

**Performance Goals**: piso e espaçamento são aritmética O(1) por envio; o espaçamento usa estado em memória do worker (um worker por conta), zero consulta nova; adiamento reaproveita `deferSendJob` (1 update de `MessageLog` por adiamento, número de adiamentos limitado pelo "cursor de saída" — research R11)

**Constraints**: zero RAM adicional; nenhum processo novo; compatibilidade retroativa de API; linguagem leiga; ordem canônica de `processSendJob` preservada (a espera entre destinos entra como adiamento)

**Scale/Scope**: ~80 vagas de robô; dezenas de destinos por conta; 1 tela nova, 4 redirecionamentos, 2 módulos puros, 1 script de diagnóstico

## Constitution Check

`.specify/memory/constitution.md` ainda é o template vazio; os gates vêm das
regras canônicas do `AGENTS.md`.

| Gate (AGENTS.md) | Situação |
|---|---|
| Fluxo branch → PR `develop` → staging → `main` | ✅ branch a partir de `develop`, sem push |
| Nada destrutivo; campos que saem da UI ficam dormentes | ✅ sem migration; dormência documentada (R2, data-model) |
| Chokepoint único para regra de precedência | ✅ `antiBanFloor.js` (piso) e `destinationSpacing.js` (intervalo entre destinos + "maior espera"); guardas estruturais proíbem a regra fora deles |
| Compatibilidade retroativa das rotas | ✅ PUT/POST aceitam e gravam como hoje (inclusive `channelStaggerJitterMs` pelo nome atual); GET só ganha campos aditivos |
| Gate por plano com fonte única | ✅ tela importa `canUseAdvancedPreservation`; `canAccessAdvancedPreservation` removida |
| Linguagem leiga + teste de jargão | ✅ teste de lista proibida (contrato de UI), inclui "atraso entre canais" |
| Política de memória (REGRA #1) | ✅ **zero RAM**, nenhum processo novo (estado do espaçamento = 2 números por worker) |
| RCA 2026-07-28 ("Atraso entre canais") | ✅ corrigido na causa: pendência (1) some (proteção sempre ligada e intervalo declarado), pendência (2) some (adiamento em vez de `sleep`) |
| "Fila entupida por UM destino" — ordem de `processSendJob` | ✅ ordem mantida; o passo novo entra no gate, antes da reserva do destino, e nunca dorme além do que o gate curto já dorme hoje (research R11) |
| **"Código novo não carregado pelos bots" / reconexão** | ⚠️ **SINALIZADO**: muda `src/core/preservationConfig.js`, novos `src/core/antiBanFloor.js` e `src/core/destinationSpacing.js`, e `processSendJob`/enqueue do `src/bot-worker.js` → o deploy de `main` **reinicia o `bot-supervisor` e reconecta TODAS as sessões**. Decisão E da spec: anunciar e deixar reiniciar |
| Celular: sem largura fixa (RCA 2026-09-05) | ✅ contrato de UI |
| SEO: não mudar título/URL de página indexada; não prometer que não bane | ✅ só troca nome do recurso no corpo (research R9) |

Re-check pós-design: sem violação nova. Nenhuma complexidade a justificar.

## Decisões técnicas (pontos em aberto da spec)

1. **Conexão WhatsApp (FR-006a)** — confirmado no código: **nenhum controle de
   proteção** na tela; nada a mover. (research R1)
   **Adendo (T001, rodada `implement` de 2026-09-23):** checagem repetida
   (`grep -riE "preserv|anti-ban|antiban|limite|hor[aá]rio|rajada|stagger|jitter|atraso.*canal|intervalo" dashboard/app/painel/whatsapp/page.js`)
   confirma o mesmo achado de R1 — uma única linha, dentro do comentário JSX
   `{/* ... */}` das linhas 672-675 (menção a "rajada esperada de Bad MAC"
   no comentário sobre a remoção do banner de "conexão instável"), não texto
   visível. Nenhum item T001a/T001b foi aberto.
2. **Onde aplicar "mais conservador"** — leitura, chokepoint único
   `src/core/antiBanFloor.js`, consumido **só** por
   `resolveDestinationPreservation` (os três campos fixos são todos de
   destino/modelo; o `getConfig()` do worker **não** passa mais pelo piso —
   nenhum campo de conta é fixo). Sem migration. Escape hatch
   `ANTI_BAN_FLOOR=off`. (research R2)
3. **Limites desligados → padrão do sistema** — quando o `throttleEnabled`
   efetivo resolvido for `false`, o piso devolve `throttleEnabled: true` e
   **troca** `minIntervalSec`, `dailyCap`, `burstCap` e `burstWindowSec` pelos
   valores de `HARD_DEFAULT_PRESERVATION` (30 s, sem limite diário, 6, 600 s),
   ignorando o que estava gravado. Horário de funcionamento e `queueMaxAgeMin`
   não são governados pelo liga/desliga e ficam como gravados. "Padrão do
   sistema" = `HARD_DEFAULT_PRESERVATION`, **não** o modelo padrão da conta
   (que pode ele mesmo estar desligado/desatualizado). (research R3, Achado C′)
4. **Intervalo entre destinos** — chokepoint `src/core/destinationSpacing.js`
   (puro): decide a espera entre destinos diferentes da mesma conta e combina
   com a decisão do destino (`decideDestination`) pela **maior espera**; se
   houver espera, o job vai para `deferSendJob` com `notBefore` — **sempre**,
   mesmo espera curta (FR-024 proíbe esperar dentro da fila). Estado "último
   envio da conta (quando, para qual destino)" + "próxima vaga livre" em memória
   do worker, registrado no momento em que o gate libera (mesmo instante da
   reserva do destino). O antigo sorteio no enqueue (`staggerMs` → `job.delayMs`)
   é removido. Faixa: 0–600 s na tela (0 = sem espaçamento extra), API continua
   0..600000 ms. (research R10, R11)
5. **Medição antes do deploy** — `scripts/diag-antiban-valores.mjs`, read-only,
   com duas partes: (A) quem muda com o piso; (B) **vazão do intervalo entre
   destinos** (ver gate humano abaixo). (research R4)
6. **UX de destino mais cuidadoso** — etiqueta só leitura "🐢 Ritmo mais
   cuidadoso", calculada no backend; nunca para destino que estava com limites
   desligados (esse recomeça do padrão). Não existe mais etiqueta de conta.
   (research R6)
7. **Perder o plano (FR-019)** — nada é resetado; robô segue lendo o gravado
   (com piso e com o intervalo entre destinos gravado); tela volta a bloquear.
   (research R8)
8. **Gate único** — tela importa `canUseAdvancedPreservation`. (research R5)

## ⚠️ Gate humano pendente — vazão do "Intervalo entre destinos" (NÃO resolvido)

A dona do produto pediu para **ver um número real antes de aprovar o valor
padrão final** do intervalo entre destinos. A sessão que conduz este pipeline
**não tem acesso ao banco de staging nem de produção** (só ao repositório).
Portanto:

- **Este gate só pode ser fechado pela dona do produto, rodando o script no VPS**
  (staging e produção). As fases `tasks` e `implement` **não podem tratá-lo como
  resolvido**: devem criar a tarefa de processo "rodar o diagnóstico e registrar
  o número na PR" como bloqueante do merge `develop → main`.
- **O padrão de 20 s é PROVISÓRIO** — vale para desenvolvimento e staging (é o
  valor gravado hoje em quase todas as contas pela migration de 2026-07-28, e a
  feature não altera dado). O valor **final em produção** só fica definido depois
  que ela vir a Parte B do diagnóstico. Se ela escolher outro valor, a mudança é
  uma migration DML guardada (mesmo padrão de
  `20260728120000_channel_stagger_default_20s`: troca só as linhas ainda no
  padrão) + default do schema, em PR própria — **não** entra nesta feature às
  cegas.
- **O que o script precisa medir (Parte B, obrigatória)** — detalhado em
  research R4:
  1. distribuição de **quantos destinos cada conta tem** (grupos + canais +
     status, juntos, agora que o intervalo vale para os dois), com p50/p90/máx e
     as 10 contas com mais destinos;
  2. **atraso mínimo projetado da última saída** de uma oferta que vai para todos
     os destinos: `(N − 1) × intervalo`, calculado com o **valor gravado da
     conta** e com o **padrão provisório de 20 s**;
  3. **vazão máxima teórica** entre destinos diferentes (`3600 / intervalo`
     envios por hora) × **pico observado de envios por hora** da conta nos
     últimos 7 dias (`MessageLog` com `status='success'`), e as contas em que o
     pico observado passa da vazão teórica (vão acumular fila);
  4. **proximidade com o descarte por idade**: para cada conta, comparar o atraso
     projetado (item 2, e o acúmulo do item 3) com o **menor `queueMaxAgeMin`
     efetivo** entre os destinos dela (`shouldDropExpiredQueueJob`, padrão 300
     min). Marcar contas em que o atraso projetado passa de **50%** do teto
     (atenção) ou de **100%** (ofertas seriam descartadas).
- **Risco sinalizado, sem mudança agora — `queueMaxAgeMin`**: o tempo do
  intervalo entre destinos corre como adiamento, mas **conta** para o descarte
  por idade de cada destino (a idade vem de `job.enqueuedAt`, preservado nos
  re-enfileiramentos). Critério de decisão para a dona: se o item 4 mostrar conta
  em "atenção" ou pior, decidir entre (a) intervalo padrão menor, (b) rever o
  teto de descarte dessas contas/padrão, ou (c) aceitar. **Nenhuma mudança em
  `queueMaxAgeMin` é implementada nesta feature**; só o sinal e o critério.

### Status desta seção (rodada implement, 2026-09-24) — o gate CONTINUA aberto

O script `scripts/diag-antiban-valores.mjs` está **implementado e testado**
(`test/diag-antiban-valores.test.js`, `src/domain/antiban/diagnostics.js`),
cobrindo as duas partes descritas acima — rodado localmente contra um banco de
teste (T060), nunca contra staging/produção reais (esta sessão não tem
acesso). **Isso NÃO fecha o gate.** T061 (rodar o script em `~/wabot-staging`
e `~/wabot`, ler a saída, decidir e confirmar o valor final do intervalo entre
destinos) e T062 (registrar aqui o resultado) continuam **pendentes**,
marcados `[ ]` em `tasks.md` de propósito — nenhum agente de implementação
pode marcá-los `[X]`. O valor em produção/staging continua sendo o
provisório de 20s (migration `20260728120000_channel_stagger_default_20s`),
sem qualquer mudança.

## Project Structure

### Documentation (this feature)

```text
specs/018-unificar-protecao-anti-ban/
├── spec.md
├── plan.md                        # este arquivo
├── research.md                    # R1–R11
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── anti-ban-floor.md          # módulo puro do piso (3 campos + exceção dos limites desligados)
│   ├── destination-spacing.md     # NOVO — módulo puro do intervalo entre destinos
│   ├── api-preservation.md        # rotas (compatibilidade + campos aditivos)
│   └── ui-anti-banimento.md       # tela, menu, redirects, linguagem
└── tasks.md                       # próxima fase (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── core/
│   ├── antiBanFloor.js            # NOVO — piso de 3 campos, puro (chokepoint único)
│   ├── destinationSpacing.js      # NOVO — intervalo entre destinos + "maior espera", puro
│   ├── channelThrottle.js         # expõe decisão sem reserva (peek) para combinar; reserva só se ambos liberam
│   └── preservationConfig.js      # resolveDestinationPreservation aplica o piso
├── billing/plans.js               # mensagem do gate: "Anti-banimento"
├── bot-worker.js                  # processSendJob: gate de espaçamento → defer; remove staggerMs do enqueue
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

scripts/diag-antiban-valores.mjs   # NOVO — read-only, Partes A (piso) e B (vazão)

test/
├── anti-ban-floor.test.js                    # tabela de verdade + exceção limites desligados + guarda de chokepoint
├── destination-spacing.test.js               # grupo e canal, mesmo destino isento, maior espera, cursor, 0 = sem espaço
├── bot-worker-destination-spacing-wiring.test.js  # sem sleep do espaçamento na fila; staggerMs removido; defer usado
├── anti-banimento-gate-fonte-unica.test.js   # 5 perfis tela × backend + remoção da função antiga
├── anti-banimento-linguagem.test.js          # lista proibida + sem promessa de "não bane"
├── anti-banimento-rotas-antigas.test.js      # 4 redirects + menu com 1 item
├── anti-banimento-rotas-compat.test.js       # PUT aceita campos fixos e channelStaggerJitterMs; GET aditivo
└── diag-antiban-valores.test.js              # read-only + importa as regras do produto + Parte B presente
```

**Structure Decision**: estrutura existente do repositório (backend em `src/`,
painel em `dashboard/`, testes em `test/`); nenhum diretório de topo novo.

## Ajuste de redação pendente na spec (sinalizado, não editado aqui)

O Edge Case "Destino com os limites desligados que passa ao fixo 'ligado'"
(spec, linha ~130) diz que "passam a valer também o intervalo mínimo e o limite
diário que esse destino já tinha gravado". A decisão posterior da dona do
produto (repassada a esta fase) é o **oposto**: recomeçar do padrão do sistema.
Este plano segue a decisão da dona; a redação da spec deve ser corrigida antes
de `tasks` (ou registrada no `speckit-analyze`).

## Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Reconexão de todas as sessões no deploy (supervisor reinicia) | decisão E: anunciar às clientes antes; deploy de `main` em horário de menor movimento |
| **Oferta para muitos destinos sair mais devagar** (intervalo passa a valer para grupos) | **gate humano** com a Parte B do diagnóstico; 20 s provisório; escape por conta = gravar 0 |
| Intervalo empurrar ofertas para o descarte por idade | item 4 da Parte B; critério de decisão documentado; sem mudança automática |
| Churn de re-enfileiramento (N² adiamentos) | "cursor de próxima vaga" no módulo de espaçamento: cada job adiado recebe uma vaga própria (R11) |
| Destino com limites desligados perder valores antigos | intencional (decisão da dona); diagnóstico lista esses destinos e os valores ignorados |
| Conta sentir o robô mais lento (Leve, limites desligados) | diagnóstico Parte A antes; aviso à dona com a lista |
| Tela e robô parecerem discordar | etiqueta "Ritmo mais cuidadoso" + `effective` no GET |
| Nova segunda fonte de plano surgir | teste de 5 perfis + guarda estrutural |
| Jargão voltar | teste de lista proibida |
| Rollback | `ANTI_BAN_FLOOR=off` (piso) e `DESTINATION_SPACING=off` (intervalo entre destinos para de espaçar; não volta o `sleep` antigo); por conta, gravar 0. Envs exigem `pm2 delete`/`start` + restart do supervisor em `remote`. Tela antiga não volta sem revert |

## Complexity Tracking

Sem violações a justificar.
