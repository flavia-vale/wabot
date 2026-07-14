# Backup de produção

Script: `scripts/backup_prod.sh`. Faz snapshot consistente do banco
SQLite (`prisma/prod.db`) usando `sqlite3 .backup`, copia o diretório
`auth_info` (sessões WhatsApp ativas) e empacota tudo em um único
`.tar.gz` timestampado.

## O que entra no arquivo

```
wabot-prod-YYYYMMDD-HHMMSS.tar.gz
├── manifest.json     # version, timestamp, paths originais, contagem de bytes
├── prod.db           # snapshot consistente do SQLite (PRAGMA integrity_check OK)
├── auth_info/        # sessões WhatsApp (Baileys) — opcional, só se existir
└── env/
    ├── root.env             # .env raiz (JWT_SECRET, DATABASE_URL, REDIS_URL…)
    └── dashboard.env.local  # .env do dashboard
```

> ⚠️ O archive contém segredos (JWT_SECRET, CREDENTIAL_ENCRYPTION_KEY) e o
> `auth_info` (controle das sessões WhatsApp de todos os clientes). `chmod 600`
> é aplicado automaticamente, mas isso só protege permissões locais. **Em
> produção, cifre o backup** (seção abaixo) antes de qualquer upload. Para
> excluir os .env do backup (DR parcial apenas), exporte `INCLUDE_ENV_FILES=0`.

## Criptografia em repouso (obrigatória em produção)

O backup é cifrado com [age](https://github.com/FiloSottile/age) quando
`BACKUP_AGE_RECIPIENT` (chave pública `age1...`) está configurada. O arquivo
vira `wabot-prod-*.tar.gz.age` e o plaintext é removido. **A chave privada
NÃO deve morar no VPS** — guarde-a em um gerenciador de senhas/cofre e em um
segundo local offline. Sem ela o backup é irrecuperável; com ela em mãos
errada, o backup entrega o sistema inteiro.

```bash
# 1) Gerar o par de chaves FORA do VPS (na sua máquina)
age-keygen -o wabot-backup-key.txt
# anote a "public key: age1..." e guarde wabot-backup-key.txt em local seguro

# 2) No VPS: instalar age e configurar só a chave PÚBLICA no cron
sudo apt-get install -y age
```

Variáveis no cron de produção (recomendado):

```
BACKUP_AGE_RECIPIENT=age1...          # chave pública
BACKUP_REQUIRE_ENCRYPTION=1           # backup sem cifra = falha (não silencioso)
BACKUP_RCLONE_REMOTE=b2-wabot:wabot-backups
BACKUP_REQUIRE_CLOUD=1                # backup sem cópia externa = falha
```

- `verify_backup.sh` valida idade/header de backups `.age` sem a chave; a
  verificação completa do conteúdo roda no **restore drill** (host separado,
  com `AGE_IDENTITY_FILE` apontando para a chave privada).
- `restore_from_backup.sh <arquivo.tar.gz.age> --confirm` exige
  `AGE_IDENTITY_FILE`.
- Cada execução bem-sucedida grava `last_success.txt` no `BACKUP_DIR` —
  monitore o mtime desse arquivo (alerta se >26h).

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

## Cópia para nuvem (opcional, múltiplos destinos)

O script aceita upload via [rclone](https://rclone.org/) — um único
binário que fala com S3, Backblaze B2, Cloudflare R2, Google Drive,
Dropbox, etc. `BACKUP_RCLONE_REMOTE` aceita **múltiplos remotes
separados por vírgula** — o mesmo arquivo cifrado sobe pra cada um
(útil pra ter Drive **e** B2 ao mesmo tempo, sem depender de um único
provedor).

### 1) Instalar rclone

```bash
curl https://rclone.org/install.sh | sudo bash
```

### 2a) Backblaze B2 — mais rápido (sem OAuth, só chave de API)

1. Crie um bucket **privado** no painel do B2 e uma Application Key
   restrita a esse bucket (não use a chave mestra da conta).
2. Configure o remote direto por linha de comando (não-interativo,
   funciona por SSH sem abrir navegador):

```bash
rclone config create b2-wabot b2 account <keyID> key <applicationKey>
```

3. Teste:

```bash
rclone lsd b2-wabot:
rclone copy /etc/hostname b2-wabot:wabot-backups/test.txt
rclone ls b2-wabot:wabot-backups
```

### 2b) Google Drive — exige autorização única (OAuth)

O Drive não aceita uma chave de API simples feito o B2; a primeira vez
precisa de um consentimento OAuth. Como o VPS normalmente não tem
navegador, use `rclone authorize` numa máquina com navegador (seu
notebook, por exemplo) e cole o token de volta no VPS:

```bash
# No VPS: inicia a config e escolhe "drive", depois "No" quando perguntar
# se quer usar auto config (porque não há navegador no VPS)
rclone config
# name> gdrive-wabot
# Storage> drive
# client_id/client_secret> deixe em branco (usa o app padrão do rclone)
# scope> 1 (acesso completo ao próprio Drive)
# Use auto config?> n

# Na SUA máquina (com navegador), rode o comando que o rclone imprimiu, ex.:
rclone authorize "drive"
# Abre o navegador, você loga e autoriza; copia o token JSON gerado

# De volta no VPS, cole esse token quando o rclone config pedir
# "result"> <cole o JSON aqui>
```

4. Teste:

```bash
rclone lsd gdrive-wabot:
rclone copy /etc/hostname gdrive-wabot:wabot-backups/test.txt
rclone ls gdrive-wabot:wabot-backups
```

### 3) Apontar o cron pro(s) remote(s)

Um só destino:

```
0 6 * * * BACKUP_RCLONE_REMOTE=b2-wabot:wabot-backups /home/deploy/wabot/scripts/backup_prod.sh >> /home/deploy/wabot-backups/backup.log 2>&1
```

Os dois ao mesmo tempo (recomendado — cada provedor cobre a falha do outro):

```
0 6 * * * BACKUP_RCLONE_REMOTE=b2-wabot:wabot-backups,gdrive-wabot:wabot-backups /home/deploy/wabot/scripts/backup_prod.sh >> /home/deploy/wabot-backups/backup.log 2>&1
```

O script faz `rclone copy` do arquivo gerado pra cada remote da lista e
aplica a mesma política de retenção (`--min-age`) em cada um. Se um
upload falhar, o script aborta (`fail`) — não fica um remote
silenciosamente desatualizado sem ninguém perceber.

## Restauração (`scripts/restore_from_backup.sh`)

Script idempotente que executa o procedimento canônico: pre-backup
automático do estado atual, verificação de integridade do archive,
parada PM2, restore, religa PM2.

```bash
# Exige --confirm explícito (operação destrutiva)
/home/deploy/wabot/scripts/restore_from_backup.sh \
  /home/deploy/wabot-backups/wabot-prod-20260601-060000.tar.gz \
  --confirm
```

O script:
1. Verifica integridade do `.db` no archive antes de tocar em qualquer arquivo
2. Salva pre-backup em `/tmp/wabot-pre-restore-<ts>/` (db, auth_info, .env)
3. Para `pm2 stop api bot-supervisor`
4. Restaura `prod.db`, `auth_info/`, `.env` (raiz + dashboard)
5. `pm2 start` dos mesmos apps
6. Imprime caminho do pre-backup para rollback manual rápido

Knobs úteis:

| Env             | Default                          | Efeito |
|-----------------|----------------------------------|--------|
| `RESTORE_ENV`   | `1`                              | `0` preserva `.env` atual (use quando só quer voltar DB) |
| `SKIP_PM2`      | `0`                              | `1` pula stop/start (use em DR onde PM2 ainda não está montado) |
| `PM2_APPS`      | `api bot-supervisor`             | Apps a parar/reiniciar |
| `PROD_DB`       | `$PROD_DIR/prisma/prod.db`       | Destino do DB |
| `AUTH_INFO_DIR` | `/home/deploy/BOTinho-shared/auth_info` | Destino de auth_info |

### Rollback rápido (algo deu errado no restore)

O pre-backup que o script imprime fica em `/tmp/wabot-pre-restore-<ts>/`.
Para reverter:

```bash
PRE=/tmp/wabot-pre-restore-20260601-150000   # caminho do log do script
pm2 stop api bot-supervisor
cp "$PRE/prod.db.before-restore" /home/deploy/wabot/prisma/prod.db
rm -rf /home/deploy/BOTinho-shared/auth_info
tar -xzf "$PRE/auth_info.before-restore.tar.gz" -C /home/deploy/BOTinho-shared/
cp "$PRE/root.env.before-restore" /home/deploy/wabot/.env
pm2 start api bot-supervisor
```

## Verificação periódica (`scripts/verify_backup.sh`)

Cron-safe, não-destrutivo. Por default checa o backup MAIS RECENTE em
`BACKUP_DIR`. Bom para alertar quando o cron de backup parou ou quando
o `.db` corrompeu.

```bash
# Verifica o último backup
/home/deploy/wabot/scripts/verify_backup.sh

# Ou um arquivo específico
/home/deploy/wabot/scripts/verify_backup.sh /caminho/arquivo.tar.gz
```

O script falha (exit ≠ 0) se:
- Arquivo mais novo tem >`MAX_AGE_HOURS` (default 26h — cobre cron diário com folga)
- `tar -xzf` falhou (archive corrompido)
- `PRAGMA integrity_check` não retornou `ok`
- Tabela `User`, `WaSession` ou `AdminAuditLog` ausente
- `User.count < MIN_USER_COUNT`
- `env/root.env` ausente ou sem `JWT_SECRET` (a menos que `REQUIRE_ENV_FILES=0`)

Rodar como cron logo após o backup:

```cron
0 6 * * * /home/deploy/wabot/scripts/backup_prod.sh >> /home/deploy/wabot-backups/backup.log 2>&1
30 6 * * * /home/deploy/wabot/scripts/verify_backup.sh >> /home/deploy/wabot-backups/verify.log 2>&1 || echo "VERIFY FALHOU" | mail -s "wabot backup falhou" voce@exemplo.com
```

(A linha do `mail` é opcional — adapte para o canal de alerta que você usa.)
