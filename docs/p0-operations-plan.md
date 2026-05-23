# P0 Operations Plan (staging-first)

## Prioridade 1 — bot supervisor em modo `remote`

1. Validar preflight de supervisor no host alvo.
2. Em **staging** (`~/wabot-staging`), garantir `REDIS_URL=redis://127.0.0.1:6379/1` e `BOT_SUPERVISOR_MODE=remote` no `.env` da API.
3. Reiniciar com `pm2 delete api-staging && pm2 start ecosystem.config.cjs --only api-staging` (não usar apenas `restart --update-env`).
4. Critério de aceite: reiniciar `api-staging` com sessão conectada e confirmar que sessão segue conectada.
5. Repetir em produção somente após validação completa em staging.

## Prioridade 2 — SLO operacional de DLQ de envio

SLO proposto:
- `send_dlq_open_jobs == 0` em regime normal.
- alerta warning quando `send_dlq_open_jobs > 0` por mais de 10 minutos.
- alerta critical quando `send_dlq_open_jobs >= 20` ou item mais antigo > 30 minutos.

Resposta operacional:
1. Listar via `GET /api/admin/send-dlq/:userId`.
2. Tentar `POST /api/admin/send-dlq/:userId/retry/:jobId` para erro transitório.
3. Descartar `DELETE /api/admin/send-dlq/:userId/job/:jobId` para payload inválido/irrecuperável.
4. Registrar ação via trilha de auditoria existente (`AdminAuditLog`).

## Prioridade 3 — métricas centralizadas

- Endpoint Prometheus em `/metrics` na API.
- Scrape recomendado a cada 15s.
- Painel mínimo:
  - `wabot_api_uptime_seconds`
  - `wabot_api_requests_aggregate_total`
  - `wabot_api_http_4xx_total`
  - `wabot_api_http_5xx_total`
  - `wabot_api_requests_total{method,route}`

## Risco e bloqueio

Se qualquer validação de staging falhar, **bloquear promoção para produção** e manter `BOT_SUPERVISOR_MODE=inline` até correção.
