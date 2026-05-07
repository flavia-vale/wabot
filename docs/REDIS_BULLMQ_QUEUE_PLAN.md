# Plano SRE: Redis/BullMQ para fila persistente

A fila atual do BOTinho é em memória por processo `bot-worker`. Ela reduz latência do listener, mas não sobrevive a restart. Para muitos clientes simultâneos ou necessidade de garantia de entrega, migrar para Redis + BullMQ.

## Quando ativar

- Mais de 20 bots simultâneos na VPS.
- Fila média por usuário acima de 100 jobs.
- Necessidade de retry persistente após restart/queda.
- SQLite apresentando locks de escrita por volume de logs.

## Arquitetura recomendada

- Redis local na VPS Hetzner ou Redis gerenciado.
- Uma fila BullMQ por ambiente: `BOTinho-send-production`.
- `jobId` determinístico por `messageLog.id` para idempotência.
- `attempts: 3`, backoff exponencial com jitter.
- Rate limit por `destJid` guardado em Redis (`lastSend:${destJid}`).
- Worker Node separado do processo API se o volume crescer.

## Variáveis sugeridas

```env
QUEUE_BACKEND=bullmq
REDIS_URL=redis://127.0.0.1:6379
BULLMQ_QUEUE_NAME=BOTinho-send-production
SEND_MAX_ATTEMPTS=3
SEND_RETRY_BASE_MS=2000
DEST_RATE_LIMIT_MS=1000
```

## Observação do rollout atual

A dependência `bullmq` não foi adicionada neste commit porque o registry npm retornou `403 Forbidden` neste ambiente ao consultar o pacote. O código atual mantém a fila em memória com métricas, retry e rate limit, e deixa este plano documentado para rollout quando o acesso ao registry/dependências estiver liberado.
