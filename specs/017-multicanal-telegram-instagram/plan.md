# Implementation Plan: Arquitetura multicanal de entrega (WhatsApp, Telegram e Story do Instagram)

**Branch**: `017-multicanal-telegram-instagram` | **Date**: 2026-09-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/017-multicanal-telegram-instagram/spec.md`

**Base de código**: levantamento read-only em `scratchpad/levantamento-multicanal.md` (HEAD `66bc013`). Este plano parte dele e **não re-descobre** nada que já esteja lá.

---

## Summary

O produto entrega hoje **só no WhatsApp**, e o envio real acontece num único ponto dentro do processo por conta (`sendPreparedPayload`, `src/bot-worker.js`). Esta feature separa **"o que publicar"** de **"onde publicar"**, para que a mesma estrutura (origem → conversão → texto → fila → ritmo → histórico) alimente WhatsApp e Telegram, com o Story do Instagram declarado e preparado para a fase 2.

A abordagem técnica tem quatro pilares, nesta ordem de importância:

1. **O WhatsApp não muda de caminho.** O envio real continua sendo exatamente a função de hoje, movida sem alteração de corpo para dentro do adaptador de WhatsApp. Um teste estrutural trava a identidade byte a byte.
2. **Nenhum código de rede nova roda dentro do processo por conta.** O worker nunca fala HTTP com o Telegram: quando um destino não é WhatsApp, ele escreve uma linha numa **caixa de saída** (`DeliveryOutbox`) e segue. Quem fala com o Telegram é uma passada dentro do processo da API. Isso torna estruturalmente impossível o modo de falha do RCA da fila serial (uma rede lenta segurando as outras) e faz com que **correção de Telegram nunca exija reiniciar o supervisor**.
3. **O Telegram como ORIGEM não inventa contrato novo.** Origem de Telegram → destino de WhatsApp usa o `sendBroadcast` que os dois dispatchers de oferta já usam hoje de fora do worker. **`src/supervisor/protocol.js` não muda em nenhuma linha** e `PROTOCOL_VERSION` não é bumpado.
4. **Um interruptor único, lido fora do worker.** `DELIVERY_NETWORKS_ENABLED` (default `whatsapp`) é lido na montagem da configuração, na API. Com ele no default, nenhum destino não-WhatsApp chega a existir para o worker — o produto é byte a byte o de hoje. Desligar é rollback sem redeploy e **sem tocar no supervisor**.

---

## Technical Context

**Language/Version**: Node.js ESM (mesma base do repo; sem mudança de runtime).

**Primary Dependencies**: as já existentes. **Nenhuma biblioteca de Telegram é adicionada** — a Bot API é HTTP/JSON e é consumida com `fetch` nativo, como os conversores de loja já fazem. Isso evita dependência nova em `package.json` (que é caminho de código de worker) e evita a superfície de uma lib de terceiro no processo da API.

**Storage**: SQLite via Prisma (WAL). Todas as migrations desta feature são **aditivas**: 3 colunas nuláveis em tabelas existentes e 2 tabelas novas. Nenhuma coluna é renomeada; `Group.waJid`, `OfferAutomation.destGroupJid`, `OfferQueueItem.targetJids`, `ScheduledMessage.targetJids` e `MessageLog.destGroup` continuam com o mesmo nome, o mesmo tipo e os mesmos dados.

**Testing**: `node:test` (`npm test`), com preferência por **módulos puros** (sem banco, sem rede) e por **testes estruturais de guarda** no padrão já usado pelo repo (`test/image-mode-policy.test.js`, `test/bot-worker-retry-cache-wiring.test.js`, `test/migrations-no-duplicate-column.test.js`).

**Target Platform**: VPS único (15,6 GB, 8 vCPU), PM2, prod (`~/wabot`) e homologação (`~/wabot-staging`).

**Project Type**: serviço web + painel Next.js (backend `src/`, painel `dashboard/`).

**Performance Goals**: nenhuma mudança mensurável no ritmo, no formato ou na latência das ofertas de WhatsApp (SC-002). Para Telegram: respeitar os limites do aplicativo adiando, nunca descartando (FR-022/FR-040).

**Constraints**:
- **Memória**: zero processo PM2 novo, zero processo por cliente. Duas passadas novas dentro do processo `api` (ver "Sinalização de memória" abaixo).
- **`src/supervisor/protocol.js` [PROTECTED_CORE]**: não é tocado.
- **Modo `remote`**: código de worker só passa a valer depois de `pm2 restart bot-supervisor`, que reconecta todas as sessões. O plano concentra **todas** as mudanças de worker numa fatia só, para haver **um único reinício anunciado**.
- **`api` roda `instances: 1`, `exec_mode: fork`** (confirmado em `ecosystem.config.cjs`). Isso é pré-requisito do leitor único de Telegram — ver a condição registrada em "Questões em aberto".

**Scale/Scope**: ~36 contas de WhatsApp conectadas em produção; 62 requisitos funcionais; 17 riscos mapeados; 6 fatias de entrega.

---

## Constitution Check

*GATE: antes da Phase 0 e novamente depois da Phase 1.*

⚠️ `.specify/memory/constitution.md` está no estado de **template não preenchido** (todos os placeholders `[PRINCIPLE_N_NAME]` intactos). Não há constituição efetiva neste repositório. Na ausência dela, o gate é avaliado contra a fonte canônica de convenções do projeto, que é **`AGENTS.md`** — explicitamente declarada lá como "fonte única de regras para qualquer agente de IA editando este repo".

| Regra canônica (AGENTS.md) | Situação neste plano | Veredito |
|---|---|---|
| **REGRA #1 — memória: sinalizar antes de qualquer aumento** | Zero processo PM2 novo, zero processo por cliente. Duas passadas in-process na API, com estimativa declarada e gate de medição de 24 h. Alternativa mais pesada explicitamente rejeitada e precificada. | ✅ com **sinalização obrigatória** (abaixo) |
| **REGRA #2 — sempre oferecer a alternativa mais leve** | Processo PM2 dedicado (~90–120 MB) avaliado e rejeitado em favor de passada in-process (~< 30 MB). | ✅ |
| **`protocol.js` é [PROTECTED_CORE]** | Não é tocado; `PROTOCOL_VERSION` não é bumpado; o trio `manager.js`+`sessionCore.js`+`protocol.js` fica intacto. | ✅ |
| **Modo `remote` não recarrega workers** | Todas as mudanças de worker concentradas na Fatia 1 (um reinício anunciado). O interruptor de rollout **não** é lido pelo worker, então ligar/desligar Telegram nunca exige reiniciar o supervisor. | ✅ |
| **Migration aditiva; nunca renomear coluna com dado** | 3 colunas nuláveis + 2 tabelas novas. Zero `ALTER` destrutivo, zero backfill obrigatório. | ✅ |
| **Vocabulário: `channel`/`platform` são reservados** | Termo novo `deliveryNetwork`; direito de plano `multi_network` (nunca `channels`); para a cliente, "aplicativo". Guardas de teste. | ✅ |
| **Linguagem leiga em tudo que a cliente lê** | Nenhum jargão de rede chega à tela; teste de vocabulário no padrão de `test/painel-linguagem-leiga.test.js`. | ✅ |
| **Interruptor de rollout com default seguro** | `DELIVERY_NETWORKS_ENABLED`, default `whatsapp`, no padrão de `COUPON_LINK_CONVERT` / `GROUP_IMAGE_MODE` / `WA_CHAT_SCOPE_MODE`. | ✅ |
| **Branch → PR contra `develop` → homologação → PR para `main`** | Seis fatias, cada uma uma PR contra `develop`; gate manual da spec antes de produção. | ✅ |

**Resultado do gate**: aprovado, condicionado à sinalização de memória abaixo ser aceita pela dona do produto antes da implementação.

### 🔴 Sinalização de memória obrigatória (REGRA #1 — ler antes de aprovar o plano)

O servidor está com **folga zero pelo critério da política vigente**: 15,6 GB, 36 robôs ligados, média medida de **329 MB por robô**, teto de vagas **40**, limite seguro calculado pela política **35**. Qualquer coisa que cresça precisa ser dita antes, com número.

**O que este plano acrescenta:**

| Item | Onde roda | Custo estimado | Observação |
|---|---|---|---|
| Leitor do Telegram (origem) | dentro do processo `api` existente, `setInterval` + `unref()`, single-flight | **< 20 MB** em regime | Uma requisição HTTP longa aberta por vez + fila de entrada limitada (`maxSize`). Não é processo, não ocupa vaga de robô. |
| Drenador da caixa de saída (destino) | dentro do processo `api` existente, mesmo padrão | **< 10 MB** em regime | Lê lotes pequenos do banco, faz HTTP, grava resultado. Sem buffer de mídia em memória (a imagem vai por URL). |
| **Total** | processo `api` (hoje ~218 MB) | **< 30 MB** | **Zero processo PM2 novo. Zero processo por cliente. Zero mudança na conta de 329 MB/robô e no teto de 40 vagas.** |

**Alternativa mais pesada, avaliada e rejeitada:** um app PM2 dedicado (`telegram-gateway`). Custo estimado **90–120 MB** (o `bot-supervisor`, de porte comparável, mede 120 MB em produção) — cerca de **um terço de uma vaga de robô**, por um trabalho que é HTTP intermitente. Rejeitada por REGRA #2. Ela volta à mesa só se a condição da nota abaixo deixar de valer.

⚠️ **Condição que sustenta a escolha leve**: o leitor do Telegram por `getUpdates` exige **exatamente um consumidor** — dois processos lendo o mesmo robô recebem `409 Conflict` do Telegram e um deles para de ler. Hoje `api` roda `instances: 1` em `fork` (confirmado no `ecosystem.config.cjs`), então a passada in-process é segura. **Se algum dia a API passar a rodar mais de uma instância, o leitor precisa de trava de dono única (chave no Redis) ou de processo dedicado** — e aí a estimativa acima muda. Isso está registrado como condição, não como suposição.

**Estimativas são estimativas.** O gate manual nº 9 da spec (24 h de observação) é o que confirma o número; nada vai para produção sem ele.

---

## Decisões de arquitetura

### D-A1. O termo, o registro e a declaração de capacidades

Termo interno: **`deliveryNetwork`**, valores `whatsapp` | `telegram` | `instagram` (+ `fake`, só em teste). Para a cliente: **"aplicativo"**.

- `src/core/delivery/networks.js` — **módulo puro**, sem banco e sem rede. Concentra:
  - `DELIVERY_NETWORK` (os valores);
  - `resolveDeliveryNetwork(value)` → **ausente/desconhecido cai em `whatsapp`** (FR-013/SC-003), nunca em erro nem em "desconhecido";
  - `CAPABILITIES` por rede (FR-007) — ver o contrato em `contracts/delivery-network-adapter.md`;
  - `registerDeliveryNetwork(adapter)` / `getDeliveryNetwork(id)` — registro por injeção, que é o que permite a rede fictícia existir **só em teste** (FR-032) sem um único `if` a mais nos módulos compartilhados;
  - `isDeliveryNetworkEnabled(id, env)` — leitura do interruptor.
- **É o único lugar do código onde é legítimo escrever a lista de redes.** Todo o resto pergunta capacidade (`caps.requiresImage`, `caps.supportsButton`, `caps.canReadSource`, `caps.singleDestination`), nunca `if (rede === 'telegram')`. Guarda estrutural de teste varre os módulos compartilhados atrás de comparação literal com nome de rede.

**Por que declaração e não herança de comportamento**: é o que FR-007/FR-008/FR-031 pedem e é o que faz a US7 ser verificável. A prova não é argumento, é a rede fictícia da Fatia 1 rodando de ponta a ponta.

### D-A2. Chokepoint do envio — o WhatsApp não muda de caminho

`sendPreparedPayload` (`src/bot-worker.js`) é movida, **com o corpo inalterado**, para `src/delivery/whatsapp/send.js`, e passa a ser o método `send` do adaptador de WhatsApp. `bot-worker.js` importa e chama com os mesmos argumentos.

- Guarda: `test/delivery-whatsapp-send-inalterado.test.js` — teste **estrutural**, no padrão de `test/bot-worker-retry-cache-wiring.test.js`: lê o arquivo, confere que as quatro rotas de envio de hoje (`relayMessage`, `primary`, `fallbacks`, `sendMessage` default), o `stableMessageId`, o `stripChannelUnsafeFields` para destino canal e o `withSendTimeout` continuam presentes e na mesma ordem. Falha se alguém "melhorar" o caminho do WhatsApp.
- O botão "Ver canal", o `channelForward`, o `waitDestinationRateLimit`, o typing delay e o `lastSendByDest` continuam **exatamente onde estão**, fora do adaptador. O adaptador é a ponta, não o pipeline.

### D-A3. Chokepoint do formato — oferta neutra e degradação declarada

`src/core/delivery/neutralOffer.js` (puro) produz **`{ texto, linkConvertido, imagem: {url, bytes?}, produto: {titulo, preco}, botao?, marca? }`** — a oferta sem aplicativo.

- **O WhatsApp continua montando o payload dele exatamente como hoje**, em `src/monitoredMessagePayload.js` + `buildPayloadFromRecipe`. Nada ali é reescrito na Fatia 1: a oferta neutra é o que alimenta os **outros** adaptadores.
- `degradeFor(oferta, capabilities)` → `{ oferta, reducoes: [...] }` (FR-009). As reduções são **códigos**, traduzidos para linguagem leiga só na tela. Registradas em `MessageLog.deliveryReductions` (SC-012). Degradação silenciosa é proibida por teste.
- **Por que o WhatsApp não passa a usar a oferta neutra agora**: fazê-lo obrigaria o payload do WhatsApp a ser reconstruído a partir de uma estrutura nova, e é exatamente o tipo de mudança que produziria a regressão que FR-010 proíbe. A oferta neutra nasce provada pela rede fictícia e pelo Telegram; migrar o WhatsApp para ela é trabalho futuro e opcional, nunca requisito desta feature.

### D-A4. Chokepoint da configuração — e onde mora o interruptor

`toMonitorGroup` / `toPostDetail` (`src/billing/groupEntitlements.js`) passam a carregar `deliveryNetwork: resolveDeliveryNetwork(group.deliveryNetwork)`. É o ponto ÚNICO onde `Group` vira config do worker, como já é hoje para `imageMode` e para o filtro de canais por plano.

`buildEntitledGroupConfig` ganha **dois filtros novos, no mesmo lugar e no mesmo formato do filtro de canais que já existe**:

1. rede não habilitada por `DELIVERY_NETWORKS_ENABLED` → o destino/origem **não entra na config**;
2. conta sem direito `multi_network` → idem (segunda camada de FR-047).

**Consequência decisiva**: com o interruptor no default (`whatsapp`), nenhum destino não-WhatsApp chega a existir para o worker. O caminho de hand-off do worker é inalcançável, e o comportamento é o de hoje **por construção**, não por cuidado.

🔑 **Regra de desenho que vale para toda a feature: nenhum código de worker lê a env de rollout.** O worker só reage à configuração que a API monta e entrega por `reloadConfig`. Ligar ou desligar o Telegram é: editar o `.env`, `pm2 delete` + `start` da API (pegadinha #1) e `reloadConfig`. **Nunca `pm2 restart bot-supervisor`, nunca reconectar sessões.**

### D-A5. Chokepoint do contrato de comandos — ele não é tocado

`src/supervisor/protocol.js` fica intacto e `PROTOCOL_VERSION` continua `1`. Isso é possível porque:

- **destino de Telegram** nunca precisa do worker — sai pela caixa de saída, drenada na API;
- **origem de Telegram → destino de WhatsApp** usa `sendBroadcast(userId, texto, jids, { imageUrl, imageRefererUrl, source })`, que é **o caminho que `src/offerAutomation/dispatcher.js` e `src/offerQueue/dispatcher.js` já usam hoje de fora do worker** para publicar oferta com imagem em grupo de WhatsApp. É comando existente, com timeout existente e com o isolamento de falha por item que aquele RCA já deixou montado.

Resultado: **R2 e FR-036 são atendidos por não existirem** — não há duas pontas para ficarem divergentes.

### D-A6. Onde o Telegram roda, e por quê

| Opção | Custo | Veredito |
|---|---|---|
| Dentro do **processo por conta** (`bot-worker`) | 0 MB novos, mas **N × HTTP do Telegram dentro da fila serial de envio** | ❌ **Rejeitada.** Recria exatamente o RCA "fila entupida por UM destino derrubando a vazão de todos": um `await` de rede do Telegram dentro do consumidor serial congela os envios de WhatsApp daquela conta. Além disso, todo conserto de Telegram passaria a exigir reiniciar o supervisor e reconectar todas as sessões. |
| Dentro do **supervisor** | ~0 MB novos | ❌ **Rejeitada.** O supervisor é [PROTECTED_CORE] adjacente, é o processo que NÃO se reinicia no deploy justamente para preservar sessões — pôr código que muda com frequência ali é o pior dos dois mundos. |
| **Processo PM2 dedicado** | **+90–120 MB** | ❌ Rejeitada por REGRA #2. Reservada como plano B se a API deixar de ser instância única. |
| **Dentro do processo `api`, em duas passadas `setInterval` + `unref()`** | **< 30 MB** | ✅ **Escolhida.** Mesmo padrão de `startCredentialExpirySweep`, `startSessionCapacityAlertSweep` e `startLifecycleEmailSweep`, que é o padrão que o projeto usa exatamente para não criar processo. O Telegram é HTTP sem sessão e o robô é **único do produto** — não há nada que justifique um processo por conta nem um processo dedicado. |

As duas passadas:

- **`startDeliveryOutboxSweep()`** — drena `DeliveryOutbox` (destinos não-WhatsApp). Single-flight, lote pequeno, `unref()`.
- **`startTelegramInboxSweep()`** — lê o robô por `getUpdates` (long poll) e alimenta a fila de entrada. Single-flight, `unref()`.

Ambas **não começam** se `DELIVERY_NETWORKS_ENABLED` não incluir `telegram` ou se o segredo do robô estiver ausente — mesmo fail-safe silencioso do motor de e-mails sem SMTP.

### D-A7. Justiça de ritmo no robô único (FR-039/FR-040/R14)

`src/core/delivery/fairShare.js` — **puro**, sem banco e sem rede. Recebe as linhas prontas da caixa de saída e o estado dos orçamentos, devolve **o que sai neste tick e o que espera**.

- **Rodízio entre clientes**: as linhas são agrupadas por conta e servidas em rodízio, com teto por conta por tick (`DELIVERY_FAIR_SHARE_PER_USER`). Uma conta em volume alto ocupa no máximo a sua fatia; as demais nunca ficam atrás dela na fila. É isto que SC-013 mede.
- **Orçamento global**: balde de fichas dimensionado para os limites do robô, mais um limite por conversa de destino. Estourou o balde → a linha **espera** (`notBefore`), nunca é descartada nem marcada como entregue (FR-040).
- **Descarte só pelas regras que já existem**: a idade na fila reusa `shouldDropExpiredQueueJob` (`src/core/queueExpiry.js`) e produz `skip:queue_expired`, a mesma linha que a cliente já sabe ler.
- **Fail-safe**: sem foto confiável do orçamento (medição falhou), a decisão é **deixar sair no ritmo conservador**, nunca travar a conta inteira.

### D-A8. Estado do robô único e contingência (FR-041/FR-043/US10/R13/R17)

- `src/core/delivery/networkHealth.js` — **puro**: recebe as últimas respostas do robô (sucesso, limitado, recusado, indisponível) e devolve o estado (`funcionando` | `limitado` | `bloqueado` | `indisponivel`) + o motivo em linguagem leiga. Sem medição confiável → **`sem_medicao`, nunca vermelho** (a lição de `assessBillingMachine`: alarme falso recorrente treina a pessoa a ignorar o alerta que importa).
- **Visível sem entrar no servidor**: bloco no painel de operação (`/admin`), alimentado pelo mesmo dado.
- **Aviso interno**: `sendAdminAlert` com um template novo no grupo `interno` do catálogo (`admin_robo_aplicativo_parado`), com cooldown por assunto — caminho próprio, fora do despachante da cliente, exatamente como os avisos de cobrança.
- **Sinais duráveis** (allowlist em `src/analytics.js` + mapa em `src/observability/operationalSignals.js`): `ops_delivery_network_down`, `ops_delivery_network_throttled`, `ops_delivery_fair_share_deferred`, `ops_delivery_degraded`.
- **Contingência declarada (FR-043)**: como a identidade do robô é **segredo de infraestrutura** (`.env`) e **não** credencial de cliente, substituí-lo é: criar o robô novo, trocar a variável, `pm2 delete` + `start` da API. **Nenhuma configuração de cliente é tocada** — o que a cliente guardou é o grupo dela, não o robô. O único trabalho manual é a cliente adicionar o robô novo aos grupos, e esse passo tem texto próprio pronto. Enquanto isso, as ofertas esperam na caixa de saída e o WhatsApp segue intacto.

### D-A9. Blindagem da entrada do Telegram (FR-054 a FR-058/R16)

A entrada nova **não herda** proteção por suposição; cada uma é exigida e testada.

| Exigência | Como é atendida | Reaproveita |
|---|---|---|
| **FR-056** mensagem antiga/reentregue não reentra, com motivo e idade registrados | `src/core/delivery/incomingEnvelope.js` (novo, puro) normaliza o update cru em `{ networkId, sourceId, messageId, timestampMs, isReplay }` e chama **`shouldProcessIncomingMessage`** sem alterar uma linha dele | ✅ `src/core/incomingFreshness.js` **intacto** |
| **FR-055** entrega repetida vira um espelhamento só, inclusive entre processos | Tabela nova `DeliveryInboxSeen` com `@@unique([deliveryNetwork, sourceId, messageId])`. A gravação acontece **antes** do fan-out; colisão = já processada. Durável, então sobrevive a restart da API (que é onde o `update_id` sozinho falharia) | — (nasce) |
| **FR-057** ordem preservada por origem | `createMessageQueue({ orderKey: sourceId })` — o mesmíssimo mecanismo do worker, inclusive a correção de 2026-08-28 (o elo da corrente é o fim do job **na fila**, não o fim da função) | ✅ `src/messageQueue.js` **intacto** |
| **FR-058** mensagem travada não para a origem | Consequência direta do item acima + `taskTimeoutMs`/watchdog que a fila já tem | ✅ mesma fila |
| **FR-060** mesma oferta em duas origens continua bloqueada no destino | Chave de repetição por **destino**, montada por `buildMirrorDedupKeys` | ✅ `src/core/mirrorDedupKey.js` **intacto** |
| **FR-059** origem com problema não afeta as outras | Isolamento por item com `try/catch` por mensagem — a lição do RCA "fila travava inteira quando UM item falhava" | ✅ padrão existente |

**O que nasce**: `incomingEnvelope.js`, `DeliveryInboxSeen`, e o leitor do robô (`src/delivery/telegram/reader.js`). **O que é reusado sem tocar**: freshness, chave de repetição, fila com ordem por origem, roteamento origem→destino (`resolveMonitorDestinations`), conversão de link, montagem de texto, palavras bloqueadas, lojas permitidas, entitlements e histórico.

### D-A10. Identidade de destino sem mexer na unicidade (R10/FR-013)

`Group` tem hoje `@@unique([userId, waJid, role])`. Mudar esse índice é risco desnecessário sobre dados vivos.

**Decisão**: o identificador guardado para destino/origem que **não é WhatsApp** nasce com prefixo de rede — `tg:-1001234567890`. Como nenhum endereço de WhatsApp tem esse formato (`@g.us` / `@newsletter`), **colisão é impossível por construção** e o índice atual já garante a unicidade que R10 pede, sem uma linha de migration de índice.

- A coluna `Group.deliveryNetwork` (nova, nulável) é a **verdade declarada**; o prefixo é cinto e suspensório.
- `null` → `whatsapp` (FR-013). Nenhum registro existente é reescrito (FR-012).
- Guarda: teste que confere que nenhum endereço com prefixo de rede chega ao caminho de envio do WhatsApp.

### D-A11. Por qual rede a mensagem saiu, sem colidir com "loja" (FR-026/FR-027)

`MessageLog.platform` continua significando **loja** e não é tocada. Entram duas colunas nuláveis:

- `deliveryNetwork String?` — `null` lê como `whatsapp` (FR-027: registro antigo aparece como WhatsApp, sem lacuna e sem backfill);
- `deliveryReductions String?` — códigos do que foi reduzido (SC-012), `null` = nada foi reduzido.

---

## Project Structure

### Documentation (this feature)

```text
specs/017-multicanal-telegram-instagram/
├── plan.md                                  # este arquivo
├── spec.md                                  # já fechada
├── research.md                              # Phase 0
├── data-model.md                            # Phase 1
├── quickstart.md                            # Phase 1
├── contracts/
│   ├── delivery-network-adapter.md          # contrato que toda rede implementa
│   ├── delivery-outbox.md                   # caixa de saída e drenagem
│   └── telegram-surface.md                  # superfície da API/painel do Telegram
└── tasks.md                                 # Phase 2 (/speckit-tasks — NÃO criado aqui)
```

### Source Code (repository root)

```text
src/
├── core/delivery/                # PUROS — sem banco, sem rede, sem Baileys
│   ├── networks.js               # registro, capacidades, resolveDeliveryNetwork, interruptor
│   ├── neutralOffer.js           # oferta neutra + degradeFor
│   ├── fairShare.js              # rodízio entre clientes + orçamento global
│   ├── networkHealth.js          # estado do robô único, em linguagem leiga
│   ├── incomingEnvelope.js       # update cru -> envelope neutro (chama incomingFreshness)
│   └── deliveryFailure.js        # motivos próprios de falha por rede (taxonomia)
├── delivery/
│   ├── whatsapp/
│   │   ├── send.js               # sendPreparedPayload MOVIDA SEM ALTERAR O CORPO
│   │   └── adapter.js            # capacidades + describeDestination
│   └── telegram/
│       ├── api.js                # cliente HTTP da Bot API (fetch nativo, sem lib nova)
│       ├── adapter.js            # send/listDestinations/readiness
│       └── reader.js             # leitor único (long poll) da origem
├── deliveryOutbox/
│   ├── enqueue.js                # escrita (usada pelo worker e pelos dispatchers)
│   └── sweep.js                  # startDeliveryOutboxSweep() — in-process na API
├── billing/
│   ├── plans.js                  # + FEATURE_CODES.MULTI_NETWORK, canUseMultiNetwork
│   └── groupEntitlements.js      # + deliveryNetwork; + 2 filtros (interruptor, plano)
├── api/routes/
│   └── deliveryNetworks.js       # rotas novas: listar aplicativos, ligar/desligar, destinos
├── bot-worker.js                 # importa o send do adaptador + 1 ramo de hand-off
└── analytics.js                  # + 4 sinais na allowlist

dashboard/
├── app/painel/aplicativos/       # tela de ligar o Telegram (linguagem leiga)
├── app/painel/grupos/            # + qual aplicativo, travado por rede
├── app/admin/                    # + bloco de estado do robô único
└── lib/painel/                   # + tradução leiga de rede e de redução

prisma/migrations/
└── <ts>_delivery_network_additive/   # 3 colunas nuláveis + 2 tabelas novas

test/                             # ver "Plano de teste"
```

**Structure Decision**: mantém a organização já existente do repo (`src/core/` para o que é puro, `src/<dominio>/` para o que toca I/O, `dashboard/app/` para tela, `test/` plano). A única pasta conceitualmente nova é `src/delivery/`, que agrupa **as pontas** de cada aplicativo — deliberadamente separada de `src/core/delivery/`, que é onde ficam as **decisões puras**. Essa separação é o que permite a rede fictícia de teste provar o contrato sem tocar em nada de WhatsApp ou de Telegram (SC-009).

---

## Ordem de execução — fatias que vão a produção isoladamente

Princípio que define os cortes: **`src/core/`, `src/billing/`, `src/bot-worker.js` e `prisma/schema.prisma` são código de worker** (`WORKER_CODE_PATHS_RE`). Todo deploy que os toca reinicia o `bot-supervisor` e **reconecta todas as sessões de WhatsApp de uma vez** — o que é decisão humana anunciada. Por isso **todo o código de worker desta feature está concentrado na Fatia 1**, e as cinco fatias seguintes são API e painel, sem reinício.

### Fatia 1 — Núcleo neutro e prova de não-regressão  🔴 único reinício anunciado

**Entrega**: o vocabulário, o registro, as capacidades, a oferta neutra, a extração byte-idêntica do envio de WhatsApp, o direito de plano, o schema aditivo, o ramo de hand-off do worker (**inalcançável com o interruptor no default**) e a rede fictícia de teste.

- `src/core/delivery/networks.js`, `neutralOffer.js`, `deliveryFailure.js`
- `src/delivery/whatsapp/send.js` (corpo inalterado) + `adapter.js`
- `src/billing/plans.js`: `FEATURE_CODES.MULTI_NETWORK = 'multi_network'` + `canUseMultiNetwork` + texto leigo em `buildFeatureGateError`
- `src/billing/groupEntitlements.js`: `deliveryNetwork` nos dois conversores + os dois filtros
- `src/bot-worker.js`: importa o send do adaptador; **um** ramo no ponto em que o destino vira job — WhatsApp segue o caminho de hoje, não-WhatsApp escreve na caixa de saída
- migration aditiva; `MessageLog.deliveryNetwork`/`deliveryReductions` gravados no envio
- `DELIVERY_NETWORKS_ENABLED` (default `whatsapp`)
- rede fictícia em `test/helpers/` + e2e do contrato

**Por que esta é a fatia que prova a não-regressão**: em produção ela entra com o interruptor no default, e nessa condição `buildEntitledGroupConfig` **não emite nenhum destino não-WhatsApp** — o ramo novo do worker nunca executa, o payload do WhatsApp não é tocado e o envio é a mesma função. A diferença observável é zero, e os testes estruturais travam isso.

**Validação em homologação**: gate manual nº 1 da spec (antes × depois numa conta só de WhatsApp: destinos, oferta em grupo, oferta em Canal com botão, histórico, bloqueios). Mais 24 h de observação (gate nº 9).

⚠️ **O deploy desta fatia reconecta todas as sessões de WhatsApp.** É inerente ao modo `remote` e precisa ser anunciado e agendado. É o **único** reinício que esta feature exige.

### Fatia 2 — A cliente vê o aplicativo (API + painel; sem reinício)

Histórico passa a dizer por qual aplicativo a oferta saiu (tudo "WhatsApp"); a configuração do destino exibe o aplicativo; o Story do Instagram aparece declarado e **não selecionável** (FR-034). Prova FR-026, FR-027 e FR-034 com zero Telegram no ar.

### Fatia 3 — Telegram como DESTINO, pelas filas e ofertas automáticas (API + painel; sem reinício)

Caixa de saída + drenador + rodízio + orçamento + adaptador do Telegram + tela de ligar o robô (US2) + estados de prontidão (FR-018) + motivos próprios no histórico (FR-045) + aviso à cliente (FR-029). Os dois dispatchers de oferta já rodam fora do worker, então **as filas e as ofertas automáticas entregam no Telegram nesta fatia** (US4), sem tocar no worker.

### Fatia 4 — Espelhamento de origem de WhatsApp para destino de Telegram (API; sem reinício)

Liga o ramo que a Fatia 1 já deixou no worker: basta o destino de Telegram passar a existir na config (interruptor + direito de plano), e o hand-off começa a valer via `reloadConfig`. **Nenhum reinício de supervisor.** Fecha US3 e FR-010b no sentido WhatsApp → Telegram.

### Fatia 5 — Telegram como ORIGEM (API; sem reinício)

Leitor único + envelope neutro + a blindagem inteira de D-A9 + fan-out: destinos de WhatsApp pelo `sendBroadcast` existente, destinos de Telegram pela caixa de saída. Fecha US8 e o outro sentido do cruzamento. Gate manual nº 4 da spec.

### Fatia 6 — Operação enxerga o robô único (API + painel; sem reinício)

Estado do robô no painel de operação, aviso interno, sinais duráveis, contingência documentada e testada. Fecha US10, FR-041 a FR-043 e R13/R17. Gates manuais nº 6 e nº 8.

---

## Plano de teste

Padrão do repo: **preferir módulo puro testável sem banco e sem rede** (`node:test`), mais **teste estrutural de guarda** onde a regressão é de forma, não de valor.

### Puros (sem banco, sem rede) — o grosso da cobertura

| Arquivo de teste | Prova |
|---|---|
| `test/delivery-networks.test.js` | `resolveDeliveryNetwork`: ausente/desconhecido → `whatsapp`, nunca erro (FR-013/SC-003). Interruptor: default só WhatsApp. Valores não colidem com `Group.kind` (FR-002). |
| `test/delivery-capabilities.test.js` | Decisões saem da declaração: rede que exige imagem recusa oferta sem foto; rede sem botão não oferece botão; rede que não lê origem não aparece como origem (FR-007/FR-008, US7 cenários 2 e 3). |
| `test/delivery-neutral-offer.test.js` | `degradeFor` devolve a oferta **e** a lista do que foi reduzido; degradação silenciosa falha o teste (FR-009/SC-012). |
| `test/delivery-fair-share.test.js` | Uma conta em volume alto não consome a fatia das outras; estourou o orçamento → espera com `notBefore`, nunca descarte nem "entregue" (FR-039/FR-040/SC-013). Fail-safe sem medição. |
| `test/delivery-network-health.test.js` | Sem medição confiável → `sem_medicao`, nunca vermelho. Estados e motivos em linguagem leiga (FR-041). |
| `test/delivery-incoming-envelope.test.js` | Update velho/reentregue é descartado com motivo e idade; update ao vivo passa (FR-056). |
| `test/delivery-failure-taxonomy.test.js` | Cada falha de Telegram tem motivo próprio dentro da taxonomia existente e tradução leiga; nenhuma cai em genérico (FR-028/SC-007). |
| `test/multi-network-plan-gate.test.js` | `multi_network` existe, **não** é `channels`, e a recusa traz explicação + caminho de plano (FR-046/FR-048). |

### Estruturais de guarda — impedem a regressão voltar

| Arquivo de teste | Trava |
|---|---|
| `test/delivery-whatsapp-send-inalterado.test.js` | O corpo do envio de WhatsApp continua com as quatro rotas, o id estável, o strip de canal e o timeout, na mesma ordem. |
| `test/delivery-sem-if-por-rede.test.js` | Nenhum módulo compartilhado (`src/core/` fora de `delivery/networks.js`, `src/billing/`, dispatchers, filas, histórico) compara literalmente com nome de rede. Prova FR-031. |
| `test/delivery-vocabulario.test.js` | Nenhuma superfície nova usa `channel`/"canal" ou `platform`/"plataforma" para aplicativo; nenhuma tela da cliente contém "rede de entrega", "adaptador", "driver", "transporte", "Bot API", "webhook", "token" (FR-001/FR-003/SC-008). |
| `test/delivery-worker-sem-http.test.js` | `src/bot-worker.js` e `src/delivery/whatsapp/` não importam o cliente do Telegram nem fazem HTTP para ele — trava R5 e FR-021 na forma. |
| `test/delivery-protocolo-intocado.test.js` | `src/supervisor/protocol.js` não ganhou comando novo e `PROTOCOL_VERSION` continua `1` (R2/FR-036). |
| `test/delivery-rollout-fora-do-worker.test.js` | Nenhum arquivo de código de worker lê `DELIVERY_NETWORKS_ENABLED` (garante rollback sem reiniciar o supervisor, FR-037). |
| `test/delivery-segredo-do-robo.test.js` | O segredo do robô não aparece em rota, resposta, log, e-mail, tela nem tabela de credencial de loja (FR-016/FR-017). |
| `test/migrations-delivery-network-aditiva.test.js` | A migration só adiciona; nenhum `DROP`, nenhum `RENAME`, nenhuma reescrita de `Group.waJid`/`MessageLog.destGroup` (FR-012). |

### Ponta a ponta com a rede fictícia (a prova de FR-031/SC-009)

`test/delivery-rede-ficticia-e2e.test.js`: registra a rede fictícia (destino único, imagem obrigatória, sem botão, não lê origem) e roda origem → roteamento → conversão → texto → fila → ritmo → repetição → histórico. **Assertiva estrutural junto**: este teste não importa nenhum arquivo de `src/delivery/whatsapp/` nem de `src/delivery/telegram/`, e a fatia não alterou nenhum deles.

### Com banco (poucos, focados)

`DeliveryInboxSeen` garante um espelhamento só sob entrega repetida (SC-016); `DeliveryOutbox` preserva a linha quando o robô está fora (FR-040); rebaixamento de plano não apaga configuração (SC-015).

### Gate manual (spec) — não substituível por teste

Os nove itens do "Gate manual obrigatório" da spec, com grupos reais de Telegram (um de destino, um de origem) em homologação, mais as 24 h de observação de memória e de quedas de sessão.

---

## Riscos R1–R17 — a decisão técnica que trata cada um

| # | Risco | Decisão técnica que o trata | Verificação |
|---|---|---|---|
| **R1** | Tocar o ponto único de envio do WhatsApp | **D-A2**: a função é movida com o corpo inalterado e continua sendo a única coisa que fala com o socket. O ramo novo do worker fica antes da montagem do payload e é inalcançável com o interruptor no default (**D-A4**). | `delivery-whatsapp-send-inalterado`, gate manual nº 1, SC-002 |
| **R2** | Contrato API ↔ supervisor é protegido | **D-A5**: `protocol.js` não é tocado; destino de Telegram não passa pelo worker; origem de Telegram → WhatsApp usa o `sendBroadcast` existente. Não há duas pontas para divergirem. | `delivery-protocolo-intocado` |
| **R3** | Custo de memória | **D-A6**: zero processo novo, zero processo por cliente; duas passadas in-process (< 30 MB). Alternativa de 90–120 MB precificada e rejeitada. Sinalização formal feita no gate. | Gate manual nº 9 (24 h), SC-010 |
| **R4** | Repetição compartilhada entre redes | O identificador do destino é **namespaceado por rede** (**D-A10**) e a chave de repetição é montada por `buildMirrorDedupKeys` a partir dele — destinos de redes diferentes **não podem** produzir a mesma chave. | teste de dedup por destino, FR-023 |
| **R5** | Fila de envio serial | **D-A6 + D-A2**: o worker **nunca** faz HTTP de Telegram. Espera de Telegram vira `notBefore` na caixa de saída, num processo diferente do consumidor serial do WhatsApp. | `delivery-worker-sem-http`, SC-006 |
| **R6** | Ambiguidade de vocabulário | **D-A1**: `deliveryNetwork` interno, "aplicativo" na tela, `multi_network` no direito de plano (nunca `channels`). | `delivery-vocabulario`, `multi-network-plan-gate`, SC-008 |
| **R7** | Cotas e direitos de plano | `FEATURE_CODES.MULTI_NETWORK` + duas camadas: recusa na rota e filtro em `buildEntitledGroupConfig` (mesmo lugar e forma do filtro de canais que já existe). | `multi-network-plan-gate`, gate manual nº 7, SC-014 |
| **R8** | Falha silenciosa da rede nova | **D-A8** + `deliveryFailure.js`: cada falha tem motivo próprio dentro da taxonomia existente, tradução leiga, aviso à cliente e sinal durável. Nenhuma cai em genérico. | `delivery-failure-taxonomy`, gate manual nº 6, SC-007 |
| **R9** | Código novo não valer nos processos de sessão | **Todo** o código de worker está na Fatia 1 (um reinício anunciado). Depois dela, nada do Telegram mora no worker, então nenhum conserto de Telegram exige reiniciar. O interruptor é lido fora do worker (**D-A4**). | `delivery-rollout-fora-do-worker`, FR-037 |
| **R10** | Unicidade de destino | **D-A10**: prefixo de rede torna colisão impossível sem tocar em `@@unique([userId, waJid, role])`. Nada gravado é recusado. | `migrations-delivery-network-aditiva`, US3 cenário 4 |
| **R11** | Avisos em duplicidade | Avisos de rede passam pelo **despachante existente**, com as travas que já existem (conta parada, teto semanal, janela anti-repetição). Aviso à operação vai pelo caminho interno, com cooldown por assunto. Nada de caminho paralelo sem trava. | teste de aviso, FR-029/FR-030 |
| **R12** | Moldar a abstração pelo caso mais divergente | Instagram declarado e **não selecionável** (FR-034); o contrato é provado **hoje** pela rede fictícia de publicação (destino único, imagem obrigatória), não por suposição sobre o Instagram. | `delivery-rede-ficticia-e2e`, SC-009 |
| **R13** | **Robô único como ponto único de falha** | **D-A8**: estado visível no painel de operação, aviso interno, ofertas esperam na caixa de saída sem se perder, WhatsApp intacto por construção (o robô não participa de nenhum caminho de WhatsApp), e contingência de troca de robô **sem tocar em configuração de cliente**. | `delivery-network-health`, gate manual nº 6, SC-018 |
| **R14** | **Orçamento de ritmo compartilhado** | **D-A7**: rodízio entre contas com teto por conta por tick, sob orçamento global; estouro vira espera, não descarte. | `delivery-fair-share`, gate manual nº 8, SC-013 |
| **R15** | **Bloqueio de plano que vaza** | Duas camadas (rota + config do worker + checagem na drenagem da caixa de saída). Rebaixamento **filtra**, nunca apaga: nenhuma linha de `Group` é removida ou reescrita. Aviso explicando; voltar de plano restaura sozinho porque nada foi perdido. | gate manual nº 7, SC-015 |
| **R16** | **Entrada nova sem a blindagem que o WhatsApp levou anos para ganhar** | **D-A9**: freshness reusada sem alterar, dedup **durável** por `@@unique` antes do fan-out, ordem por origem na fila existente, isolamento de mensagem travada pelo mecanismo já corrigido em 2026-08-28. Exigidas explicitamente, uma a uma, com teste próprio. | `delivery-incoming-envelope`, teste de `DeliveryInboxSeen`, gate manual nº 4, SC-016/SC-017 |
| **R17** | **Leitura de todas as origens dependendo do mesmo robô** | Mesmo tratamento de R13 aplicado ao leitor: o estado do robô cobre leitura e publicação, o aviso interno distingue as duas, e o texto para a cliente deixa claro que **o problema não é o grupo dela**. As origens de WhatsApp de todas as contas seguem intocadas (o leitor vive fora do worker). | `delivery-network-health`, gate manual nº 6 |

---

## Questões em aberto (decisão da dona do produto — não inventadas aqui)

| # | Questão | Por que não dá para decidir sozinho | Bloqueia qual fatia |
|---|---|---|---|
| **Q1** | **Qual é a fronteira de plano do multicanal?** A spec supõe "Pro ou teste grátis ativo" (a mesma de Canal do WhatsApp, preservação avançada, ofertas automáticas e filas), mas a própria spec marca isso como ⚠️ suposição, não fato — em particular se o **teste grátis** deve ou não dar acesso. | É decisão comercial. O código só mostra o padrão vigente; ele não determina que o multicanal caiba nele. | Fatia 1 (o valor de `canUseMultiNetwork`) |
| **Q2** | **Haverá um robô de Telegram separado para homologação?** É **obrigatório**: dois ambientes lendo o mesmo robô por `getUpdates` recebem `409 Conflict` do Telegram e um deles para de ler — e o gate manual da spec exige validar em homologação com grupo real. | Depende de criar um segundo robô e de como a marca dele aparece. | Fatia 5 (e o gate) |
| **Q3** | **Qual o nome público do robô?** Ele fica **visível para os membros dos grupos das clientes** (a spec já aceita isso conscientemente em Assumptions). O nome é decisão de marca. | Não é decisão técnica. | Fatia 3 |
| **Q4** | **Leitura por consulta contínua ou por aviso do Telegram?** A recomendação técnica é **consulta contínua** (funciona igual em prod e em homologação, sem endereço público, sem TLS, sem depender da Cloudflare). O aviso seria mais barato em prod e inviável em homologação hoje. | Mudar depois custa pouco, mas escolher agora evita retrabalho. | Fatia 5 |
| **Q5** | **Quais controles de ritmo a cliente vê num destino de Telegram?** A spec diz que "preservação" ali significa respeitar os limites do aplicativo, não replicar as regras anti-ban do WhatsApp — mas não define quais campos aparecem na tela. | É decisão de produto sobre o que a cliente controla e o que o sistema decide sozinho. | Fatia 3 |
| **Q6** | **Quais são os limites reais a adotar como orçamento do robô?** Os números correntes (~30 mensagens/s global, ~20/min por grupo) vêm da documentação pública do Telegram, **não de medição nossa**. | Precisam ser calibrados em homologação antes de virar constante. | Fatia 3 (calibração, não bloqueio) |

**Condição registrada (não é pergunta)**: a escolha de rodar o leitor dentro da API depende de `api` continuar em `instances: 1`. Se isso mudar, o leitor precisa de trava de dono única no Redis ou de processo dedicado — e aí a estimativa de memória volta à mesa com o número de 90–120 MB.

---

## Complexity Tracking

| Violação aparente | Por que é necessária | Alternativa mais simples rejeitada porque |
|---|---|---|
| Duas tabelas novas (`DeliveryOutbox`, `DeliveryInboxSeen`) | FR-040 exige que a oferta **espere sem se perder** quando o robô está fora, e FR-055 exige dedup de entrada que sobreviva a **processos diferentes**. As duas coisas precisam ser duráveis. | Fila só em memória perde tudo num deploy da API. Redis sozinho não serve: `REDIS_URL` é opcional no modo `inline` e a garantia "nunca perder" não pode depender de infraestrutura opcional. |
| Uma pasta nova (`src/delivery/`) separada de `src/core/delivery/` | É o que permite a rede fictícia provar o contrato **sem importar** nada de WhatsApp ou de Telegram (SC-009), e o que mantém os módulos de decisão puros e testáveis sem rede. | Colocar tudo em `src/core/` misturaria I/O com decisão pura e tornaria SC-009 inverificável. |
| Ramo de hand-off entrando no worker já na Fatia 1, ainda inalcançável | Cada deploy que toca código de worker **reconecta todas as sessões de WhatsApp**. Concentrar tudo numa fatia troca dois reinícios anunciados por um. | Deixar o ramo para a Fatia 4 custaria um segundo reinício de todas as sessões em produção, que é o custo operacional mais caro que este repositório tem. |

