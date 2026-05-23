#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$HOME/wabot}"
STAGING_OK_FILE="${STAGING_OK_FILE:-$HOME/wabot-staging/.p2_staging_approved}"
MODE="${MODE:-dry-run}" # dry-run|execute
CONSISTENCY_EVIDENCE_FILE="${CONSISTENCY_EVIDENCE_FILE:-$HOME/wabot-staging/.p2_consistency_ok}"
BACKUP_EVIDENCE_FILE="${BACKUP_EVIDENCE_FILE:-$HOME/wabot/.p2_backup_ok}"
ROLLBACK_EVIDENCE_FILE="${ROLLBACK_EVIDENCE_FILE:-$HOME/wabot-staging/.p2_rollback_tested}"

API_BASE_URL="${API_BASE_URL:-http://127.0.0.1:3001}"
LOGIN_ENDPOINT="${LOGIN_ENDPOINT:-$API_BASE_URL/api/auth/login}"
SESSION_CRITICAL_ENDPOINT="${SESSION_CRITICAL_ENDPOINT:-$API_BASE_URL/api/session/list?metrics=0}"

[[ -d "$ROOT_DIR" ]] || { echo "ERRO: ROOT_DIR não encontrado: $ROOT_DIR"; exit 1; }
[[ -f "$STAGING_OK_FILE" ]] || { echo "HARD-GATE: staging approval marker ausente: $STAGING_OK_FILE"; exit 1; }
[[ -f "$CONSISTENCY_EVIDENCE_FILE" ]] || { echo "HARD-GATE: evidência de consistência ausente: $CONSISTENCY_EVIDENCE_FILE"; exit 1; }
[[ -f "$BACKUP_EVIDENCE_FILE" ]] || { echo "HARD-GATE: evidência de backup ausente: $BACKUP_EVIDENCE_FILE"; exit 1; }
[[ -f "$ROLLBACK_EVIDENCE_FILE" ]] || { echo "HARD-GATE: evidência de rollback testado ausente: $ROLLBACK_EVIDENCE_FILE"; exit 1; }

cd "$ROOT_DIR"
echo "[P2.4] preflight"
grep "name:" ecosystem.config.cjs | sed -n '1,20p'
ls src/supervisor/

echo "[P2.4] MODE=$MODE"
if [[ "$MODE" == "dry-run" ]]; then
  echo "DRY-RUN OK: todos os hard-gates passaram."
  echo "Próximo passo: MODE=execute para aplicar cutover."
  exit 0
fi

if [[ "$MODE" != "execute" ]]; then
  echo "ERRO: MODE inválido: $MODE (use dry-run|execute)"
  exit 1
fi

auth_and_session_smoke() {
  local token login_resp login_code
  [[ -n "${CUTOVER_SMOKE_LOGIN_EMAIL:-}" ]] || { echo "ERRO: CUTOVER_SMOKE_LOGIN_EMAIL ausente"; return 1; }
  [[ -n "${CUTOVER_SMOKE_LOGIN_PASSWORD:-}" ]] || { echo "ERRO: CUTOVER_SMOKE_LOGIN_PASSWORD ausente"; return 1; }

  login_resp="$(curl -sS -w '\n%{http_code}' -H 'content-type: application/json' \
    -d "{\"email\":\"${CUTOVER_SMOKE_LOGIN_EMAIL}\",\"password\":\"${CUTOVER_SMOKE_LOGIN_PASSWORD}\"}" \
    "$LOGIN_ENDPOINT")"
  login_code="$(printf '%s' "$login_resp" | tail -n1)"
  if [[ "$login_code" != "200" ]]; then
    echo "ERRO: smoke auth falhou (status=$login_code)"
    return 1
  fi

  token="$(printf '%s' "$login_resp" | sed '$d' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const j=JSON.parse(s);process.stdout.write(j.token||'')}catch{process.stdout.write('')}})")"
  [[ -n "$token" ]] || { echo "ERRO: smoke auth não retornou token"; return 1; }

  curl -fsS -H "authorization: Bearer $token" "$SESSION_CRITICAL_ENDPOINT" >/dev/null || {
    echo "ERRO: rota crítica de sessão falhou: $SESSION_CRITICAL_ENDPOINT"
    return 1
  }
  return 0
}

echo "[P2.4] EXECUTE"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env}"
NEW_DATABASE_URL="${NEW_DATABASE_URL:-}"
[[ -n "$NEW_DATABASE_URL" ]] || { echo "ERRO: informe NEW_DATABASE_URL para MODE=execute"; exit 1; }
[[ -f "$ENV_FILE" ]] || { echo "ERRO: .env não encontrado em $ENV_FILE"; exit 1; }
OLD_DATABASE_URL=$(grep '^DATABASE_URL=' "$ENV_FILE" | head -n1 | cut -d'=' -f2- || true)
[[ -n "$OLD_DATABASE_URL" ]] || { echo "ERRO: DATABASE_URL atual ausente em $ENV_FILE"; exit 1; }
cp "$ENV_FILE" "$ENV_FILE.p2_4.bak"
sed -i "s|^DATABASE_URL=.*$|DATABASE_URL=$NEW_DATABASE_URL|" "$ENV_FILE"
if pm2 delete api >/dev/null 2>&1 && pm2 start ecosystem.config.cjs --only api >/dev/null 2>&1; then
  if curl -fsS "$API_BASE_URL/health" >/dev/null \
    && curl -fsS "$API_BASE_URL/ready" >/dev/null \
    && auth_and_session_smoke; then
    echo "P2.4 execute OK"
    exit 0
  fi
fi
echo "Falha no cutover/smoke. Iniciando rollback automático..."
sed -i "s|^DATABASE_URL=.*$|DATABASE_URL=$OLD_DATABASE_URL|" "$ENV_FILE"
pm2 delete api >/dev/null 2>&1 || true
pm2 start ecosystem.config.cjs --only api >/dev/null 2>&1 || true
echo "Rollback aplicado. Verifique logs manualmente."
exit 1
