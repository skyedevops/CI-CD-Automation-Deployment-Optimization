#!/usr/bin/env bash
# =============================================================================
# deploy.sh - Zero-downtime deployment with multiple strategies
# =============================================================================
# Usage:
#   deploy.sh --image <image:tag> --env <env> [--strategy <strategy>]
#             [--canary-percent <n>] [--slot <blue|green>]
#             [--rollback-on-failure] [--dry-run]
#
# Strategies: blue-green, canary, rolling
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib.sh"

# Defaults
IMAGE=""
ENV_NAME=""
STRATEGY="blue-green"
CANARY_PERCENT=10
SLOT=""
ROLLBACK_ON_FAILURE=true
DRY_RUN=false
HEALTH_TIMEOUT=300
HEALTH_INTERVAL=5
COMPOSE_FILE="${SCRIPT_DIR}/../../docker/docker-compose.yml"
PROJECT_NAME="ci-cd-demo"

usage() {
  cat <<EOF
Usage: $0 [options]

Options:
  --image <image:tag>       Container image to deploy (required)
  --env <env>               Target environment (staging|production) (required)
  --strategy <strategy>     Deployment strategy: blue-green|canary|rolling (default: blue-green)
  --canary-percent <n>      Initial canary traffic percentage (default: 10)
  --slot <blue|green>       Force specific slot for blue-green
  --rollback-on-failure     Automatically rollback on failed health checks (default: true)
  --no-rollback             Disable automatic rollback
  --health-timeout <sec>    Health check timeout in seconds (default: 300)
  --health-interval <sec>   Health check interval in seconds (default: 5)
  --dry-run                 Print actions without executing them
  -h, --help                Show this help message
EOF
}

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --image)             IMAGE="$2"; shift 2 ;;
    --env)               ENV_NAME="$2"; shift 2 ;;
    --strategy)          STRATEGY="$2"; shift 2 ;;
    --canary-percent)    CANARY_PERCENT="$2"; shift 2 ;;
    --slot)              SLOT="$2"; shift 2 ;;
    --rollback-on-failure) ROLLBACK_ON_FAILURE=true; shift ;;
    --no-rollback)       ROLLBACK_ON_FAILURE=false; shift ;;
    --health-timeout)    HEALTH_TIMEOUT="$2"; shift 2 ;;
    --health-interval)   HEALTH_INTERVAL="$2"; shift 2 ;;
    --dry-run)           DRY_RUN=true; shift ;;
    -h|--help)           usage; exit 0 ;;
    *)                   log_error "Unknown option: $1"; usage; exit 1 ;;
  esac
done

# Validate
if [[ -z "$IMAGE" ]]; then log_error "--image is required"; exit 1; fi
if [[ -z "$ENV_NAME" ]]; then log_error "--env is required"; exit 1; fi
if [[ ! "$STRATEGY" =~ ^(blue-green|canary|rolling)$ ]]; then
  log_error "Invalid strategy: $STRATEGY"; exit 1
fi

# Preflight
log_info "=========================================="
log_info "Deployment starting"
log_info "  Image:     $IMAGE"
log_info "  Env:       $ENV_NAME"
log_info "  Strategy:  $STRATEGY"
log_info "  Canary:    ${CANARY_PERCENT}%"
log_info "  Dry-run:   $DRY_RUN"
log_info "=========================================="

preflight() {
  log_info "Running preflight checks..."

  require_cmd docker
  require_cmd curl

  if ! docker info >/dev/null 2>&1; then
    log_error "Docker daemon not accessible"
    exit 1
  fi

  if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
    log_warn "Image $IMAGE not present locally; attempting to pull..."
    if [[ "$DRY_RUN" == "true" ]]; then
      log_info "[DRY-RUN] Would pull: docker pull $IMAGE"
    else
      docker pull "$IMAGE" || { log_error "Failed to pull image"; exit 1; }
    fi
  fi

  log_info "Preflight checks passed"
}

# Determine slot for blue-green
determine_slot() {
  if [[ -n "$SLOT" ]]; then
    echo "$SLOT"; return
  fi
  # Read current slot from state file, then pick the other one
  local current
  current=$(read_state "active_slot" "blue")
  if [[ "$current" == "blue" ]]; then echo "green"; else echo "blue"; fi
}

deploy_blue_green() {
  local new_slot
  new_slot=$(determine_slot)
  local old_slot
  if [[ "$new_slot" == "blue" ]]; then
    old_slot="green"
    new_port=3001
    old_port=3002
  else
    old_slot="blue"
    new_port=3002
    old_port=3001
  fi

  log_info "Blue-Green deploy: new=$new_slot (port $new_port), old=$old_slot (port $old_port)"

  run docker compose \
    -f "$COMPOSE_FILE" \
    -p "${PROJECT_NAME}-${ENV_NAME}" \
    --profile blue-green \
    up -d "app-${new_slot}"

  # Tag the new slot with the deployed image
  run docker tag "$IMAGE" "ci-cd-demo-app:${new_slot}" || true

  # Health checks
  log_info "Running health checks on $new_slot..."
  if [[ "$DRY_RUN" == "true" ]]; then
    log_info "[DRY-RUN] Would health-check: http://127.0.0.1:${new_port}/health/live (timeout=${HEALTH_TIMEOUT}s)"
  elif ! health_check "http://127.0.0.1:${new_port}/health/live" "$HEALTH_TIMEOUT" "$HEALTH_INTERVAL"; then
    log_error "Health check failed on new slot"
    if [[ "$ROLLBACK_ON_FAILURE" == "true" ]]; then
      log_warn "Triggering rollback..."
      cleanup_slot "$new_slot"
    fi
    exit 1
  fi

  log_info "Health checks passed. Switching traffic to $new_slot..."

  # Save state
  write_state "active_slot" "$new_slot"
  write_state "active_image" "$IMAGE"
  write_state "last_deploy_at" "$(date -u +%Y-%m-%dT%H:%M:%SZ)"

  log_info "Traffic switched to $new_slot. Cleaning up $old_slot..."
  cleanup_slot "$old_slot" || log_warn "Cleanup of $old_slot failed; continuing"

  log_info "Blue-Green deployment to $new_slot complete"
}

deploy_canary() {
  log_info "Canary deploy starting at ${CANARY_PERCENT}%..."

  # Pull canary image
  run docker pull "$IMAGE"

  # Start canary container
  local canary_port=3003
  run docker run -d \
    --name "${PROJECT_NAME}-canary-${ENV_NAME}" \
    -p "${canary_port}:3000" \
    -e NODE_ENV=production \
    -e DEPLOY_SLOT=canary \
    -e CANARY_PERCENT="${CANARY_PERCENT}" \
    "$IMAGE"

  if [[ "$DRY_RUN" == "true" ]]; then
    log_info "[DRY-RUN] Would health-check canary on port ${canary_port}"
  elif ! health_check "http://127.0.0.1:${canary_port}/health/live" 60 5; then
    log_error "Canary health check failed"
    run docker rm -f "${PROJECT_NAME}-canary-${ENV_NAME}" || true
    if [[ "$ROLLBACK_ON_FAILURE" == "true" ]]; then
      log_warn "Rolling back canary"
    fi
    exit 1
  fi

  log_info "Canary health check passed. Promoting to full traffic..."

  # Promote canary -> stable
  run docker rm -f "${PROJECT_NAME}-canary-${ENV_NAME}" || true
  run docker compose -f "$COMPOSE_FILE" -p "${PROJECT_NAME}-${ENV_NAME}" up -d app

  write_state "active_image" "$IMAGE"
  write_state "last_deploy_at" "$(date -u +%Y-%m-%dT%H:%M:%SZ)"

  log_info "Canary promotion to full traffic complete"
}

deploy_rolling() {
  log_info "Rolling deploy starting..."
  # Compose's --scale with rolling updates
  run docker compose -f "$COMPOSE_FILE" -p "${PROJECT_NAME}-${ENV_NAME}" up -d --no-deps --scale app=2 app
  sleep 10
  if [[ "$DRY_RUN" == "true" ]]; then
    log_info "[DRY-RUN] Would health-check rolling deploy on port 3000"
  elif ! health_check "http://127.0.0.1:3000/health/live" 60 5; then
    log_error "Rolling deploy health check failed"
    if [[ "$ROLLBACK_ON_FAILURE" == "true" ]]; then
      log_warn "Triggering rollback..."
      "$SCRIPT_DIR/rollback.sh" --env "$ENV_NAME"
    fi
    exit 1
  fi
  run docker compose -f "$COMPOSE_FILE" -p "${PROJECT_NAME}-${ENV_NAME}" up -d --no-deps --scale app=1 app
  write_state "active_image" "$IMAGE"
  write_state "last_deploy_at" "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  log_info "Rolling deploy complete"
}

cleanup_slot() {
  local slot="$1"
  log_info "Cleaning up slot: $slot"
  run docker compose \
    -f "$COMPOSE_FILE" \
    -p "${PROJECT_NAME}-${ENV_NAME}" \
    --profile blue-green \
    stop "app-${slot}" || true
  run docker compose \
    -f "$COMPOSE_FILE" \
    -p "${PROJECT_NAME}-${ENV_NAME}" \
    --profile blue-green \
    rm -f "app-${slot}" || true
}

main() {
  preflight

  case "$STRATEGY" in
    blue-green) deploy_blue_green ;;
    canary)     deploy_canary ;;
    rolling)    deploy_rolling ;;
  esac

  log_info "Deployment successful: $IMAGE -> $ENV_NAME"
}

main "$@"
