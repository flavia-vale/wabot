# Implementation Plan: Cupons de desconto da própria cliente

**Branch**: `017-client-coupon-catalog` | **Date**: 2026-09-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/017-client-coupon-catalog/spec.md`

## Summary

A cliente passa a ter onde guardar os cupons que ela mesma conquista com as
lojas, e o robô insere sozinho o cupom certo — o de **maior economia em reais** —
em cada oferta, junto do preço já com o desconto aplicado ("de R$ 300,00 por
R$ 270,00 com o cupom"). Na mesma entrega sai a variável `{linhaDeCupom}`, que
copiava o cupom **do concorrente**.

A abordagem técnica se apoia em três decisões, detalhadas em
[research.md](./research.md):

1. **O cupom viaja como token e é resolvido no último instante.** O texto é
   montado na chegada da mensagem com `{cupom}` ainda intacto; quem substitui é
   `processSendJob`, imediatamente antes do envio. É isso que faz valer a
   validade e o ligado/desligado **do momento do envio** (FR-014) mesmo para um
   item que ficou horas parado na fila. *(Revisado em 2026-09-23: a montagem
   só mantém `{cupom}` intacto quando pedido — `keepCouponToken: true`, usado
   pelos caminhos que passam pelo robô; o padrão é apagar, para o "copiar" do
   Criar oferta nunca levar o marcador cru ao grupo. Ver research.md D3.)*
2. **A fonte dos cupons no worker é o cache de configuração que já existe**
   (`getConfig`), invalidado pelo comando `reloadConfig` que já existe, com o
   TTL de 60s como rede de segurança. Zero consulta ao banco por envio
   (FR-028a), zero mecanismo novo.
3. **A decisão mora numa regra pura** (`src/core/clientCouponPolicy.js`), sem
   banco, sem rede, sem relógio interno — com teste `node:test` próprio.

## Technical Context

**Language/Version**: Node.js (ESM), sem TypeScript

**Primary Dependencies**: Fastify (API), Prisma + SQLite (banco), Baileys
(WhatsApp), BullMQ/Redis (fila, opcional), Next.js (painel). **Nenhuma
dependência nova.**

**Storage**: SQLite via Prisma, modo WAL. Uma tabela nova (`ClientCoupon`) e uma
coluna nova (`OfferAutomation.useCoupons`), ambas aditivas.

**Testing**: `node:test` (`npm test`), `npm run arch:check` (dependency-cruiser),
`npm run quality:gate`.

**Target Platform**: VPS Linux, processos PM2 `api` + `dashboard` +
`bot-supervisor` (produção) e espelhos em staging. **Nenhum processo novo.**

**Project Type**: aplicação web com worker de longa duração (API Fastify +
painel Next.js + bot-workers forkados).

**Performance Goals**: **zero** consulta ao banco e **zero** chamada de rede
atribuíveis ao cupom dentro do caminho de envio (SC-009, SC-011). A substituição
do token é manipulação de string sobre dado já em memória.

**Constraints**:
- a fila de envio é **serial** (`concurrency: 1`) — qualquer custo ali é pago por
  todos os destinos da conta;
- orçamento de 25s por mensagem (`MSG_QUEUE_TIMEOUT_MS`) e 6s de scrape
  (`MIRROR_TEMPLATE_SCRAPE_BUDGET_MS`), que o cupom **não pode** consumir;
- `src/**` não pode importar `dashboard/lib/**` (barreira de arquitetura);
- acréscimo de memória na ordem de poucos KB por robô (ver D8 da pesquisa).

**Scale/Scope**: dezenas de cupons por conta; ~36 robôs em produção;
1 tabela, 1 coluna, 1 regra pura, 5 rotas, 1 tela nova, 1 campo de formulário,
1 variável de template entrando e 1 saindo.

## Constitution Check

*GATE: passa antes da Phase 0 e revalidado depois da Phase 1.*

⚠️ `.specify/memory/constitution.md` está com o **template não preenchido**
(placeholders `[PRINCIPLE_N_NAME]`). A constituição de fato deste repositório é
o `AGENTS.md`, e os portões abaixo saem dele.

| Portão (`AGENTS.md`) | Status | Como o plano atende |
|---|---|---|
| **REGRA #1 — sinalizar mudança memory-heavy** | ✅ | Nenhum processo PM2 novo, nenhum timer novo, nenhuma dependência nova. O acréscimo é uma lista de dezenas de linhas dentro do objeto de config que o worker **já** mantém — poucos KB por robô contra os ~329 MB/robô medidos em 2026-09-11. Registrado em D8 e em `data-model.md`. |
| **A fila serial não pode ganhar custo** | ✅ | A decisão do cupom é função pura sobre dado já carregado. `processSendJob` já chama `await getConfig()` hoje — ler os cupons de lá não acrescenta nem uma consulta. |
| **Best-effort absoluto no laço de envio** | ✅ | Falha ao obter/escolher/formatar o cupom → oferta sai **sem** cupom. É a lição dos dois RCAs de `runAutomation` e `checkScheduledMessages`, onde um item sem try/catch abortava o laço inteiro. Teste obrigatório. |
| **Migration só aditiva** | ✅ | Tabela nova + coluna nova com `DEFAULT false`. Nada removido nem renomeado. Guarda existente `test/migrations-no-duplicate-column.test.js`. |
| **Chokepoint único** | ✅ | A escolha mora só em `clientCouponPolicy.js`; a substituição do token termina em `applyCouponToken` nos três caminhos. Nenhum lugar decide cupom por conta própria. |
| **Barreira de arquitetura** (`arch:check`) | ✅ | A regra nova não importa `dashboard/`, não importa Prisma e não é `async`. Não entra na allowlist de exceções. |
| **Linguagem leiga obrigatória** | ✅ | FR-026: tela, rótulos, exemplos e recusas em português simples, com teste que falha se jargão voltar. Nada de `platform`, `discountType`, `token`, `placeholder` na tela. |
| **Não quebrar template de cliente em produção** | ✅ | `{linhaDeCupom}` sai do código, não do banco. A limpeza acontece na leitura (`canonicalizeTemplateBody`), que já serve tela e worker. |
| **Não regredir a trava de repetição** | ✅ | A chave continua saindo dos **links**, calculada na chegada, sobre texto **sem** cupom. Resolver o cupom depois torna a propriedade mais forte, não mais fraca. |
| **Fluxo `feature → develop → main`** | ✅ | Branch a partir de `develop`, PR contra `develop`, validação em staging, só então `develop → main`. |
| **Nota do modo `remote`** | ✅ | Registrada na spec e no `quickstart.md`: o diff toca `WORKER_CODE_PATHS_RE`, então o deploy reinicia o `bot-supervisor` sozinho e reconecta todas as sessões — anunciar antes do merge em `main`. |

**Resultado**: nenhum portão violado. Nada a registrar em Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/017-client-coupon-catalog/
├── spec.md              # já existe, completa (39 FRs, 13 SCs) — NÃO reescrita
├── plan.md              # este arquivo
├── research.md          # Phase 0 — as 8 decisões (D1..D8)
├── data-model.md        # Phase 1 — ClientCoupon, useCoupons, couponContext, SQL
├── contracts/
│   ├── coupons-api.md   # rotas /api/coupons + campo novo da automação
│   └── coupon-policy.md # contrato da regra pura
├── quickstart.md        # Phase 1 — roteiro de validação
└── tasks.md             # Phase 2 (/speckit-tasks) — NÃO criado aqui
```

### Source Code (repository root)

```text
src/
├── core/
│   ├── clientCouponPolicy.js     # NOVO — regra pura: escolhe, calcula, formata, substitui
│   ├── mirrorTemplate.js         # ALTERADO — preserva {cupom}, devolve couponContext,
│   │                             #   para de alimentar {linhaDeCupom} (mantém a função
│   │                             #   interna, que é o delimitador de {preçoDoTexto})
│   └── templateVariables.js      # ALTERADO — canonicalização remove {linhaDeCupom} da
│                                 #   leitura (serve tela E worker, num lugar só)
├── bot-worker.js                 # ALTERADO — loadConfig carrega os cupons; o job carrega
│                                 #   couponContext; processSendJob substitui antes de enviar
├── offerAutomation/
│   └── dispatcher.js             # ALTERADO — carga única por execução (FR-028d),
│                                 #   gate por automation.useCoupons
└── api/
    ├── workerConfigReload.js     # NOVO — reloadWorkerConfig com o `await` documentado,
    │                             #   extraído de routes/groups.js e compartilhado
    ├── server.js                 # ALTERADO — registra /api/coupons
    └── routes/
        ├── coupons.js            # NOVO — GET/POST/PUT/PATCH/DELETE
        ├── groups.js             # ALTERADO — passa a importar o helper extraído
        └── offerAutomation.js    # ALTERADO — aceita useCoupons

prisma/
├── schema.prisma                                   # ALTERADO — ClientCoupon + useCoupons
└── migrations/20260919120000_client_coupon/        # NOVO — aditiva

dashboard/
├── app/painel/
│   ├── cupons/page.js            # NOVO — tela de cupons
│   ├── nav.js                    # ALTERADO — item novo
│   └── ofertas-automaticas/      # ALTERADO — caixa de seleção do opt-in
└── lib/
    ├── mobileOfferComposer.js    # ALTERADO — {cupom} entra na lista, {linhaDeCupom} sai,
    │                             #   applyTemplateVariables perde o parâmetro couponLine
    └── mobileTemplateStore.js    # ALTERADO — nenhuma mudança de lógica: herda a limpeza
                                  #   por já passar em canonicalizeTemplateStore

test/
├── client-coupon-policy.test.js  # NOVO — a regra pura (FR-013, FR-018f/g, SC-006/007/012/013)
├── client-coupon-envio.test.js   # NOVO — momento do envio, cache/invalidação, best-effort
├── painel-cupons-linguagem.test.js # NOVO — linguagem leiga (FR-026)
├── mirror-template.test.js       # ALTERADO — {linhaDeCupom} fora, {preçoDoTexto} intacto
├── mobile-offer-composer.test.js # ALTERADO — token novo e sem sobra
└── offer-automation.test.js      # ALTERADO — opt-in e falha que não aborta o lote
```

**Structure Decision**: o repositório já é uma aplicação única com API, worker e
painel no mesmo tree. A feature segue as fronteiras existentes: regra pura em
`src/core/`, rota em `src/api/routes/`, tela em `dashboard/app/painel/`. Nenhuma
pasta nova de topo, nenhum pacote novo.

---

## Decisões que o plano precisava resolver

### 1. FR-028a × FR-014 — cache com validade × o que vale é o momento do envio

Detalhe completo em [research.md § D1](./research.md). Em resumo:

- **carga**: `loadConfig()` traz os cupons ligados junto do que já traz;
- **invalidação**: cada escrita de cupom chama `await reloadWorkerConfig(userId)`
  — o mesmo caminho que as rotas de grupo já usam, com o `await` que o RCA
  2026-08-26 ("`configReloaded: {}` não confirmava nada") ensinou a não esquecer;
- **quando a notificação se perde**: `CONFIG_CACHE_TTL_MS` (60s) expira o cache
  sozinho. O pior caso é um cupom desligado sair por até um minuto — nunca para
  sempre, e nunca um preço errado.
- **a validade não depende do cache**: o cache guarda `validUntil` cru e a
  comparação com o relógio acontece **a cada envio**, dentro da regra pura.
  Cupom vence → para de sair no mesmo instante, com cache quente.

### 2. Onde mora a regra pura

`src/core/clientCouponPolicy.js` (não `src/domain/`): é consumida pelo **worker**
e pelo dispatcher, e `src/core/` é onde vivem as políticas puras do worker.
Nome com prefixo `client` porque já existe `src/converters/couponPolicy.js`,
que é outra coisa. Contrato em [contracts/coupon-policy.md](./contracts/coupon-policy.md).

### 3. Tabela nova e migration

`ClientCoupon` + `OfferAutomation.useCoupons BOOLEAN NOT NULL DEFAULT false`,
numa migration só. SQL em [data-model.md](./data-model.md). Dinheiro em
**centavos inteiros** — FR-018f exige cálculo determinístico, e ponto flutuante
não entrega isso.

### 4. Rotas e tela

`/api/coupons` com cinco rotas, todas escopadas em `req.user.sub`, todas as
escritas chamando o reload. Tela em `dashboard/app/painel/cupons/`. Contrato em
[contracts/coupons-api.md](./contracts/coupons-api.md).

### 5. Campo novo da automação, com retrocompatibilidade

`useCoupons` com `DEFAULT false` no banco **e** default `false` na rota de
criação. É o default do banco que garante SC-005: nenhuma automação existente
muda de comportamento no deploy.

### 6. Saída do `{linhaDeCupom}` sem quebrar template salvo

**Achado que muda o plano**: `extractCouponLine` não serve só à variável — é o
**delimitador** de `extractTextPrice`, que alimenta `{preçoDoTexto}`, e FR-021
exige que essa continue funcionando. Então: **remove-se a variável, preserva-se
a função**.

A limpeza acontece em `canonicalizeTemplateBody` (`src/core/templateVariables.js`),
que já existe para migrar variável velha e já é chamada pela tela de templates
**e** pelo worker. Um lugar só resolve as duas superfícies do FR-020, sem
reescrever template no banco. Duas camadas de defesa ficam de pé para o template
digitado à mão depois: o token segue na varredura de placeholders não resolvidos
e a remoção da linha órfã no composer passa a ser incondicional.

### 7. A variável nova

`{cupom}`, rotulada "Cupom de desconto", com exemplo em português. **"com o
cupom" é obrigatório no texto publicado** e não pode ser removido numa futura
edição de copy — é o que mantém o preço menor como condição declarada em vez de
promessa (premissa de risco de negócio aceita na spec). Teste falha se sumir.

### 8. Onde o cupom é resolvido nos três caminhos

| Caminho | Onde decide | Preço | Por quê ali |
|---|---|---|---|
| **Espelhamento** | `processSendJob`, antes de `sendPreparedPayload` | `couponContext.priceCents`, do preço **já raspado** para `{preço}` | é o único ponto que é de fato o momento do envio para item adiado. Sem consulta nova ao banco (o `getConfig()` já está ali) e **sem rede** (FR-028c) |
| **Fila de ofertas** | `processSendJob`, mesmo ponto | desconhecido → ordem fixa do FR-011 | o texto do item já vem composto com o token; o ramo `broadcast` só monta o `couponContext` (loja pelo link do texto) |
| **Ofertas automáticas** | `runAutomation`, no dispatcher | `offer.priceMin`/`offer.price`, numérico e confiável | é o único lugar onde o preço numérico existe, e o envio é imediato. Carga dos cupons **uma vez por execução** (FR-028d) |

**Invariante única dos três**: o token `{cupom}` nunca chega ao WhatsApp — ou
vira texto de cupom, ou é apagado sem deixar linha vazia, emoji solto ou
asterisco órfão. Os três terminam no mesmo `applyCouponToken`.

**O que o `couponContext` pode carregar**: só valores primitivos
(`platform`, `priceCents`). É a mesma restrição que o `AGENTS.md` documenta para
`payloadRecipe` — o roteamento BullMQ persiste via `JSON.stringify`, e função ou
Buffer ali quebraria o envio.

---

## Riscos conhecidos e como o plano os contém

| Risco | Contenção |
|---|---|
| Cupom desligado continuar saindo | Invalidação ativa + TTL de 60s. Não existe caminho em que fique valendo para sempre. |
| Falha no cupom travar a fila serial | Tudo best-effort com try/catch por item; sem cupom a oferta sai igual. Teste que força a falha (SC-010). |
| Preço errado publicado no grupo | Sem preço confiável, **não** existe "de X por Y" (FR-018d). Preço final nunca é lido da loja, sempre calculado por nós. |
| `{preçoDoTexto}` quebrar junto com `{linhaDeCupom}` | A função delimitadora é preservada de propósito; teste específico em `mirror-template.test.js`. |
| Duas PRs paralelas adicionarem a mesma coluna | Guarda `test/migrations-no-duplicate-column.test.js`; conferir PRs abertas antes de abrir a branch (pegadinha #10). |
| Deploy reconectar todas as sessões sem aviso | O deploy reinicia o `bot-supervisor` sozinho (o diff toca `WORKER_CODE_PATHS_RE`). Mitigação: anunciar às clientes antes do merge em `main`. Restart manual só com `RESTART_SUPERVISOR=0`. |

## Complexity Tracking

> Preenchido apenas quando o Constitution Check tem violação a justificar.

Nenhuma violação. Tabela vazia de propósito.

A única duplicação consciente — um `parseOfferPriceToCents` próprio na regra
pura, em vez de importar `parsePriceToCents` de `src/domain/painel/` — está
justificada em [research.md § D2](./research.md): são entradas e modos de falha
diferentes (nosso preço de plano × texto raspado de loja), e o import acoplaria
`core` a `domain` pelo motivo errado. Cada uma com seu teste.
