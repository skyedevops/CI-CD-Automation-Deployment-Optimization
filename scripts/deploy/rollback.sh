#!/usr/bin/env bash
# =============================================================================
# rollback.sh - Rollback to a previous deployment
# =============================================================================
# Usage:
#   rollback.sh --env <env> [--to-image <image:tag>] [--to-revision <n>]
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib.sh"

ENV_NAME=""
TARGET_IMAGE=""
TARGET_REVISION=""
DRY_RUN=false

usage() {
  cat <<EOF
Usage: $0 [options]

Options:
  --env <env>            Target environment (required)
  --to-image <image>     Roll back to a specific image:tag
  --to-revision <n>     Roll back to a specific previous revision (default: previous)
  --dry-run              Show what would happen without executing
  -h, --help             Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)         ENV_NAME="$2"; shift 2 ;;
    --to-image)    TARGET_IMAGE="$2"; shift 2 ;;
    --to-revision) TARGET_REVISION="$2"; shift 2 ;;
    --dry-run)     DRY_RUN=true; shift ;;
    -h|--help)     usage; exit 0 ;;
    *)             log_error "Unknown option: $1"; usage; exit 1 ;;
  esac
done

if [[ -z "$ENV_NAME" ]]; then log_error "--env is required"; exit 1; fi

# History file
HISTORY_FILE="${STATE_DIR}/history-${ENV_NAME}.jsonl"

# Determine target image
if [[ -z "$TARGET_IMAGE" ]]; then
  if [[ ! -f "$HISTORY_FILE" ]]; then
    log_error "No history file found at $HISTORY_FILE and no --to-image given"
    exit 1
  fi

  if [[ -n "$TARGET_REVISION" ]]; then
    TARGET_IMAGE=$(sed -n "${TARGET_REVISION}p" "$HISTORY_FILE" | jq -r '.image')
  else
    # Second-to-last line is "previous"; current is last
    TARGET_IMAGE=$(sed -n 'x;$p' "$HISTORY_FILE" | jq -r '.image' 2>/dev/null || true)
    if [[ -z "$TARGET_IMAGE" || "$TARGET_IMAGE" == "null" ]]; then
      # Fallback: second line from bottom
      TARGET_IMAGE=$(tail -n 2 "$HISTORY_FILE" | head -n 1 | jq -r '.image')
    fi
  fi
fi

if [[ -z "$TARGET_IMAGE" || "$TARGET_IMAGE" == "null" ]]; then
  log_error "Could not determine target image for rollback"
  exit 1
fi

log_info "=========================================="
log_info "Rollback to: $TARGET_IMAGE"
log_info "Environment: $ENV_NAME"
log_info "=========================================="

# Save current as last-known
CURRENT_IMAGE=$(read_state "active_image" "unknown")
log_info "Current image: $CURRENT_IMAGE"

# Run deploy with target image
DEPLOY_ARGS=(--image "$TARGET_IMAGE" --env "$ENV_NAME" --strategy blue-green)
if [[ "$DRY_RUN" == "true" ]]; then
  DEPLOY_ARGS+=(--dry-run)
fi

chmod +x "$SCRIPT_DIR/deploy.sh"
bash "$SCRIPT_DIR/deploy.sh" "${DEPLOY_ARGS[@]}"

if [[ "$?" -eq 0 ]]; then
  log_ok "Rollback to $TARGET_IMAGE completed"

  # Record rollback event
  ensure_state_dir
  jq -n \
    --arg img "$TARGET_IMAGE" \
    --arg prev "$CURRENT_IMAGE" \
    --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '{action: "rollback", from: $prev, to: $img, timestamp: $ts}' \
    >> "$HISTORY_FILE"
else
  log_error "Rollback failed"
  exit 1
fi
