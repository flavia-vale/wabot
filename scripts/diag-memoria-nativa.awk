# Decomposição de /proc/<pid>/smaps por tipo de região — SOMENTE LEITURA.
#
# Versão em awk portável (mawk/gawk) do que scripts/diag-memoria-nativa.mjs faz,
# para poder ser COLADA no VPS sem esperar deploy. A classificação é a mesma de
# src/ops/memory/smapsBreakdown.js e as duas foram conferidas lendo o MESMO
# arquivo congelado (mesmo PSS, mesmo RSS, mesma contagem de arenas).
#
# Uso:
#   for p in $(pgrep -f "/home/deploy/wabot/src/bot-worker"); do
#     awk -v PID=$p -f ~/wabot/scripts/diag-memoria-nativa.awk /proc/$p/smaps
#   done
#
# Valores em MiB. PSS é a métrica que vale para somar processos — RSS conta a
# mesma página compartilhada uma vez por processo (armadilha registrada na
# revisão da POC de shard).
#
# `strtonum` é extensão do gawk e o Debian usa mawk por padrão, então o hex é
# convertido à mão em hex(). Não trocar por strtonum.

function hex(s,  i,c,v,n) { n=0; for (i=1;i<=length(s);i++) { c=substr(s,i,1); v=index("0123456789abcdef",c)-1; if(v<0)v=index("0123456789ABCDEF",c)-1; n=n*16+v } return n }
/^[0-9a-fA-F]+-[0-9a-fA-F]+ / {
  split($1, r, "-"); idx++; st[idx] = hex(r[1])
  pa[idx] = (NF >= 6) ? $6 : ""
  next
}
/^Size:/ { sz[idx] = $2 } /^Rss:/ { rs[idx] = $2 } /^Pss:/ { ps[idx] = $2 }
END {
  for (i = 1; i <= idx; i++) if (pa[i] == "") { b = int(st[i] / 67108864); g[b] += sz[i] }
  for (i = 1; i <= idx; i++) {
    if (pa[i] == "[heap]") k = "heap_principal"
    else if (pa[i] ~ /^\[stack/) k = "pilha"
    else if (pa[i] == "") { b = int(st[i] / 67108864); if (g[b] == 65536) { k = "arena_glibc"; if (!seen[b]++) arenas++ } else k = "anonimo" }
    else if (pa[i] ~ /\.(so|node)(\.[0-9]+)*$/) k = "biblioteca"
    else if (pa[i] ~ /^\//) k = "arquivo"
    else k = "outro"
    P[k] += ps[i]; R[k] += rs[i]; totP += ps[i]; totR += rs[i]
  }
  printf "pid %-7s PSS %8.1f  RSS %8.1f  arenas %3d  |", PID, totP/1024, totR/1024, arenas
  split("arena_glibc heap_principal anonimo pilha biblioteca arquivo outro", ord, " ")
  for (j = 1; j <= 7; j++) printf "  %s=%.1f", ord[j], P[ord[j]]/1024
  printf "\n"
}
