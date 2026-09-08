# Disco em 80% — onde ele está sendo gasto e o que dá para tirar

Estudo feito a partir do código e do último relatório de capacidade
(`docs/capacity-audit-2026-08-31.md`). O disco é de **38 GiB**; em 31/08 estava
em **75%** (27 GiB usados, 9,2 GiB livres) e hoje o painel marca **80%**.

## Resultado medido em produção (2026-09-07)

Executado no VPS: **85% → 55%**, 10,6 GB liberados de uma vez, sem derrubar
sessão nenhuma e sem reiniciar processo.

| Item | Liberado |
|---|---:|
| `bot.log` de produção (estava em **4,2 GB**) | 4,1 GB |
| Logs do PM2 já rotacionados | 3,6 GB |
| Cache do npm (estava em 2,5 GB) | 2,5 GB |
| `bot.log` de staging (455,9 MB) | 405,9 MB |

O `bot.log` de produção sozinho era **4,2 GB** — cinco vezes o tamanho medido no
RCA de julho, e mais que o banco, os backups e as sessões somados. Confirma o
diagnóstico: o gasto de disco é log sem rotação, não dado de cliente.

## 1. O QUE ACONTECEU

O disco encheu de **log**, não de dado de cliente. O banco de produção inteiro
tem ~294 MB — menos de 1% do disco. O que ocupa lugar é arquivo que ninguém
mais lê: log do PM2 (~3,58 GB medidos em 31/08), o `bot.log`, backups velhos e
cache de download.

## 2. PORQUE

Três motivos, em ordem de tamanho.

**a) O `bot.log` nunca foi rotacionado — e ninguém percebeu.** O
`pm2-logrotate` foi instalado em 01/07/2026, mas ele só rotaciona o que o PM2
captura (a saída dos apps, em `~/.pm2/logs`). O `bot.log` é escrito **direto**
pelo pino (`src/logger.js`, alvo `pino/file`) dentro de `BOT_LOG_DIR`, fora do
alcance do PM2. Ou seja: o arquivo cresce desde sempre, sem teto e sem limpeza.
O RCA de julho já o mediu em **835 MB / 1,5 milhão de linhas**, e são dois — um
de produção e um de staging.

**b) O log do PM2 é o maior bloco isolado.** 3,58 GB em 31/08. Boa parte é
arquivo já rotacionado (`*__*.log`, `*.log.gz`), que existe só como histórico.
E o `api-staging` tem 1.894 reinícios acumulados: cada um escreve linha.

**c) Backup e cache não têm quem os cobre.** O `backup_prod.sh` guarda 30 dias
de tarball (banco + `auth_info` + `.env`), e o `backup.log` do cron cresce sem
rotação nenhuma. O cache do npm e os `.deb` do sistema se acumulam a cada
deploy.

O que **não** é o problema: banco (294 MB), `auth_info`, `node_modules`. O
`AnalyticsEvent` é a única tabela sem retenção nenhuma no código, mas dentro de
um banco de 294 MB isso ainda não é questão de disco.

## 3. O QUE DEVE SER FEITO

Duas coisas separadas: **limpar agora** (uma vez) e **impedir que volte**
(permanente). Só limpar não resolve — sem rotação o `bot.log` volta ao mesmo
tamanho.

Nada do que está aqui derruba sessão, exige QR novo ou reinicia processo.

| Item | Estimativa | Risco |
|---|---|---|
| `bot.log` prod + staging (guardando os últimos 50 MB de cada) | ~1–2 GB | nenhum |
| Logs do PM2 já rotacionados | até ~3 GB | nenhum |
| `journald` acima de 200 MB | variável | nenhum |
| Backups com mais de 30 dias + `backup.log` | variável | nenhum |
| Cache do npm, `.deb` do apt, `/tmp/wabot*` | ~0,3–1 GB | nenhum |

**Não entra, de propósito:** `auth_info` (apagar = QR novo para toda cliente),
`*.db`/`*.db-wal`, backup dentro da retenção, `node_modules` e
`dashboard/.next` dos apps no ar, `dedup_*.json`/`known_channels_*.json`
(estado dos robôs) e `pm2 flush` às cegas — ele apaga justamente o log que
explica o último incidente.

## 4. COMO

**Passo 1 — medir (não altera nada):**

```bash
bash ~/wabot/scripts/diag-disco.sh > /tmp/wabot-disco.txt
tail -40 /tmp/wabot-disco.txt
```

O relatório separa o que é precioso do que é descartável e termina com a soma
do que dá para liberar sem perder nada.

**Passo 2 — limpar (simula por padrão):**

```bash
bash ~/wabot/scripts/limpar-disco.sh              # só mostra o que faria
bash ~/wabot/scripts/limpar-disco.sh --aplicar    # executa
```

**Passo 3 — impedir que volte (o que de fato conserta):**

```bash
sudo cp ~/wabot/scripts/logrotate/wabot-bot-log /etc/logrotate.d/wabot-bot-log
sudo logrotate -d /etc/logrotate.d/wabot-bot-log   # simula
sudo logrotate -f /etc/logrotate.d/wabot-bot-log   # primeira rotação
```

`copytruncate` é obrigatório: API, supervisor e cada bot-worker mantêm o
arquivo aberto e não sabem reabrir sozinhos. O pino escreve em modo *append*,
então truncar é seguro — **não** precisa reiniciar nada.

Confira também o teto do PM2 (100 MB / 10 arquivos é o combinado):

```bash
pm2 conf pm2-logrotate
pm2 set pm2-logrotate:max_size 100M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

**Passo 4 — desligar staging fora de validação** (já existe botão no painel
admin). Além de liberar ~1–1,4 GB de RAM, staging para de escrever log.

## Não regredir

- **`bot.log` NÃO é coberto pelo `pm2-logrotate`.** Qualquer conversa futura
  sobre rotação de log precisa tratar os dois caminhos separadamente: o que o
  PM2 captura e o que o pino escreve direto no `BOT_LOG_DIR`.
- **Não apagar `dedup_*.json`, `known_channels_*.json` nem
  `stuck-message-quarantine.json`** junto com o log: eles moram no mesmo
  diretório e são **estado operacional** dos robôs, não histórico.
- **Não subir a retenção de backup para "economizar disco" reduzindo abaixo de
  30 dias** sem decisão explícita — backup é a última linha de defesa, e o
  tarball é a única cópia de `auth_info` + `.env`.
- Os dois scripts são de leitura por padrão: `diag-disco.sh` nunca escreve, e
  `limpar-disco.sh` só age com `--aplicar`.
