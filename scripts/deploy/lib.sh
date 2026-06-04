#!/usr/bin/env bash
# =============================================================================
# lib.sh - Shared library for deployment scripts
# =============================================================================

set -euo pipefail

# Colors (disabled if not a terminal)
if [[ -t 1 ]]; then
  C_RED='\033[0;31m'
  C_GREEN='\033[0;32m'
  C_YELLOW='\033[0;33m'
  C_BLUE='\033[0;34m'
  C_RESET='\033[0m'
else
  C_RED=''; C_GREEN=''; C_YELLOW=''; C_BLUE=''; C_RESET=''
fi

log_ts() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
log_info()  { echo -e "${C_BLUE}[$(log_ts)] [INFO]${C_RESET}  $*" >&2; }
log_warn()  { echo -e "${C_YELLOW}[$(log_ts)] [WARN]${C_RESET}  $*" >&2; }
log_error() { echo -e "${C_RED}[$(log_ts)] [ERROR]${C_RESET} $*" >&2; }
log_ok()    { echo -e "${C_GREEN}[$(log_ts)] [OK]${C_RESET}    $*" >&2; }

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    log_error "Required command not found: $cmd"
    exit 1
  fi
}

# State persistence for blue-green slot tracking
STATE_DIR="${STATE_DIR:-${HOME}/.deploy-state}"
STATE_FILE="${STATE_DIR}/state.json"

ensure_state_dir() {
  mkdir -p "$STATE_DIR"
}

write_state() {
  local key="$1"
  local value="$2"
  ensure_state_dir
  if [[ -f "$STATE_FILE" ]]; then
    local current
    current=$(cat "$STATE_FILE")
    echo "$current" | jq --arg k "$key" --arg v "$value" '.[$k] = $v' > "$STATE_FILE.tmp"
    mv "$STATE_FILE.tmp" "$STATE_FILE"
  else
    jq -n --arg k "$key" --arg v "$value" '{($k): $v}' > "$STATE_FILE"
  fi
}

read_state() {
  local key="$1"
  local default="${2:-}"
  if [[ ! -f "$STATE_FILE" ]]; then
    echo "$default"
    return
  fi
  local val
  val=$(jq -r --arg k "$key" '.[$k] // ""' "$STATE_FILE" 2>/dev/null || echo "")
  echo "${val:-$default}"
}

# Health check with retries
health_check() {
  local url="$1"
  local timeout="${2:-300}"
  local interval="${3:-5}"
  local start
  start=$(date +%s)

  log_info "Health check: $url (timeout=${timeout}s, interval=${interval}s)"

  while true; do
    local now
    now=$(date +%s)
    local elapsed=$((now - start))

    if [[ $elapsed -ge $timeout ]]; then
      log_error "Health check timed out after ${elapsed}s"
      return 1
    fi

    if curl -fsS --max-time 5 "$url" >/dev/null 2>&1; then
      log_ok "Health check passed after ${elapsed}s"
      return 0
    fi

    log_info "  waiting... (${elapsed}s elapsed)"
    sleep "$interval"
  done
}

# Run with optional dry-run
run() {
  if [[ "${DRY_RUN:-false}" == "true" ]]; then
    log_info "[DRY-RUN] $*"
  else
    log_info "EXEC: $*"
    "$@"
  fi
}
