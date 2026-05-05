# Backlog de Issues SRE — wabot

Gerado durante a auditoria de performance, fila de envios e escalabilidade.
**Status:** `open` · `in-progress` · `done`

---

## Módulo SRE — Fila e Infraestrutura

### SRE-001 · Migrar fila em memória para Redis/BullMQ persistente
**Status:** open  
**Prioridade:** alta  
**Arquivo:** `src/bot-worker.js` · `src/manager.js` · infra VPS

**Descrição:**  
A fila atual é em memória por processo `bot-worker`. Ela já desacopla o listener dos envios e possui retry/rate limit/métricas, mas não sobrevive a restart do PM2, queda da VPS ou deploy. Jobs `queued/sending` são marcados como interrompidos para evitar status presos.

**Reprodução:**
```bash
# Com jobs na fila:
pm2 restart api
# Resultado atual: jobs em memória são perdidos e logs/agendamentos pendentes são marcados como erro/falha.
```

**Impacto:**  
Em produção com clientes pagantes, reinícios podem interromper entregas que ainda estavam na fila. Isso é aceitável para MVP, mas não para garantia forte de entrega.

**Correção sugerida:**  
Adicionar Redis + BullMQ quando o registry/deploy permitir instalar dependências:
```env
QUEUE_BACKEND=bullmq
REDIS_URL=redis://127.0.0.1:6379
BULLMQ_QUEUE_NAME=wabot-send-production
```
Usar `MessageLog.id` como `jobId`, configurar `attempts`, backoff exponencial, rate limit por destino e worker dedicado.

**Critério de aceite:**
- Jobs `queued/sending` sobrevivem a `pm2 restart api`.
- Retry continua após restart.
- Duplicidade é evitada por `jobId` idempotente.
- Métricas da fila persistente aparecem no dashboard.

---

### SRE-002 · Migrar SQLite para Postgres antes de alto volume
**Status:** open  
**Prioridade:** alta  
**Arquivo:** `prisma/schema.prisma` · infra banco

**Descrição:**  
SQLite funciona para MVP e recebeu índices para logs/agendamentos, mas múltiplos workers escrevendo logs, agendamentos e sessões simultaneamente podem gerar locks e degradação.

**Reprodução:**
```bash
LOG_PRESSURE_TOTAL=100000 npm run pressure:logs
# Em produção, repetir enquanto bots reais gravam MessageLog.
```

**Impacto:**  
Com muitos clientes simultâneos, a API pode sofrer lentidão ou erros de lock em escritas concorrentes.

**Correção sugerida:**  
Planejar migração Prisma para Postgres, incluindo backup, migração de dados, alteração de `DATABASE_URL`, validação de migrations e rollback.

**Critério de aceite:**
- Dados existentes migrados sem perda.
- `/ready` saudável apontando para Postgres.
- Teste de pressão com 100k logs mantém paginação de logs em tempo aceitável.

---

### SRE-003 · Testes automatizados de fila com worker mockado
**Status:** open  
**Prioridade:** média  
**Arquivo:** `src/bot-worker.js` · `src/manager.js`

**Descrição:**  
Os checks atuais validam sintaxe, build, pressão SQLite e conversores, mas a fila depende do Baileys/WhatsApp real. Falta uma suíte automatizada que mocke `sendMessage` e valide transições `queued → sending → success/error`, retry, rate limit, broadcast e agendamentos.

**Reprodução:**
```bash
# Hoje não existe comando dedicado para simular a fila sem WhatsApp real.
```

**Impacto:**  
Mudanças futuras na fila podem quebrar retry, callbacks de agendamento ou métricas sem serem detectadas em CI.

**Correção sugerida:**  
Extrair a fila para módulo testável ou adicionar injeção de dependências para `sock`, `db` e relógio. Criar testes para:
- broadcast enfileirado;
- agendamento com múltiplos destinos;
- falha transitória com retry;
- fila cheia;
- rate limit por destino;
- shutdown com jobs pendentes.

**Critério de aceite:**
- Comando `npm test` ou equivalente cobre a fila sem WhatsApp real.
- Testes executam sem rede externa.

---

### SRE-004 · Observabilidade externa e alertas de fila
**Status:** open  
**Prioridade:** média  
**Arquivo:** `src/api/routes/dashboard.js` · dashboard · infra monitoramento

**Descrição:**  
Métricas da fila já aparecem via status/dashboard, mas ainda não há endpoint Prometheus, alertas ou histórico temporal.

**Reprodução:**
```bash
# Não há endpoint /metrics nem alerta quando queueSize cresce ou errorTotal aumenta.
```

**Impacto:**  
Operação continua reativa: problemas podem ser percebidos só quando clientes reclamam.

**Correção sugerida:**  
Adicionar endpoint protegido ou integração Prometheus/Grafana/Uptime Kuma com métricas:
- `queue_size`;
- `send_success_total`;
- `send_error_total`;
- `send_retry_total`;
- `avg_latency_ms`;
- `last_error_at`.

**Critério de aceite:**
- Alerta quando fila passa de limite por mais de N minutos.
- Alerta quando taxa de erro/retry sobe.
