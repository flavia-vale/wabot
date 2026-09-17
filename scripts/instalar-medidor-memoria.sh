#!/bin/bash
#
# Instala /tmp/medir.sh e /tmp/mem.awk no VPS — SOMENTE LEITURA.
#
# Existe para ser COLADO por SSH: em producao ~/wabot esta em `main`, entao um
# script novo so chega la depois do deploy, e a medicao "antes" precisa ser
# feita ANTES dele. Depois do deploy este mesmo arquivo fica versionado aqui.
#
#   bash scripts/instalar-medidor-memoria.sh   # (ou colar o conteudo)
#   bash /tmp/medir.sh antes
#   bash /tmp/medir.sh depois
#   bash /tmp/medir.sh comparar
#   ALVO=staging bash /tmp/medir.sh antes
#
# A classificacao de regiao e a mesma de src/ops/memory/smapsBreakdown.js e de
# scripts/diag-memoria-nativa.awk — conferidas lendo o MESMO arquivo congelado.
# Escreve apenas em /tmp/medidas. Nao le .env, nao le banco, nao reinicia nada.

mkdir -p /tmp/medidas
cat > /tmp/mem.awk <<'FIMAWK'
function hex(s,  i,c,v,n) { n=0; for (i=1;i<=length(s);i++) { c=substr(s,i,1); v=index("0123456789abcdef",c)-1; if(v<0)v=index("0123456789ABCDEF",c)-1; n=n*16+v } return n }
/^[0-9a-fA-F]+-[0-9a-fA-F]+ / { split($1,r,"-"); idx++; st[idx]=hex(r[1]); pa[idx]=(NF>=6)?$6:""; next }
/^Size:/ { sz[idx]=$2 } /^Rss:/ { rs[idx]=$2 } /^Pss:/ { ps[idx]=$2 }
END {
  for (i=1;i<=idx;i++) if (pa[i]=="") { b=int(st[i]/67108864); g[b]+=sz[i] }
  for (i=1;i<=idx;i++) {
    if (pa[i]=="[heap]") k="heap"
    else if (pa[i] ~ /^\[stack/) k="pilha"
    else if (pa[i]=="") { b=int(st[i]/67108864); if (g[b]==65536) { k="arena"; if(!seen[b]++) ar++ } else k="anon" }
    else if (pa[i] ~ /\.(so|node)(\.[0-9]+)*$/) k="lib"
    else if (pa[i] ~ /^\//) k="arq"
    else k="outro"
    P[k]+=ps[i]; tot+=ps[i]
  }
  printf "%.1f %.1f %.1f %.1f %d %d\n", tot/1024, P["arena"]/1024, P["anon"]/1024, P["heap"]/1024, ar, TH
}
FIMAWK
cat > /tmp/medir.sh <<'FIMSH'
#!/bin/bash
# Medicao de memoria nativa dos robos — SOMENTE LEITURA.
# Uso:  bash /tmp/medir.sh [antes|depois|comparar|historico]
#       ALVO=staging bash /tmp/medir.sh ...
set -u
D=/tmp/medidas
if [ "${ALVO:-prod}" = "staging" ]; then PAT="/home/deploy/wabot-staging/src/bot-worker"; NOME=staging
else PAT="/home/deploy/wabot/src/bot-worker"; NOME=prod; fi

medir() {
  local tot=0 arena=0 anon=0 heap=0 arenas=0 thr=0 n=0
  for p in $(pgrep -f "$PAT"); do
    local th; th=$(ls /proc/$p/task 2>/dev/null | wc -l)
    local L; L=$(awk -v TH=$th -f /tmp/mem.awk /proc/$p/smaps 2>/dev/null) || continue
    [ -z "$L" ] && continue
    set -- $L
    tot=$(echo "$tot $1" | awk '{print $1+$2}')
    arena=$(echo "$arena $2" | awk '{print $1+$2}')
    anon=$(echo "$anon $3" | awk '{print $1+$2}')
    heap=$(echo "$heap $4" | awk '{print $1+$2}')
    arenas=$((arenas + $5)); thr=$((thr + $6)); n=$((n+1))
  done
  echo "$(date +%Y-%m-%dT%H:%M:%S) $n $tot $arena $anon $heap $arenas $thr"
}

mostrar() {
  awk -v amb="$NOME" '{
    pct = ($3>0 ? $4*100/$3 : 0)
    printf "  quando .............. %s (%s)\n", $1, amb
    printf "  robos ligados ....... %d\n", $2
    printf "  PSS total ........... %.0f MiB  (%.2f GB)\n", $3, $3/1024
    printf "  em ARENA ............ %.0f MiB  = %.0f%% do total   <-- o numero que importa\n", $4, pct
    printf "  em anonimo .......... %.0f MiB\n", $5
    printf "  em heap ............. %.0f MiB\n", $6
    printf "  arenas .............. %d   (media %.1f por robo)\n", $7, ($2>0?$7/$2:0)
    printf "  threads ............. %d   (media %.0f por robo)\n", $8, ($2>0?$8/$2:0)
  }'
}

case "${1:-agora}" in
  antes|depois)
    L=$(medir); echo "$L" > $D/$NOME-$1.txt; echo "$L" >> $D/$NOME-historico.txt
    echo "== MEDIDA '$1' ($NOME) gravada em $D/$NOME-$1.txt"; echo "$L" | mostrar ;;
  comparar)
    A=$D/$NOME-antes.txt; B=$D/$NOME-depois.txt
    [ -f "$A" ] && [ -f "$B" ] || { echo "Faltam medidas. Rode: bash /tmp/medir.sh antes   e depois   bash /tmp/medir.sh depois"; exit 1; }
    echo "== ANTES ($NOME)"; cat $A | mostrar
    echo; echo "== DEPOIS ($NOME)"; cat $B | mostrar
    echo; echo "== DIFERENCA"
    paste $A $B | awk -v amb="$NOME" '{
      dp=$11-$3; da=$12-$4; dth=$16-$8; dar=$15-$7
      printf "  PSS total ........... %+.0f MiB  (%+.1f%%)\n", dp, ($3>0?dp*100/$3:0)
      if ($4 > 0) printf "  em ARENA ............ %+.0f MiB  (%+.1f%%)\n", da, da*100/$4
      else         printf "  em ARENA ............ %+.0f MiB\n", da
      printf "  arenas .............. %+d  (de %d para %d)\n", dar, $7, $15
      printf "  threads ............. %+d  (de %d para %d)\n", dth, $8, $16
      printf "  %% do PSS em arena ... de %.0f%% para %.0f%%\n", ($3>0?$4*100/$3:0), ($11>0?$12*100/$11:0)
      print ""
      if (amb == "staging") {
        print "  LEITURA (staging): economia NAO se mede aqui — e uma sessao so, com pouco trafego."
        print "  O que vale em staging e a linha ARENAS: tem que ter caido para ~2 por robo."
        print "  Se caiu, a env chegou e nada quebrou. Pode levar para producao."
      } else if (da < -100) print "  LEITURA: a memoria presa em arena caiu de verdade. Deu certo."
      else if (da > 100)    print "  LEITURA: SUBIU. Nao promover. Conferir se a env chegou ao robo (passo 5)."
      else                  print "  LEITURA: praticamente igual. Se as arenas tambem nao cairam, a env NAO chegou ao robo."
    }' ;;
  historico)
    echo "== historico ($NOME)"; printf "%-20s %5s %9s %9s %7s\n" "quando" "robos" "PSS_MiB" "arena_MiB" "%arena"
    awk '{printf "%-20s %5d %9.0f %9.0f %6.0f%%\n", $1,$2,$3,$4,($3>0?$4*100/$3:0)}' $D/$NOME-historico.txt 2>/dev/null || echo "  (vazio — rode 'bash /tmp/medir.sh' algumas vezes)" ;;
  *)
    L=$(medir); echo "$L" >> $D/$NOME-historico.txt; echo "== AGORA ($NOME)"; echo "$L" | mostrar ;;
esac
FIMSH
echo "OK — instalado. Agora use:  bash /tmp/medir.sh"
