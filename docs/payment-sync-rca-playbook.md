# Falha de Sincronização de Pagamentos — Playbook de RCA e Mitigação

## Objetivo
Fornecer um roteiro prático para investigar e corrigir casos em que o pagamento foi confirmado no gateway, mas o dashboard permanece desatualizado.

## 1) Rastreamento do Fluxo de Dados (Data Path)

### 1.1 Webhooks
- Confirmar no painel do gateway (Stripe/ASAAS/Mercado Pago) se o evento `payment.succeeded` foi emitido.
- Verificar status de entrega do webhook:
  - `2xx`: recebido com sucesso.
  - `4xx` (ex.: `403`): problema de autenticação/assinatura/IP allowlist.
  - `5xx`: erro interno da API ao processar o evento.
- Correlacionar `event_id` do gateway com logs internos para garantir rastreabilidade ponta a ponta.

### 1.2 Logs no timestamp exato
- Buscar logs do período exato da transação (incluindo timezone).
- Verificar falhas comuns:
  - Assinatura inválida do webhook.
  - Parsing JSON inválido.
  - Timeout de banco.
  - Falha de transação (rollback silencioso).
  - Falha ao publicar evento interno (fila/pubsub).

### 1.3 Idempotência
- Validar se o `event_id` está sendo armazenado corretamente.
- Garantir que a lógica de deduplicação:
  - Rejeite apenas duplicatas reais.
  - Não descarte novos eventos por colisão de chave/idempotency key mal definida.

## 2) Integridade e Estado do Banco de Dados

### 2.1 Mapeamento de status
- Confirmar o status final persistido na tabela de pagamentos.
- Comparar status aceitos no backend com filtros do dashboard.
- Exemplo de divergência crítica:
  - Banco: `paid`
  - Dashboard filtra apenas `completed`

### 2.2 Relacionamentos
- Validar vínculo entre pagamento e dono correto:
  - `user_id`
  - `account_id`
  - `subscription_id` / `order_id`
- Auditar queries e joins para garantir que o registro não esteja “órfão” ou associado a tenant incorreto.

### 2.3 Consistência transacional
- Verificar se atualização de pagamento e atualização de saldo/plano ocorrem na mesma transação lógica.
- Se distribuído, usar outbox/inbox pattern para evitar estados parciais.

## 3) Cache e Frontend

### 3.1 Invalidação de cache
- Confirmar se houve invalidation após `payment.succeeded`:
  - Redis keys.
  - Cache de API gateway/reverse proxy.
  - CDN (Cloudflare).
- Garantir TTL curto para métricas financeiras críticas.

### 3.2 Atualização no cliente
- Revisar estratégia do dashboard:
  - Polling (intervalo, retry, backoff).
  - WebSocket/SSE (reconexão e fallback).
  - React Query/SWR (staleTime, refetchOnWindowFocus, invalidateQueries).
- Validar se o frontend não está memoizando estado antigo sem revalidação.

## 4) Roadmap de Correção (Prevenção)

### I. Worker de Reconciliação (obrigatório)
**Objetivo:** não depender 100% de webhooks.

**Implementação mínima:**
- Cron a cada 1h (ou 15 min em alto volume).
- Selecionar no banco pagamentos `pending` criados/atualizados nas últimas 24–72h.
- Consultar API do gateway por `external_id/charge_id`.
- Se gateway = `paid` e banco = `pending`, corrigir estado e registrar auditoria.
- Métricas:
  - `reconciliation.checked`
  - `reconciliation.fixed`
  - `reconciliation.failed`

### II. Dead Letter Queue (DLQ)
**Objetivo:** não perder webhook em falha de processamento.

**Implementação mínima:**
- Pipeline:
  1. Recebe webhook.
  2. Valida assinatura.
  3. Publica job de processamento.
  4. Em falha após N retries, enviar para DLQ.
- DLQ deve guardar payload completo + erro + stack + timestamp.
- Criar comando/admin endpoint para reprocessamento manual seguro.

### III. Observabilidade e Alertas
**Objetivo:** detectar incidentes antes do cliente.

**Alertas recomendados:**
- Taxa de erro de webhook > X% em 5 min.
- Crescimento de DLQ acima de baseline.
- Divergência entre total pago no gateway e total pago no banco acima de limiar.
- Tempo médio de confirmação acima do SLA.

**Dashboards recomendados:**
- Funil: `webhook_received -> webhook_processed -> db_updated -> dashboard_updated`.
- SLO: % de pagamentos refletidos no dashboard em até N minutos.

## 5) Plano de Resposta a Incidente (Runbook)
1. Congelar deploys não relacionados.
2. Identificar janela do incidente (início/fim).
3. Rodar reconciliação manual para transações impactadas.
4. Reprocessar DLQ.
5. Validar amostra com clientes afetados.
6. Publicar postmortem com:
   - causa raiz,
   - impacto,
   - correções imediatas,
   - ações preventivas com prazo e dono.

## 6) Checklist de RCA
- [ ] Evento foi emitido pelo gateway.
- [ ] Assinatura do webhook validada.
- [ ] Endpoint respondeu `2xx`.
- [ ] Job de processamento executou sem erro.
- [ ] Banco atualizado com status correto.
- [ ] Relacionamento com conta/usuário correto.
- [ ] Cache invalidado.
- [ ] Frontend revalidou dados.
- [ ] Reconciliação não encontrou pendências.
- [ ] Alertas e métricas operacionais funcionando.

## 7) Prompt reutilizável para investigação com IA
"Analise uma falha de sincronização de pagamentos onde o gateway confirma pagamento, mas o dashboard não atualiza. Entregue:
1) hipótese de causa raiz priorizada por probabilidade/impacto,
2) plano de diagnóstico com queries/logs/métricas específicas,
3) plano de mitigação imediata,
4) plano preventivo com reconciliação, DLQ e observabilidade,
5) checklist de validação final e critérios de aceite."
