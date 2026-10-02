#!/usr/bin/env bash
#
# Janela de manutenção: marca que ALGUÉM está mexendo no servidor.
#
#   scripts/janela.sh abrir "instalar age para backup cifrado"
#   scripts/janela.sh status
#   scripts/janela.sh fechar
#
# Com a janela aberta:
#  - deploys param com erro claro em vez de mexer no pm2 junto com você
#    (rode o workflow de novo depois de fechar);
#  - o vigia registra mas não manda e-mail;
#  - religar-producao.sh avisa que outra pessoa está operando.
# Ao abrir, tira o retrato do ambiente (ponto_retorno.sh) para comparar depois.
#
# Regra (AGENTS.md): `apt`, `systemctl`, `pm2 kill|update|resurrect|delete` em
# produção só com janela aberta. RCA 2026-10-01: um `apt install` sem aviso
# derrubou o pm2 inteiro.
set -euo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="${ROOT_DIR:-$(cd -- "$SCRIPT_DIR/.." && pwd)}"
JANELA_FILE="${WABOT_JANELA_FILE:-$HOME/.wabot-janela}"
MAX_H="${JANELA_MAX_HORAS:-4}"

cmd="${1:-status}"
case "$cmd" in
  abrir)
    motivo="${2:-}"
    [[ -n "$motivo" ]] || { echo "uso: $0 abrir \"motivo\""; exit 2; }
    if [[ -f "$JANELA_FILE" ]]; then echo "Já existe janela aberta: $(head -n 1 "$JANELA_FILE")"; exit 3; fi
    printf '%s | %s | %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${SUDO_USER:-${USER:-$(id -un)}}@$(hostname)" "$motivo" > "$JANELA_FILE"
    echo "Janela aberta: $(cat "$JANELA_FILE")"
    if [[ -x "$ROOT_DIR/scripts/ponto_retorno.sh" ]]; then
      (cd "$ROOT_DIR" && PROD_DIR="$ROOT_DIR" scripts/ponto_retorno.sh >/dev/null 2>&1 && echo "Retrato salvo em ~/wabot-pontos-de-retorno/.") || echo "Aviso: retrato não foi salvo."
    fi
    echo "Ao terminar: $0 fechar   (e confira: node scripts/vigia.mjs)"
    ;;
  fechar)
    [[ -f "$JANELA_FILE" ]] || { echo "Nenhuma janela aberta."; exit 0; }
    echo "Fechando: $(head -n 1 "$JANELA_FILE")"
    rm -f "$JANELA_FILE"
    (cd "$ROOT_DIR" && node scripts/pm2-faltando.mjs | sed 's/^/ATENÇÃO, sumiu do pm2: /') || true
    ;;
  status)
    if [[ -f "$JANELA_FILE" ]]; then
      echo "ABERTA: $(head -n 1 "$JANELA_FILE")"
      aberta_s=$(( $(date +%s) - $(stat -c %Y "$JANELA_FILE") ))
      [[ $aberta_s -gt $(( MAX_H * 3600 )) ]] && echo "Aviso: aberta há mais de ${MAX_H} h — esqueceram de fechar?"
    else
      echo "Nenhuma janela aberta."
    fi
    ;;
  *) echo "uso: $0 abrir \"motivo\" | fechar | status"; exit 2 ;;
esac
