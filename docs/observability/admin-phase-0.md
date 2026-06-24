# Fase 0 — estudo do `/admin` para observabilidade

Status: executada como diagnóstico inicial.
Data: 2026-06-24.
Escopo: mapear o que já existe em `/admin` e `/api/admin` para adaptar a
estratégia de observabilidade antes de criar novas telas, métricas ou alertas.

## Objetivo

Antes de implementar a camada completa de observabilidade, esta fase levanta o
estado atual do Admin para decidir, com baixo retrabalho:

- o que será reaproveitado sem mudança estrutural;
- o que será reaproveitado com adaptação;
- o que precisa ser reestruturado;
- o que deve ser criado do zero.

A decisão central desta fase é manter `/admin` como visão executiva/operacional
e criar uma futura área dedicada, sugerida como `/admin/observabilidade`, para
Golden Signals, SLOs, alertas, dependências, filas, sessões, banco e integrações.

## Inventário de superfícies existentes

| Superfície | Arquivo | Papel atual | Decisão inicial |
| --- | --- | --- | --- |
| Layout Admin | `dashboard/app/admin/layout.js` | Metadata restrita e `robots` noindex/nofollow. | Reaproveitar. |
| Admin principal | `dashboard/app/admin/page.js` | Visão geral com KPIs, clientes, sessões, logs, CS, sistema e atalhos. | Reestruturar parcialmente. |
| Sucesso do Cliente | `dashboard/app/admin/sucesso-cliente/page.js` | Fila de risco, follow-up, métricas e ações de CS. | Reaproveitar com adaptação. |
| Marketing & Growth | `dashboard/app/admin/marketing-growth/page.js` | Funil, campanhas, cohorts, data trust, prompts e alertas de growth. | Reaproveitar padrões visuais/conceituais. |
| Pipeline técnico | `dashboard/app/admin/pipeline/page.js` | Kanban técnico/backlog interno. | Reaproveitar como destino de follow-ups pós-incidente. |
| Telegram | `dashboard/app/admin/telegram/page.js` | Observabilidade específica do Telegram Offer Bot. | Reaproveitar com adaptação. |
| Afiliados | `dashboard/app/admin/afiliados/page.js` | Aprovação, comissões e configurações de afiliados. | Fora do núcleo de observabilidade; manter separado. |
| Rotas Admin | `src/api/routes/admin.js` | Contratos, RBAC, auditoria e dados para todas as abas. | Base principal para evolução. |
| Client API | `dashboard/lib/api.js` | Métodos `admin*` consumidos pelas telas. | Reaproveitar e ampliar com contratos novos. |

## Inventário de contratos `/api/admin`

### Acesso, RBAC e segurança

O backend já centraliza papéis e permissões administrativas. A autenticação é
aplicada no hook `onRequest`, e cada endpoint chama `requireAdmin` com a
permissão necessária. Isso deve ser mantido como a base de segurança para a
futura área de observabilidade.

| Capability | Endpoints/trechos | Permissão dominante | Decisão |
| --- | --- | --- | --- |
| Identidade admin | `GET /api/admin/me` | admin válido | Reaproveitar. |
| Overview executivo | `GET /api/admin/overview` | `admin:read` | Reaproveitar para `/admin`; não misturar com tela técnica. |
| Usuários e detalhe | `GET /api/admin/users`, `GET /api/admin/users/:id` | `support:read` | Reaproveitar para CS e drill-down; revisar PII. |
| Ajuste manual de acesso | `POST /api/admin/users/:id/access` | `support/admin write` | Manter com MFA/auditoria; não mover para observabilidade. |
| Auditoria | `writeAdminAuditLog` em leituras e escritas | conforme endpoint | Reaproveitar, mas adicionar redaction central. |

### Observabilidade já existente

| Área | Endpoint atual | O que já entrega | Decisão |
| --- | --- | --- | --- |
| Saúde do sistema | `GET /api/admin/system/health` | DB, env, PID, uptime, memória, CPU, contagens, métricas de API. | Reaproveitar como `dependencies.health`. |
| Métricas da API | `GET /api/admin/system/metrics` | Snapshot de requests, 4xx/5xx, latência, erros recentes e sinais operacionais. | Reaproveitar; evoluir para histogramas/SLO. |
| Observabilidade operacional | `GET /api/admin/system/observability` | Alertas básicos, DLQ de pagamento, DB e supervisor. | Reestruturar em contrato de Golden Signals. |
| Logs cross-user | `GET /api/admin/logs/summary` | Sucesso, dedup, config block, timeout, erros, top destinos e top usuários. | Reaproveitar com privacy-safe output. |
| Logs detalhados | `GET /api/admin/logs` | Listagem operacional de MessageLog. | Reaproveitar; redigir mensagens/URLs/JIDs. |
| Sessões | `GET /api/admin/sessions` | Sessões WhatsApp, status, telefone mascarado, usuário, bot rodando. | Reaproveitar; adicionar saúde de sessão. |
| Telemetria de sessão | `GET /api/admin/session-telemetry` | Eventos agregados por estágio/evento a partir de auditoria. | Reaproveitar; padronizar como eventos técnicos. |
| DLQ de envio | `/api/admin/send-dlq/:userId*` | Listar, retry, discard e purge por usuário. | Reaproveitar; criar visão global e SLO. |
| Telegram | `/api/admin/telegram/*` | Overview e requests do bot. | Reaproveitar; adicionar latência e alertas. |
| CS | `/api/admin/success/*` | Overview, fila priorizada e métricas. | Reaproveitar; alimentar com incidentes técnicos. |
| Pipeline | `/api/admin/pipeline*` | Leitura e movimentação do backlog. | Reaproveitar como pós-incidente/P3. |

## Matriz de reaproveitamento

### Reaproveitar sem mudança estrutural

- RBAC de papéis e permissões em `src/api/routes/admin.js`.
- `GET /api/admin/me` como bootstrap de permissões no frontend.
- `GET /api/admin/system/health` como fonte de saúde imediata.
- `GET /api/admin/system/metrics` como fonte inicial de métricas.
- Rotas de DLQ para ações operacionais auditáveis.
- Página de Telegram como tela de domínio específico.
- Página de CS como fila de ação humana sobre clientes impactados.
- Pipeline técnico como destino de follow-ups de incidentes.

### Reaproveitar com adaptação

- `GET /api/admin/system/observability`: transformar em contrato estruturado
  por Golden Signals, dependências e alertas.
- `GET /api/admin/logs/summary`: manter agregações, mas mascarar/hash de
  destino/usuário e adicionar janelas 5m/30m/1h/6h/24h.
- `GET /api/admin/sessions`: adicionar heartbeat, owner mismatch, reconexões,
  quarantine/circuit breaker e idade do último status.
- `/admin/page.js`: manter como cockpit executivo, extraindo sinais técnicos
  densos para `/admin/observabilidade`.
- `/admin/marketing-growth`: reaproveitar padrões de `data trust` para indicar
  métrica medida, parcial ou estimada.

### Reestruturar

- Evitar que `/admin/page.js` continue acumulando toda operação técnica, CS,
  growth, sessões, logs e sistema no mesmo lugar.
- Remover dados sensíveis ou de alta cardinalidade das respostas técnicas por
  padrão: JID completo, telefone completo, mensagem completa e URL completa.
- Padronizar `before`/`after` de auditoria com redaction antes de gravar.
- Separar alertas acionáveis de cards informativos.
- Trocar snapshots isolados por séries temporais e SLOs quando houver backend de
  métricas externo.

### Criar do zero

- Nova rota de frontend: `/admin/observabilidade`.
- Novo contrato agregado: `GET /api/admin/observability/golden-signals` ou uma
  evolução compatível de `/api/admin/system/observability`.
- Visão global de filas: waiting, active, delayed, failed, DLQ e idade do job
  mais antigo.
- Matriz de dependências: API, dashboard proxy, SQLite/Prisma, Redis, supervisor,
  bot-workers, Telegram, Mercado Pago e integrações de afiliado.
- SLOs e burn-rate alerts por fluxo crítico.
- Runbooks por alerta.
- Propagação de `traceId` para request -> fila -> supervisor -> worker -> banco.

## Lacunas frente aos Golden Signals

### Latência

Já existe latência média e um `p95RouteAvgMs` aproximado no snapshot da API, mas
faltam histogramas reais, p95/p99 por rota crítica, latência de filas, latência
de banco e latência de envio WhatsApp/Telegram.

Backlog recomendado:

1. Adicionar histogramas Prometheus/OTel para HTTP.
2. Medir latência de comandos do supervisor.
3. Medir tempo em fila e tempo de execução por backend de envio.
4. Medir latência p50/p95/p99 do Telegram Offer Bot.
5. Medir duração de queries Prisma/SQLite em pontos críticos.

### Tráfego

Já existe contagem de requests por rota e contagens de MessageLog/Telegram, mas
faltam métricas normalizadas por fluxo de negócio.

Backlog recomendado:

1. `messages_received_total`.
2. `messages_processed_total`.
3. `messages_sent_total`.
4. `offer_automation_runs_total`.
5. `telegram_offer_requests_total`.
6. `supervisor_commands_total`.
7. `queue_jobs_total` por status.

### Erros

A taxonomia de `MessageLog.errorMsg` já permite classificar timeouts, dedup,
config block, Baileys, fila cheia, worker restart e conversão. A lacuna é
transformar isso em métricas e alertas com severidade correta.

Backlog recomendado:

1. Exportar métricas por categoria canônica de erro.
2. Separar `skip:*` benigno de falha real.
3. Criar alertas só para sintomas acionáveis.
4. Criar drill-down privacy-safe por usuário/grupo.

### Saturação

Já há memória, CPU e sinais operacionais básicos; faltam event loop lag, Redis,
BullMQ, WAL/SQLite, filas internas, PM2 restarts e capacidade do supervisor.

Backlog recomendado:

1. Event loop lag e heap.
2. Redis latency/memory/blocked clients.
3. BullMQ waiting/active/delayed/failed/DLQ.
4. SQLite busy, WAL size e query duration.
5. Supervisor heartbeat age e sessões por shard.
6. Worker restarts e reconnect loops.

## Lacunas de tracing distribuído

Não há contrato documentado para propagar `traceparent`/`traceId` entre
Dashboard, API, BullMQ, supervisor, worker e banco. A Fase 1 deve introduzir um
plano de propagação sem quebrar o protocolo atual.

Fluxo-alvo:

```text
Dashboard -> Next proxy -> Fastify API -> Prisma/SQLite
  -> Redis/BullMQ -> bot-supervisor -> bot-worker -> WhatsApp/Baileys
  -> MessageLog/AnalyticsEvent
```

Decisões iniciais:

- adicionar `x-request-id`/`traceparent` no frontend/API;
- incluir contexto de trace em jobs BullMQ e comandos do supervisor;
- incluir `traceId` em logs estruturados;
- avaliar campo opcional `traceId` em tabelas operacionais futuras, como
  `MessageLog`, sem bloquear a Fase 1.

## Matriz LGPD e privacidade

| Campo | Onde aparece | Risco | Decisão |
| --- | --- | --- | --- |
| `contactPhone` | usuários, CS, sessões | PII direto | Mascarar por padrão; exibir só com `support:write`. |
| `waSession.phone` | sessões | PII direto | Mascarar por padrão. |
| `email` | usuários/admin | PII direto | Exibir só onde necessário; preferir `userId` em painéis técnicos. |
| `sourceGroup`/`destGroup` | logs | Identificador sensível | Hash/alias em views técnicas. |
| `messageText` | MessageLog | Conteúdo potencialmente sensível | Não exibir integral em observabilidade. |
| `originalUrl`/`convertedUrl` | MessageLog | Pode conter query/PII/tracking | Truncar e remover query por padrão. |
| `inputUrl` | TelegramOfferLog | URL sensível | Redigir query e limitar tamanho. |
| `before`/`after` | AdminAuditLog | Variável, pode conter segredo | Redaction central obrigatória. |
| tokens/cookies/secrets | headers/env/credenciais | Segredo crítico | Nunca logar. |

## Arquitetura-alvo após Fase 0

```text
/admin
  Visão executiva, clientes, atalhos, status geral, CS resumido.

/admin/observabilidade
  Golden Signals, SLOs, alertas ativos, dependências, filas, banco,
  supervisor, sessões, integrações e runbooks.

/admin/sucesso-cliente
  Clientes impactados, fila humana, contatos e retenção.

/admin/telegram
  Observabilidade específica do Telegram Offer Bot.

/admin/pipeline
  Backlog técnico, follow-ups P3 e melhorias pós-incidente.
```

## Backlog priorizado para Fase 1

1. Criar `/admin/observabilidade` consumindo os contratos atuais
   `/system/health`, `/system/metrics`, `/system/observability`,
   `/logs/summary`, `/sessions` e Telegram.
2. Evoluir `/system/observability` para retornar `goldenSignals`,
   `dependencies`, `alerts`, `queues`, `supervisor`, `database` e `privacy`.
3. Adicionar componente de alerta com severidade P1/P2/P3/Info e estado
   acionável.
4. Criar camada de redaction para payloads admin antes de exibir/logar dados
   técnicos sensíveis.
5. Adicionar janelas de tempo padronizadas nos resumos operacionais.
6. Adicionar visão global de DLQ/filas além da visão por usuário.
7. Documentar runbooks mínimos para banco indisponível, 5xx alto, DLQ alta,
   supervisor morto, Telegram sem eventos e timeouts de envio.
8. Planejar OTel/tracing com `traceparent` sem alterar o protocolo do supervisor
   de forma breaking.

## Critérios de aceite desta Fase 0

- Inventário de páginas admin: concluído.
- Inventário de endpoints admin relevantes para observabilidade: concluído.
- Matriz de reaproveitamento: concluída.
- Lacunas por Golden Signal: concluídas.
- Matriz LGPD/privacidade: concluída.
- Arquitetura-alvo: proposta.
- Backlog da Fase 1: proposto.

## Comandos usados na auditoria

```bash
rg --files dashboard/app src/api | rg 'admin|Admin'
rg -n "app\\.(get|post|put|patch|delete)\\('|api\\.admin|href=\"/admin" src/api/routes/admin.js dashboard/app/admin dashboard/lib/api.js -S
rg -n "system/health|system/metrics|system/observability|logs/summary|session-telemetry|send-dlq|telegram|success" src/api/routes/admin.js dashboard/app/admin dashboard/lib/api.js -S
```
