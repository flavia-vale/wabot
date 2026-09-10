#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-${VISUAL_BASE_URL:-http://127.0.0.1:3000}}"
shift || true
PATHS=("${@:-}")
if [[ ${#PATHS[@]} -eq 0 || -z "${PATHS[0]:-}" ]]; then
  PATHS=("/" "/login")
fi

MOBILE_USER_AGENT="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

normalize_url() {
  local base="${1%/}"
  local path="$2"
  if [[ "$path" != /* ]]; then
    path="/$path"
  fi
  printf '%s%s' "$base" "$path"
}

check_mobile_path() {
  local path="$1"
  local attempts="${MOBILE_SMOKE_ATTEMPTS:-8}"
  local sleep_seconds="${MOBILE_SMOKE_SLEEP_SECONDS:-2}"
  local url
  url="$(normalize_url "$BASE_URL" "$path")"
  local headers_file="$TMP_DIR/headers_${path//[^A-Za-z0-9]/_}.txt"
  local body_file="$TMP_DIR/body_${path//[^A-Za-z0-9]/_}.html"

  for ((i=1; i<=attempts; i++)); do
    local code
    code=$(curl -sS -L -A "$MOBILE_USER_AGENT" \
      -H 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' \
      -H 'Accept-Language: pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7' \
      -D "$headers_file" \
      -o "$body_file" \
      -w "%{http_code}" \
      --max-time 15 \
      "$url" || echo "000")

    local bytes
    bytes=$(wc -c < "$body_file" 2>/dev/null || echo 0)
    echo "  mobile ${path} tentativa ${i}/${attempts} -> HTTP ${code}, ${bytes} bytes"

    if [[ "$code" =~ ^(200|301|302|307|308)$ ]] && [[ "$bytes" -gt 200 ]]; then
      if grep -qi '^content-type: .*text/html' "$headers_file" && \
         grep -qi '<meta name="viewport"[^>]*width=device-width' "$body_file" && \
         ! grep -qiE '^(Forbidden|Access Denied)$' "$body_file"; then
        return 0
      fi
    fi

    sleep "$sleep_seconds"
  done

  echo "ERRO: smoke mobile falhou para ${url}. Headers finais:"
  cat "$headers_file" || true
  echo "Trecho do body final:"
  head -c 1200 "$body_file" || true
  echo
  diagnose_edge_cache "$url" "$headers_file"
  return 1
}

# Separa "o site está quebrado" de "a borda guardou uma resposta velha" — as
# duas chegam aqui como o MESMO vermelho e pedem ações opostas (RCA 2026-09-10:
# a home devolveu 404 na janela de restart do Next, a Cloudflare guardou essa
# resposta com validade longa, e a partir daí todo deploy bom era reprovado por
# ela). Refaz o pedido com um parâmetro descartável na ponta do endereço, o que
# obriga a borda a buscar do servidor. Só imprime diagnóstico: o veredito não
# muda, porque resposta velha na borda é problema de verdade para quem visita.
diagnose_edge_cache() {
  local url="$1"
  local headers_file="$2"

  grep -qi '^cf-cache-status:[[:space:]]*HIT' "$headers_file" || return 0

  local separador='?'
  [[ "$url" == *\?* ]] && separador='&'
  local url_sem_cache="${url}${separador}smoke_cache_bust=$$-${RANDOM}"

  local code
  code=$(curl -sS -A "$MOBILE_USER_AGENT" -o /dev/null -w '%{http_code}' \
    --max-time 15 "$url_sem_cache" || echo "000")

  echo "  DIAGNÓSTICO: a borda (Cloudflare) respondeu com uma cópia guardada."
  echo "  Pedindo de novo sem usar essa cópia -> HTTP ${code}"
  if [[ "$code" =~ ^(200|301|302|307|308)$ ]]; then
    echo "  >> O SERVIDOR ESTÁ BOM. O que reprovou foi a cópia velha guardada na borda."
    echo "  >> Conserto: limpar o cache da Cloudflare (Caching -> Purge Everything)."
    echo "  >> O passo 'Purgar cache da Cloudflare' deste mesmo deploy faz isso"
    echo "  >> logo a seguir; se ele não rodar, limpe pelo painel."
  else
    echo "  >> O servidor também respondeu com erro. A falha NÃO é da borda."
  fi
}

for path in "${PATHS[@]}"; do
  check_mobile_path "$path"
done
