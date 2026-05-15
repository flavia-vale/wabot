#!/usr/bin/env bash
# Configura HTTPS para espelhagrupos.com.br usando Let's Encrypt + Certbot.
#
# Pré-requisitos no VPS:
#   - Nginx já rodando e servindo http://espelhagrupos.com.br
#   - DNS de espelhagrupos.com.br e www.espelhagrupos.com.br apontando para o IP do VPS
#   - Porta 80 e 443 abertas no firewall (ufw / iptables / Hetzner Cloud / etc.)
#   - Usuário com sudo
#
# O que faz:
#   1. Instala certbot e o plugin nginx
#   2. Emite certificado para espelhagrupos.com.br + www.espelhagrupos.com.br
#   3. Reescreve o vhost Nginx pra escutar 443 com SSL e redirecionar 80 -> 443
#   4. Cria timer systemd de renovação automática (certbot já faz isso)
#   5. Valida com curl que https://espelhagrupos.com.br responde 200
#
# Como rodar (no VPS, NÃO em staging):
#   ssh deploy@178.105.54.0
#   cd ~/wabot
#   git fetch origin && git checkout claude/setup-https
#   sudo bash scripts/setup_letsencrypt.sh
#
# Rollback: o certbot guarda backup do nginx.conf em /etc/letsencrypt/.
# Pra reverter: sudo cp /etc/nginx/sites-available/<arquivo>.backup-<data> /etc/nginx/sites-available/<arquivo> && sudo nginx -t && sudo systemctl reload nginx

set -euo pipefail

DOMAIN_PRIMARY="${DOMAIN_PRIMARY:-espelhagrupos.com.br}"
DOMAIN_WWW="${DOMAIN_WWW:-www.espelhagrupos.com.br}"
ADMIN_EMAIL="${ADMIN_EMAIL:-}"

log() { printf '\n[setup-https] %s\n' "$*"; }
fail() { printf '\n[setup-https] ERRO: %s\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || fail "Rode com sudo."

if [[ -z "$ADMIN_EMAIL" ]]; then
  read -rp "Email para alertas do Let's Encrypt (vencimento de cert): " ADMIN_EMAIL
fi
[[ "$ADMIN_EMAIL" == *"@"* ]] || fail "Email inválido."

log "Verificando que o Nginx está rodando e responde em :80"
command -v nginx >/dev/null || fail "Nginx não está instalado."
systemctl is-active --quiet nginx || fail "Nginx não está ativo. Rode: sudo systemctl start nginx"

log "Verificando que o DNS resolve para este servidor"
SERVER_IP="$(curl -fsS https://api.ipify.org || true)"
DOMAIN_IP="$(getent hosts "$DOMAIN_PRIMARY" | awk '{print $1}' | head -1 || true)"
if [[ -n "$SERVER_IP" && -n "$DOMAIN_IP" && "$SERVER_IP" != "$DOMAIN_IP" ]]; then
  printf '\n[setup-https] AVISO: IP público do servidor (%s) difere do DNS de %s (%s).\n' \
    "$SERVER_IP" "$DOMAIN_PRIMARY" "$DOMAIN_IP"
  read -rp "Continuar mesmo assim? (y/N) " yn
  [[ "$yn" =~ ^[Yy]$ ]] || fail "Aborte e corrija o DNS antes."
fi

log "Instalando certbot e plugin nginx"
if command -v apt-get >/dev/null; then
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y certbot python3-certbot-nginx
elif command -v dnf >/dev/null; then
  dnf install -y certbot python3-certbot-nginx
else
  fail "Gerenciador de pacotes não suportado. Instale certbot manualmente."
fi

log "Emitindo certificado para $DOMAIN_PRIMARY e $DOMAIN_WWW"
# --nginx: o plugin edita os vhosts automaticamente, adiciona listen 443 ssl,
#          ssl_certificate, ssl_certificate_key e redirect 80 -> 443.
# --redirect: força redirect HTTP -> HTTPS no vhost.
# --agree-tos --no-eff-email: aceita ToS, recusa newsletter da EFF.
# -n: non-interactive.
certbot --nginx \
  -d "$DOMAIN_PRIMARY" \
  -d "$DOMAIN_WWW" \
  --redirect \
  --agree-tos \
  --no-eff-email \
  --email "$ADMIN_EMAIL" \
  -n

log "Testando configuração do Nginx"
nginx -t

log "Recarregando Nginx"
systemctl reload nginx

log "Verificando renovação automática"
# O pacote certbot do apt/dnf já instala um systemd timer (certbot.timer) ou cron.
if systemctl list-timers --all 2>/dev/null | grep -q certbot; then
  log "✅ Timer systemd de renovação ativo (certbot.timer)"
else
  log "Timer não encontrado, instalando cron fallback"
  cat > /etc/cron.d/certbot-renew <<'CRON'
# Renova certificados Let's Encrypt 2x por dia (recomendação oficial)
0 0,12 * * * root certbot renew --quiet --post-hook "systemctl reload nginx"
CRON
fi

log "Testando renovação em modo dry-run (não emite cert, só valida)"
certbot renew --dry-run

log "Validando HTTPS"
sleep 2
HTTPS_STATUS="$(curl -fsS -o /dev/null -w '%{http_code}' "https://${DOMAIN_PRIMARY}/" || echo 000)"
HTTP_REDIRECT="$(curl -fsS -o /dev/null -w '%{http_code}' "http://${DOMAIN_PRIMARY}/" || echo 000)"

log "Resultado:"
printf '  GET https://%s/   -> HTTP %s (esperado 200)\n' "$DOMAIN_PRIMARY" "$HTTPS_STATUS"
printf '  GET http://%s/    -> HTTP %s (esperado 301/308 redirecionando pra https)\n' "$DOMAIN_PRIMARY" "$HTTP_REDIRECT"

if [[ "$HTTPS_STATUS" != "200" ]]; then
  fail "HTTPS não está retornando 200. Veja sudo nginx -t e /var/log/nginx/error.log"
fi

log "Concluído. Próximos passos manuais:"
cat <<'NEXT'
  1. Atualizar variáveis de ambiente em ~/wabot/.env e ~/wabot/dashboard/.env.local
     para usar https://espelhagrupos.com.br (DASHBOARD_URL, API_URL).
  2. Atualizar ecosystem.config.cjs (DASHBOARD_URL e API_URL apontando pra https)
     e rodar: pm2 restart api dashboard --update-env
  3. Atualizar o domínio no painel do Mercado Pago / outros provedores que
     fazem callback pra cá, se houver.
  4. Mandar um teste pelo WhatsApp pra você mesmo confirmando que abre.
NEXT
