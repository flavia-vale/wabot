# Diagnóstico de RSS das sessões WhatsApp — 2026-09-13

> Documento de handoff para revisão independente por outra IA ou por uma pessoa
> engenheira. Consolida o pedido, as evidências coletadas na VPS, a leitura do
> código e as conclusões da conversa de 13 de setembro de 2026. Não contém
> credenciais, telefones, e-mails, IPs, JIDs nem identificadores de clientes.

## 1. Objetivo original

Investigar por que o Espelha Grupos consome muita memória com poucas sessões
WhatsApp e encontrar mudanças **cirúrgicas de engenharia de software** capazes
de reduzir o RSS por sessão ou aumentar a densidade por processo.

O escopo solicitado foi deliberadamente estreito:

- Node.js, V8 e Baileys;
- estado criptográfico e histórico do WhatsApp;
- processos e isolamento das sessões;
- buffers, imagens, Sharp e coleta de lixo;
- possibilidade de hibernar sessões ociosas;
- evitar explicações genéricas de “vazamento” sem evidência;
- evitar, nesta fase, uma reestruturação completa de infraestrutura.

## 2. Arquitetura observada

### Produção

- `bot-supervisor` roda em modo `remote`.
- O supervisor usa `fork()` para criar um processo Node dedicado por sessão.
- Todos os 37 `bot-worker` de produção observados eram filhos do mesmo
  supervisor.
- Cada worker anuncia `--max-old-space-size=384`.
- O limite PM2 de `400M` pertence ao processo supervisor e não engloba o RSS
  agregado dos filhos.
- Redis é usado para comandos/eventos e deduplicação, mas cada conexão Baileys
  continua residente no respectivo worker.

### Staging

- `api-staging` estava em modo `inline` e tinha um único worker filho.
- `bot-supervisor-staging` estava vivo, porém em `STANDBY`.
- Não foi encontrada evidência de dupla posse da credencial em staging.

### Modelo de estado persistido

`WaSession` registra separadamente `status`, `lifecycle`, `ownerInstance`,
`lastHeartbeatAt` e `lastDisconnectCode`. Por isso, nenhum desses campos deve
ser interpretado isoladamente como prova de que um socket está vivo.

## 3. Dados relevantes coletados

### 3.1 Host

- Ubuntu 24.04.4, kernel 6.8.
- 8 vCPUs AMD EPYC.
- Aproximadamente 15 GiB de RAM.
- 4 GiB de swap.
- Carga de CPU baixa durante a coleta.
- Nenhuma ocorrência de OOM encontrada no kernel no período pesquisado.
- PSI sem pressão sustentada no instante consultado.
- `vmstat` sem atividade relevante de swap no instante consultado.

### 3.2 Contagem de processos

| Categoria | Quantidade |
|---|---:|
| `bot-worker` de produção | 37 |
| `bot-worker` de staging | 1 |
| `bot-supervisor` de produção | 1 |
| `bot-supervisor-staging` | 1 |
| API de produção | 1 |
| API de staging | 1 |

Não foram encontrados processos Chromium/Chrome associados ao pipeline.

### 3.3 RSS agregado por categoria

| Categoria | Processos | RSS observado |
|---|---:|---:|
| Workers de produção | 37 | 10.860,6 MiB |
| Worker de staging | 1 | 206,1 MiB |
| Supervisor de produção | 1 | 121,2 MiB |
| Supervisor de staging | 1 | 114,7 MiB |
| API de produção | 1 | 257,9 MiB |
| API de staging | 1 | 172,8 MiB |
| Redis | 1 | 22,9 MiB |

Observação: a soma de RSS pode contar páginas compartilhadas mais de uma vez.
Ainda assim, PSS/private dirty e `memory.current` indicaram comprometimento
físico relevante, de modo que a conclusão de baixa folga não depende de tratar
a soma de RSS como memória perfeitamente exclusiva.

### 3.4 Coleta de memória por 30 minutos

Arquivo bruto preservado na VPS no momento da conversa:

```text
/tmp/wabot-memory-20260913T183441Z.csv
```

Resumo informado pelo script:

| Métrica | Resultado |
|---|---:|
| Amostras | 30 |
| Workers médios | 37,2 |
| RSS total mínimo | 10.675,4 MiB |
| RSS total médio | 10.894,8 MiB |
| RSS total máximo | 11.201,2 MiB |
| Oscilação máximo − mínimo | 525,8 MiB |
| RSS médio aproximado por worker | 292,9 MiB |

O último número é `10.894,8 / 37,2`; ele é uma média operacional, não um
limite por sessão.

#### Maiores workers na janela

| PID da amostra | RSS mín. | RSS méd. | RSS máx. | Delta informado |
|---:|---:|---:|---:|---:|
| 576023 | 516,6 MiB | 540,3 MiB | 564,2 MiB | +13,6 MiB |
| 576078 | 347,0 MiB | 395,0 MiB | 435,5 MiB | −12,7 MiB |
| 575962 | 331,7 MiB | 376,1 MiB | 421,3 MiB | +7,5 MiB |
| 576089 | 358,4 MiB | 387,7 MiB | 416,8 MiB | +11,8 MiB |
| 575935 | 402,9 MiB | 404,2 MiB | 406,2 MiB | +1,8 MiB |
| 575992 | 339,8 MiB | 373,0 MiB | 403,7 MiB | −4,1 MiB |
| 576026 | 346,2 MiB | 379,3 MiB | 400,4 MiB | −41,5 MiB |

#### Exemplos de workers estáveis ou que encolheram

- PID 576125: delta de 0,0 MiB.
- PID 576069: delta de +0,4 MiB.
- PID 576019: delta de +0,4 MiB.
- PID 575895: delta de +0,5 MiB.
- PID 576014: delta de −35,3 MiB.
- PID 575889: delta de −40,7 MiB.
- PID 575901: delta de −20,2 MiB.

Não houve swap por worker durante essa coleta. FDs ficaram aproximadamente na
faixa de 42–50 e threads normalmente em 21, com máximos de 24–26.

### 3.5 CPU por worker

A maioria dos workers ficou próxima de zero. Maiores médias observadas:

| PID da amostra | CPU média |
|---:|---:|
| 575962 | 9,60% |
| 576078 | 5,72% |
| 576089 | 4,23% |
| 576023 | 2,05% |

Não houve major page faults relevantes. Em um host com 8 vCPUs, a CPU não se
mostrou o recurso limitante durante a janela.

### 3.6 Cgroups

Os workers estavam em cgroup v2 sob:

```text
/user.slice/user-1000.slice/session-1.scope
```

Valores relevantes:

- `memory.high=max`;
- `memory.max=max`;
- nenhum evento `oom` ou `oom_kill` registrado;
- `memory.current` do escopo da sessão próximo de 10 GiB;
- pico do escopo próximo de 13,4 GiB;
- `memory.current` do `user-1000.slice` próximo de 14,6 GiB;
- pico do `user-1000.slice` próximo de 14,9 GiB;
- pico histórico de swap próximo de 1,1 GiB.

Conclusão factual: não há isolamento rígido de memória envolvendo supervisor e
filhos. O sistema operacional não impôs um teto antes da memória total do host.

### 3.7 Sessões persistidas

Resumo agregado de produção, no instante consultado:

| Estado | Quantidade |
|---|---:|
| Total de `WaSession` | 146 |
| `status=connected` | 36 |
| `status=disconnected` | 110 |
| `lifecycle=ready` | 47 |
| `lifecycle=disconnected` | 79 |
| `lifecycle=stopped_by_user` | 15 |
| `lifecycle=idle` | 3 |
| `lifecycle=authenticating` | 2 |
| Com telefone | 108 |
| Sem telefone | 38 |
| Com `ownerInstance` | 143 |
| Sem `ownerInstance` | 3 |
| Heartbeat nos últimos 5 minutos | 37 |
| Heartbeat ausente | 3 |
| Conectada sem heartbeat recente | 0 |

A correspondência entre 37 heartbeats e 37 workers de produção sugere um
worker por sessão viva ou em transição. Não apareceu uma frota extra de
processos órfãos.

Há uma divergência persistida a investigar: 47 registros `ready`, mas apenas
36 `connected`. Isso não prova 11 sockets conectados escondidos; indica que
`status` e `lifecycle` podem ficar defasados entre si.

### 3.8 Último código de desconexão

| `lastDisconnectCode` | Sessões |
|---|---:|
| `401` | 42 |
| `408` | 10 |
| `500` | 5 |
| `403` | 1 |
| `null` | 88 |

Esses são **últimos códigos persistidos**, não uma contagem de incidentes numa
janela. Não se pode concluir, por exemplo, que ocorreram 42 quedas `401`
recentemente.

### 3.9 Redis

| Métrica | Resultado |
|---|---:|
| `used_memory` | 9,67 MiB |
| RSS | 22,54 MiB |
| Clientes | 40 |
| Clientes bloqueados | 3 |
| Chaves expulsas | 0 |
| Conexões rejeitadas | 0 |
| Chaves aproximadas em DB 0 | 23,4 mil |
| Chaves com TTL encontradas no scan | 23.318 |
| Chaves sem TTL encontradas no scan | 40 |

RDB e AOF estavam habilitados/saudáveis. A maior parte das chaves era de
deduplicação com TTL. Redis não explica os quase 11 GiB dos workers.

### 3.10 Disco e logs

- Raiz com aproximadamente 38 GiB, 23 GiB usados e 14 GiB livres.
- `~/.pm2` consumia aproximadamente 2,1 GiB, quase tudo em logs.
- Diretório compartilhado de credenciais de produção próximo de 992 MiB.
- Banco de produção próximo de 478 MiB.
- Logs compartilhados do bot próximos de 291 MiB.
- Vários logs rotacionados do supervisor próximos do limite de 100 MiB.
- PM2 logrotate configurado com compressão, retenção 10 e máximo 100 MiB.

O log do worker imprimia repetidamente configurações extensas de grupos por
mensagem. Também havia repetição de erros criptográficos `Bad MAC` e decisões
normais de cron (“plano não permite”) no arquivo de erro da API.

## 4. Leitura relevante do código

### 4.1 Limite V8 não é limite de RSS

`resolveWorkerExecArgv()` fornece por padrão:

```text
--max-old-space-size=384
```

Esse parâmetro limita principalmente o old space do heap V8. Não limita de
forma rígida:

- `Buffer`/`ArrayBuffer`;
- memória nativa do Sharp/libvips;
- OpenSSL e criptografia Signal;
- pilhas de threads;
- WebSocket;
- páginas mapeadas e código JIT;
- fragmentação/caches do alocador.

Portanto, RSS de 400–564 MiB não contradiz o limite de 384 MiB.

### 4.2 PM2 não vê a soma dos filhos

O `max_memory_restart` do app `bot-supervisor` observa o processo PM2, não os
workers criados com `child_process.fork()`. Um supervisor com RSS de 121 MiB
pode manter filhos que somam quase 11 GiB sem cruzar seu limite PM2.

### 4.3 Circuit breaker

O supervisor possui:

- `MAX_SESSIONS_PER_PROCESS`, padrão 20;
- `SESSION_CIRCUIT_BREAKER_MODE`, padrão `closed`;
- verificação antes de `startBot()`.

Foram observados 37 workers, e o Redis continha uma chave de alerta do circuit
breaker. Isso implica uma destas hipóteses, ainda não discriminadas pelos dados:

1. o limite foi elevado por ambiente;
2. o modo estava `open`;
3. a configuração mudou após a criação dos workers;
4. os processos nasceram com código/configuração diferente da cópia examinada.

Não se recomenda derrubar sessões para “voltar a 20”. Recomenda-se confirmar a
configuração efetiva e definir conscientemente o orçamento de capacidade.

### 4.4 Baileys store e histórico

Na versão instalada (`@whiskeysockets/baileys@6.7.23`):

- `makeInMemoryStore` é opt-in;
- a aplicação não o instancia nem faz `store.bind(sock.ev)`;
- `syncFullHistory` já está `false`;
- `markOnlineOnConnect` já está `false`;
- a aplicação apenas extrai JIDs dos eventos de chat/histórico.

Logo, não existe hoje um store explícito contendo todo o histórico que possa
ser simplesmente desligado. O estado criptográfico Signal continua sendo
necessário durante toda a conexão.

Melhoria defensiva sugerida:

```js
syncFullHistory: false,
shouldSyncHistoryMessage: () => false,
```

### 4.5 Auth state

Cada worker usa `useMultiFileAuthState(AUTH_DIR)`. Essa solução funciona no
isolamento atual, porém não é ideal para densificação porque faz leituras,
escritas, serialização e locks por arquivo.

Alternativa proposta: implementar a interface `AuthenticationState`/Signal key
store sobre SQLite ou Redis:

```js
{
  creds,
  keys: {
    get(type, ids),
    set(data),
  },
}
```

Requisitos:

- namespace por `userId`;
- serialização compatível com `BufferJSON`;
- conversão de `app-state-sync-key` para o tipo protobuf esperado;
- transação por lote de `set()`;
- criptografia em repouso;
- cache quente pequeno, com TTL e cap, sem apagar a cópia persistida.

### 4.6 Fila que abandona sem cancelar I/O

`createMessageQueue()` usa `Promise.race()` para impor timeout. Quando o timeout
vence, o slot lógico é liberado, mas a operação original não é abortada. O
watchdog também pode liberar um slot sem cancelar o trabalho subjacente.

Consequência possível sob upstream lento:

1. trabalho A mantém HTML/buffers;
2. timeout libera o slot;
3. trabalho B começa;
4. A continua vivo fora da contabilidade da fila;
5. vários trabalhos residuais coexistem.

Essa é uma explicação plausível para picos transitórios, especialmente nos
workers mais ativos. Correção proposta: `AbortController` por job e propagação
do `AbortSignal` para fetch, streams e demais operações canceláveis.

### 4.7 Imagens e Sharp

Defaults relevantes observados:

- HTML limitado a 2 MiB;
- imagem limitada a 5 MiB;
- download acumula chunks e depois executa `Buffer.concat()`;
- link preview de alta qualidade habilitado;
- thumbnail configurado em 800 px.

Durante uma transformação podem coexistir chunks, buffer concatenado, entrada
e saída do Sharp, thumbnail e payload de envio. Recomendações:

- streaming para arquivo temporário;
- Sharp lendo/escrevendo arquivo quando possível;
- envio Baileys por `{ url: path }` em vez de manter tudo em Buffer;
- concorrência 1 por sessão e 1–2 por shard;
- experimentar thumbnail de 400–480 px em staging;
- testar `sharp.cache({ memory: 0, files: 0, items: 0 })`;
- testar `sharp.concurrency(1)`.

### 4.8 Caches

Caches considerados adequadamente limitados:

- idempotência;
- tentativas de login;
- short links do Mercado Livre;
- short links da Shopee;
- timestamps de grupos;
- requisições IPC pendentes.

Pontos de endurecimento:

- `imageCache` tem TTL, mas não cap nem poda global; a remoção é lazy por URL;
- `summaryCache` da API tem TTL, mas não cap; universo atual é pequeno;
- alguns Maps/Sets de JID sobrevivem a reconexões e devem ter limite/TTL.

O `imageCache` aparenta guardar URL/resultado pequeno, não buffers completos.
É um risco de cardinalidade em processo longevo, mas não explica sozinho
centenas de MiB por worker.

### 4.9 Logging

Cada mensagem aceita registrava o array completo de grupos monitorados. O
logger também usa simultaneamente `pino-pretty` e `pino/file` em produção.

Consequências:

- serialização repetida de objetos grandes;
- alocação temporária e pressão de GC;
- saída capturada pelo PM2 e gravação no `bot.log`;
- muito disco e baixa relação sinal/ruído.

Correção sugerida: registrar somente contagens/IDs mínimos, mover eventos por
mensagem para `debug` ou amostragem e evitar pretty transport em produção.

### 4.10 Listeners e timers

A busca estática encontrou 39 adições e 5 remoções de listeners, 74 criações de
timers e 27 cancelamentos/`unref()`. Esses totais não podem ser subtraídos para
provar vazamento: há listeners e intervalos legítimos durante toda a vida do
processo, e `unref()` tem semântica diferente de cancelamento.

FDs e threads ficaram estáveis na coleta. Não apareceu
`MaxListenersExceededWarning`. Portanto, não há evidência atual de vazamento de
listener, socket, FD ou thread.

## 5. Conclusões separadas por nível de certeza

### Confirmado pelos dados

1. O maior consumidor é a frota de 37 workers WhatsApp.
2. O custo médio observado foi aproximadamente 293 MiB de RSS por worker.
3. A arquitetura escala memória aproximadamente de forma linear por sessão.
4. O limite V8 de 384 MiB não é teto de RSS.
5. O limite PM2 do supervisor não contém a soma dos filhos.
6. O cgroup não tinha limite de memória.
7. CPU, Redis, FDs, threads e swap corrente não estavam saturados.
8. Staging não estava criando um segundo worker concorrente pelo supervisor.
9. Não foi observada multiplicação generalizada de workers órfãos.
10. O logging é excessivamente volumoso e duplicado.

### Provável ou plausível, mas ainda não comprovado

1. Buffers, Sharp e tarefas que continuam após timeout ampliam picos nos
   workers movimentados.
2. Maps sem cap podem produzir retenção lenta em processos que vivem semanas.
3. `Bad MAC` e reconexões aumentam churn de objetos e pressão de GC.
4. Multi-tenancy de 4–8 sessões por processo pode reduzir substancialmente o
   custo incremental por sessão.

### Não comprovado

1. Vazamento contínuo e generalizado do heap V8.
2. Vazamento de listeners, sockets, FDs ou threads.
3. Redis como causa da pressão de memória.
4. Dois workers de produção para a mesma sessão.
5. OOM no período examinado.
6. Quantidade exata de sessões que caberá num shard com heap de 512 MiB.

## 6. Interpretação da janela de 30 minutos

A janela não demonstra vazamento rápido:

- vários workers encolheram dezenas de MiB;
- vários ficaram praticamente estáveis;
- nenhum crescimento correspondente de FD/thread/swap foi observado;
- a oscilação total foi cerca de 4,8% do RSS médio.

Ela também não elimina vazamento lento. Para isso, é necessário medir 24–72
horas e separar:

- `rss`;
- `heapUsed`;
- `heapTotal`;
- `external`;
- `arrayBuffers`;
- PSS;
- tamanho das filas/caches;
- tráfego e reconexões por sessão.

## 7. Alternativas de engenharia discutidas

### 7.1 Multi-tenancy por processo — principal candidata

Arquitetura sugerida:

```text
bot-supervisor
├── session-shard-0 (até 4 sessões)
├── session-shard-1 (até 4 sessões)
├── session-shard-2 (até 4 sessões)
└── ...
```

Começar com **4 sessões por shard**, depois testar 6 e 8. Não colocar as 37 em
um único processo.

Compartilhar por shard:

- runtime V8 e módulos;
- Prisma;
- conexões Redis;
- logger base;
- Sharp/libvips;
- caches públicos limitados;
- HTTP agents.

Isolar por sessão:

- socket;
- auth/Signal keys;
- retry e placeholder caches;
- allowlists e dedup;
- filas;
- timers/listeners;
- lifecycle/backoff;
- pairing state;
- métricas e callbacks.

Riscos:

- uma falha do shard derruba até N sessões;
- CPU síncrona de uma sessão afeta as demais;
- uma sessão ruidosa pode monopolizar memória/filas;
- variável global sem `userId` pode vazar estado entre clientes.

Mitigações:

- limite pequeno de sessões;
- fila e quota por tenant;
- semáforo global de mídia/scrape;
- escalonamento justo entre tenants;
- restart escalonado;
- persistência da atribuição em `ownerInstance`;
- teste de isolamento rigoroso.

### 7.2 Quantidade por shard com heap de 512 MiB

Não há base para prometer um número. Heap de 512 MiB também não limita o RSS.
Hipótese inicial a testar:

- 4 sessões: rollout inicial defensável;
- 6–8: somente após soak;
- limite de RSS do shard separado do limite de heap.

Métrica decisiva:

```text
incremental(N) = RSS(shard com N sessões) - RSS(shard com N-1 sessões)
```

Matriz mínima: 1, 2, 4, 6 e 8 sessões em ociosidade, tráfego normal, pico e
reconexão simultânea.

### 7.3 Garbage collection manual

`global.gc()` com `--expose-gc` só coleta objetos inalcançáveis reconhecidos
pelo V8. Não garante que glibc, libvips ou OpenSSL devolvam memória ao SO.

Não usar GC em intervalo fixo: pausas podem atrasar keepalive e causar quedas.
Uso aceitável apenas como experimento, por feature flag, depois de evento
extraordinário e com a fila ociosa, medindo duração e memória antes/depois.

### 7.4 Hibernação

Não é possível hibernar e acordar de forma confiável **quando uma mensagem
WhatsApp chegar**: sem socket conectado não existe evento externo que acorde o
processo.

Hibernar só é válido para:

- conta com acesso vencido/suspenso;
- parada voluntária;
- nenhuma origem monitorada;
- automação exclusivamente agendada, se o contrato permitir;
- reativação por painel, cron ou pagamento.

Conectar periodicamente para buscar mensagens offline não atende espelhamento
em tempo real e conflita com o filtro atual de mensagens antigas/reentregues.

Alternativa segura: “modo econômico conectado”, mantendo o socket vivo, mas
ignorando cedo JIDs irrelevantes, sem histórico/store e com baixa concorrência.

## 8. Plano recomendado

### P0 — antes de crescer

1. Confirmar valores efetivos de `MAX_SESSIONS_PER_PROCESS` e
   `SESSION_CIRCUIT_BREAKER_MODE`.
2. Não admitir crescimento indefinido no host atual.
3. Não confiar no `max_memory_restart` do supervisor para limitar filhos.
4. Definir orçamento explícito de RSS agregado e margem para pico.

### P1 — instrumentação e ganhos de baixo risco

1. Publicar `process.memoryUsage()` por worker:
   `rss`, `heapUsed`, `heapTotal`, `external`, `arrayBuffers`.
2. Publicar tamanho da fila, trabalhos ativos/residuais e caches relevantes.
3. Tornar `shouldSyncHistoryMessage: () => false` explícito.
4. Reduzir/remover logs por mensagem e pretty transport em produção.
5. Aplicar cap/poda aos caches sem teto.
6. Testar Sharp com cache e concorrência reduzidos.
7. Testar thumbnail de 400–480 px em staging.

### P1 — pipeline de mídia

1. Propagar `AbortSignal` pela fila e rede.
2. Não liberar concorrência como se o trabalho tivesse morrido quando o I/O
   ainda continua.
3. Preferir stream/arquivo temporário a múltiplos Buffers simultâneos.
4. Limitar concorrência de mídia por sessão e por processo.

### P2 — densificação

1. Extrair `BaileysSessionContext` isolado por tenant.
2. Criar processo shard com 4 sessões.
3. Migrar auth state para SQLite/Redis.
4. Fazer soak por 24–72 horas em staging.
5. Testar falha de uma sessão, falha do shard, reconnect, `Bad MAC`, envio com
   imagem, dedup e isolamento de credenciais.
6. Aumentar para 6/8 apenas se as métricas sustentarem.

## 9. Critérios sugeridos para a POC

Metas de engenharia, não promessas:

- RSS incremental por sessão abaixo de 120 MiB;
- shard com 4 sessões abaixo de 800 MiB em tráfego normal;
- shard com 4 sessões abaixo de 1 GiB em pico;
- `external`/`arrayBuffers` retornando ao patamar depois de mídia;
- nenhuma regressão em `408`, `500`, `Bad MAC` ou perda de mensagens;
- nenhum vazamento de estado entre tenants;
- reinício limitado às sessões do shard afetado.

Se dez shards de quatro sessões ficarem entre 650–800 MiB cada, a frota de 37
sessões poderia cair de quase 11 GiB para algo na faixa de 6–8 GiB. Isso é uma
hipótese de benchmark, não uma previsão garantida.

## 10. Questões para a revisão independente

Solicita-se à segunda IA avaliar explicitamente:

1. Os dados permitem descartar vazamento rápido, sem descartar vazamento lento?
2. A média de RSS foi interpretada corretamente, considerando dupla contagem de
   páginas compartilhadas?
3. O timeout sem cancelamento é um candidato material para picos de memória?
4. Há no Baileys 6.7.23 algum store interno obrigatório não identificado aqui?
5. A implementação de auth state em SQLite/Redis reduz RSS ou principalmente
   melhora I/O e viabiliza shards?
6. Quais estados Signal podem ser cacheados com segurança e quais não devem ser
   podados da persistência?
7. Quatro sessões por shard é um ponto inicial prudente?
8. Há risco de isolamento não contemplado ao transformar globais do
   `bot-worker.js` em estado por sessão?
9. `sharp.cache(0)`/`sharp.concurrency(1)` e streaming devem preceder a
   consolidação?
10. Que experimento atribuiria corretamente RSS incremental a Baileys, Sharp,
    buffers, logger e auth store?

## 11. Limitações deste documento

- Os dados de produção foram colados manualmente durante a conversa; o CSV
  bruto não está versionado neste repositório.
- A janela de memória foi de 30 minutos.
- Não foram coletados heap snapshots.
- Não houve série de `external` e `arrayBuffers`.
- Não foi feito benchmark multi-session.
- Não foi feita alteração operacional na VPS.
- Não foi aplicado restart de supervisor, para evitar reconectar toda a frota.
- Este documento registra diagnóstico e propostas; não afirma que as
  otimizações já foram implementadas ou validadas.

## 12. Veredito registrado

O incidente deve ser tratado prioritariamente como **custo basal e orçamento de
memória da arquitetura de um processo por sessão**, e não como vazamento já
demonstrado.

A ação de software com maior potencial é consolidar poucas sessões por shard,
preservando isolamento lógico e limitando o blast radius. Antes disso, convém
instrumentar heap/memória externa, reduzir o pipeline de mídia e corrigir
operações que sobrevivem ao timeout. Redis, CPU e contagem de threads não são
os gargalos indicados pelos dados atuais.

## 13. Continuação: POC controlada de shard

O desenho operacional completo para testar quatro sessões no mesmo processo,
com painel administrativo, critérios objetivos e rollback rápido, está em
[`poc-shard-4-sessoes-teste-controlado.md`](./poc-shard-4-sessoes-teste-controlado.md).

Esse plano separa a POC em degraus de 1, 2 e 4 sessões e mantém a persistência
de credenciais atual no primeiro experimento. A troca do auth store fica para
um experimento posterior, evitando testar duas mudanças críticas ao mesmo
tempo e preservando um retorno simples aos workers dedicados.
