#!/usr/bin/env bash
# =============================================================================
# smoke-test.sh - Post-deployment smoke tests
# =============================================================================
# Usage:
#   smoke-test.sh --url <url> [--extended] [--retries <n>] [--timeout <s>]
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib.sh"

URL=""
EXTENDED=false
RETRIES=3
TIMEOUT=10

usage() {
  cat <<EOF
Usage: $0 [options]

Options:
  --url <url>       Target base URL (required)
  --extended        Run extended test suite
  --retries <n>     Number of retries per check (default: 3)
  --timeout <s>     Request timeout in seconds (default: 10)
  -h, --help        Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --url)      URL="$2"; shift 2 ;;
    --extended) EXTENDED=true; shift ;;
    --retries)  RETRIES="$2"; shift 2 ;;
    --timeout)  TIMEOUT="$2"; shift 2 ;;
    -h|--help)  usage; exit 0 ;;
    *)          log_error "Unknown option: $1"; usage; exit 1 ;;
  esac
done

if [[ -z "$URL" ]]; then log_error "--url is required"; exit 1; fi

PASS=0
FAIL=0

run_check() {
  local name="$1"
  local path="$2"
  local expected_code="${3:-200}"
  local mode="${4:-status}"

  local attempt=0
  while [[ $attempt -lt $RETRIES ]]; do
    attempt=$((attempt + 1))
    local start
    start=$(date +%s%N)
    local response
    local code
    response=$(curl -sS -o /tmp/smoke-body --max-time "$TIMEOUT" -w "%{http_code}" "${URL}${path}" 2>/dev/null || echo "000")
    code="$response"
    local end
    end=$(date +%s%N)
    local duration_ms=$(( (end - start) / 1000000 ))

    if [[ ",$expected_code," == *",$code,"* ]]; then
      log_ok "[PASS] $name (path=$path, code=$code, ${duration_ms}ms)"
      PASS=$((PASS + 1))
      return 0
    fi
    log_warn "  retry $attempt/$RETRIES for $name (got $code, expected one of: $expected_code)"
    sleep 2
  done

  log_error "[FAIL] $name (path=$path, expected=$expected_code, last_code=$code)"
  FAIL=$((FAIL + 1))
  return 1
}

# Health
run_check "liveness probe" "/health/live" 200
run_check "readiness probe" "/health/ready" 200
run_check "health status" "/health" "200,503"

# API
run_check "root endpoint" "/" 200
run_check "API status" "/api/v1/status" 200
run_check "API echo" "/api/v1/echo/hello" 200
run_check "API 404" "/api/v1/this-does-not-exist" 404

# POST checks via curl
log_info "POST /api/v1/calc ..."
RESP=$(curl -sS --max-time "$TIMEOUT" -X POST -H 'Content-Type: application/json' \
  -d '{"operation":"add","a":2,"b":3}' "${URL}/api/v1/calc" 2>/dev/null || echo "")
if echo "$RESP" | grep -q '"result":5'; then
  log_ok "[PASS] POST /api/v1/calc returned correct result"
  PASS=$((PASS + 1))
else
  log_error "[FAIL] POST /api/v1/calc returned: $RESP"
  FAIL=$((FAIL + 1))
fi

# Extended
if [[ "$EXTENDED" == "true" ]]; then
  log_info "Running extended checks..."

  for op in add subtract multiply divide; do
    log_info "  calc operation: $op"
    RESP=$(curl -sS --max-time "$TIMEOUT" -X POST -H 'Content-Type: application/json' \
      -d "{\"operation\":\"$op\",\"a\":10,\"b\":2}" "${URL}/api/v1/calc" 2>/dev/null || echo "")
    if [[ -n "$RESP" ]] && ! echo "$RESP" | grep -qi "error"; then
      log_ok "[PASS] extended calc $op"
      PASS=$((PASS + 1))
    else
      log_error "[FAIL] extended calc $op: $RESP"
      FAIL=$((FAIL + 1))
    fi
  done

  # Load test (lightweight)
  log_info "  light load: 50 sequential requests..."
  local_total=0
  for i in $(seq 1 50); do
    code=$(curl -sS -o /dev/null --max-time "$TIMEOUT" -w "%{http_code}" "${URL}/health/live" 2>/dev/null || echo 000)
    if [[ "$code" == "200" ]]; then local_total=$((local_total + 1)); fi
  done
  if [[ $local_total -ge 45 ]]; then
    log_ok "[PASS] load test ($local_total/50 successful)"
    PASS=$((PASS + 1))
  else
    log_error "[FAIL] load test ($local_total/50 successful)"
    FAIL=$((FAIL + 1))
  fi
fi

# Summary
echo ""
echo "=========================================="
echo "Smoke test summary"
echo "  Passed: $PASS"
echo "  Failed: $FAIL"
echo "=========================================="

if [[ $FAIL -gt 0 ]]; then
  exit 1
fi
exit 0
