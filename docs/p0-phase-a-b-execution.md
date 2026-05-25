# P0 Fase A + B — Execução Sequencial (staging-first)

Este runbook operacionaliza as fases A e B com critérios objetivos de aceite.

## Fase A — Cutover staging para `BOT_SUPERVISOR_MODE=remote`

Pré-requisito: usar `scripts/p0_1_cutover_remote.sh` no host staging.

1. Dry-run:
   ```bash
   cd ~/wabot-staging
   bash scripts/p0_1_cutover_remote.sh --env staging
   ```
2. Aplicação real:
   ```bash
   cd ~/wabot-staging
   bash scripts/p0_1_cutover_remote.sh --env staging --yes
   ```
3. Aceite obrigatório:
   - Sessão WhatsApp conectada antes do restart.
   - `pm2 restart api-staging` não derruba sessão.

Se falhar: rollback imediato para `BOT_SUPERVISOR_MODE=inline` e restart de `api-staging`.

## Fase B — SLO operacional de DLQ

Script de avaliação: `scripts/p0_2_dlq_slo_check.sh`.

1. Execução manual/cron:
   ```bash
   API_BASE_URL=http://127.0.0.1:3004 \
   ADMIN_TOKEN='<jwt_admin>' \
   USER_IDS='user1,user2,user3' \
   bash scripts/p0_2_dlq_slo_check.sh
   ```
2. Critérios padrão:
   - warning: >=1 job com idade >=10 min
   - critical: >=20 jobs OU idade >=30 min
3. Resposta operacional:
   - Listar: `GET /api/admin/send-dlq/:userId`
   - Retry: `POST /api/admin/send-dlq/:userId/retry/:jobId`
   - Discard: `DELETE /api/admin/send-dlq/:userId/job/:jobId`
   - Purge controlado: `POST /api/admin/send-dlq/:userId/purge`

## Gate para avançar

Somente avançar para produção quando:
- Fase A aprovada em staging com sessão persistindo após restart da API.
- Fase B sem critical por pelo menos 24h e com rotina de resposta validada.
