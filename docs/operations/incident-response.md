# Runbook: Incident Response

## Severity levels

| Level | Description | Response time | Examples |
| ----- | ----------- | ------------- | -------- |
| **SEV1** | Complete outage or data loss | < 15 min | 5xx errors, total unavailability |
| **SEV2** | Major degradation | < 1 hour | Slow responses, partial outage |
| **SEV3** | Minor issue | < 4 hours | Cosmetic bug, single endpoint down |
| **SEV4** | Cosmetic / info | Next business day | Log noise, minor UX issue |

## Response flow

```
1. Detect       →  Alerting / user report
2. Triage       →  On-call assesses severity
3. Mitigate     →  Rollback if user-facing
4. Investigate  →  Read logs, check recent deploys
5. Resolve      →  Fix forward or maintain rollback
6. Post-mortem  →  Document timeline and learnings
```

## Initial triage (first 5 minutes)

1. **Check the service**:
   ```bash
   bash scripts/deploy/healthcheck.sh https://production.example.com
   ```

2. **Check recent deploys**:
   ```bash
   cat ~/.deploy-state/history-production.jsonl | tail -5
   ```

3. **Check the running version**:
   ```bash
   curl -sS https://production.example.com/ | jq .version
   ```

4. **Check the active image**:
   ```bash
   jq -r '.active_image' ~/.deploy-state/state.json
   ```

## Mitigation: rollback

If the issue correlates with a recent deploy:

```bash
bash scripts/deploy/rollback.sh --env production
```

Verify the rollback with health and smoke tests:

```bash
bash scripts/deploy/healthcheck.sh https://production.example.com
bash scripts/deploy/smoke-test.sh --url https://production.example.com --extended
```

## Mitigation: rollback to a specific known-good version

If the previous version is also bad:

```bash
bash scripts/deploy/rollback.sh \
  --env production \
  --to-image ghcr.io/example/ci-cd-demo-app:v1.2.2
```

## Escalation

| Role | When to escalate |
| ---- | ---------------- |
| On-call engineer | Always for SEV1/SEV2 |
| Tech lead | SEV1 only |
| Engineering manager | SEV1 with > 30 min impact |
| Customer success | User-visible SEV1/SEV2 |
| Security | Any suspected security incident |

## Communication templates

### Internal status update

```
[SEV<N>] <one-line summary>

Impact: <what users are experiencing>
Status: <investigating | identified | mitigating | resolved>
Latest: <what was just done>
Next update: <time>
```

### Customer-facing

```
We're aware of an issue affecting <service>. Our team is investigating.
We'll provide an update in <timeframe>. Status: https://status.example.com
```

## Post-mortem (SEV1/SEV2)

Within 48 hours, write a post-mortem covering:

- **Timeline** — When detected, mitigated, resolved
- **Root cause** — What actually went wrong
- **Contributing factors** — Why our defenses didn't catch it
- **Action items** — Concrete follow-ups with owners and dates
- **What went well** — Be honest about wins too

Store post-mortems in `docs/postmortems/<date>-<slug>.md`.

## Common failure modes

| Symptom | Likely cause | First action |
| ------- | ------------ | ------------ |
| 5xx spike after deploy | Bad code in new version | Rollback |
| Slow responses | Resource exhaustion | Check `/health`, scale up |
| Health check failing | App crash loop | Check logs, consider rollback |
| DNS resolution failure | Ingress / DNS issue | Check ingress, cert-manager |
| Image pull errors | Registry auth, network | Verify credentials, network |
| Connection refused | Service down, port issue | Check pod status, service config |
