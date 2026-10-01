# Prompt para segunda opinião (colar em outra IA)

Copie tudo abaixo da linha. Anexe, se puder, `docs/ops/multi-supervisor-ativacao.md`.

---

Você é um(a) arquiteto(a) de software sênior especialista em Node.js, filas (BullMQ/Redis), Baileys/WhatsApp, SQLite/Postgres, Prisma e operação em VPS. Quero uma **segunda opinião crítica** e um **plano técnico estruturado em backlog**. Não seja complacente: procure o que está errado ou faltando.

## Contexto do produto
SaaS brasileiro ("Espelha Grupos") que espelha ofertas entre grupos de WhatsApp. Cada cliente tem uma sessão WhatsApp (Baileys) rodando em um processo filho ("bot-worker"). Um processo PM2 "bot-supervisor" faz o `fork()` dos workers; a API (Fastify) fala com o supervisor por **Redis**: comandos request-response em uma fila BullMQ única (`supervisor-commands`) e eventos por pub/sub (`bots:events`). Há ~11–80 sessões por servidor (teto `MAX_SESSIONS_PER_PROCESS`; ~0,35 GB de RAM por sessão para planejar). Banco hoje: **SQLite local** (Prisma). Credenciais do WhatsApp (`auth_info`) ficam em **disco local**. Ambientes: staging (`develop`) e produção (`main`). Deploy automático por GitHub Actions; em modo `remote` o deploy da API **não** reinicia o supervisor (reiniciá-lo reconecta todas as sessões e arrisca queda/ban).

## Objetivo
Permitir **vários supervisores (nós)** em servidores diferentes, cada um dono de um conjunto de sessões, sem mudar nada em produção até ligar uma flag (`SUPERVISOR_NODE_ROUTING`, padrão desligado).

## Diagnóstico que motivou
- Todo comando ia para a fila única; com 2 supervisores o BullMQ entrega cada job a UM consumidor, e se caísse no nó errado o comando era descartado e se perdia.
- Chaves de heartbeat/bootedAt eram únicas; `LIST_RUNNING_BOTS` respondia só pelo processo que pegou o job.
- A posse era `sha1(userId) % SHARD_COUNT`: mudar o número de nós realocaria ~metade das contas, e `auth_info` é disco local.

## O que JÁ foi implementado (mesclado em `develop`, tudo desligado)
1. Protocolo aditivo (`PROTOCOL_VERSION` segue 1): `commandQueueName(nodeId)` = `supervisor-commands-<id>` (hífen; BullMQ proíbe `:`), `heartbeatKey`, `bootedAtKey`, validação `^[a-z0-9-]{1,16}$`.
2. Prisma: `WaSession.nodeId String?` + índice; nulo = `n1`. (`ownerInstance` não reutilizado: é de uma POC de shard.) O schema Postgres é um stub sem modelos.
3. Supervisor (flag on): consome a fila do nó e, **só o `n1`**, também a legada (transição); posse por `nodeId` com cache de 10 s (aquecido no processador de comandos); resume/ressurreição filtrados por nó; heartbeat/bootedAt nas chaves novas e, só no `n1`, nas legadas; o sweep de 5 s que antes parava robô "fora do shard" **não para mais** com roteamento.
4. Cliente da API (flag on): `Queue`+`QueueEvents` por nó (lazy; a legada nem é aberta); nó resolvido por banco + cache 45 s (falha de leitura propaga); `START_BOT` de sessão sem nó usa função pura `placement` (nó vivo com mais vagas livres) e **grava `nodeId` antes de enviar** (`updateMany where nodeId null`; sem linha → `create`); `LIST_RUNNING_BOTS` faz fan-out aos nós vivos e **rejeita** se qualquer nó falhar (nunca soma parcial); `listRunningBotsByNode()`; `isSupervisorAlive(nodeId?)` e `getSupervisorBootedAtMs(nodeId?)`.
5. Recusa de start e aviso de vagas usam contagem/teto do nó da conta; "servidor errado" passa a significar "nó da conta sem heartbeat". Mensagens em linguagem leiga.
6. Testes (node:test) cobrindo flag off idêntica, nomes sem `:`, roteamento, fan-out com falha, `nodeId` gravado antes do `START_BOT`, resume por nó. Suíte de 5100 testes passa.
Flag off = comportamento idêntico ao anterior.

## Runbook de ativação planejado
1. Deploy com reconexão anunciada: supervisor com flag on (`SUPERVISOR_NODE_ID=n1`) ouvindo fila legada + `-n1`; API ainda na legada.
2. Ligar a flag só na API; observar 48 h com a fila legada zerada.
3. Backfill `nodeId='n1'` nas contas sem valor; depois remover o consumidor legado.
Racional: em `remote` o deploy da API não reinicia o supervisor, então a API nunca pode trocar de fila antes de o supervisor já estar ouvindo a nova.

## O que AINDA falta (backlog que eu conheço)
Banco compartilhado (cutover Postgres); Redis acessível por todos os nós; deploy por servidor; migração de conta entre nós (`auth_info`); painel de capacidade multi-nó; rate limit/anti-ban global; remover fila legada; destino da POC de shard; efeito do IP diferente por servidor no WhatsApp; medição real de RAM (hoje só estimativa).

## O que quero de você
1. **Validação:** o desenho está correto? Aponte falhas lógicas, condições de corrida e furos no runbook (inclua a ordem dos passos e o que acontece se algum falhar no meio).
2. **Impactos não mapeados:** liste riscos que eu não citei (dados, filas BullMQ — stalled jobs, locks, `removeOnComplete` —, pub/sub e cache de último evento, Baileys/ban, sessões órfãs, split-brain, latência de Redis/DB remotos, observabilidade, segurança, custo, LGPD). Para cada um: probabilidade, severidade, como detectar e como mitigar.
3. **Segunda opinião:** existe abordagem melhor (ex.: fila única com roteamento por job/grupos de consumidores, consistent hashing, lease/lock de posse no Redis, um supervisor por nó com API por nó, não escalar horizontalmente e sim verticalmente)? Compare custo/risco/benefício e diga qual você escolheria e por quê.
4. **Plano estruturado em backlog**, em ordem de prioridade (P0, P1, P2…), como tabela com: ID, título, descrição técnica, dependências, esforço (P/M/G), risco, critério de aceite, como testar e como reverter. Marque o que bloqueia o quê (caminho crítico).
5. **Para CADA item e CADA risco, inclua também uma explicação em linguagem leiga** (2–3 frases, sem jargão): o que é, por que importa para o negócio e qual o impacto para as clientes se der errado.
6. Termine com: (a) as 5 perguntas que você me faria antes de começar; (b) uma lista de "o que eu NÃO verificaria por suposição" — pontos em que você precisaria de dados reais (logs, medições) para opinar.

Regras: não invente fatos sobre meu sistema; quando depender de dado que você não tem, diga "hipótese" e diga qual dado confirmaria. Seja direto e organize a resposta com títulos.
