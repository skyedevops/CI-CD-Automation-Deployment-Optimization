# ADR-001: Blue-Green as Default Deployment Strategy

## Status

Accepted (2026-01-15)

## Context

We need a deployment strategy that:

- Provides zero-downtime deployments
- Allows fast rollback
- Is straightforward to reason about
- Works with our existing infrastructure (Docker Compose, then k8s)

## Options considered

1. **Recreate** — Stop old, start new. Simple but has downtime.
2. **Rolling update** — Update pods in-place. No extra resources but slower
   rollback.
3. **Blue-Green** — Two full environments, atomic switch. Zero-downtime, fast
   rollback, but 2x resources during deploy.
4. **Canary** — Gradual traffic shift. Best for risk reduction, but more
   complex and needs good observability.

## Decision

Use **Blue-Green** as the default for staging and dev environments.
Use **Canary** for production deployments where blast radius matters.

## Consequences

- **Positive**: Zero-downtime, instant rollback, simple state model
- **Positive**: Same artifact promoted through environments
- **Negative**: 2x resource usage during deploy window
- **Negative**: Need a state file to track active slot
- **Mitigation**: For canary, the same scripts can drive the strategy with
  traffic-shifting proxies

## Notes

The state file approach (`~/.deploy-state/state.json`) is suitable for local
and CI-driven deploys. For multi-node production, a centralized state backend
(S3, etcd) should be used.
