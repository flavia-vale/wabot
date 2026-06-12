# Healthcheck com alertas (`scripts/healthcheck_alerts.sh`)

Roda via cron no VPS e notifica (Telegram ou webhook) quando algo crítico
degrada. **Complementa, não substitui, um uptime monitor externo** (ex.:
UptimeRobot/BetterStack apontando para `http://espelhagrupos.com.br/login` e
`/health`): se o VPS inteiro cair, este script cai junto.

## Checks

| # | Check  | Falha quando                                                | Env de ajuste |
|---|--------|--------------------------------------------------------------|---------------|
| 1 | Disco  | espaço livre < `DISK_MIN_FREE_PCT` (20%) em `DISK_PATH` (/) | `DISK_MIN_FREE_PCT`, `DISK_PATH` |
| 2 | Backup | `BACKUP_DIR/last_success.txt` mais velho que `BACKUP_MAX_AGE_HOURS` (26h) ou ausente | `BACKUP_DIR`, `BACKUP_MAX_AGE_HOURS` |
| 3 | PM2    | qualquer app de `PM2_APPS` (default `api dashboard bot-supervisor`) fora de `online`. `PM2_APPS=""` pula o check. | `PM2_APPS` |
| 4 | API    | `API_HEALTH_URL` (default `http://127.0.0.1:3001/health`) ≠ 200 | `API_HEALTH_URL` |

## Notificação

Configure pelo menos um canal:

- **Telegram**: `ALERT_TELEGRAM_BOT_TOKEN` + `ALERT_TELEGRAM_CHAT_ID`.
  Pode ser um bot dedicado (não reutilize o token do `telegram-offer-bot` de
  prod — long-polling duplo dá 409; `sendMessage` puro não conflita, mas o
  isolamento evita confusão).
- **Webhook genérico**: `ALERT_WEBHOOK_URL` (POST JSON `{"text": "..."}`,
  compatível com Slack/Discord/Mattermost via incoming webhook).

Dedupe: o mesmo conjunto de falhas só re-alerta após `ALERT_REMIND_HOURS`
(6h). Quando tudo volta ao normal depois de um alerta, envia mensagem de
recuperação. Estado em `STATE_FILE` (default `/tmp/wabot-healthcheck-state`).

## Instalação (cron, a cada 5 min)

```bash
crontab -e
# adicionar (ajuste os envs num wrapper ou inline):
*/5 * * * * ALERT_TELEGRAM_BOT_TOKEN=... ALERT_TELEGRAM_CHAT_ID=... /home/deploy/wabot/scripts/healthcheck_alerts.sh >> /home/deploy/wabot-backups/healthcheck.log 2>&1
```

Em staging, use `API_HEALTH_URL=http://127.0.0.1:3004/health` e
`PM2_APPS="api-staging visual-staging bot-supervisor-staging"`.
