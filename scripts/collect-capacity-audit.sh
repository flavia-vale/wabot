#!/usr/bin/env bash
set -u

# Coleta somente leitura para diagnóstico de capacidade. Não altera PM2, Redis,
# banco ou kernel. O arquivo pode conter nomes de processos/IPs: revise antes de enviar.
OUT="${1:-/tmp/wabot-capacity-$(date -u +%Y%m%dT%H%M%SZ).txt}"
exec > >(tee "$OUT") 2>&1

section() { printf '\n\n===== %s =====\n' "$1"; }
run() { printf '\n$ %s\n' "$*"; timeout 20s bash -lc "$*" || printf '[indisponível ou comando retornou %s]\n' "$?"; }

section "IDENTIFICAÇÃO"
run 'date -u; hostnamectl 2>/dev/null || uname -a; uptime'

section "CPU, RAM E SWAP"
run 'nproc; lscpu | sed -n "1,25p"'
run 'free -h; cat /proc/meminfo | sed -n "1,25p"'
run 'vmstat 1 10'
run 'cat /proc/loadavg; ps -eo pid,ppid,user,%cpu,%mem,rss,vsz,etime,stat,comm --sort=-rss | head -31'

section "DISCO E I/O"
run 'df -hT; df -ih'
run 'du -xhd1 ~/wabot ~/wabot-staging 2>/dev/null | sort -h'
run 'command -v iostat >/dev/null && iostat -xz 1 10 || echo "iostat ausente (instale sysstat)"'
run 'find ~/wabot/prisma ~/wabot-staging/prisma -maxdepth 1 -type f -printf "%p %s bytes\n" 2>/dev/null | sort -k2 -n'

section "PROCESSOS DA APLICAÇÃO"
run 'pm2 status'
# Nunca use `pm2 prettylist` neste relatório: o bloco pm2_env contém todas as
# variáveis e apagar apenas a linha "env" não remove os segredos nas linhas seguintes.
run 'pm2 jlist | node -e "let s=\"\";process.stdin.on(\"data\",d=>s+=d).on(\"end\",()=>{for(const p of JSON.parse(s)){const e=p.pm2_env||{};console.log(JSON.stringify({name:p.name,pid:p.pid,status:e.status,restarts:e.restart_time,uptime:e.pm_uptime,monit:p.monit||{}}))}})"'
run 'ps -eo pid,ppid,%cpu,%mem,rss,etime,nlwp,cmd --sort=-rss | grep -E "(node|redis|python|docker|sqlite|wabot)" | grep -v grep | head -80'
run 'ps -eo pid,rss,etime,cmd | grep "wabot/src/bot-worker" | grep -v grep'

section "REDE E SOCKETS"
run 'ss -s; ss -lntup'
run 'ss -Htan state established | awk "{print \$1, \$4, \$5}" | head -200'
run 'ss -Htan state established | awk "{print \$5}" | sed -E "s/:[0-9]+$//" | sort | uniq -c | sort -nr | head -30'
run 'cat /proc/net/sockstat; cat /proc/net/sockstat6'
run 'ip -s link'

section "REDIS E FILAS BULLMQ"
run 'redis-cli -u "${REDIS_URL:-redis://127.0.0.1:6379/0}" PING'
run 'redis-cli -u "${REDIS_URL:-redis://127.0.0.1:6379/0}" INFO server memory persistence stats clients keyspace | grep -E "^(redis_version|uptime_in_seconds|connected_clients|blocked_clients|used_memory_human|used_memory_peak_human|maxmemory_human|mem_fragmentation_ratio|rdb_last_bgsave_status|aof_enabled|aof_last_bgrewrite_status|instantaneous_ops_per_sec|total_error_replies|evicted_keys|expired_keys|keyspace_hits|keyspace_misses|db[0-9]+:)"'
run 'redis-cli -u "${REDIS_URL:-redis://127.0.0.1:6379/0}" --scan --pattern "bull:*" | sed -E "s/:([[:alnum:]_-]{12})[[:alnum:]_-]+/:\\1…/g" | awk -F: "{count[\$1 FS \$2 FS \$3]++} END {for (k in count) print count[k], k}" | sort -nr | head -50'

section "BANCO SQLITE"
run 'find ~/wabot/prisma ~/wabot-staging/prisma -maxdepth 1 -type f \( -name "*.db" -o -name "*.db-wal" -o -name "*.db-shm" \) -printf "%p %s bytes\n" 2>/dev/null'
run 'command -v sqlite3 >/dev/null && for db in ~/wabot/prisma/*.db ~/wabot-staging/prisma/*.db; do [ -f "$db" ] || continue; echo "-- $db"; timeout 10 sqlite3 "$db" "PRAGMA quick_check; PRAGMA journal_mode; PRAGMA page_count; PRAGMA freelist_count;"; done || echo "sqlite3 ausente"'

section "KERNEL, OOM E ERROS"
run 'journalctl -k --since "24 hours ago" --no-pager | grep -Ei "oom|out of memory|killed process|I/O error|ext4|xfs|nvme|segfault" | tail -200'
run 'journalctl -u redis-server --since "24 hours ago" --no-pager | grep -Ei "error|fail|oom|latency|slow" | tail -100'
run 'pm2 logs --nostream --lines 2000 2>&1 | grep -Ei "fatal|uncaught|unhandled|out of memory|heap|timeout|rate.?limit|429|stream.?error|connection.*(closed|lost)|SQLITE_(BUSY|FULL|CORRUPT)|redis.*(error|closed)" | sed -E "s/[[:alnum:]._%+-]+@[[:alnum:].-]+/[EMAIL_REMOVIDO]/g; s/[0-9]{10,15}/[NUMERO_REMOVIDO]/g" | tail -300'

section "FIM"
printf 'Relatório salvo em %s\n' "$OUT"
printf 'Revise IPs, nomes e qualquer dado pessoal residual antes de compartilhar.\n'
