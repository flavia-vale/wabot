#!/usr/bin/env bash
#
# Limpeza de disco — SIMULA por padrão, só executa com --aplicar.
#
# Remove APENAS o que é descartável por definição: log já analisado, log já
# rotacionado, cache que se recria sozinho e temporário. Nada aqui toca em
# banco, em sessão do WhatsApp (auth_info), em backup dentro da retenção, em
# node_modules ou em build de app no ar.
#
# Uso (no VPS):
#   bash ~/wabot/scripts/limpar-disco.sh              # simulação: só mostra
#   bash ~/wabot/scripts/limpar-disco.sh --aplicar    # executa de verdade
#
# Antes: rode `bash ~/wabot/scripts/diag-disco.sh` para saber onde está o peso.
#
# Variáveis opcionais: PROD_DIR, STAGING_DIR, BACKUP_DIR, PROD_SHARED_DIR,
# STAGING_SHARED_DIR, BOT_LOG_KEEP_MB (cauda preservada do bot.log, default 50),
# BACKUP_RETENTION_DAYS (default 30), JOURNAL_KEEP (default 200M).

set -uo pipefail

APLICAR=0
[[ "${1:-}" == "--aplicar" ]] && APLICAR=1

PROD_DIR="${PROD_DIR:-$HOME/wabot}"
STAGING_DIR="${STAGING_DIR:-$HOME/wabot-staging}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/wabot-backups}"
PROD_SHARED_DIR="${PROD_SHARED_DIR:-$HOME/BOTinho-shared}"
STAGING_SHARED_DIR="${STAGING_SHARED_DIR:-$HOME/wabot-staging-shared}"
PM2_LOG_DIR="${PM2_LOG_DIR:-$HOME/.pm2/logs}"
BOT_LOG_KEEP_MB="${BOT_LOG_KEEP_MB:-50}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
JOURNAL_KEEP="${JOURNAL_KEEP:-200M}"

TOTAL=0
humano() {
  awk -v b="${1:-0}" 'BEGIN{ split("B KB MB GB TB", u, " "); i=1
    while (b >= 1024 && i < 5) { b /= 1024; i++ } printf "%.1f %s", b, u[i] }'
}
# NR==1 + fallback: `du` pode nao imprimir nada (permissao negada) ou mais de
# uma linha; sem isso as contas de bytes recebiam texto de varias linhas.
bytes() { [[ -e "$1" ]] || { echo 0; return; }; du -sb "$1" 2>/dev/null | awk 'NR==1 { print $1 + 0; ok = 1 } END { if (!ok) print 0 }'; }

if [[ $APLICAR -eq 1 ]]; then
  echo "MODO APLICAR — os itens abaixo serão removidos."
else
  echo "MODO SIMULAÇÃO — nada será removido. Use --aplicar para executar."
fi
echo "Disco antes:"; df -h / | sed 's/^/  /'
echo

item() { printf '\n[%s] %s\n' "$1" "$2"; }
ganho() { TOTAL=$(( TOTAL + ${1:-0} )); printf '   libera: %s\n' "$(humano "${1:-0}")"; }
faria() { printf '   comando: %s\n' "$*"; }
executar() { if [[ $APLICAR -eq 1 ]]; then eval "$*" && printf '   feito.\n' || printf '   FALHOU (seguindo)\n'; fi }

# ---------------------------------------------------------------- bot.log
# Preserva a cauda recente num .1 (é o que serve para investigar incidente)
# e trunca o arquivo em uso. O pino escreve em modo append, então truncar não
# corrompe nada nem exige reiniciar processo — não derruba sessão nenhuma.
for dir in "$PROD_SHARED_DIR/logs" "$STAGING_SHARED_DIR/logs"; do
  log="$dir/bot.log"
  [[ -f "$log" ]] || continue
  b=$(bytes "$log")
  limite=$(( BOT_LOG_KEEP_MB * 1024 * 1024 ))
  [[ $b -le $limite ]] && continue
  item "log" "$log ($(humano "$b")) — guarda os últimos ${BOT_LOG_KEEP_MB} MB em bot.log.1 e zera o atual"
  ganho $(( b - limite ))
  faria "tail -c ${limite} '$log' > '$log.1' && truncate -s 0 '$log'"
  executar "tail -c ${limite} '$log' > '$log.1' && truncate -s 0 '$log'"
done

# --------------------------------------------------- logs já rotacionados
if [[ -d "$PM2_LOG_DIR" ]]; then
  b=$(find "$PM2_LOG_DIR" -type f \( -name '*__*.log' -o -name '*.log.gz' \) -printf '%s\n' 2>/dev/null | awk '{s+=$1} END{print s+0}')
  if [[ ${b:-0} -gt 0 ]]; then
    item "log" "arquivos já rotacionados do PM2 em $PM2_LOG_DIR"
    ganho "$b"
    faria "find '$PM2_LOG_DIR' -type f \\( -name '*__*.log' -o -name '*.log.gz' \\) -delete"
    executar "find '$PM2_LOG_DIR' -type f \\( -name '*__*.log' -o -name '*.log.gz' \\) -delete"
  fi
fi

# -------------------------------------------------------------- journald
if command -v journalctl >/dev/null 2>&1; then
  item "log" "journald acima de $JOURNAL_KEEP (mantém o período recente)"
  faria "journalctl --vacuum-size=$JOURNAL_KEEP"
  executar "journalctl --vacuum-size=$JOURNAL_KEEP >/dev/null 2>&1"
fi

# --------------------------------------------------------------- backups
if [[ -d "$BACKUP_DIR" ]]; then
  b=$(find "$BACKUP_DIR" -maxdepth 1 -type f -name '*.tar.gz*' -mtime +"$BACKUP_RETENTION_DAYS" -printf '%s\n' 2>/dev/null | awk '{s+=$1} END{print s+0}')
  if [[ ${b:-0} -gt 0 ]]; then
    item "backup" "backups com mais de $BACKUP_RETENTION_DAYS dias (fora da retenção declarada)"
    ganho "$b"
    faria "find '$BACKUP_DIR' -maxdepth 1 -type f -name '*.tar.gz*' -mtime +$BACKUP_RETENTION_DAYS -delete"
    executar "find '$BACKUP_DIR' -maxdepth 1 -type f -name '*.tar.gz*' -mtime +$BACKUP_RETENTION_DAYS -delete"
  fi
  blog="$BACKUP_DIR/backup.log"
  if [[ -f "$blog" ]] && [[ $(bytes "$blog") -gt 10485760 ]]; then
    b=$(bytes "$blog")
    item "log" "backup.log do cron ($(humano "$b")) — guarda as últimas 2000 linhas"
    ganho $(( b - 200000 ))
    faria "tail -n 2000 '$blog' > '$blog.tmp' && mv '$blog.tmp' '$blog'"
    executar "tail -n 2000 '$blog' > '$blog.tmp' && mv '$blog.tmp' '$blog'"
  fi
fi

# ---------------------------------------------------------------- caches
b=$(bytes "$HOME/.npm/_cacache")
if [[ ${b:-0} -gt 52428800 ]]; then
  item "cache" "cache do npm ($(humano "$b")) — recriado sozinho no próximo npm ci"
  ganho "$b"
  faria "npm cache clean --force"
  executar "npm cache clean --force >/dev/null 2>&1"
fi

if [[ -d /var/cache/apt/archives ]]; then
  b=$(bytes /var/cache/apt/archives)
  if [[ ${b:-0} -gt 52428800 ]]; then
    item "cache" "pacotes .deb já instalados ($(humano "$b"))"
    ganho "$b"
    faria "sudo apt-get clean"
    executar "sudo apt-get clean"
  fi
fi

# ----------------------------------------------------------- temporários
b=$(find /tmp -maxdepth 1 -name 'wabot*' -printf '%s\n' 2>/dev/null | awk '{s+=$1} END{print s+0}')
if [[ ${b:-0} -gt 0 ]]; then
  item "temp" "arquivos wabot* em /tmp (coletas de diagnóstico antigas)"
  ganho "$b"
  faria "find /tmp -maxdepth 1 -name 'wabot*' -mtime +1 -delete"
  executar "find /tmp -maxdepth 1 -name 'wabot*' -mtime +1 -delete"
fi

for raiz in "$PROD_DIR" "$STAGING_DIR"; do
  d="$raiz/tmp"
  [[ -d "$d" ]] || continue
  b=$(bytes "$d")
  [[ ${b:-0} -gt 10485760 ]] || continue
  item "temp" "$d ($(humano "$b"))"
  ganho "$b"
  faria "find '$d' -mindepth 1 -mtime +1 -delete"
  executar "find '$d' -mindepth 1 -mtime +1 -delete"
done

printf '\n\nTotal estimado liberado: %s\n' "$(humano "$TOTAL")"
if [[ $APLICAR -eq 1 ]]; then
  echo "Disco depois:"; df -h / | sed 's/^/  /'
else
  echo "Nada foi alterado. Repita com --aplicar quando estiver de acordo."
fi

cat <<'TXT'

NÃO ENTRA NESTE SCRIPT, DE PROPÓSITO:
  - auth_info (apagar = QR novo para toda cliente)
  - *.db / *.db-wal / *.db-shm
  - backups dentro da retenção
  - node_modules e dashboard/.next dos apps no ar
  - dedup_*.json e known_channels_*.json (estado dos robôs)
  - `pm2 flush` às cegas (apaga o log que explica o último incidente)
TXT
