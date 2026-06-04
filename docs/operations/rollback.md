# Runbook: Rollback

## When to roll back

- Health check failures after deploy
- Error rate spike in monitoring
- Performance regression detected
- Security issue discovered in new version
- User-reported regression in core functionality

## Automatic rollback

The deploy script automatically rolls back when `--rollback-on-failure` is set
(default) and health checks fail.

## Manual rollback (immediate)

### To the previous version

```bash
bash scripts/deploy/rollback.sh --env production
```

This will:
1. Read the second-most-recent image from the history file
2. Run a blue-green deploy with that image
3. Record the rollback event

### To a specific version

```bash
# Roll back to a specific image
bash scripts/deploy/rollback.sh \
  --env production \
  --to-image ghcr.io/example/ci-cd-demo-app:v1.2.2

# Roll back to a specific historical revision
bash scripts/deploy/rollback.sh \
  --env production \
  --to-revision 3
```

### Dry-run a rollback

```bash
bash scripts/deploy/rollback.sh \
  --env production \
  --to-revision 2 \
  --dry-run
```

## Post-rollback verification

```bash
# Quick health check
bash scripts/deploy/healthcheck.sh https://production.example.com

# Full smoke test
bash scripts/deploy/smoke-test.sh --url https://production.example.com --extended
```

## Communication

After a rollback, follow the [Incident Response](./incident-response.md)
playbook for stakeholder communication.

## History file

The rollback history is stored at:
```
~/.deploy-state/history-<env>.jsonl
```

Each line is a JSON record of a deployment or rollback event.

## Important notes

- Rollback deploys use the blue-green strategy by default, which keeps the
  current (problematic) version warm for 30 seconds in case you need to
  re-rollback
- State files are local to the machine running the deploy. In CI, state is not
  shared between runs. For production, integrate with a state backend (e.g.
  S3, etcd, Consul)
- The `--to-revision` numbering is 1-indexed: `1` is the most recent, `2` is
  the previous, etc.
