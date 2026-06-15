# Cutover `BOT_SUPERVISOR_MODE=remote` (runbook)

Objetivo: deixar o `bot-supervisor` (processo PM2 separado) dono do `fork()` dos
workers, para que reiniciar a API **não derrube as sessões WhatsApp**. Detalhes
de arquitetura e o porquê em `AGENTS.md` (seção "Processos PM2"). Este doc é o
runbook operacional enxuto.

## Pré-flight obrigatório (não pular)
```bash
grep "name:" ~/wabot/ecosystem.config.cjs   # deve listar api, dashboard, bot-supervisor, snapshot-cron
ls ~/wabot/src/supervisor/                   # deve ter protocol.js, client.js, index.js
```
Se qualquer item falhar: **BLOQUEAR CUTOVER**, promover `develop → main`,
aguardar autodeploy, revalidar.

## Capacidade — `MAX_SESSIONS_PER_PROCESS`
Default conservador é **20** (era 200). Cada bot-worker é um `fork()` cujo RSS o
`max_memory_restart` do PM2 (aplicado ao supervisor) **não cobre** — 50 filhos
podem somar vários GB e disparar o OOM killer do host. **Só subir esse limite
com evidência de RSS por worker do soak** (`docs/p3-soak-evidence.md`).

## Staging primeiro
1. Redis local no VPS (`redis-server`, bind 127.0.0.1, AOF on).
2. `REDIS_URL=redis://127.0.0.1:6379/1` no `.env` de staging.
3. `pm2 start ecosystem.config.cjs --only bot-supervisor-staging`
4. `BOT_SUPERVISOR_MODE=remote` no `.env` da `api-staging` e **delete + start**
   (não basta `restart --update-env` — pegadinha #1):
   ```bash
   pm2 delete api-staging && pm2 start ecosystem.config.cjs --only api-staging
   ```
5. Validar no dashboard de staging: QR, status e envio funcionam end-to-end.
6. **Teste de aceitação**: com uma sessão conectada, `pm2 restart api-staging`
   — a sessão **deve continuar conectada**. Esse é o ponto do cutover.

## Produção (só após staging validado)
Repetir os passos com `bot-supervisor`, `REDIS_URL=.../0` e `api`
(delete + start). Backup antes (`scripts/backup_prod.sh`).

## Rollback (janela ≤ 2 min)
`BOT_SUPERVISOR_MODE=inline` + `pm2 restart api` (ou `api-staging`).
