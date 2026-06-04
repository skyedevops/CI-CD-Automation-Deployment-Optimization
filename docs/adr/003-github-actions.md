# ADR-003: GitHub Actions for CI/CD

## Status

Accepted (2026-02-01)

## Context

We need a CI/CD platform that:

- Is widely understood by the team
- Integrates with our Git repository
- Supports parallel jobs, matrix builds, and approval gates
- Has first-class container registry support
- Is cost-effective for a small team

## Options considered

- **GitHub Actions** — Tightly integrated, free for public repos, generous
  free tier for private
- **GitLab CI** — Powerful, but adds a separate platform to manage
- **CircleCI** — Mature, but pricing scales with users
- **Jenkins** — Maximum flexibility, but high operational overhead
- **Drone** — Lightweight, but smaller ecosystem

## Decision

Use **GitHub Actions** with these workflows:

- `ci.yml` — Continuous integration (lint, test, audit, build smoke)
- `build.yml` — Container build, scan, and publish
- `deploy.yml` — Environment-based deploys with approval gates
- `release.yml` — Version tag-driven releases
- `dependency-update.yml` — Weekly automated dependency bumps

## Consequences

- **Positive**: No new platform to learn or maintain
- **Positive**: Native OIDC for cloud authentication
- **Positive**: Reusable workflows, composite actions, and the broader
  marketplace
- **Positive**: Free for public repos
- **Negative**: Some features (e.g. self-hosted runners) require additional
  infrastructure
- **Negative**: Workflow syntax can be verbose

## Notes

We use `concurrency` groups to cancel superseded runs (saving CI minutes on
rapid pushes) and `if: always()` to summarize pipeline results in a single
final job.
