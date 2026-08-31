#!/usr/bin/env bash
set -u

# Resumo curto e somente leitura. Saída deliberadamente limitada para colar em
# atendimento sem expor env do PM2, conteúdo de logs, IPs remotos ou chaves Redis.
title() { printf '\n== %s ==\n' "$1"; }

title "HOST"
date -u '+coletado_em=%FT%TZ'
printf 'uptime='; uptime -p
printf 'cpus='; nproc

title "MEMORIA_MB"
free -m | awk 'NR==2 {printf "ram_total=%s ram_usada=%s ram_disponivel=%s\n",$2,$3,$7} NR==3 {printf "swap_total=%s swap_usada=%s swap_livre=%s\n",$2,$3,$4}'
vmstat 1 6 | tail -5 | awk '{si+=$7;so+=$8;idle+=$15;n++} END {printf "swap_in_medio_kb_s=%.0f swap_out_medio_kb_s=%.0f cpu_ociosa_media_pct=%.1f\n",si/n,so/n,idle/n}'

title "DISCO"
df -Pm / | awk 'NR==2 {printf "total_mb=%s usado_mb=%s livre_mb=%s uso=%s\n",$2,$3,$4,$5}'
df -Pi / | awk 'NR==2 {printf "inodes_uso=%s\n",$5}'
command -v iostat >/dev/null && iostat -dx 1 3 | awk '$1=="sda" {util=$NF} END {printf "sda_util_pct=%s\n",util}' || echo 'iostat=indisponivel'

title "PM2"
pm2 jlist 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{for(const p of JSON.parse(s||"[]")){const e=p.pm2_env||{},m=p.monit||{};console.log(`app=${p.name} status=${e.status||"?"} reinicios=${e.restart_time??"?"} memoria_mb=${Math.round((m.memory||0)/1048576)} cpu_pct=${m.cpu??"?"}`)}})' | sort

title "WORKERS_PRODUCAO"
ps -eo ppid=,rss=,cmd= | awk '/wabot\/src\/bot-worker/ && !/wabot-staging/ {count++;sum+=$2;if(!min||$2<min)min=$2;if($2>max)max=$2} END {printf "quantidade=%d rss_total_mb=%.0f rss_menor_mb=%.0f rss_maior_mb=%.0f\n",count,sum/1024,min/1024,max/1024}'

title "REDIS"
for db in 0 1; do
  printf 'db=%s ' "$db"
  redis-cli --no-auth-warning -u "redis://127.0.0.1:6379/$db" INFO memory persistence stats clients keyspace 2>/dev/null | awk -F: '/^(connected_clients|blocked_clients|used_memory_human|used_memory_peak_human|mem_fragmentation_ratio|aof_enabled|aof_last_bgrewrite_status|rdb_last_bgsave_status|evicted_keys|total_error_replies):/ {gsub(/\r/,"",$2);printf "%s=%s ",$1,$2} END {print ""}'
done

title "SQLITE"
find ~/wabot/prisma ~/wabot-staging/prisma -maxdepth 1 -type f \( -name '*.db' -o -name '*.db-wal' \) -printf '%p %s\n' 2>/dev/null | awk '{printf "arquivo=%s tamanho_mb=%.1f\n",$1,$2/1048576}' | sort

title "ERROS_24H_CONTAGEM"
printf 'kernel_oom_ou_io='; journalctl -k --since '24 hours ago' --no-pager 2>/dev/null | grep -Eic 'oom|out of memory|killed process|I/O error|segfault' || true
printf 'pm2_criticos='; pm2 logs --nostream --lines 2000 2>&1 | grep -Eic 'fatal|uncaught|unhandled|out of memory|heap|rate.?limit|429|SQLITE_(BUSY|FULL|CORRUPT)|redis.*(error|closed)' || true
