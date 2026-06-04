#!/usr/bin/env bash
# =============================================================================
# healthcheck.sh - Quick health verification for a deployed service
# =============================================================================
# Usage:
#   healthcheck.sh <url>
# =============================================================================

set -euo pipefail

URL="${1:-}"
if [[ -z "$URL" ]]; then
  echo "Usage: $0 <url>" >&2
  exit 2
fi

echo "Checking $URL ..."

# 1. Liveness
LIVE_CODE=$(curl -sS -o /dev/null --max-time 5 -w '%{http_code}' "${URL}/health/live" 2>/dev/null || echo 000)
if [[ "$LIVE_CODE" != "200" ]]; then
  echo "FAIL: liveness probe returned $LIVE_CODE"
  exit 1
fi
echo "  [OK] liveness"

# 2. Readiness
READY_CODE=$(curl -sS -o /dev/null --max-time 5 -w '%{http_code}' "${URL}/health/ready" 2>/dev/null || echo 000)
if [[ "$READY_CODE" != "200" ]]; then
  echo "FAIL: readiness probe returned $READY_CODE"
  exit 1
fi
echo "  [OK] readiness"

# 3. Full health
HEALTH=$(curl -sS --max-time 5 "${URL}/health" 2>/dev/null || echo "")
if [[ -z "$HEALTH" ]]; then
  echo "FAIL: empty health response"
  exit 1
fi
STATUS=$(echo "$HEALTH" | grep -oE '"status":"[a-z]+"' | head -1 | cut -d'"' -f4)
if [[ "$STATUS" != "ok" && "$STATUS" != "degraded" ]]; then
  echo "FAIL: unexpected health status: $STATUS"
  exit 1
fi
echo "  [OK] health status: $STATUS"

# 4. API
API_CODE=$(curl -sS -o /dev/null --max-time 5 -w '%{http_code}' "${URL}/api/v1/status" 2>/dev/null || echo 000)
if [[ "$API_CODE" != "200" ]]; then
  echo "FAIL: API returned $API_CODE"
  exit 1
fi
echo "  [OK] API"

echo "All checks passed for $URL"
exit 0
