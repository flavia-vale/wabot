#!/usr/bin/env bash
#
# Confere, NO SERVIDOR que hospeda o Redis (6379) e/ou o banco (5432), se essas
# portas estão abertas para TODAS as interfaces (0.0.0.0 / ::). Read-only.
# Exposto assim, qualquer pessoa na internet pode tentar conectar. O certo é
# escutar só na interface da rede privada (bind) + firewall + senha.
#
#   scripts/preflight-portas.sh            # confere 6379 e 5432
#   PORTAS="6379" scripts/preflight-portas.sh
#
# Sai com código 1 se achar porta exposta.

set -euo pipefail
PORTAS="${PORTAS:-6379 5432}"
command -v ss >/dev/null 2>&1 || { echo "ERRO: 'ss' não está disponível (pacote iproute2)."; exit 2; }

saida="$(ss -ltn)"
achou=0
for porta in $PORTAS; do
  if echo "$saida" | grep -Eq "[[:space:]](0\.0\.0\.0|\*|\[::\]|::):${porta}[[:space:]]"; then
    echo "❌ A porta $porta está aberta para TODAS as interfaces. Restrinja o 'bind' à rede privada e feche no firewall."
    achou=1
  elif echo "$saida" | grep -Eq ":${porta}[[:space:]]"; then
    echo "✅ A porta $porta está escutando, mas não em todas as interfaces."
  else
    echo "ℹ️  Nada escutando na porta $porta neste servidor."
  fi
done
exit "$achou"
