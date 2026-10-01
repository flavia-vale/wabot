# Vários servidores de robôs (multi-supervisor) — guia de ativação e registro técnico

Estado em 2026-10-01. Código mesclado em `develop` pelo PR #2106 (commit `93a458e`).
**Tudo nasceu desligado** atrás de `SUPERVISOR_NODE_ROUTING` (padrão: desligado).
Este documento tem 3 partes: (1) guia em linguagem leiga, (2) registro técnico do
que foi feito e do que falta, (3) o prompt para pedir segunda opinião a outra IA
está em `docs/ops/multi-supervisor-prompt-segunda-opiniao.md`.

---

## PARTE 1 — Guia em linguagem leiga

### O que é isso, em uma frase
Hoje todos os robôs de WhatsApp moram em **um único servidor**. Preparamos o
sistema para, no futuro, ter **dois ou mais servidores**, cada um cuidando de um
grupo de clientes, para a plataforma crescer sem sobrecarregar um servidor só.

### O que já está pronto (e o que isso muda hoje)
- Cada conta ganhou uma "etiqueta de servidor" (vazia por enquanto = servidor 1).
- Cada servidor terá a própria "caixa de entrada" de comandos, para um pedido
  como "ligar o robô da cliente X" nunca cair no servidor errado e se perder.
- O sistema sabe escolher, para uma cliente nova, o servidor com mais vagas.
- Os avisos de "vagas acabando" e de "servidor lotado" passam a olhar o servidor
  da própria cliente.
- **Impacto hoje: nenhum.** Está tudo desligado; o sistema funciona como antes.
  Única mudança real: o banco ganhou uma coluna vazia (segura e reversível).

### Antes de qualquer coisa: o que ainda NÃO existe
Um segundo servidor de verdade. Para ele existir, faltam coisas que **não** foram
feitas (ver Parte 2, itens B-1 a B-4). A principal: o banco de dados de hoje é um
arquivo guardado dentro do servidor, então um segundo servidor **não enxerga** as
mesmas contas. Precisa antes mudar para um banco que os dois servidores acessem.
**Impacto se ignorar:** o segundo servidor subiria "cego", sem conhecer nenhuma
cliente.

### Passo a passo para ligar (só quando houver segundo servidor)

**Passo 0 — Conferir o ambiente de testes (staging).**
O que fazer: ver se o último deploy passou e se as contas continuam conectando e
enviando ofertas normalmente. Medir a memória (comando no fim desta parte).
Impacto se pular: um problema só apareceria na produção, com clientes reais.

**Passo 1 — Mandar a novidade para produção (desligada).**
O que fazer: abrir o pedido de `develop` para `main` e fazer o merge.
Impacto: nenhum para as clientes (continua desligada). A coluna nova entra no banco.

**Passo 2 — Reiniciar o servidor de robôs com a novidade ligada nele.**
O que fazer: **avisar as clientes antes**; reiniciar só o servidor de robôs,
ligando a novidade nele e dando o nome "n1" a esse servidor.
Impacto: **todos os robôs reconectam**. Alguns minutos sem receber/enviar ofertas;
risco de algumas conexões demorarem a voltar. Fazer em horário de menos movimento.
Importante: a parte do site/API **continua no modo antigo** neste passo. O servidor
de robôs passa a atender os dois caminhos (o novo e o antigo), então nada se perde.

**Passo 3 — Ligar a novidade na parte do site/API e observar 48 horas.**
O que fazer: ligar a novidade só na API e acompanhar durante 48 horas se a fila
antiga ficou vazia (ninguém mais usa o caminho antigo).
Impacto se ligar ANTES do Passo 2: os comandos vão para uma caixa de entrada que
ninguém está lendo; o painel trava, o QR não aparece, "ligar robô" dá erro.
Por isso a ordem 2 → 3 é obrigatória.

**Passo 4 — Marcar todas as contas atuais como "servidor 1" e remover o caminho antigo.**
O que fazer: gravar a etiqueta "n1" em todas as contas que estão sem etiqueta e,
depois, desligar o caminho antigo.
Impacto: baixo. Se algo der errado, voltar a etiqueta para vazia desfaz.

**Passo 5 — Entrada do segundo servidor.**
Só depois de B-1 a B-4 (Parte 2). Contas **novas** passam a ir para o servidor
com mais vagas; contas antigas **continuam onde estão** (não se movem sozinhas,
porque o login do WhatsApp fica guardado no disco do servidor).

### Como voltar atrás (se algo der errado)
- Desligar a novidade na API e reiniciar a API: volta ao caminho antigo, sem
  reconectar robôs (a API reinicia sem tocar neles).
- No servidor de robôs, desligar a novidade e reiniciar **reconecta todos os
  robôs** — só em último caso e avisando antes.

### Medir a memória do servidor (rodar na VPS, é só leitura)
```
free -m | grep -E "Mem|Swap"; ps -eo rss,args | grep "[b]ot-worker" | awk '{n++; s+=$1} END {printf "robos: %d | memoria dos robos: %.1f GB\n", n, s/1048576}'
```
Como ler: linha `Swap` com "usado" perto de zero = tranquilo. Swap usado alto e
crescendo = perigo (o que decide é o swap). Se `robos: 0`, o nome do processo é
outro: me envie a saída de `pm2 list`.

---

## PARTE 2 — Registro técnico

### A. Feito (PR #2106, em `develop`)

| Área | Arquivo | O que mudou |
|---|---|---|
| Protocolo (aditivo, `PROTOCOL_VERSION` = 1) | `src/supervisor/protocol.js` | `DEFAULT_NODE_ID='n1'`, `isValidNodeId` (`^[a-z0-9-]{1,16}$`), `commandQueueName(id)` → `supervisor-commands-<id>` (hífen: BullMQ proíbe `:`), `heartbeatKey(id)`, `bootedAtKey(id)`. Nomes legados intactos. |
| Banco | `prisma/schema.prisma`, migration `20261001130000_wa_session_node_id` | `WaSession.nodeId String?` + `@@index([nodeId])`. Nulo = `n1`. `ownerInstance` não reutilizado (é da POC de shard). `schema.postgres.prisma` é stub sem modelos: só comentário. |
| Helpers puros | `src/supervisor/nodeRouting.js` | `isNodeRoutingEnabled`, `resolveSupervisorNodeId` (inválido lança), `resolveKnownNodeIds` (`SUPERVISOR_NODE_IDS`), `ownsLegacyQueue` (só `n1`), `nodeIdWhere`/`buildResumeWhere`, `createNodeOwnershipCache`. |
| Colocação | `src/supervisor/placement.js` | `pickNodeForNewSession` (nó vivo com mais vagas; empate = menor id; sem medição não presume vaga; sem candidato = null), `resolveSessionNodeId`. |
| Supervisor | `src/supervisor/index.js` | Flag on: Worker na fila do nó + (só `n1`) Worker na legada; posse por `nodeId` (cache 10 s, aquecido no processador de comandos) no lugar do hash; resume/ressurreição filtrados por nó; heartbeat/bootedAt nas chaves novas e (só `n1`) nas legadas; `shutdown` fecha todos os Workers; o sweep de 5 s **não para** robô por posse quando há roteamento; `SUPERVISOR_NODE_ID` inválido = `exit(1)`. Flag off: caminho idêntico ao anterior. |
| Cliente (API) | `src/supervisor/client.js` | Flag on: `Queue`+`QueueEvents` por nó (lazy, a legada nem é aberta); nó resolvido por banco + cache 45 s (falha de leitura propaga); `START_BOT` sem `nodeId` → `placement` e **grava `nodeId` antes de enviar** (`updateMany where nodeId null`; sem linha → `create`, corrida resolvida relendo); sem nó disponível → `false`; `LIST_RUNNING_BOTS` em fan-out aos nós vivos, **rejeita** se qualquer nó falhar; `listRunningBotsByNode()` → `{n1:12,n2:null}`; `isSupervisorAlive(nodeId?)` (sem id = todos os nós vivos); `getSupervisorBootedAtMs(nodeId?)` (sem id = boot mais antigo). Flag off: caminho idêntico. |
| Fachada | `src/manager.js` | repassa `nodeId`; novos `listRunningBotsByNode()` e `getNodeRoutingInfo(userId)`. |
| Recusa de start | `src/domain/session/startRefusal.js`, `src/api/routes/session.js` | flag on: "servidor errado" = nó da conta sem heartbeat; contagem/teto do nó. Textos e ordem inalterados, sem jargão. |
| Aviso de vagas | `src/ops/sessionCapacityAlertSweep.js`, `…Policy.js`, `src/api/server.js` | flag on: avalia o nó mais cheio; chave de cooldown e texto levam "servidor nX". |
| Docs | `docs/rca/deploy-e-infra.md` | seção "Vários supervisores (nós)". |
| Testes | 6 arquivos atualizados + `test/supervisor-placement.test.js` | cobrem flag off idêntica, nomes sem `:`, roteamento, fan-out com falha → sem medição, `nodeId` gravado antes do `START_BOT`, resume por nó. Suíte: 5100 testes. |

Variáveis de ambiente novas: supervisor `SUPERVISOR_NODE_ROUTING`, `SUPERVISOR_NODE_ID` (padrão `n1`); API `SUPERVISOR_NODE_ROUTING`, `SUPERVISOR_NODE_IDS` (csv, padrão `n1`).

Decisões de projeto (e por quê):
1. Posse por banco, não por hash: mudar o número de nós realocaria ~metade das contas e o `auth_info` é disco local.
2. Só o `n1` lê a fila legada: outro nó pegaria jobs de contas do `n1`.
3. `listRunningBots()` rejeita em vez de somar parcial: nunca afirmar teto sem medição (RCA de capacidade).
4. Sweep de 5 s não mata por posse: um comando mal roteado aqueceria o cache com outro nó e o nó mataria o próprio robô.
5. API com flag on não abre a fila legada (−1 par Queue/QueueEvents).

### B. Falta fazer (ordem sugerida)

**Pré-requisitos para existir um 2º servidor (não feitos, fora do escopo do PR):**
- **B-1 Banco compartilhado.** SQLite é arquivo local; um 2º servidor não enxerga as mesmas contas. Exige o cutover para Postgres (hoje `schema.postgres.prisma` é só stub, sem modelos). Bloqueia tudo abaixo.
- **B-2 Redis acessível pelos dois servidores** (fila, pub/sub, heartbeat, last-event). Hoje é local (`REDIS_URL`). Ponto único de falha; avaliar latência e segurança (senha/TLS).
- **B-3 Deploy por servidor.** `deploy.yml` e `scripts/deploy_safe_*.sh` assumem um VPS; precisa definir como o código chega ao 2º nó e como cada nó recebe seu `SUPERVISOR_NODE_ID`/`.env`.
- **B-4 Disco/credenciais do WhatsApp (`auth_info`).** Local por nó; mover uma conta entre nós exige copiar/migrar a pasta e parar o robô antes (risco de dois sockets na mesma credencial = queda em loop). Não há ferramenta de migração de conta entre nós.

**Validação e ativação:**
- **B-5** Conferir deploy do staging do PR #2106 (não verificado nesta sessão) e a migration aplicada (`SELECT COUNT(*) FROM WaSession` igual antes/depois).
- **B-6** Medir RAM/swap em staging e produção (comando na Parte 1); confirmar a estimativa (≈1–3 MB por nó na API; +1 conexão Redis no supervisor `n1`). Estimativa, não medição.
- **B-7** PR `develop` → `main` (flag desligada).
- **B-8** Ativação em 3 passos (runbook): (1) reinício anunciado do supervisor com flag on + `SUPERVISOR_NODE_ID=n1`, API ainda legada; (2) flag on só na API, 48 h com a fila legada zerada; (3) backfill `UPDATE "WaSession" SET "nodeId"='n1' WHERE "nodeId" IS NULL;` e remoção do consumidor legado. Em modo `remote` o deploy da API não reinicia o supervisor: a API nunca troca de fila antes dele.

**Evolução (backlog):**
- **B-9** Painel `/admin/capacidade` multi-nó.
- **B-10** Limite de envio (rate limit/anti-ban) global entre nós; hoje é por processo.
- **B-11** Migração de conta entre nós (parar → copiar `auth_info` → gravar `nodeId` → iniciar) com verificação.
- **B-12** Remover a fila e as chaves legadas depois de estável.
- **B-13** `SHARD_COUNT`/`SHARD_INDEX` e a POC de shard (`ownerInstance`): com a flag on são ignorados para posse; decidir se serão removidos.
- **B-14** IP de saída diferente por servidor: avaliar risco de ban/QR no WhatsApp ao mudar o IP de uma conta.

### C. Riscos conhecidos e pontos a vigiar
- Cache de posse no supervisor (10 s, sem expiração ativa) e na API (45 s): uma conta movida de nó pode receber comandos no nó antigo até expirar. Hoje não há movimentação, então é inerte.
- `listRunningBots()` com um nó fora do ar passa a **rejeitar**; telas do admin que o chamam sem `catch` podem degradar (as conhecidas já tratam).
- `START_BOT` de conta sem linha em `WaSession` faz a API **criar** a linha (com `nodeId`); se outro fluxo também criar, a corrida é tratada relendo o dono.
- Sem nó vivo com vaga, o start é recusado (`false`) e a cliente vê a mensagem genérica/de capacidade da API.
- `isSupervisorAlive()` sem `nodeId` exige todos os nós listados em `SUPERVISOR_NODE_IDS`: um nó listado que nunca subiu mantém o alarme aceso.
- Lacuna de teste: não há teste de integração do `index.js` do supervisor com Redis real; posse/resume são cobertos nos helpers puros e por leitura de código/subprocesso.
- Reiniciar o supervisor derruba e reconecta todas as sessões (anunciar antes).

- **MN-09** Cada supervisor publica o próprio teto em `supervisor:capacity:<nodeId>` (TTL do heartbeat). A API lê dali para placement, recusa de start e aviso de vagas (menor folga entre nós). **Sem a chave o teto não é presumido** (nó nunca é escolhido; nenhum teto cheio é afirmado). Por isso o supervisor precisa estar na versão nova antes de ligar a flag na API (passo 1 antes do passo 2/3).
- **MN-10** Cadeado de posse no Redis (`SUPERVISOR_OWNER_LEASE=1`, só com roteamento ligado; padrão off): `supervisor:owner:<userId>`, TTL 60 s, renovado a cada 20 s. START_BOT em nó diferente do dono do cadeado é recusado (`session_lease_conflict`). Falha ABERTA: Redis fora = só perde a guarda extra, o banco continua mandando. Liberado em STOP_BOT e no shutdown.

## Runbook revisado (MN-14) — rode a pré-checagem ANTES de cada passo

Script read-only (`scripts/preflight-multi-supervisor.mjs`, no diretório do ambiente). Sai com erro se algo bloquear:

| Antes de… | Comando | O que ele barra |
|---|---|---|
| reiniciar o supervisor com a flag (passo 2) | `node scripts/preflight-multi-supervisor.mjs --passo=supervisor` | `SUPERVISOR_NODE_ID` inválido (o supervisor não sobe e TODOS os robôs caem) |
| ligar a flag na API (passo 3) | `node scripts/preflight-multi-supervisor.mjs --passo=api` | servidor sem heartbeat ou sem teto publicado; avisa se a fila antiga ainda tem pedidos; nome inválido em `SUPERVISOR_NODE_IDS` |
| listar um n2 em `SUPERVISOR_NODE_IDS` | `node scripts/preflight-multi-supervisor.mjs --passo=segundo-no` | contas ainda sem `nodeId` (rode o backfill antes), conta apontando para servidor fora da lista |

Ordem obrigatória: supervisor (passo 2) → API (passo 3) → **backfill** → só então n2 na lista. Mantenha o consumidor da fila legada (remoção só pegando carona num restart inevitável — MN-19); não conte com "remover o consumidor legado" como passo de baixo impacto: exige novo restart do supervisor = reconexão geral.
Guarda da API: com a flag ligada, a API loga `node_routing_no_heartbeat` (a cada 30 s) se algum nó listado estiver sem heartbeat. **Só loga**, nunca derruba a API.
Rollback da API só é seguro enquanto nenhuma linha tiver `nodeId` diferente de `n1`.
