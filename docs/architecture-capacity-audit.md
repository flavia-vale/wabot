# Auditoria de arquitetura, capacidade e desempenho

## Conclusão executiva

Esta auditoria separa **o que o código permite afirmar** do que depende de uma
amostra real da VPS. Sem a coleta do host não é tecnicamente responsável dizer
que CPU, RAM, disco ou rede “são suficientes”, nem prometer um máximo de grupos.
O baseline documentado é um único CX33 (4 vCPU, 8 GB RAM, 40 GB), enquanto a
política atual reserva o maior valor entre 20% da RAM e 1.536 MB e estima pelo
menos 350 MB por sessão. Isso é uma estimativa conservadora de memória, não um
teste de pico ponta a ponta.

**Diagnóstico arquitetural:** a separação entre API e supervisor reduz o raio de
impacto de deploys; BullMQ/Redis dá um caminho de comando durável; PM2 oferece
supervisão; e os snapshots/alertas são boas bases de observabilidade. Porém,
host, Redis e SQLite continuam no mesmo VPS: falha do host, disco cheio ou
indisponibilidade do Redis em modo remoto afetam toda a operação. SQLite também
limita concorrência de escrita e não oferece alta disponibilidade.

## Mapa do fluxo e riscos

| Etapa | Projeto atual | Avaliação | Falha que importa |
|---|---|---|---|
| Captura WhatsApp | Um `bot-worker` por sessão, gerenciado inline ou pelo supervisor | Isolamento por processo é bom; `remote` desacopla deploy da API | Consumo de RAM cresce por sessão; reconexão simultânea pode provocar bloqueio e tempestade de carga |
| Conversão | Pipeline Node e chamadas às APIs afiliadas | Assíncrono, mas dependente de terceiros | 429/timeout aumenta latência; retry sem jitter/circuit breaker amplifica o pico |
| Comandos de sessão | BullMQ em Redis no modo remoto | Persistência e desacoplamento são adequados | Redis local é SPOF; backlog e idade da mensagem ainda não aparecem na tela |
| Persistência | Prisma + SQLite local | Simples, barato e coerente para carga moderada | Escritor único, `SQLITE_BUSY`, disco cheio e ausência de failover |
| Execução | PM2 no mesmo VPS para API, dashboard, supervisor, cron e staging | Operação simples | Host único, recursos disputados com staging e reinício coletivo em OOM/reboot |
| Observabilidade | Snapshot a cada 5 min, histórico, forecast e alertas | Boa visão de host e RAM por worker | Não mede SLI do produto: captura→envio, fila, sucesso, 429 e desconexões |

## Pontos únicos de falha e gargalos prioritários

1. **VPS única (crítico estrutural):** CPU, RAM, disco, rede e kernel têm o mesmo
   domínio de falha. Backup não reduz tempo de indisponibilidade. A evolução é
   separar persistência/Redis e ter restauração ensaiada antes de horizontalizar
   workers.
2. **Redis local em `remote` (alto):** uma queda interrompe comandos e eventos do
   supervisor. Habilitar AOF, monitorar memória/evictions/latência e testar
   reinício. Alta disponibilidade só é necessária depois de medir o RTO aceito.
3. **SQLite local (alto nos picos de escrita):** WAL ajuda leitores, mas continua
   existindo um escritor. Medir `SQLITE_BUSY`, duração das transações, WAL e
   crescimento. Migrar para PostgreSQL quando contenção for recorrente, não só
   pelo número bruto de usuários.
4. **Memória por sessão (alto):** processos separados limitam propagação de
   vazamento, mas 350 MB por sessão já consome rapidamente 8 GB. Comparar p50,
   p95, máximo e inclinação do RSS por PID durante 24 h; crescimento monotônico
   indica vazamento ou cache sem limite.
5. **Pico de fan-out (alto):** uma oferta pode virar centenas de envios. Limitar
   concorrência global e por sessão, aplicar backpressure, jitter, idempotência e
   DLQ. A idade do item mais antigo é mais importante que apenas contar itens.
6. **Limites externos/WhatsApp (alto):** 429, timeout e desconexões precisam de
   métricas por plataforma e motivo. Retries devem respeitar `Retry-After` e não
   provocar reconexão em massa. Nenhuma infraestrutura elimina risco de bloqueio
   por comportamento abusivo.
7. **Staging concorrendo com produção (médio/alto):** desligar somente API e
   dashboard libera memória, mas o supervisor de staging é independente. A tela
   deve deixar explícito o escopo, como já faz.

## Roteiro de coleta na VPS

O script é somente leitura, impõe timeout por comando, remove variáveis de
ambiente do `pm2 prettylist` e faz uma sanitização básica dos logs:

```bash
cd ~/wabot
bash scripts/collect-capacity-audit.sh
```

Para escolher o arquivo de saída:

```bash
bash scripts/collect-capacity-audit.sh /tmp/capacidade-promocao.txt
```

Execute uma vez em horário normal e outra durante uma promoção. Para observar
um pico durante 15 minutos sem instalar agente:

```bash
vmstat 5 180 | tee /tmp/vmstat-pico.txt
pidstat -rud -p ALL 5 180 | tee /tmp/pidstat-pico.txt
iostat -xz 5 180 | tee /tmp/iostat-pico.txt
```

`pidstat` e `iostat` pertencem ao pacote `sysstat`. O relatório pode conter IPs,
nomes de processo e trechos residuais de log; deve ser revisado antes do envio.

## Critérios objetivos de criticidade e ação

| Sinal | Atenção | Crítico | Ação direta |
|---|---:|---:|---|
| RAM disponível | <20% sustentado | <10% ou OOM | Parar staging; localizar RSS crescente; aumentar RAM antes de novas sessões |
| CPU | ≥70% sustentado | ≥85% sustentado com atraso | Reduzir concorrência; perfilar conversão; separar workers/host se persistir |
| Disco/inodes | ≥75% | ≥90% ou erro de escrita | Rotacionar logs, retirar backups locais, ampliar volume |
| Swap | atividade com RAM baixa | swap-out contínuo e atraso | Reduzir carga e ampliar RAM; swap não entra no limite seguro |
| Fila | idade p95 > SLO | item mais antigo > 2× SLO | Backpressure, DLQ e escala de consumidor após excluir rate limit externo |
| Captura→envio | p95 acima do SLO por 10 min | perda ou p99 crescente | Quebrar latência por captura/conversão/fila/envio |
| WhatsApp | desconexões acima do baseline | tempestade em várias sessões | Congelar restart coletivo e escalonar reconexões |
| API afiliada | 429/timeout crescente | circuito aberto/sem conversão | Respeitar `Retry-After`, jitter, cache e fallback explícito |

## Especificação da nova tela de Capacidade

### Primeira dobra: decisão

- estado geral textual, idade da amostra e fonte;
- sessões conectadas, limite seguro, margem e custo p95 por sessão;
- gargalo atual e ação recomendada, sem depender somente de cor;
- “sem medição” tratado como desconhecido, nunca como zero saudável.

### SLIs operacionais a instrumentar

| Métrica | Definição | Visualização / alerta |
|---|---|---|
| Latência captura→envio | `sent_at - captured_at`, p50/p95/p99 por 5 min | Série e SLO; separar conversão, espera e envio |
| Taxa de entrega | enviados com sucesso / tentativas | 5 min e 24 h, por sessão e destino |
| Ocupação das filas | waiting, active, delayed, failed, DLQ | total, variação e capacidade de drenagem |
| Idade do item mais antigo | agora − `createdAt` do primeiro waiting | principal sinal de backlog; alerta por SLO |
| Throughput | capturadas, convertidas e enviadas por minuto | comparar entrada versus saída em promoções |
| Fan-out | destinos por mensagem, p50/p95/máximo | dimensionar pico real por oferta |
| APIs afiliadas | latência, sucesso, timeout e 429 por plataforma | painel por provedor e estado do circuit breaker |
| Saúde WhatsApp | sessões conectadas, quedas, motivos e reconexões | taxa por hora; alerta para evento correlacionado |
| Banco | tamanho, WAL, `SQLITE_BUSY`, duração p95 de escrita | tendência e alerta de contenção/disco |
| Redis | memória, evictions, clientes bloqueados e latência | estado AOF e headroom; nunca expor chaves/valores |
| Rede | RX/TX, retransmissões e conexões estabelecidas | tendência por host, sem expor IP ao browser |

### “Máximo de grupos” sem falsa precisão

Não deve ser uma constante. Exibir duas capacidades independentes:

1. **sessões seguras por memória**, já calculadas com reserva e p95; e
2. **destinos sustentáveis por minuto**, calculados em teste controlado como
   `throughput de envio sustentável / fan-out p95`, respeitando SLO e limites.

O número só recebe o selo “validado” quando houver ao menos 14 dias de amostras
e um teste de pico comparável. Caso contrário, mostrar faixa e confiança.

## Plano em fases

1. **Agora:** executar a coleta normal+pico, corrigir qualquer OOM, disco ≥90%,
   swap-out ou fila envelhecida; confirmar AOF e backup restaurável.
2. **Próximo ciclo:** instrumentar timestamps ponta a ponta e gauges BullMQ,
   além de 429/timeout por provedor e motivo de desconexão.
3. **Depois de 14 dias:** estabelecer SLO, validar custo p95 por sessão e fazer
   teste de pico com aumento gradual, nunca reconectar todas as sessões juntas.
4. **Quando os dados exigirem:** mover SQLite para PostgreSQL por contenção;
   separar Redis/persistência por RTO; escalar workers horizontalmente somente
   com ownership de sessão, idempotência e rate limit distribuído.

