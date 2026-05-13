# Backup de produção

Script: `scripts/backup_prod.sh`. Faz snapshot consistente do banco
SQLite (`prisma/prod.db`) usando `sqlite3 .backup`, copia o diretório
`auth_info` (sessões WhatsApp ativas) e empacota tudo em um único
`.tar.gz` timestampado.

## O que entra no arquivo

```
wabot-prod-YYYYMMDD-HHMMSS.tar.gz
├── prod.db           # snapshot consistente do SQLite (PRAGMA integrity_check OK)
└── auth_info/        # sessões WhatsApp (Baileys) — opcional, só se existir
```

## Instalação no VPS de produção

```bash
# 1) Garantir dependência
sudo apt-get update && sudo apt-get install -y sqlite3

# 2) Criar diretório de destino
mkdir -p /home/deploy/wabot-backups
chmod 700 /home/deploy/wabot-backups

# 3) Validar manualmente
/home/deploy/wabot/scripts/backup_prod.sh

# Confere que gerou um arquivo
ls -lah /home/deploy/wabot-backups
```

A primeira execução deve imprimir algo como:

```
[backup_prod ...] Snapshot SQLite OK (X bytes)
[backup_prod ...] auth_info copiado (N arquivos)
[backup_prod ...] Arquivo gerado: /home/deploy/wabot-backups/wabot-prod-...tar.gz
```

## Cron diário (03:00 BRT = 06:00 UTC)

```bash
crontab -e
```

Adicione:

```
0 6 * * * /home/deploy/wabot/scripts/backup_prod.sh >> /home/deploy/wabot-backups/backup.log 2>&1
```

Verifique depois com:

```bash
crontab -l
tail -f /home/deploy/wabot-backups/backup.log
```

## Retenção

Por padrão, arquivos com mais de **30 dias** em `/home/deploy/wabot-backups`
são removidos a cada execução. Sobrescreva com `RETENTION_DAYS` se quiser
outro valor:

```
0 6 * * * RETENTION_DAYS=60 /home/deploy/wabot/scripts/backup_prod.sh >> /home/deploy/wabot-backups/backup.log 2>&1
```

## Cópia para nuvem (opcional)

O script aceita upload via [rclone](https://rclone.org/) — um único
binário que fala com S3, Backblaze B2, Cloudflare R2, Google Drive,
Dropbox, etc.

### 1) Instalar rclone

```bash
curl https://rclone.org/install.sh | sudo bash
```

### 2) Configurar um remote

```bash
rclone config
```

Siga o menu interativo. Exemplo para Backblaze B2 (mais barato para
backup):

- Nome do remote: `b2-wabot`
- Tipo: `b2`
- Cole `account` e `key` do seu bucket
- Aceite os defaults

Teste:

```bash
rclone lsd b2-wabot:
rclone copy /etc/hostname b2-wabot:wabot-backups/test.txt
rclone ls b2-wabot:wabot-backups
```

### 3) Apontar o cron pro remote

Edite o cron para incluir `BACKUP_RCLONE_REMOTE`:

```
0 6 * * * BACKUP_RCLONE_REMOTE=b2-wabot:wabot-backups /home/deploy/wabot/scripts/backup_prod.sh >> /home/deploy/wabot-backups/backup.log 2>&1
```

O script vai fazer `rclone copy` do arquivo gerado e aplicar a mesma
política de retenção (`--min-age`) no remote.

## Restauração (procedimento manual)

⚠️ Operação destrutiva — sempre pare a API antes, faça um backup do
estado atual, e só então restaure.

```bash
# 1) Parar a API em produção
pm2 stop api

# 2) Backup do estado atual antes de mexer
cp /home/deploy/wabot/prisma/prod.db /home/deploy/wabot/prisma/prod.db.broken.$(date +%s)
tar -czf /tmp/auth_info_pre_restore_$(date +%s).tar.gz -C /home/deploy/BOTinho-shared auth_info

# 3) Extrair o backup desejado para uma pasta temporária
mkdir -p /tmp/wabot-restore
tar -xzf /home/deploy/wabot-backups/wabot-prod-YYYYMMDD-HHMMSS.tar.gz -C /tmp/wabot-restore

# 4) Restaurar
cp /tmp/wabot-restore/prod.db /home/deploy/wabot/prisma/prod.db
rm -rf /home/deploy/BOTinho-shared/auth_info
cp -a /tmp/wabot-restore/auth_info /home/deploy/BOTinho-shared/auth_info

# 5) Religar
pm2 start api
pm2 logs api --lines 50 --nostream

# 6) Limpeza
rm -rf /tmp/wabot-restore
```

## Verificação periódica

Pelo menos 1x por mês, faça um teste de restauração em um diretório
isolado:

```bash
tar -xzf /home/deploy/wabot-backups/wabot-prod-$(ls -t /home/deploy/wabot-backups | head -1) -C /tmp/restore-test
sqlite3 /tmp/restore-test/prod.db "SELECT COUNT(*) FROM User; PRAGMA integrity_check;"
ls /tmp/restore-test/auth_info | head
rm -rf /tmp/restore-test
```

Se a query retornar uma contagem coerente e `ok`, o backup está válido.
