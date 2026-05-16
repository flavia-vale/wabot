#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST_BASE="$ROOT_DIR/.codex/skills"

SOURCE_DIR=""
SKILL_NAME=""
GLOBAL_NAME=""
AUTO_CONFIRM=0
LIST_GLOBAL=0

print_help() {
  cat <<'USAGE'
Sincroniza uma skill para o repositório em .codex/skills.

Opções:
  --source <path>        Caminho da skill instalada (opcional se usar --global-name)
  --global-name <name>   Nome da skill instalada globalmente (auto-resolve caminho)
  --name <name>          Nome da pasta destino em .codex/skills (opcional)
  --list-global          Lista skills encontradas nos caminhos globais conhecidos
  --yes                  Não pedir confirmação interativa
  --help                 Exibe esta ajuda

Exemplos:
  scripts/sync_installed_skills.sh --global-name minha-skill
  scripts/sync_installed_skills.sh --source ~/.codex/skills/minha-skill --yes
  scripts/sync_installed_skills.sh --list-global
USAGE
}

find_global_skill_dir() {
  local name="$1"
  local -a bases=(
    "$HOME/.codex/skills"
    "$HOME/.claude/skills"
    "$HOME/.config/codex/skills"
    "$HOME/.local/share/codex/skills"
  )

  local base
  for base in "${bases[@]}"; do
    if [[ -d "$base/$name" ]]; then
      echo "$base/$name"
      return 0
    fi
  done

  return 1
}

list_global_skills() {
  local -a bases=(
    "$HOME/.codex/skills"
    "$HOME/.claude/skills"
    "$HOME/.config/codex/skills"
    "$HOME/.local/share/codex/skills"
  )

  local found=0
  local base
  for base in "${bases[@]}"; do
    if [[ -d "$base" ]]; then
      found=1
      echo "[global] $base"
      find "$base" -mindepth 1 -maxdepth 1 -type d -printf '  - %f\n' | sort || true
    fi
  done

  if [[ $found -eq 0 ]]; then
    echo "[info] Nenhum diretório global conhecido foi encontrado."
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source)
      SOURCE_DIR="${2:-}"
      shift 2
      ;;
    --global-name)
      GLOBAL_NAME="${2:-}"
      shift 2
      ;;
    --name)
      SKILL_NAME="${2:-}"
      shift 2
      ;;
    --list-global)
      LIST_GLOBAL=1
      shift
      ;;
    --yes)
      AUTO_CONFIRM=1
      shift
      ;;
    --help|-h)
      print_help
      exit 0
      ;;
    *)
      echo "[erro] Opção inválida: $1" >&2
      print_help
      exit 1
      ;;
  esac
done

if [[ $LIST_GLOBAL -eq 1 ]]; then
  list_global_skills
  exit 0
fi

if [[ -n "$GLOBAL_NAME" ]]; then
  if [[ -n "$SOURCE_DIR" ]]; then
    echo "[erro] Use apenas --source OU --global-name." >&2
    exit 1
  fi

  if ! SOURCE_DIR="$(find_global_skill_dir "$GLOBAL_NAME")"; then
    echo "[erro] Skill global '$GLOBAL_NAME' não encontrada." >&2
    echo "[dica] Rode: scripts/sync_installed_skills.sh --list-global" >&2
    exit 1
  fi

  if [[ -z "$SKILL_NAME" ]]; then
    SKILL_NAME="$GLOBAL_NAME"
  fi
fi

if [[ -z "$SOURCE_DIR" ]]; then
  echo "[erro] Informe --source ou --global-name." >&2
  print_help
  exit 1
fi

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "[erro] Diretório de origem não encontrado: $SOURCE_DIR" >&2
  exit 1
fi

if [[ -z "$SKILL_NAME" ]]; then
  SKILL_NAME="$(basename "$SOURCE_DIR")"
fi

DEST_DIR="$DEST_BASE/$SKILL_NAME"
if [[ "$DEST_DIR" != "$ROOT_DIR/.codex/skills/"* ]]; then
  echo "[erro] Destino calculado fora de .codex/skills. Abortando por segurança." >&2
  exit 1
fi

mkdir -p "$DEST_BASE"
if [[ -d "$DEST_DIR" ]]; then
  echo "[info] Destino já existe: $DEST_DIR"
  if [[ $AUTO_CONFIRM -eq 0 ]]; then
    read -r -p "Deseja sobrescrever o conteúdo? [y/N] " answer
    if [[ ! "$answer" =~ ^[Yy]$ ]]; then
      echo "[info] Operação cancelada."
      exit 0
    fi
  fi
  rm -rf "$DEST_DIR"
fi

mkdir -p "$DEST_DIR"
cp -a "$SOURCE_DIR"/. "$DEST_DIR"/

SENSITIVE_MATCHES="$(rg -n --hidden --glob '!.git' --glob '!node_modules/**' '(API_KEY|SECRET|TOKEN|PASSWORD|JWT_SECRET)' "$DEST_DIR" || true)"
if [[ -n "$SENSITIVE_MATCHES" ]]; then
  echo "[aviso] Possíveis segredos encontrados. Revise antes de commitar:" >&2
  echo "$SENSITIVE_MATCHES" >&2
fi

echo "[ok] Skill sincronizada em: $DEST_DIR"
echo "[origem] $SOURCE_DIR"
echo "[próximo] Revise e depois rode:"
echo "  git add .codex/skills/$SKILL_NAME"
echo "  git commit -m \"chore(skills): adiciona $SKILL_NAME\""
