# Cron de snapshot diário (PR-5.F follow-up)

Rotina automatizada que captura `ChannelSnapshot` de todos os canais-destino
ativos, 1x/dia, depois do `backup_prod.sh`. Paraquedas: se um canal for
banido, o cliente recria no app, chama `POST /api/groups/:id/recreate` e
o bot re-aplica nome+descrição do último snapshot.

## Como ativa

Já está em `ecosystem.config.cjs` como app PM2 `snapshot-cron`:

- `script: scripts/run_channel_snapshots.mjs`
- `cron_restart: '0 6 * * *'` (06:00 UTC = 03:00 BRT)
- `autorestart: false` (roda 1x e sai; PM2 não reinicia imediatamente)

Para subir no VPS:

```bash
cd ~/wabot
pm2 start ecosystem.config.cjs --only snapshot-cron
pm2 save
```

Para staging, mesmo procedimento em `~/wabot-staging`.

## O que o script faz

1. Lista `User` com `status='active'`.
2. Para cada usuário com sessão WA rodando (`isRunning(userId)`), chama
   `captureAllForUser(userId)`, que itera os canais `kind='channel'`
   `role='post'` e grava `ChannelSnapshot` (mantém últimos 30).
3. Usuários sem sessão ativa entram no contador `skipped`.
4. Saída final em stderr como linha JSON (consumível por log aggregator).

Cada usuário roda em sequência (não paralelo) para não saturar a IPC do
bot worker — snapshot é leve mas o `newsletterMetadata` é round-trip
WhatsApp.

## Logs

```bash
pm2 logs snapshot-cron --lines 200
```

Saída de sucesso (1 linha por run):
```json
{"level":"info","msg":"channel_snapshot_cron_done","durationMs":2341,"users":12,"captured":34,"skipped":3,"errors":0}
```

## Quando NÃO roda

- VPS reiniciou no horário do cron e o PM2 ainda não saiu do
  `min_uptime` → próximo run só amanhã. Ideal monitorar a partir do 2º dia.
- API/worker offline para todos os usuários → tudo conta como skipped,
  mas o cron sai com exit 0 (não conta como erro).

## Retenção

`captureSnapshot()` já faz a poda: mantém últimos 30 por canal. Não há
job separado de garbage collection necessário.

## Recuperação manual

Para forçar fora do horário:

```bash
cd ~/wabot
node scripts/run_channel_snapshots.mjs
```

Ou, para um canal específico via API (sem aguardar o cron):

```bash
curl -X POST -H "Authorization: Bearer ..." http://localhost:3001/api/groups/<groupId>/snapshot-now
```
