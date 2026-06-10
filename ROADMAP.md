# Project Roadmap

> **Status:** v1.0.0 released — core pipeline complete
> **Next milestone:** v1.1.0 — Observability & Reliability
> **Maintenance window:** Every Monday 06:00 UTC (dependency-update workflow)

---

## Phase 0 — Immediate (This Sprint)

| Item | Owner | Effort | Notes |
| --- | --- | --- | --- |
| Add `renovate.json` for fine-grained dependency scheduling | Platform | 1h | Supersedes `dependency-update.yml` |
| Wire `trivy` SARIF upload to CodeQL dashboard | Security | 30m | Already in `build.yml`; needs repo config |
| Document `STATE_DIR` migration to S3 in `lib.sh` | Platform | 1h | See ADR-001 footnote |
| Add `package-lock.json` to git (already done) | — | — | Prevents lockfile drift |

---

## Phase 1 — Observability & Reliability (v1.1.0)

**Target:** 2 weeks

### 1.1 Metrics & Tracing
- [ ] Add OpenTelemetry SDK to app (`@opentelemetry/api`, `@opentelemetry/sdk-node`)
- [ ] Export traces to OTLP endpoint (Jaeger/Tempo)
- [ ] Add `/metrics` endpoint (Prometheus format) with:
  - HTTP request latency (p50/p95/p99)
  - Error rate by endpoint
  - Active request gauge
  - Node.js event loop lag
- [ ] Add Grafana dashboard JSON to `docs/dashboards/`
- [ ] Add alerting rules (PrometheusRule CRD) for:
  - `error_rate > 1%` for 5m
  - `p99_latency > 500ms` for 5m
  - `up == 0` for 1m

### 1.2 Log Aggregation
- [ ] Ship JSON logs to Loki via Promtail (DaemonSet)
- [ ] Add structured log query examples to `docs/operations/`
- [ ] Correlate trace ID in logs (W3C trace-context)

### 1.3 Health Check Hardening
- [ ] Add dependency health checks to `/health/ready` (DB, Redis, upstream APIs)
- [ ] Implement startup probe separate from liveness/readiness
- [ ] Add circuit-breaker pattern for outbound calls

---

## Phase 2 — Developer Experience (v1.2.0)

**Target:** 3 weeks

### 2.1 Local Development
- [ ] Add `devcontainer.json` for VS Code Remote Containers
- [ ] Add `tilt.dev` or `skaffold.yaml` for live-reload in k8s
- [ ] Add `make` targets: `make test`, `make build`, `make deploy-staging`
- [ ] Pre-commit hooks (husky + lint-staged)

### 2.2 PR Experience
- [ ] Add GitHub Actions workflow status badges to README
- [ ] Add PR template with checklist (tests, docs, changelog)
- [ ] Auto-assign reviewers via `CODEOWNERS`
- [ ] Add "deploy preview" comment on PRs (ephemeral environment)

### 2.3 Debugging
- [ ] Add `kubectl debug` profile to deployment
- [ ] Document `kubectl port-forward` + `curl` patterns
- [ ] Add `stern` / `kubetail` logging snippets

---

## Phase 3 — Security Hardening (v1.3.0)

**Target:** 2 weeks

### 3.1 Supply Chain
- [ ] Sign images with `cosign` (keyless via GitHub OIDC)
- [ ] Verify signatures in `deploy.yml` before deploy
- [ ] Add SLSA Level 2 provenance (build.yml already has SBOM/provenance)
- [ ] Pin base image digests in Dockerfile (`FROM node:20-alpine@sha256:...`)

### 3.2 Runtime
- [ ] Add `seccomp` profile to k8s deployment
- [ ] Drop `NET_RAW` capability (not needed)
- [ ] Add `apparmor` profile (optional)
- [ ] Scan for secrets in CI (`trufflehog` or `gitleaks`)

### 3.3 Compliance
- [ ] Add `policy/rego` for OPA Gatekeeper (e.g., "no privileged pods")
- [ ] Generate `cyclonedx` SBOM in addition to SPDX
- [ ] Document CVE triage process in `docs/operations/security.md`

---

## Phase 4 — Multi-Environment & Scaling (v1.4.0)

**Target:** 4 weeks

### 4.1 Environment Parity
- [ ] Add `staging` namespace with identical k8s manifests (kustomize overlays)
- [ ] Add `preview` namespace per PR (ephemeral, TTL 4h)
- [ ] Implement environment-specific ConfigMaps/Secrets
- [ ] Add canary analysis via Flagger or Argo Rollouts

### 4.2 GitOps
- [ ] Migrate k8s manifests to ArgoCD or Flux
- [ ] Remove `kubectl apply` from `deploy.sh`; let GitOps controller sync
- [ ] Add `Application` CR for each environment
- [ ] Implement progressive delivery (canary → stable promotion automated)

### 4.3 Scale
- [ ] Add pod disruption budget for zero-downtime upgrades
- [ ] Add vertical pod autoscaler (VPA) for right-sizing
- [ ] Add cluster autoscaler integration
- [ ] Load test with `k6` (target: 10k RPS sustained)

---

## Phase 5 — Platform Features (v2.0.0)

**Target:** 6-8 weeks

### 5.1 Self-Service
- [ ] Internal developer portal (Backstage or custom)
- [ ] "Create new service" scaffolding (cookiecutter template)
- [ ] Service catalog with ownership, docs, metrics links
- [ ] One-click rollback UI

### 5.2 Multi-Service
- [ ] Shared library for common middleware (auth, logging, tracing)
- [ ] Contract testing (Pact) between services
- [ ] Service mesh (Istio/Linkerd) for mTLS and traffic splitting
- [ ] Distributed tracing across services

### 5.3 Data & State
- [ ] Add PostgreSQL with managed instance (Cloud SQL / RDS)
- [ ] Add Redis for caching/sessions
- [ ] Database migration strategy (golang-migrate or similar)
- [ ] Backup/restore runbooks

---

## Backlog (Unscheduled)

| Idea | Value | Effort |
| --- | --- | --- |
| Chaos engineering (Litmus/Gremlin) | High | Medium |
| Feature flags (LaunchDarkly/Unleash) | Medium | Medium |
| Cost allocation tags on k8s resources | Medium | Low |
| DR drill (region failover) | High | High |
| SBOM vulnerability alerting (Dependabot + Trivy) | Medium | Low |
| Automated perf regression detection | Medium | Medium |
| Blue-green DB migrations | High | High |
| Policy-as-code for deploy gates | Medium | Medium |

---

## Release Cadence

| Channel | Trigger | Version bump |
| --- | --- | --- |
| `patch` | Bug fix, doc update | Weekly or as needed |
| `minor` | New feature, non-breaking | Bi-weekly |
| `major` | Breaking change, architecture shift | Quarterly |

All releases go through `release.yml` workflow. Pre-releases (`-rc.N`) for major versions.

---

## Decision Log (Architecture Decisions)

| ADR | Title | Status | Date |
| --- | --- | --- | --- |
| 001 | Blue-Green as Default Deployment Strategy | Accepted | 2026-01-15 |
| 002 | Multi-Stage Docker Build | Accepted | 2026-01-20 |
| 003 | GitHub Actions for CI/CD | Accepted | 2026-02-01 |
| 004 | Observability Stack: OTel + Prometheus + Loki | Proposed | — |
| 005 | GitOps with ArgoCD | Proposed | — |
| 006 | Supply Chain Signing with Cosign | Proposed | — |

New ADRs follow `docs/adr/NNN-title.md` template.

---

## Success Metrics (v1.0 → v2.0)

| Metric | v1.0 Baseline | v2.0 Target |
| --- | --- | --- |
| Deploy frequency | 1/day | 10/day |
| Lead time (commit → prod) | 15 min | 5 min |
| Change failure rate | Unknown | < 5% |
| MTTR (rollback) | ~2 min | < 30 sec |
| Deploy rollback rate | Unknown | < 2% |
| Developer NPS (deploy experience) | N/A | > 8/10 |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| GitHub Actions outage | Low | High | Self-hosted runner pool as backup |
| Base image CVE spike | Medium | Medium | Weekly dependency-update + Trivy |
| State file loss (blue-green) | Medium | High | Migrate to S3 (Phase 1.1) |
| Knowledge silo (single maintainer) | High | High | Document everything; pair on changes |
| Scale ceiling (single-node CI) | Low | Medium | Self-hosted runners or GitHub larger runners |

---

## Communication

- **Weekly sync:** Monday 10:00 UTC (15 min) — review roadmap, blockers
- **Incident review:** Within 48h of SEV-1/2 — update runbooks
- **Architecture review:** First Friday of month — ADR proposals
- **Demo day:** End of each phase — stakeholder walkthrough

---

*Roadmap is a living document. Update at each milestone. Last updated: 2026-06-04*