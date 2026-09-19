# POC controlada: shard com quatro sessões WhatsApp

> Plano de implementação e runbook de segurança. Por decisão da responsável,
> o canário será em produção porque staging não tem sessões representativas.
> Isso não autoriza cutover cego: código continua passando por `develop` e
> staging antes da janela controlada em produção.

## Estado executável em 2026-09-15

- A conta fixa é `flavia.vale@usp.br`.
- As outras três são sugeridas a partir das sessões realmente conectadas em
  produção: uma leve, uma mediana e uma com maior uso de mídia em 24 horas.
- `GET /api/admin/shard-poc/overview` exige `tech:read` e reúne seleção, saúde,
  RSS, heap, memória externa, ArrayBuffers, atraso do event loop e eventos.
- `/admin/teste-shard` atualiza esses sinais a cada cinco segundos. Mensagens,
  links e JIDs não são enviados ao navegador.
- O modo seguro é `WA_SESSION_SHARD_POC=observe`. Nesse modo a tela monitora,
  mas não mostra o botão de entrada. O rollback permanece disponível para uma
  conta que tenha ownership residual de uma tentativa anterior.

### Gate incontornável para o cutover real

O worker dedicado foi transformado em uma factory: cada chamada cria um escopo
fechado por `userId`, e `BaileysSessionContext` passa a possuir o runtime e seus
recursos. `session-shard-worker.js` mantém até quatro contextos no mesmo V8.
O botão de entrada só aparece com `WA_SESSION_SHARD_POC=enabled`; `observe` é
fail-closed. O handoff bloqueia comandos, drena e espera o exit real do dedicado
antes de abrir a credencial no shard. O rollback faz a ordem inversa e pode ser
repetido sem abrir sockets duplicados.

### Arquivos executáveis da implementação

- `src/core/BaileysSessionContext.js`: estado e descarte por tenant;
- `src/core/baileysShardSessionFactory.js`: adapta o pipeline real do bot ao
  contrato de contexto, sem listeners globais de IPC/sinais;
- `src/core/sessionShardRuntime.js`: roteamento e teto rígido de quatro;
- `src/session-shard-worker.js`: processo multi-sessão e semáforos globais;
- `src/core/shardOwnershipCoordinator.js`: handoff/rollback idempotente;
- `src/supervisor/shardProcessController.js`: IPC e ciclo de vida do shard.

Mesmo implementado, o caminho permanece experimental: começar com uma conta,
validar rollback, depois duas e somente então quatro. Nunca trocar diretamente
de `observe` para quatro sessões em produção.

## 1. Decisão proposta

Testar se quatro sessões Baileys no mesmo processo Node reduzem o RSS agregado
sem causar perda de mensagens, mistura entre clientes, atraso do event loop ou
mais reconexões.

A POC deve ser **híbrida e reversível**:

- apenas uma allowlist de contas de teste entra no shard;
- todas as demais sessões continuam em workers dedicados;
- o supervisor continua sendo o dono do ciclo de vida;
- cada credencial continua no diretório atual e só muda o processo que a abre;
- nunca podem existir socket dedicado e socket do shard para a mesma conta;
- um kill switch no `.env` prevalece sobre qualquer comando do painel;
- o botão de rollback volta os membros aos workers dedicados sem apagar auth.

### O que não entra no primeiro experimento

Não migrar simultaneamente o auth state para Redis/SQLite. Essa mudança pode
ser útil depois, mas misturá-la com multi-tenancy impediria saber se uma falha
veio do shard ou da persistência. Na POC inicial, cada sessão continua usando
seu `AUTH_INFO_DIR`, com exclusão de posse garantida pelo supervisor.

Também ficam fora:

- hibernação;
- mudança de versão do Baileys;
- alteração do protocolo público entre API e supervisor sem compatibilidade;
- mudança do dedup;
- entrada automática de clientes reais no shard;
- aumento para mais de quatro sessões.

## 2. Resultado que precisa ser provado

O teste só é bem-sucedido se demonstrar simultaneamente:

1. economia material de memória;
2. isolamento absoluto entre contas;
3. recebimento e envio equivalentes ao worker dedicado;
4. event loop e filas dentro do orçamento;
5. credenciais intactas após restart e rollback;
6. retorno aos workers dedicados em poucos minutos;
7. nenhuma piora material de quedas `408`, `500`, `Bad MAC` ou heartbeat.

Economia sem confiabilidade não é sucesso. Confiabilidade sem economia
material também não justifica a complexidade.

## 3. Estratégia de rollout

O alvo final da POC é quatro sessões, mas o rollout tem três degraus:

| Degrau | Sessões no shard | Permanência mínima | Objetivo |
|---|---:|---:|---|
| A | 1 | 2 horas | provar start/stop/rollback e paridade funcional |
| B | 2 | 6 horas | provar isolamento e concorrência entre contas |
| C | 4 | 24 horas | medir densidade, pico de mídia e blast radius |

Depois do degrau C, manter soak de 48–72 horas somente se todos os gates
continuarem verdes. Nunca pular diretamente de zero para quatro.

## 4. Contas para o teste

Usar quatro contas controladas da operação, preferencialmente em staging.
Nenhuma deve ser indispensável para cliente pagante durante a POC.

### Perfil desejado

- uma sessão praticamente ociosa;
- uma com grupos comuns e texto/link;
- uma com tráfego frequente;
- uma que processe imagens/Sharp e represente o perfil mais pesado.

Isso evita um resultado artificial obtido com quatro sessões ociosas.

### Critérios de exclusão

Não selecionar conta que:

- esteja em pareamento ou recuperação de `Bad MAC`;
- tenha queda recorrente ainda sem causa conhecida;
- esteja com acesso vencido ou parada voluntariamente;
- seja o único canal de uma operação comercial crítica;
- esteja participando de outra mudança de configuração;
- não possa ser testada ponta a ponta por uma pessoa.

## 5. Pré-requisitos técnicos

### 5.1 Refatorar o runtime para estado por sessão

O `bot-worker.js` atual possui estado de módulo para uma única conta. Antes de
abrir quatro sockets no mesmo processo, esse estado deve ser encapsulado:

```js
class BaileysSessionContext {
  constructor({ userId, services }) {
    this.userId = userId
    this.services = services
    this.activeSock = null
    this.pendingSock = null
    this.timers = new Set()
    this.disposers = new Set()
    this.allowedChatJids = new Set()
    this.selfChatJids = new Set()
    this.knownChannelJids = new Set()
    this.lastSendByDest = new Map()
    this.lastIncomingByMonitorJid = new Map()
    this.doneCallbacks = new Map()
    this.incomingQueue = null
    this.sendBackend = null
  }
}
```

Obrigatoriamente isolados por `userId`:

- socket e auth state;
- Signal/retry/placeholder caches;
- config e allowlists;
- dedup;
- pairing state;
- filas de entrada e saída;
- timers e listeners;
- backoff, lifecycle e heartbeat;
- callbacks e métricas.

Podem ser compartilhados com limites:

- Prisma;
- Redis;
- logger base;
- HTTP agents;
- Sharp/libvips;
- cache de URL pública que não contenha segredo ou identidade do cliente.

### 5.2 Criar um processo de shard separado

Criar um entrypoint, por exemplo:

```text
src/session-shard-worker.js
```

O processo recebe `SHARD_ID`, inicia no máximo quatro contextos e responde ao
supervisor por IPC. Não deve rodar dentro da API.

Contrato mínimo de comandos:

```text
START_SESSION
STOP_SESSION
IS_SESSION_RUNNING
RELOAD_SESSION_CONFIG
LIST_SESSION_GROUPS
SEND_SESSION_BROADCAST
GET_SESSION_METRICS
DRAIN_SHARD
SHUTDOWN_SHARD
```

Todo comando e evento deve conter:

```js
{
  protocolVersion,
  requestId,
  shardId,
  userId,
  type,
  payload,
}
```

O supervisor mantém o roteamento `userId -> owner` e não expõe a diferença
entre worker dedicado e shard para a API.

### 5.3 Posse exclusiva

Antes de mover uma sessão:

1. marcar a sessão como `moving` no controle da POC;
2. impedir novos comandos concorrentes;
3. pedir drain do worker dedicado;
4. esperar o `exit` real, não apenas enviar `SIGTERM`;
5. confirmar ausência do PID antigo;
6. só então abrir o mesmo auth state no shard;
7. gravar `ownerInstance=shard-poc-1` depois da confirmação de start;
8. liberar comandos.

Se o PID antigo não sair dentro do prazo, **não iniciar no shard**. Dois sockets
na mesma credencial constituem falha crítica e podem causar `440/replaced`.

### 5.4 Kill switch fora do banco

Variáveis propostas:

```env
WA_SESSION_SHARD_POC=off
WA_SESSION_SHARD_POC_MAX_SESSIONS=4
WA_SESSION_SHARD_POC_MAX_RSS_MB=1000
WA_SESSION_SHARD_POC_MAX_EVENT_LOOP_P95_MS=250
```

Semântica:

| Valor | Efeito |
|---|---|
| `off` | não cria shard e rejeita novas migrações |
| `observe` | painel e métricas ativos, nenhuma migração permitida |
| `enabled` | painel pode executar a POC para membros autorizados |

O valor `off` precisa ganhar sempre, mesmo que o banco diga que um teste está
ativo. Alterar a flag requer reinício controlado do supervisor; por isso ela é
o último recurso fora do painel, não o rollback cotidiano.

### 5.5 Limites internos do shard

- máximo rígido de quatro sessões;
- fila por sessão;
- concorrência de entrada inicial igual a 1 por sessão;
- semáforo global de Sharp igual a 1;
- semáforo global de scraping igual a 2;
- limite de fila por tenant;
- fairness round-robin entre tenants;
- cache com quota global e por tenant;
- proibição de inserir quinta sessão mesmo por comando interno.

## 6. Persistência do teste controlado

O painel não pode depender apenas de estado em RAM. Modelos conceituais:

### `WaShardExperiment`

| Campo | Uso |
|---|---|
| `id` | identidade do experimento |
| `environment` | somente `staging` na primeira versão |
| `status` | máquina de estados |
| `shardId` | processo controlado |
| `targetSize` | 1, 2 ou 4 |
| `baselineStartedAt` | início da comparação dedicada |
| `startedAt` | início efetivo do shard |
| `endedAt` | conclusão/rollback |
| `createdByUserId` | autoria |
| `rollbackReason` | por que voltou |
| `configSnapshotJson` | configuração necessária para restaurar |
| `acceptanceSnapshotJson` | thresholds congelados no início |
| `version` | concorrência otimista |

### `WaShardExperimentMember`

| Campo | Uso |
|---|---|
| `experimentId` + `userId` | chave única |
| `position` | ordem de entrada 1–4 |
| `previousOwnerInstance` | dono anterior |
| `previousStatus` | estado anterior |
| `previousLifecycle` | lifecycle anterior |
| `dedicatedBaselineRssMb` | baseline individual |
| `status` | pending/moving/running/restoring/restored/failed |
| `currentPid` | processo observado |
| `lastHeartbeatAt` | liveness |
| `lastErrorCode` | diagnóstico sem conteúdo de mensagem |

### `WaShardExperimentSample`

Uma amostra agregada a cada 15 segundos:

- `rssMb`, `heapUsedMb`, `heapTotalMb`;
- `externalMb`, `arrayBuffersMb`;
- event-loop delay p50/p95/max;
- sessões esperadas, iniciadas e com heartbeat;
- filas por sessão e item mais antigo;
- trabalhos ativos, com timeout e residuais;
- FDs e threads;
- CPU;
- contagens acumuladas de mensagens, erros, reconnects e `Bad MAC`;
- timestamp e versão do código.

Não salvar texto de mensagem, JID, telefone, credencial ou payload Signal nas
amostras.

### `WaShardExperimentEvent`

Linha do tempo auditável:

```text
experiment_created
preflight_passed
baseline_started
member_drain_started
member_dedicated_exited
member_shard_started
gate_warning
gate_failed
rollback_requested
member_restored
rollback_completed
experiment_completed
```

## 7. Máquina de estados

```text
draft
  -> baseline
  -> ready
  -> starting
  -> running
  -> completing -> completed

starting/running
  -> rollback_requested
  -> rolling_back
  -> rolled_back

qualquer transição com erro operacional
  -> failed (mas ainda exige reconciliação/rollback)
```

Regras:

- apenas uma POC ativa por ambiente;
- ação com chave de idempotência;
- transição condicional por `version`;
- refresh de página nunca repete start/rollback;
- `failed` não significa que a restauração terminou;
- somente `rolled_back` confirma retorno ao desenho anterior.

## 8. Painel ADMIN — “TESTE CONTROLADO”

Adicionar em `/admin/capacidade`, abaixo do diagnóstico atual, um bloco visual
separado e claramente marcado como experimental.

### 8.1 Cabeçalho

Mostrar sempre:

- ambiente;
- `WA_SESSION_SHARD_POC` efetivo;
- versão do código da API, supervisor e shard;
- estado do experimento;
- horário de início e duração;
- pessoa que iniciou;
- shard/PID;
- degrau atual: 1, 2 ou 4;
- botão **VOLTAR AOS WORKERS INDIVIDUAIS**.

O botão de rollback fica visível mesmo se a coleta de métricas falhar.

### 8.2 Pré-flight no painel

Todos os itens precisam ficar verdes antes de habilitar “Começar”:

- ambiente é staging;
- kill switch em `enabled`;
- supervisor vivo e em modo correto;
- Redis disponível;
- banco disponível;
- nenhum experimento ativo;
- exatamente 1, 2 ou 4 contas selecionadas;
- todas possuem auth state legível;
- nenhuma está em pairing/recovery/quarentena;
- todas pertencem ao mesmo supervisor esperado;
- existe baseline recente;
- há memória livre mínima definida;
- versão do shard compatível com o supervisor;
- rota de rollback respondeu ao dry-run;
- nenhum membro já pertence a outro shard.

Falha de pre-flight bloqueia o botão e apresenta o motivo em linguagem clara.

### 8.3 Seleção de membros

Tabela com:

- nome interno mascarado;
- estado da sessão;
- perfil de carga: ociosa/normal/intensa/mídia;
- RSS dedicado p50/p95;
- mensagens por hora;
- quedas nas últimas 24 horas;
- fila atual;
- elegível ou motivo de bloqueio.

A confirmação deve exigir a frase:

```text
TESTAR 4 SESSÕES EM STAGING
```

### 8.4 Comparação ao vivo

Cards:

| Card | Cálculo |
|---|---|
| Baseline dedicado | soma do RSS p50/p95 dos mesmos membros antes da migração |
| RSS atual do shard | RSS do processo compartilhado |
| Economia absoluta | baseline − shard |
| Economia percentual | `(baseline - shard) / baseline` |
| RSS incremental estimado | diferença entre degraus |
| Heap | usado/total/limite |
| Memória externa | `external + arrayBuffers` |
| Event loop | p95 e máximo |
| Saúde | membros com heartbeat / esperados |

Gráficos:

- RSS dedicado versus RSS do shard;
- heap, external e arrayBuffers;
- event-loop delay;
- filas e idade do item mais antigo;
- mensagens/erros/reconnects por sessão;
- linha vertical para entrada/saída de cada membro.

### 8.5 Tabela por sessão

Para cada membro:

- estado do socket;
- último heartbeat;
- última mensagem recebida e enviada, apenas timestamps;
- fila pendente/ativa;
- reconnects desde o início;
- `408`, `500`, `Bad MAC` e timeouts desde o início;
- latência de processamento p95;
- teste sintético recebido/enviado;
- dono anterior e dono atual;
- botão “retirar somente esta sessão”.

### 8.6 Gates e veredito

Cada gate deve aparecer como verde, amarelo ou vermelho, com valor observado,
limite e ação recomendada. O painel não pode resumir “rodando” como “saudável”.

### 8.7 Linha do tempo e rollback

Mostrar eventos de posse, PIDs, gates, starts, stops e rollback. Exibir o
manifesto congelado necessário para restaurar:

- membros;
- dono anterior;
- lifecycle/status anteriores;
- diretório de auth esperado, sem conteúdo;
- commit/versão;
- processos que precisam existir depois;
- checklist de validação pós-retorno.

## 9. API administrativa

Rotas propostas, todas com `tech:read` ou `tech:write` e audit log:

```text
GET  /api/admin/shard-experiments/current
GET  /api/admin/shard-experiments/:id
POST /api/admin/shard-experiments
POST /api/admin/shard-experiments/:id/preflight
POST /api/admin/shard-experiments/:id/baseline/start
POST /api/admin/shard-experiments/:id/start
POST /api/admin/shard-experiments/:id/add-member
POST /api/admin/shard-experiments/:id/remove-member
POST /api/admin/shard-experiments/:id/rollback
POST /api/admin/shard-experiments/:id/complete
GET  /api/admin/shard-experiments/:id/samples
GET  /api/admin/shard-experiments/:id/events
```

Requisitos de escrita:

- `Idempotency-Key` obrigatória;
- confirmação textual para start e rollback;
- rejeitar produção na primeira versão;
- resposta `202` para operação assíncrona;
- status consultável;
- nenhuma rota shell arbitrária;
- nunca aceitar caminho de auth vindo do browser;
- registrar before/after no `AdminAuditLog`.

## 10. Baseline antes do shard

Coletar os mesmos quatro workers dedicados por pelo menos duas horas:

- RSS/PSS;
- heap/external/arrayBuffers;
- CPU;
- event-loop delay;
- mensagens por hora;
- quantidade e duração de Sharp;
- filas;
- timeouts;
- reconnects e códigos;
- FDs/threads.

Usar p50 e p95, não apenas uma fotografia. Congelar o baseline no experimento
para que abrir o painel depois não altere a referência.

Executar um roteiro funcional antes e depois:

1. mensagem de texto com link;
2. mensagem com imagem;
3. mensagem para dois destinos;
4. reload de configuração;
5. envio manual pelo painel;
6. desconexão/reconexão de uma conta;
7. restart do shard;
8. confirmação de que nenhuma mensagem foi para tenant errado.

## 11. Gates de sucesso e rollback

Os valores iniciais abaixo são conservadores e devem ficar configuráveis no
backend, congelados no começo do experimento.

### Falha crítica — rollback automático imediato

| Sinal | Critério inicial |
|---|---|
| Mistura de tenant | qualquer evento, JID, config ou envio atribuído à conta errada |
| Dupla posse | PID dedicado e shard vivos para o mesmo `userId` |
| Credencial comprometida | logout/reset de auth provocado pelo teste |
| Perda confirmada | mensagem sintética fresca não processada, sem bloqueio esperado |
| Crash loop | 2 crashes do shard em 10 minutos |
| Liveness | 2 ou mais membros sem heartbeat por 90 segundos |

### Falha operacional — rollback após confirmação rápida

| Sinal | Critério inicial |
|---|---|
| RSS do shard | acima de 1.000 MiB por 3 amostras de 15 s |
| Heap | acima de 85% do limite por 3 amostras |
| Event loop | p95 acima de 250 ms por 2 minutos ou máximo acima de 1 s |
| Fila | item mais antigo acima de 60 s sem preservação deliberada |
| Timeouts | mais de 2 vezes o baseline ajustado por tráfego |
| Quedas | `408`/`500` mais de 2 vezes o baseline ajustado por tráfego |
| `Bad MAC` | mais de 2 vezes o baseline ajustado por tráfego |
| Justiça | uma sessão sem progresso enquanto outra monopoliza o shard |

### Não funcionou economicamente

Não precisa rollback emergencial, mas a POC não deve ser aprovada se:

- economia p50 menor que 25%;
- economia p95 menor que 20%;
- RSS incremental da quarta sessão maior que 180 MiB;
- shard de quatro frequentemente se aproxima de 1 GiB;
- throughput cai mais de 15%;
- latência p95 aumenta mais de 25%;
- operação se torna materialmente mais difícil que o benefício obtido.

## 12. Hipóteses de falha e sinais

### H1 — estado global cruza tenants

**Causa:** variável de módulo, cache ou callback não movido para o contexto.

**Sinais:** mensagem no destino errado, configuração de outra conta, dedup
entre contas, QR/status atribuído ao membro incorreto.

**Ação:** rollback imediato; bloquear nova POC até teste de isolamento cobrir o
estado responsável.

### H2 — uma sessão ruidosa bloqueia as outras

**Causa:** CPU síncrona, Sharp ou fila sem fairness.

**Sinais:** event-loop p95 alto, filas das sessões ociosas envelhecendo enquanto
uma conta processa mídia, heartbeat atrasado em todos os membros.

**Ação:** rollback ou retirar a sessão ruidosa; reduzir concorrência e adicionar
round-robin/semaphore.

### H3 — memória externa elimina a economia

**Causa:** buffers e libvips são incrementais por sessão/carga.

**Sinais:** heap estável, mas `external`, `arrayBuffers` e RSS crescem; quarta
sessão adiciona mais de 180 MiB; RSS não retorna após mídia.

**Ação:** encerrar POC como sem ganho; corrigir streaming/Sharp antes de repetir.

### H4 — auth multi-file sofre contenção

**Causa:** quatro estados gravando arquivos no mesmo processo/event loop.

**Sinais:** `creds.update` lento, erros de leitura/escrita, `Bad MAC` após restart,
tempo alto de transação de keys.

**Ação:** rollback; testar auth store transacional em experimento separado.

### H5 — timeout libera trabalho que continua vivo

**Causa:** `Promise.race()` não aborta I/O.

**Sinais:** fila aparenta vazia, mas active handles/RSS continuam crescendo;
external aumenta depois de timeouts; concorrência real excede o limite.

**Ação:** rollback se houver pressão; implementar abort cooperativo.

### H6 — crash amplia o blast radius

**Causa:** exceção fatal de uma sessão encerra o processo compartilhado.

**Sinais:** quatro heartbeats somem no mesmo instante e todas reconectam juntas.

**Ação:** rollback após estabilizar; impedir que erro de tenant chegue ao
processo, mantendo fatal apenas para corrupção real do shard.

### H7 — roteamento fica divergente

**Causa:** API/supervisor usam owners diferentes ou evento atrasado sobrescreve
estado novo.

**Sinais:** `isRunning` falso apesar de heartbeat, comando chega ao dedicado
antigo, painel mostra dois PIDs ou nenhum.

**Ação:** rollback; usar geração/versionamento de owner e compare-and-swap.

### H8 — restart causa tempestade de conexão

**Causa:** quatro sockets abrem simultaneamente.

**Sinais:** pico de RSS/CPU, `408`/`500`, notificações simultâneas e falhas no
handshake.

**Ação:** rollback se não estabilizar; adicionar start escalonado com jitter.

### H9 — métricas ficam verdes sem dados

**Causa:** coletor morreu ou denominador ficou zero.

**Sinais:** amostras antigas, campos nulos convertidos em zero, shard sem PID
marcado como saudável.

**Ação:** dado ausente é `unknown` e bloqueia progressão; nunca significa verde.

### H10 — rollback parcial

**Causa:** shard encerra, mas nem todos os dedicados voltam.

**Sinais:** quantidade de heartbeats menor que membros, `ownerInstance` ainda
aponta para shard ou algum PID antigo continua vivo.

**Ação:** manter estado `rolling_back`, reconciliar membro por membro e não
declarar sucesso até cumprir os invariantes pós-rollback.

## 13. Rollback rápido pelo painel

Botão permanente:

```text
VOLTAR AOS WORKERS INDIVIDUAIS
```

Confirmação:

```text
VOLTAR TODAS AS SESSÕES AO MODO INDIVIDUAL
```

### Algoritmo

1. trocar estado para `rollback_requested` por compare-and-swap;
2. bloquear novos comandos de mutação e enfileirar os recebidos por membro;
3. pedir `DRAIN_SHARD` com prazo curto;
4. fechar sockets de forma escalonada;
5. esperar o exit do shard;
6. confirmar que nenhum PID possui as credenciais dos membros;
7. restaurar `ownerInstance` anterior;
8. iniciar um worker dedicado por vez, com intervalo/jitter;
9. reentregar comandos seguros ainda não expirados;
10. aguardar heartbeat e status de cada membro;
11. executar teste sintético por membro;
12. marcar `rolled_back` apenas se todos os invariantes passarem.

### Invariantes de retorno

- zero processos shard para o experimento;
- exatamente um worker dedicado por membro;
- nenhum membro com dois PIDs;
- quatro heartbeats recentes;
- `ownerInstance` coerente;
- auth state presente e não recriado;
- fila sem item duplicado;
- teste de recebimento/envio aprovado;
- evento e audit log de conclusão.

### Prazo esperado

Meta operacional: iniciar o rollback em segundos e restaurar as quatro sessões
em até 2–3 minutos, respeitando drain e start escalonado. O painel deve mostrar
progresso por membro, e não bloquear a requisição HTTP até o final.

## 14. Rollback fora do painel

O painel pode estar indisponível. É obrigatório fornecer um comando
idempotente, estreito e auditável, por exemplo:

```bash
cd ~/wabot-staging
node scripts/shard-poc-rollback.mjs --experiment <ID> --confirm
```

O script deve chamar a mesma camada de domínio do endpoint, não reimplementar a
lógica. Ele não recebe paths, PIDs ou `userId` arbitrários; tudo vem do
manifesto persistido do experimento.

Último recurso, se API e Redis estiverem indisponíveis:

1. definir `WA_SESSION_SHARD_POC=off`;
2. parar somente o processo shard da POC;
3. confirmar seu exit;
4. reiniciar o supervisor no ambiente correto;
5. reconciliar os quatro membros pelo manifesto;
6. confirmar PIDs e heartbeats.

Não executar restart geral do supervisor de produção como primeiro passo. A POC
inicial deve existir em staging e o restart indiscriminado reconecta sessões
fora do experimento.

## 15. Testes obrigatórios antes do painel habilitar start

### Unitários

- roteamento de owner dedicado versus shard;
- cap rígido de quatro;
- isolamento de todos os Maps/caches;
- máquina de estados e compare-and-swap;
- gates e thresholds;
- manifesto de rollback;
- idempotência de start e rollback;
- dado ausente nunca vira saudável;
- sanitização das métricas.

### Integração sem WhatsApp real

- quatro sockets falsos;
- mensagens simultâneas com `userId` distintos;
- crash de apenas um contexto;
- crash do shard;
- timeout residual;
- Redis temporariamente indisponível;
- API reiniciada no meio do experimento;
- rollback repetido duas vezes;
- refresh do browser durante start/rollback.

### Staging com WhatsApp real

- texto/link/imagem;
- múltiplos destinos;
- reload de config;
- reconnect de um membro;
- restart do shard;
- `Bad MAC` simulado quando possível;
- saída e retorno pelo rollback;
- comprovação de que nenhum tenant recebeu dados de outro.

## 16. Ordem de implementação

1. Extrair uma lista completa do estado global por sessão.
2. Criar `BaileysSessionContext` sem mudar ainda a arquitetura de produção.
3. Fazer o worker dedicado usar esse contexto; todos os testes atuais devem
   continuar passando.
4. Instrumentar memória/event loop/filas no worker dedicado e colher baseline.
5. Criar shard worker e roteamento híbrido atrás de `observe`.
6. Criar persistência e máquina de estados do experimento.
7. Implementar rollback e testá-lo antes do start.
8. Implementar API administrativa e audit log.
9. Implementar o painel.
10. Validar degrau A, B e C em staging.
11. Encerrar a POC e revisar os dados antes de qualquer proposta de produção.

Regra essencial: **o caminho de volta precisa estar implementado e testado
antes do botão que inicia o teste ser habilitado**.

## 17. Checklist “pronto para começar”

- [ ] Quatro contas de staging selecionadas e classificadas por carga.
- [ ] Baseline de duas horas disponível para as mesmas contas.
- [ ] Runtime encapsulado por sessão.
- [ ] Testes provam isolamento de estado.
- [ ] Shard tem cap rígido de quatro.
- [ ] Métricas internas chegam ao painel a cada 15 segundos.
- [ ] Kill switch externo funciona.
- [ ] Persistência do experimento e manifesto existem.
- [ ] Rollback pelo painel foi testado com sockets falsos.
- [ ] Rollback pelo script foi testado.
- [ ] Pre-flight bloqueia produção e dados incompletos.
- [ ] Audit log cobre todas as mutações.
- [ ] Gates automáticos foram testados.
- [ ] Teste sintético por tenant está pronto.
- [ ] Pessoa responsável acompanha toda a janela.
- [ ] Nenhuma outra mudança de Baileys/auth/pipeline será feita na janela.

Sem todos os itens, a POC ainda não está pronta para começar.
