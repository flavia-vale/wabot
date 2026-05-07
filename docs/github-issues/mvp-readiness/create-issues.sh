#!/usr/bin/env bash
set -euo pipefail

REPO="${1:-flavia-vale/BOTinho}"
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

declare -A TITLES=(
  [001-camada-publica-confianca.md]="P0: Criar camada pública mínima de confiança e páginas legais"
  [002-pagamento-assinatura-seguranca.md]="P0: Ajustar jornada de pagamento, modelo comercial e segurança do webhook"
  [003-onboarding-primeiros-passos.md]="P0: Criar onboarding guiado de primeiros passos no dashboard"
  [004-suporte-faq-operacional.md]="P1: Criar suporte mínimo e FAQ operacional"
  [005-analytics-funil-mvp.md]="P1: Implementar analytics mínimo de funil MVP"
)

declare -A LABELS=(
  [001-camada-publica-confianca.md]="mvp,launch-readiness,legal,trust,p0"
  [002-pagamento-assinatura-seguranca.md]="mvp,launch-readiness,payments,security,p0"
  [003-onboarding-primeiros-passos.md]="mvp,launch-readiness,onboarding,ux,p0"
  [004-suporte-faq-operacional.md]="mvp,launch-readiness,support,docs,p1"
  [005-analytics-funil-mvp.md]="mvp,launch-readiness,analytics,growth,p1"
)

if ! command -v gh >/dev/null 2>&1; then
  echo "Erro: GitHub CLI (gh) não encontrado. Instale/autentique o gh ou crie as issues manualmente com os arquivos deste diretório." >&2
  exit 1
fi

# Garante labels usadas pelas issues. Se a label já existir, atualiza cor/descrição quando o gh suportar --force.
ensure_label() {
  local name="$1"
  local color="$2"
  local description="$3"
  gh label create "$name" --repo "$REPO" --color "$color" --description "$description" --force >/dev/null 2>&1 || true
}

ensure_label "mvp" "0E8A16" "Escopo necessário para MVP"
ensure_label "launch-readiness" "5319E7" "Preparação para lançamento e vendas"
ensure_label "legal" "D4C5F9" "Jurídico e compliance"
ensure_label "trust" "1D76DB" "Confiança e reputação"
ensure_label "payments" "FBCA04" "Pagamentos e billing"
ensure_label "security" "B60205" "Segurança"
ensure_label "onboarding" "C2E0C6" "Primeira experiência do usuário"
ensure_label "ux" "BFDADC" "Experiência do usuário"
ensure_label "support" "F9D0C4" "Suporte ao cliente"
ensure_label "docs" "0075CA" "Documentação"
ensure_label "analytics" "0052CC" "Métricas e analytics"
ensure_label "growth" "F9A825" "Crescimento e aquisição"
ensure_label "p0" "B60205" "Prioridade máxima / blocker"
ensure_label "p1" "D93F0B" "Alta prioridade"

for file in \
  001-camada-publica-confianca.md \
  002-pagamento-assinatura-seguranca.md \
  003-onboarding-primeiros-passos.md \
  004-suporte-faq-operacional.md \
  005-analytics-funil-mvp.md
 do
  echo "Criando issue: ${TITLES[$file]}"
  gh issue create \
    --repo "$REPO" \
    --title "${TITLES[$file]}" \
    --body-file "$BASE_DIR/$file" \
    --label "${LABELS[$file]}"
 done
