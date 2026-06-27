#!/usr/bin/env bash
# Smoke do programa de afiliados em STAGING (cenários B, D, E, G da validação).
#
# - Parte HTTP (B): testa rate-limit + dedup do /api/affiliate/track contra o
#   endpoint vivo. Totalmente automatizável.
# - Parte BANCO (D/E/G): roda invariantes (SELECTs read-only) sobre staging.db
#   que validam o RESULTADO das ações manuais (criação/hold/classificação de
#   comissão, ledger, bloqueio de afiliado suspenso), independente de como os
#   passos foram executados.
#
# NÃO escreve no banco. A parte HTTP grava no máximo 1 touch (o resto é dedup/429).
#
# Uso:
#   BASE_URL=http://178.105.54.0:3006 DB=~/wabot-staging/prisma/staging.db \
#     bash scripts/smoke-affiliate-staging.sh
#
# Envs (todas opcionais, com defaults de staging):
#   BASE_URL  default http://178.105.54.0:3006
#   DB        default ~/wabot-staging/prisma/staging.db
#   AFF_CODE  código de afiliado APROVADO p/ os testes HTTP; se vazio, pega do DB
#   RATE_MAX  teto esperado do rate-limit (default 20, = AFFILIATE_TRACK_RATE_MAX)

set -uo pipefail
BASE_URL="${BASE_URL:-http://178.105.54.0:3006}"
DB="${DB:-$HOME/wabot-staging/prisma/staging.db}"
AFF_CODE="${AFF_CODE:-}"
RATE_MAX="${RATE_MAX:-20}"

fail=0
pass() { printf '  \033[32m✅ %s\033[0m\n' "$1"; }
err()  { printf '  \033[31m❌ %s\033[0m\n' "$1"; fail=1; }
warn() { printf '  \033[33m⚠️  %s\033[0m\n' "$1"; }
hdr()  { printf '\n\033[1m== %s ==\033[0m\n' "$1"; }

have_sqlite=1; command -v sqlite3 >/dev/null 2>&1 || have_sqlite=0
sq() { sqlite3 "$DB" "$1" 2>/dev/null; }

# POST track; ecoa "HTTPCODE|body"
track() {
  curl -s -m 8 -o /tmp/_aff_body -w '%{http_code}' \
    -H 'Content-Type: application/json' \
    -X POST "$BASE_URL/api/affiliate/track" \
    -d "$1"
}

hdr "Pré-flight"
cfg_code=$(curl -s -m 8 -o /tmp/_aff_cfg -w '%{http_code}' "$BASE_URL/api/affiliate/config")
if [ "$cfg_code" = "200" ]; then
  pass "GET /api/affiliate/config 200"
  grep -q 'attributionWindowDays' /tmp/_aff_cfg && pass "config expõe attributionWindowDays (R4)" || err "config sem attributionWindowDays"
else
  err "GET /api/affiliate/config retornou $cfg_code (esperado 200)"
fi

if [ -z "$AFF_CODE" ] && [ "$have_sqlite" = 1 ] && [ -f "$DB" ]; then
  AFF_CODE=$(sq "SELECT code FROM AffiliateProfile WHERE status='approved' ORDER BY appliedAt DESC LIMIT 1;")
  [ -n "$AFF_CODE" ] && warn "AFF_CODE auto-selecionado do banco: $AFF_CODE"
fi

# ───────────────────────────── B: rate-limit + dedup ─────────────────────────
hdr "B — /affiliate/track: dedup + rate-limit"
if [ -z "$AFF_CODE" ]; then
  warn "sem AFF_CODE (e sem afiliado aprovado no DB) — pulando testes HTTP de track"
else
  # B.1 dedup: mesmo (visitor, afiliado) 2x → 2º vem deduped
  VID="smoke-dedup-$(date +%s)-$$"
  body1=$(track "{\"affiliateCode\":\"$AFF_CODE\",\"visitorId\":\"$VID\"}"); read1=$(cat /tmp/_aff_body)
  body2=$(track "{\"affiliateCode\":\"$AFF_CODE\",\"visitorId\":\"$VID\"}"); read2=$(cat /tmp/_aff_body)
  if echo "$read1" | grep -q '"tracked":true' && echo "$read2" | grep -q '"deduped":true'; then
    pass "dedup: 1º grava (tracked:true), 2º deduplicado (deduped:true)"
  else
    err "dedup falhou — 1º='$read1' 2º='$read2'"
  fi

  # B.2 rate-limit: estourar o teto do mesmo IP → aparece 429
  n=$((RATE_MAX + 6)); got429=0
  for i in $(seq 1 "$n"); do
    code=$(track "{\"affiliateCode\":\"$AFF_CODE\",\"visitorId\":\"smoke-rl-$i-$$\"}")
    [ "$code" = "429" ] && got429=1
  done
  if [ "$got429" = 1 ]; then
    pass "rate-limit: 429 disparado ao exceder $RATE_MAX req/janela"
  else
    err "rate-limit NÃO disparou em $n requisições (esperava 429 após $RATE_MAX)"
  fi
  warn "este IP fica rate-limitado ~1min; rode os testes HTTP só uma vez por janela"
fi

# ─────────────────────── Invariantes de banco (D / E / G) ─────────────────────
if [ "$have_sqlite" != 1 ] || [ ! -f "$DB" ]; then
  hdr "D/E/G — invariantes de banco"
  warn "sqlite3 ausente ou DB não encontrado ($DB) — pulando invariantes"
  printf '\n'; [ "$fail" = 0 ] && { echo "RESULTADO: PASS (parcial — sem banco)"; exit 0; } || { echo "RESULTADO: FAIL"; exit 1; }
fi

assert_zero() { # $1=descrição $2=query (deve retornar 0)
  local v; v=$(sq "$2")
  if [ "$v" = "0" ]; then pass "$1"; else err "$1 (violações: ${v:-erro})"; fi
}
assert_empty() { # $1=descrição $2=query (não deve retornar linhas)
  local v; v=$(sq "$2")
  if [ -z "$v" ]; then pass "$1"; else err "$1 (linhas: $v)"; fi
}

hdr "R1 — pixKey cifrado em repouso"
assert_zero "todo pixKey está cifrado (v1:) — 0 em texto puro" \
  "SELECT count(*) FROM AffiliateProfile WHERE pixKey IS NOT NULL AND pixKey<>'' AND pixKey NOT LIKE 'v1:%';"

hdr "E — Ledger imutável (R3)"
assert_zero "toda comissão tem linha de CRIAÇÃO no ledger (fromStatus NULL)" \
  "SELECT count(*) FROM AffiliateCommission c WHERE NOT EXISTS (SELECT 1 FROM AffiliateCommissionLedger l WHERE l.commissionId=c.id AND l.fromStatus IS NULL);"
assert_zero "toda comissão PAGA tem linha ledger toStatus='paid'" \
  "SELECT count(*) FROM AffiliateCommission c WHERE c.status='paid' AND NOT EXISTS (SELECT 1 FROM AffiliateCommissionLedger l WHERE l.commissionId=c.id AND l.toStatus='paid');"
assert_zero "toda comissão REVERTIDA tem linha ledger toStatus='reversed'" \
  "SELECT count(*) FROM AffiliateCommission c WHERE c.status='reversed' AND NOT EXISTS (SELECT 1 FROM AffiliateCommissionLedger l WHERE l.commissionId=c.id AND l.toStatus='reversed');"

hdr "D — Classificação e hold"
assert_empty "no máx 1 'initial' NÃO-revertida por indicado (O4)" \
  "SELECT referredUserId||':'||count(*) FROM AffiliateCommission WHERE commissionType='initial' AND status<>'reversed' GROUP BY referredUserId HAVING count(*)>1;"
assert_zero "toda comissão em 'held' tem holdReason (R5/pix)" \
  "SELECT count(*) FROM AffiliateCommission WHERE status='held' AND (holdReason IS NULL OR holdReason='');"
assert_zero "nenhuma comissão de afiliado NÃO-aprovado em status pagável/pago" \
  "SELECT count(*) FROM AffiliateCommission c JOIN AffiliateProfile p ON p.id=c.affiliateId WHERE c.status IN ('eligible','approved','paid') AND p.status<>'approved';"

hdr "G — Pagamento (O2)"
assert_zero "nenhuma comissão PAGA cujo afiliado não está aprovado" \
  "SELECT count(*) FROM AffiliateCommission c JOIN AffiliateProfile p ON p.id=c.affiliateId WHERE c.status='paid' AND p.status<>'approved';"

hdr "Resumo de estado (informativo)"
echo "  Comissões por status:"
sq "SELECT '   '||status||': '||count(*) FROM AffiliateCommission GROUP BY status;"
echo "  Linhas no ledger: $(sq 'SELECT count(*) FROM AffiliateCommissionLedger;')"
echo "  Touches de atribuição (com userId / órfãos):"
sq "SELECT '   vinculados: '||count(*) FROM AffiliateAttributionTouch WHERE userId IS NOT NULL;"
sq "SELECT '   órfãos: '||count(*) FROM AffiliateAttributionTouch WHERE userId IS NULL;"

printf '\n'
if [ "$fail" = 0 ]; then
  printf '\033[1;32mRESULTADO: PASS\033[0m — invariantes OK. (Lembre: criação positiva de comissão via pagamento sandbox MP é passo manual.)\n'
  exit 0
else
  printf '\033[1;31mRESULTADO: FAIL\033[0m — revise os ❌ acima antes de subir para main.\n'
  exit 1
fi
