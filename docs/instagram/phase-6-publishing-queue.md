# Fase 6 — publicação e fila de Instagram Stories

## Fluxo

`StoryPublication.id` é o único dado transportado no BullMQ. Token, imagem e
snapshot ficam no banco/storage e são resolvidos no dequeue. A API inicia a
fila `instagram-stories` somente quando OAuth, Redis e storage estão
configurados; sem isso, o restante do produto continua funcionando.

O processor revalida no dequeue: tenant, plano Premium, conexão ativa, método
de login, token decifrável e asset não expirado. Depois consulta o orçamento,
cria o container `STORIES`, acompanha o status por no máximo cinco minutos e
só então chama `media_publish`.

## Máquina de estados

```text
queued -> processing -> container_processing -> published
                    \-> retry_scheduled
                    \-> reconciliation_required
                    \-> failed
```

Timeout de rede em `media_publish` é ambíguo: o retry preserva o container e
consulta seu estado antes de decidir publicar novamente. Container `PUBLISHED`
fecha a linha por reconciliação; nunca cria outro container.

## Retry e DLQ

- 5 tentativas, backoff exponencial iniciado em 30s;
- 429, 5xx e rede são transitórios;
- erros permanentes usam `UnrecoverableError`;
- falha final é copiada para `instagram-stories-dlq` sem token ou imagem;
- sucesso/falha atualiza `StoryPublicationAttempt` para auditoria.

## Configuração

Requer simultaneamente `REDIS_URL`, configuração OAuth (`INSTAGRAM_*`) e
storage (`STORY_ASSET_*`). O runtime roda dentro da API nesta fase: jobs são
duráveis no Redis e retornam à fila após restart, sem criar mais um processo
PM2 ou tocar no `bot-supervisor` do WhatsApp.
