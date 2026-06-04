# Runbook: Deploy

## Prerequisites

- Docker daemon running
- `jq` installed (for state file manipulation)
- Network access to the target registry and environment

## Standard deploy

```bash
# Staging (blue-green, no approval)
bash scripts/deploy/deploy.sh \
  --image ghcr.io/example/ci-cd-demo-app:v1.2.3 \
  --env staging

# Production (canary, requires approval in GitHub UI)
bash scripts/deploy/deploy.sh \
  --image ghcr.io/example/ci-cd-demo-app:v1.2.3 \
  --env production \
  --strategy canary \
  --canary-percent 10
```

## Dry-run

Preview the actions without executing them:

```bash
bash scripts/deploy/deploy.sh \
  --image ghcr.io/example/ci-cd-demo-app:v1.2.3 \
  --env staging \
  --dry-run
```

## Verify a deployment

```bash
# Quick health check
bash scripts/deploy/healthcheck.sh https://staging.example.com

# Comprehensive smoke tests
bash scripts/deploy/smoke-test.sh --url https://staging.example.com

# Extended (includes load test, ~30s)
bash scripts/deploy/smoke-test.sh --url https://staging.example.com --extended
```

## Environment variables

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `STATE_DIR` | `~/.deploy-state` | Where slot state and history are persisted |
| `HEALTH_TIMEOUT` | 300 | Seconds to wait for health checks |
| `HEALTH_INTERVAL` | 5 | Seconds between health check attempts |
| `DRY_RUN` | false | Set to `true` to skip executing commands |

## Common flags

| Flag | Description |
| ---- | ----------- |
| `--strategy blue-green` | Default; atomic switch with rollback slot kept warm |
| `--strategy canary` | Gradual traffic shift; good for production |
| `--strategy rolling` | In-place pod updates; used in k8s |
| `--no-rollback` | Disable automatic rollback on health-check failure |
| `--health-timeout 600` | Extend health-check window for slow warmups |

## Exit codes

| Code | Meaning |
| ---- | ------- |
| 0 | Success |
| 1 | Generic error (see logs) |
| 2 | Invalid arguments |
| 3 | Health check failed (with rollback) |
| 4 | Image pull failed |
