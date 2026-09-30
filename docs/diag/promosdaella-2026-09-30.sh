#!/usr/bin/env bash
# Diagnóstico read-only — cliente promosdaella@gmail.com (2026-09-30).
# Rodar NA VPS, em produção:  cd ~/wabot && bash docs/diag/promosdaella-2026-09-30.sh > /tmp/diag-ella.txt 2>&1
# Depois colar o /tmp/diag-ella.txt inteiro. Não escreve nada no banco. Não imprime chave/cookie.
set +e
E="promosdaella@gmail.com"
DB="prisma/prod.db"
S24="(strftime('%s','now','-24 hours')*1000)"
S72="(strftime('%s','now','-72 hours')*1000)"
UID_=$(sqlite3 "$DB" "SELECT id FROM User WHERE email='$E';")
echo "### 0. CONTA  uid=$UID_  supervisor uptime:"
pm2 jlist | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{for(const p of JSON.parse(s)){if(/api|bot-supervisor/.test(p.name)&&!/staging/.test(p.name))console.log(p.name,p.pm2_env.status,"uptime_min="+Math.round((Date.now()-p.pm2_env.pm_uptime)/60000),"restarts="+p.pm2_env.restart_time)}})'
sqlite3 -header "$DB" "SELECT plan, status, datetime(accessExpiresAt/1000,'unixepoch','localtime') acesso_ate FROM User WHERE id='$UID_';"
sqlite3 -header "$DB" "SELECT status, datetime(updatedAt/1000,'unixepoch','localtime') atualizado FROM WaSession WHERE userId='$UID_';"

echo; echo "### 1. ESPELHAMENTO — envios por status/motivo, 24h (decide: descarte por fila/horário x sem conversão x nada chegou)"
sqlite3 -header "$DB" "SELECT status, substr(coalesce(errorMsg,''),1,60) motivo, COUNT(*) n, MIN(datetime(sentAt/1000,'unixepoch','localtime')) primeiro, MAX(datetime(sentAt/1000,'unixepoch','localtime')) ultimo FROM MessageLog WHERE userId='$UID_' AND sentAt>$S24 GROUP BY 1,2 ORDER BY n DESC LIMIT 25;"
echo "--- por loja, 24h (Shopee 'praticamente não espelha' = success shopee baixo com skip alto?)"
sqlite3 -header "$DB" "SELECT platform, status, COUNT(*) n FROM MessageLog WHERE userId='$UID_' AND sentAt>$S24 GROUP BY 1,2 ORDER BY 1,2;"
echo "--- hora a hora, 72h (se houver buracos de horas sem NADA, é sessão/recepção, não fila)"
sqlite3 "$DB" "SELECT strftime('%d/%m %Hh', sentAt/1000,'unixepoch','localtime') h, SUM(status='success') ok, SUM(status='skipped') skip, SUM(status='error') err, SUM(status='queued') fila FROM MessageLog WHERE userId='$UID_' AND sentAt>$S72 GROUP BY 1 ORDER BY sentAt/1000;"

echo; echo "### 2. CONFIG dos grupos (o '9 min' está em minIntervalSec=540? dailyCap? queueMaxAgeMin? horário?)"
sqlite3 -header "$DB" "SELECT role, name, kind, allowedPlatforms, forwardMode, templateKey, targetsMode, throttleEnabled, minIntervalSec, dailyCap, queueMaxAgeMin, operatingHoursEnabled, operatingHoursJson, preservationPresetId FROM \"Group\" WHERE userId='$UID_';"
sqlite3 -header "$DB" "SELECT name, isDefault, minIntervalSec, dailyCap, queueMaxAgeMin, operatingHoursEnabled FROM PreservationPreset WHERE userId='$UID_';"
sqlite3 -header "$DB" "SELECT channelStaggerJitterMs intervalo_entre_destinos_ms, quietHoursEnabled, channelQuietHoursJson, mirrorTemplateKeyDefault FROM BotConfig WHERE userId='$UID_';"
sqlite3 -header "$DB" "SELECT platform, length(data) tam FROM Credential WHERE userId='$UID_';"

echo; echo "### 3. OFERTAS AUTOMÁTICAS — cadastro (enabled? modo review? bot rodando? page avançando sem lastSentAt = all_offers_filtered)"
sqlite3 -header "$DB" "SELECT id, keyword, enabled, publicationMode, intervalMinutes, dailyRunTime, offersPerSend, minDiscountPct, sortType, page, destGroupJid, datetime(lastSentAt/1000,'unixepoch','localtime') ultimo_envio, datetime(lastDiscoveryAt/1000,'unixepoch','localtime') ultima_busca, length(sentItemIds) tam_sentItemIds FROM OfferAutomation WHERE userId='$UID_';"
sqlite3 -header "$DB" "SELECT destGroupJid, COUNT(*) n, MIN(datetime(sentAt/1000,'unixepoch','localtime')) primeiro, MAX(datetime(sentAt/1000,'unixepoch','localtime')) ultimo FROM OfferAutomationSentLog WHERE userId='$UID_' AND sentAt>$S72 GROUP BY 1;"
sqlite3 -header "$DB" "SELECT status, COUNT(*) n FROM OfferAutomationReviewItem WHERE userId='$UID_' GROUP BY 1;" 2>/dev/null
echo "--- log do cron (api) nas últimas 24h, só linhas desta conta/automações"
for A in $(sqlite3 "$DB" "SELECT id FROM OfferAutomation WHERE userId='$UID_';"); do echo "[auto $A]"; grep -h "$A" ~/.pm2/logs/api-out.log ~/.pm2/logs/api-error.log 2>/dev/null | tail -n 5; done
echo "--- shopee-offers avisos (sem preço / api error) últimas 24h, contagem"
grep -h -c "shopee-offers\|shopee_api_error" ~/.pm2/logs/api-out.log ~/.pm2/logs/api-error.log 2>/dev/null

echo; echo "### 4. SHEIN — o que saiu e com quê (título/preço vazio no texto?)"
sqlite3 -header "$DB" "SELECT status, substr(coalesce(errorMsg,''),1,50) motivo, substr(originalUrl,1,45) origem, substr(convertedUrl,1,45) convertido, substr(replace(messageText,char(10),' '),1,70) texto, datetime(sentAt/1000,'unixepoch','localtime') q FROM MessageLog WHERE userId='$UID_' AND platform LIKE '%shein%' AND sentAt>$S72 ORDER BY sentAt DESC LIMIT 15;"
echo "--- template de espelhamento caiu no relay (sem título/preço) — contagem 24h no bot.log desta conta"
PID=$(pm2 jlist | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{for(const p of JSON.parse(s)){if(p.name==="bot-supervisor")console.log(p.pid)}})')
grep -c "Template de espelhamento" logs/bot.log 2>/dev/null
grep "Template de espelhamento" logs/bot.log 2>/dev/null | grep -c "$UID_"
grep "Template de espelhamento" logs/bot.log 2>/dev/null | grep "$UID_" | tail -n 5 | cut -c1-400

echo; echo "### 5. MAGALU OneLink e outros domínios — o desembrulho (resolve? qual motivo?)"
grep -h "onelink.me" logs/bot.log 2>/dev/null | grep -c "NÃO resolveu"
grep -h "onelink.me" logs/bot.log 2>/dev/null | grep -c "desembrulhado até a loja"
grep -h "onelink.me" logs/bot.log 2>/dev/null | grep "NÃO resolveu" | tail -n 3 | cut -c1-600
sqlite3 -header "$DB" "SELECT status, substr(coalesce(errorMsg,''),1,60) motivo, substr(originalUrl,1,60) origem, datetime(sentAt/1000,'unixepoch','localtime') q FROM MessageLog WHERE userId='$UID_' AND (originalUrl LIKE '%onelink%' OR messageText LIKE '%onelink.me%' OR platform LIKE '%magalu%' OR platform LIKE '%magazine%') AND sentAt>$S72 ORDER BY sentAt DESC LIMIT 10;"
echo "--- teste AO VIVO do OneLink do Magalu a partir da VPS (troque pelo link real que a cliente mandou, se tiver)"
ONELINK=$(sqlite3 "$DB" "SELECT originalUrl FROM MessageLog WHERE userId='$UID_' AND originalUrl LIKE '%onelink.me%' ORDER BY sentAt DESC LIMIT 1;")
[ -n "$ONELINK" ] && curl -sS -o /dev/null -m 15 -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" -w "onelink=$ONELINK -> http=%{http_code} redirect=%{redirect_url}\n" "$ONELINK" || echo "sem onelink no MessageLog — pedir o link à cliente"

echo; echo "### 6. SCRIPTS PRONTOS (mesma conta)"
node scripts/diag-oferta-descartada.mjs "$E" --hours=24 --no-live 2>&1 | head -n 120
node scripts/diag-fila-parada.mjs "$E" --hours=24 2>&1 | head -n 120
node scripts/diag-envios-vazios.mjs "$E" --hours=24 2>&1 | head -n 60
node scripts/diag-dominio-proprio.mjs --horas=72 --sem-contas 2>&1 | head -n 60
