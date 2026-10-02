#!/usr/bin/env bash
# Aviso ao entrar na VPS (opcional). Instale UMA vez, como `deploy`:
#   echo '[ -x ~/wabot/scripts/aviso-login.sh ] && ~/wabot/scripts/aviso-login.sh' >> ~/.bashrc
# Só lê; não bloqueia nada. Lembra a regra que evitou o incidente de 01/10.
[[ $- == *i* ]] || exit 0
J="${WABOT_JANELA_FILE:-$HOME/.wabot-janela}"
echo "──────────────────────────────────────────────────────────────"
echo " PRODUÇÃO. Antes de apt / systemctl / pm2 kill|update|resurrect|delete:"
echo "   ~/wabot/scripts/janela.sh abrir \"motivo\"   (e fechar ao terminar)"
if [[ -f "$J" ]]; then echo " ⚠️  Janela ABERTA: $(head -n 1 "$J")"; else echo " Nenhuma janela aberta."; fi
F="$(cd ~/wabot 2>/dev/null && timeout 10 node scripts/pm2-faltando.mjs 2>/dev/null | tr '\n' ' ')"
[[ -n "$F" ]] && echo " 🔴 Sumiram do pm2: $F → ~/wabot/scripts/religar-producao.sh"
echo "──────────────────────────────────────────────────────────────"
