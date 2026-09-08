#!/usr/bin/env bash
#
# Diagnóstico de uso de disco do VPS — SOMENTE LEITURA.
#
# Responde "onde o disco está sendo gasto" separando o que é PRECIOSO (banco,
# sessões do WhatsApp, backups) do que é DESCARTÁVEL (log velho, cache de
# download, build antigo). Não apaga nada, não imprime segredo: os `.env` são
# apenas contados/medidos, nunca lidos.
#
# Uso (no VPS, de qualquer diretório):
#   bash ~/wabot/scripts/diag-disco.sh
#   bash ~/wabot/scripts/diag-disco.sh > /tmp/wabot-disco.txt   # para enviar
#
# Variáveis opcionais:
#   PROD_DIR, STAGING_DIR, BACKUP_DIR, PROD_SHARED_DIR, STAGING_SHARED_DIR
#
# Leitura do resultado: o bloco final "O QUE DÁ PARA LIBERAR" soma só o que é
# seguro remover. Os itens fora dele exigem decisão humana.

set -uo pipefail

PROD_DIR="${PROD_DIR:-$HOME/wabot}"
STAGING_DIR="${STAGING_DIR:-$HOME/wabot-staging}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/wabot-backups}"
PROD_SHARED_DIR="${PROD_SHARED_DIR:-$HOME/BOTinho-shared}"
STAGING_SHARED_DIR="${STAGING_SHARED_DIR:-$HOME/wabot-staging-shared}"
PM2_LOG_DIR="${PM2_LOG_DIR:-$HOME/.pm2/logs}"

titulo() { printf '\n\n=== %s ===\n\n' "$*"; }
sub() { printf '\n-- %s\n' "$*"; }

# Tamanho em bytes de um caminho (0 quando não existe).
bytes() {
  local alvo="$1"
  [[ -e "$alvo" ]] || { echo 0; return; }
  # NR==1 + fallback: `du` pode nao imprimir nada (permissao negada) ou mais de
  # uma linha; sem isso a soma recebia "0\n0" e o shell quebrava a expressao.
  du -sb "$alvo" 2>/dev/null | awk 'NR==1 { print $1 + 0; ok = 1 } END { if (!ok) print 0 }'
}

humano() {
  awk -v b="${1:-0}" 'BEGIN{
    split("B KB MB GB TB", u, " "); i=1
    while (b >= 1024 && i < 5) { b /= 1024; i++ }
    printf "%.1f %s", b, u[i]
  }'
}

linha() { # nome  bytes  observacao
  printf '  %-42s %10s   %s\n' "$1" "$(humano "$2")" "${3:-}"
}

LIBERAVEL=0
# Sanitiza a entrada: um numero so, primeira linha, vazio vira 0. A soma nao
# pode quebrar o relatorio inteiro por causa de um `du` que respondeu torto.
somar_liberavel() {
  local valor
  valor=$(printf '%s' "${1:-0}" | head -n1 | tr -cd '0-9')
  LIBERAVEL=$(( LIBERAVEL + ${valor:-0} ))
}

echo "Diagnóstico de disco — $(date -u '+%Y-%m-%dT%H:%M:%SZ') (UTC) — host $(hostname)"
echo "SOMENTE LEITURA: este script não apaga nem move nada."

titulo "1. QUANTO DISCO EXISTE E QUANTO SOBROU"
df -hT / 2>/dev/null || df -h /
sub "Inodes (quantidade de arquivos)"
df -ih / 2>/dev/null || echo "  (df -i indisponível)"

titulo "2. OS MAIORES DIRETÓRIOS DA MÁQUINA"
sub "Primeiro nível de / (pode demorar alguns segundos)"
du -xhd1 / 2>/dev/null | sort -hr | head -15
sub "Dentro de $HOME"
du -xhd1 "$HOME" 2>/dev/null | sort -hr | head -20

titulo "3. LOGS — a categoria que mais cresce sozinha"

sub "3.1 bot.log (escrito direto pelo pino, NÃO passa pelo pm2-logrotate)"
for par in "produção:$PROD_SHARED_DIR/logs" "staging:$STAGING_SHARED_DIR/logs"; do
  amb="${par%%:*}"; dir="${par#*:}"
  if [[ -d "$dir" ]]; then
    b_log=$(bytes "$dir/bot.log")
    linha "$amb  $dir/bot.log" "$b_log" "$( [[ $b_log -gt 209715200 ]] && echo '<-- ACIMA DE 200 MB' )"
    # dedup_*.json e known_channels_*.json são estado operacional: NÃO apagar.
    b_estado=$(find "$dir" -maxdepth 1 -type f \( -name 'dedup_*.json' -o -name 'known_channels_*.json' -o -name 'stuck-message-*.json' \) -printf '%s\n' 2>/dev/null | awk '{s+=$1} END{print s+0}')
    linha "$amb  estado operacional (dedup/canais)" "$b_estado" "NÃO apagar"
    b_outros=$(( $(bytes "$dir") - b_log - b_estado ))
    [[ $b_outros -gt 0 ]] && linha "$amb  demais arquivos em logs/" "$b_outros" ""
    # bot.log é descartável a partir do que já foi analisado; contabiliza 90%
    somar_liberavel $(( b_log * 9 / 10 ))
  else
    linha "$amb  $dir" 0 "diretório não existe"
  fi
done

sub "3.2 Logs do PM2 (~/.pm2/logs) — rotacionados pelo pm2-logrotate"
b_pm2=$(bytes "$PM2_LOG_DIR")
linha "total" "$b_pm2" ""
if [[ -d "$PM2_LOG_DIR" ]]; then
  echo "  10 maiores arquivos:"
  find "$PM2_LOG_DIR" -type f -printf '%s %p\n' 2>/dev/null | sort -nr | head -10 \
    | while read -r sz path; do printf '    %10s  %s\n' "$(humano "$sz")" "$path"; done
  b_rotacionado=$(find "$PM2_LOG_DIR" -type f \( -name '*__*.log' -o -name '*.log.gz' -o -name '*-[0-9]*.log' \) -printf '%s\n' 2>/dev/null | awk '{s+=$1} END{print s+0}')
  linha "já rotacionados (arquivo histórico)" "$b_rotacionado" "descartável"
  somar_liberavel "$b_rotacionado"
fi
sub "Configuração atual do pm2-logrotate"
pm2 conf pm2-logrotate 2>/dev/null | sed 's/^/  /' || echo "  (pm2 não disponível nesta sessão)"

sub "3.3 journald (log do sistema)"
if command -v journalctl >/dev/null 2>&1; then
  journalctl --disk-usage 2>/dev/null | sed 's/^/  /'
  b_journal=$(journalctl --disk-usage 2>/dev/null | grep -oE '[0-9.]+[KMG]' | head -1 \
    | awk '{v=$0; u=substr(v,length(v)); n=substr(v,1,length(v)-1);
            m=(u=="G")?1073741824:((u=="M")?1048576:1024); printf "%d", n*m}')
  # acima de 200 MB o excedente é descartável (vacuum para 200M)
  [[ ${b_journal:-0} -gt 209715200 ]] && somar_liberavel $(( b_journal - 209715200 ))
else
  echo "  journalctl indisponível"
fi

titulo "4. BACKUPS — precioso, mas com retenção a conferir"
if [[ -d "$BACKUP_DIR" ]]; then
  b_bkp=$(bytes "$BACKUP_DIR")
  qtd=$(find "$BACKUP_DIR" -maxdepth 1 -type f -name '*.tar.gz*' 2>/dev/null | wc -l)
  linha "$BACKUP_DIR" "$b_bkp" "$qtd arquivos"
  echo "  Mais antigo / mais novo:"
  find "$BACKUP_DIR" -maxdepth 1 -type f -name '*.tar.gz*' -printf '%T+ %s %p\n' 2>/dev/null \
    | sort | sed -n '1p;$p' \
    | while read -r dt sz path; do printf '    %s  %10s  %s\n' "${dt%%.*}" "$(humano "$sz")" "$(basename "$path")"; done
  b_velho=$(find "$BACKUP_DIR" -maxdepth 1 -type f -name '*.tar.gz*' -mtime +30 -printf '%s\n' 2>/dev/null | awk '{s+=$1} END{print s+0}')
  linha "backups com mais de 30 dias" "$b_velho" "fora da retenção declarada"
  somar_liberavel "$b_velho"
  b_log_bkp=$(bytes "$BACKUP_DIR/backup.log")
  linha "backup.log (saída do cron, cresce sem rotação)" "$b_log_bkp" "descartável"
  somar_liberavel "$b_log_bkp"
else
  echo "  $BACKUP_DIR não existe — CONFIRA se o backup diário está rodando."
fi

titulo "5. BANCO DE DADOS E SESSÕES DO WHATSAPP — nunca apagar"
for par in "produção:$PROD_DIR/prisma" "staging:$STAGING_DIR/prisma"; do
  amb="${par%%:*}"; dir="${par#*:}"
  [[ -d "$dir" ]] || continue
  for f in "$dir"/*.db "$dir"/*.db-wal "$dir"/*.db-shm; do
    [[ -f "$f" ]] && linha "$amb  $(basename "$f")" "$(bytes "$f")" ""
  done
done
for par in "produção:$PROD_SHARED_DIR/auth_info" "staging:$STAGING_SHARED_DIR/auth_info"; do
  amb="${par%%:*}"; dir="${par#*:}"
  [[ -d "$dir" ]] || continue
  linha "$amb  auth_info ($(find "$dir" -mindepth 1 -maxdepth 1 -type d | wc -l) sessões)" "$(bytes "$dir")" "NUNCA apagar"
  # backup de pareamento interrompido é resíduo legítimo de limpar
  b_pair=$(find "$(dirname "$dir")" -maxdepth 2 -type d -name '*.pairing-backup' -printf '%s\n' 2>/dev/null | awk '{s+=$1} END{print s+0}')
  [[ ${b_pair:-0} -gt 0 ]] && linha "$amb  sobras de pareamento (.pairing-backup)" "$b_pair" "resíduo"
done

titulo "6. CÓDIGO, DEPENDÊNCIAS E BUILDS"
for par in "produção:$PROD_DIR" "staging:$STAGING_DIR"; do
  amb="${par%%:*}"; raiz="${par#*:}"
  [[ -d "$raiz" ]] || continue
  sub "$amb — $raiz"
  linha "total do diretório" "$(bytes "$raiz")" ""
  linha "node_modules (raiz)" "$(bytes "$raiz/node_modules")" "necessário para rodar"
  linha "dashboard/node_modules" "$(bytes "$raiz/dashboard/node_modules")" "necessário para rodar"
  linha "dashboard/.next (build atual)" "$(bytes "$raiz/dashboard/.next")" "necessário para rodar"
  linha ".git (histórico do repositório)" "$(bytes "$raiz/.git")" "compactável"
  linha "uploads/" "$(bytes "$raiz/uploads")" ""
  linha "tmp/" "$(bytes "$raiz/tmp")" "descartável"
  somar_liberavel "$(bytes "$raiz/tmp")"
done

titulo "7. CACHES E TEMPORÁRIOS — descartáveis por definição"
b_npm=$(bytes "$HOME/.npm/_cacache")
linha "cache do npm (~/.npm/_cacache)" "$b_npm" "recriado sozinho"
somar_liberavel "$b_npm"
b_next_cache=0
for raiz in "$PROD_DIR" "$STAGING_DIR"; do
  b_next_cache=$(( b_next_cache + $(bytes "$raiz/dashboard/.next/cache") ))
done
linha "cache de build do Next (.next/cache)" "$b_next_cache" "recriado no próximo build"
b_apt=$(bytes /var/cache/apt/archives)
linha "pacotes .deb baixados (/var/cache/apt)" "$b_apt" "descartável"
somar_liberavel "$b_apt"
b_tmp=$(find /tmp -maxdepth 1 -name 'wabot*' -printf '%s\n' 2>/dev/null | awk '{s+=$1} END{print s+0}')
linha "arquivos wabot* em /tmp" "$b_tmp" "descartável"
somar_liberavel "$b_tmp"
sub "10 maiores arquivos soltos em /tmp"
find /tmp -maxdepth 2 -type f -printf '%s %p\n' 2>/dev/null | sort -nr | head -10 \
  | while read -r sz path; do printf '    %10s  %s\n' "$(humano "$sz")" "$path"; done

titulo "8. QUALQUER ARQUIVO GRANDE QUE ESCAPOU DAS CATEGORIAS ACIMA"
echo "  20 maiores arquivos abaixo de $HOME:"
find "$HOME" -xdev -type f -size +50M -printf '%s %p\n' 2>/dev/null | sort -nr | head -20 \
  | while read -r sz path; do printf '    %10s  %s\n' "$(humano "$sz")" "$path"; done

titulo "O QUE DÁ PARA LIBERAR SEM PERDER NADA"
printf '  Estimativa somando só o que é seguro remover: %s\n\n' "$(humano "$LIBERAVEL")"
cat <<'TXT'
  Entram nessa soma:
    - bot.log (mantendo a cauda recente para investigação)
    - logs do PM2 já rotacionados
    - excedente do journald acima de 200 MB
    - backups fora da retenção de 30 dias e o backup.log do cron
    - cache do npm, cache de pacotes do sistema, tmp/ e /tmp/wabot*

  NÃO entram (decisão humana / nunca apagar):
    - auth_info (sessões do WhatsApp — apagar exige QR novo de toda cliente)
    - *.db, *.db-wal, *.db-shm (banco de produção e de staging)
    - backups dentro da retenção
    - node_modules e .next dos apps que estão no ar
    - dedup_*.json / known_channels_*.json (estado operacional dos robôs)

  Próximo passo: scripts/limpar-disco.sh (simulação por padrão).
TXT
