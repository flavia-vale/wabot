# Rollback rápido de produção

Escrito em 2026-08-29, antes da promoção de `develop` → `main` que leva a marca
d'água por destino, a observabilidade do descarte mudo e o lote de migrations
acumuladas de 28-29/08.

## Ponto de retorno

A branch **`backup/main-antes-marca-dagua-2026-08-29`** aponta para o commit
`6aa9258` — o `main` estável imediatamente antes dessa promoção. Ela existe só
para isso: não mergear nela, não apagar.

```bash
git ls-remote --heads origin | grep backup/main-antes-marca-dagua
# 6aa92584627dfdf9e8de98ca07f951abaa5363d6  refs/heads/backup/main-antes-marca-dagua-2026-08-29
```

## ANTES de promover (não pule)

O código volta em minutos; o **banco não**. Faça o backup do banco primeiro:

```bash
ssh deploy@<vps>
cd ~/wabot
scripts/backup_prod.sh          # snapshot WAL-safe + auth_info, em ~/wabot-backups/
ls -lh ~/wabot-backups/ | tail -3
```

Confira também o pré-flight canônico do AGENTS.md:

```bash
grep "name:" ~/wabot/ecosystem.config.cjs   # precisa listar api, dashboard, bot-supervisor, snapshot-cron
ls ~/wabot/src/supervisor/                  # protocol.js, client.js, index.js
```

## O risco específico desta promoção: as migrations

Este lote leva várias migrations acumuladas (`watermarkText`, `watermarkColor`,
`targetsMode`, `deliveryKind`, tabelas de capacidade). O deploy roda
`prisma migrate deploy`, que **para `api` e `bot-supervisor` antes de migrar**.

Se **uma** migration falhar, o banco entra em estado de migration falha
(**P3009**) e — atenção — **todo deploy seguinte falha também**, porque o Prisma
rastreia isso pela tabela `_prisma_migrations` do banco, não pelos arquivos do
repo. Foi exatamente o que travou o staging por horas em 28/08. Pior: o deploy
que falha **não religa** `api`/`bot-supervisor`, então a produção fica fora do ar
até alguém intervir à mão.

**Sinal de que aconteceu:** o step "Deploy via SSH" fica vermelho com
`Error: P3009` ou `duplicate column name`.

### Destravar (banco em P3009)

```bash
cd ~/wabot
pm2 stop api bot-supervisor          # OBRIGATÓRIO: com eles no ar dá "database is locked"
npx prisma migrate resolve --rolled-back <nome_da_migration_que_falhou>
pm2 start api bot-supervisor
pm2 save
```

O nome da migration aparece na própria mensagem de erro do deploy. Use
`--rolled-back` (não `--applied`) quando a migration falhou no meio: ela não
chegou a ser aplicada.

## Rollback do código

O deploy de produção faz `git reset --hard origin/main`, então basta `main`
voltar ao commit de backup:

```bash
git fetch origin
git checkout main
git reset --hard backup/main-antes-marca-dagua-2026-08-29
git push --force-with-lease origin main
```

Isso dispara o deploy automático, que devolve o código antigo ao VPS.

⚠️ **`--force-with-lease` reescreve o histórico de `main`.** Só faça com decisão
explícita da dona do produto. A alternativa sem reescrever histórico é um
`git revert` do merge commit — mais lento, porém reversível:

```bash
git revert -m 1 <sha_do_merge_commit>
git push origin main
```

## As colunas novas ficam no banco — e tudo bem

Reverter o código **não** remove as colunas que a migration criou. Isso é
seguro: todas as colunas deste lote são **nuláveis ou têm default**, e o Prisma
consulta colunas explicitamente — o código antigo simplesmente ignora as que não
conhece. **Não** tente desfazer a migration com `ALTER TABLE ... DROP COLUMN`:
o risco de perder dado é real e o ganho é zero.

## Depois do rollback, confirme

```bash
curl -s http://127.0.0.1:3001/health          # {"ok":true}
pm2 list                                       # api, dashboard, bot-supervisor online
```

E no painel de produção: WhatsApp conectado e ofertas voltando a aparecer em
Envios.

## Se precisar restaurar o banco (último recurso)

`scripts/backup_prod.sh` gera **um tarball** por execução
(`~/wabot-backups/wabot-prod-<timestamp>.tar.gz`) contendo o snapshot do banco
(`prod.db`, feito com `sqlite3 .backup`, consistente com WAL), o `auth_info` e o
`.env`.

```bash
pm2 stop api bot-supervisor snapshot-cron

# 1) extrair o backup num diretório separado (NUNCA direto por cima do que roda)
mkdir -p /tmp/restore && tar -xzf ~/wabot-backups/wabot-prod-<timestamp>.tar.gz -C /tmp/restore
ls /tmp/restore

# 2) guardar o banco atual antes de qualquer coisa
cd ~/wabot/prisma
cp prod.db prod.db.quebrado

# 3) restaurar
cp /tmp/restore/prod.db prod.db
rm -f prod.db-wal prod.db-shm                  # WAL antigo não vale para o banco restaurado

pm2 start api bot-supervisor
pm2 save
```

⚠️ O tarball contém `.env` (JWT_SECRET, CREDENTIAL_ENCRYPTION_KEY) e `auth_info`
em claro, a menos que `BACKUP_AGE_RECIPIENT` esteja configurado. Apague
`/tmp/restore` ao terminar.

Restaurar o banco **perde tudo o que entrou depois do snapshot** (envios,
cadastros, pagamentos). É o último recurso, não o primeiro.
