# Architecture

## Goals

- **Repeatability** — Every deployment is identical, regardless of who triggers it
- **Auditability** — Every change is tied to a commit, a tag, and an actor
- **Recoverability** — Rollback is fast and automatic on failure
- **Speed** — Parallel jobs, cached layers, fast feedback to developers
- **Safety** — No production deployment without passing checks and approvals

## Pipeline stages

### 1. Continuous Integration (`.github/workflows/ci.yml`)

Runs on every push and PR to `main` and `develop`. Six parallel jobs:

- **Lint** — `eslint` and `prettier --check`
- **Unit tests** — Jest across Node 18, 20, 22 (matrix)
- **Integration tests** — Supertest against full Express app
- **Security audit** — `npm audit --audit-level=high`
- **Docker smoke** — Build the production image
- **Pipeline summary** — Gate on all of the above

Concurrency groups cancel in-progress runs when a new commit is pushed to the
same branch, saving CI minutes.

### 2. Build & publish (`.github/workflows/build.yml`)

Runs on push to `main` and on version tags. Produces a versioned container
image:

- Extracts Docker metadata (semver tags, OCI labels)
- Builds with BuildKit cache from GitHub Actions cache
- Generates SBOM and provenance attestations
- Pushes to `ghcr.io/<org>/<repo>` with multiple tags
- Runs Trivy vulnerability scan
- Uploads a build manifest artifact for downstream jobs

### 3. Deploy (`.github/workflows/deploy.yml`)

Resolves target environment, then deploys:

- **Staging** — automatic on every push to `main`; uses blue-green strategy
- **Production** — triggered by version tags or manual dispatch; uses canary
  strategy and requires environment approval

Both paths run post-deploy smoke tests and capture a deployment record.

### 4. Release (`.github/workflows/release.yml`)

Triggered by version tags (`v*.*.*`):

- Validates semver format
- Runs full test suite
- Builds source tarball with SHA256 checksums
- Generates changelog from conventional commits
- Creates GitHub release with artifacts attached

## Deployment strategies in detail

### Blue-Green

```
                ┌──────────┐
   traffic ───> │  Router  │
                └────┬─────┘
            ┌────────┴────────┐
            ▼                 ▼
       ┌────────┐        ┌────────┐
       │ Blue   │        │ Green  │
       │ (old)  │        │ (new)  │
       └────────┘        └────────┘
```

1. Determine inactive slot (alternate from current)
2. Start new version in inactive slot
3. Health check until ready
4. Switch router to point to new slot
5. Tear down old slot (keep warm for fast rollback)
6. Persist state for next deploy

**Pros**: zero-downtime, instant rollback
**Cons**: 2x resource usage during deploy

### Canary

```
   traffic ───> ┌──────────┐
                │  Router  │
                └────┬─────┘
              90%   │  10%
                ┌───┴────┐
                ▼        ▼
           ┌────────┐  ┌────────┐
           │Stable  │  │Canary  │
           │ (old)  │  │ (new)  │
           └────────┘  └────────┘
```

1. Start canary container with 10% of traffic
2. Health check + metric observation window
3. Promote canary → stable
4. Scale down old version

**Pros**: validates under real traffic with limited blast radius
**Cons**: more complex, needs good observability

### Rolling

In-place pod replacement with `maxUnavailable=0`. Used for in-cluster updates
where blue-green infrastructure isn't available.

## State persistence

Blue-green deployments track the active slot in
`~/.deploy-state/state.json`. The rollback script reads the deployment history
from `~/.deploy-state/history-<env>.jsonl` to find the previous good image.

In CI, state is intentionally not persisted across runs (each workflow
deployment starts fresh). For production blue-green deployments, a persistent
state backend (e.g. S3, etcd, or the cluster itself) should be used.

## Observability

- **Structured JSON logs** to stdout (parsed by Docker / k8s log collectors)
- **Liveness probe** at `/health/live` — process is alive
- **Readiness probe** at `/health/ready` — process can serve traffic
- **Full health dump** at `/health` — memory, CPU, version, git SHA
- **Prometheus annotations** in k8s manifests for scraping `/health`

## Security model

| Layer | Control |
| ----- | ------- |
| Code | ESLint, secret scanning (out of scope here) |
| Dependencies | `npm audit`, weekly automated update PR |
| Build | Pinned base image, multi-stage, BuildKit SBOM/provenance |
| Image | Trivy scan on every build (CRITICAL/HIGH) |
| Container | Non-root user, read-only FS, dropped caps |
| Network | TLS at ingress, security headers (helmet) |
| Deploy | Environment-based approval gates |

## Failure modes & mitigations

| Failure | Detection | Mitigation |
| ------- | --------- | ---------- |
| Flaky test | CI matrix fails | Re-run, fix root cause |
| Vulnerable dep | `npm audit` | Auto-PR or manual fix |
| Bad image | Trivy scan | Block deploy |
| Bad deploy | Health check timeout | Auto-rollback |
| Bad production deploy | Canary metrics | Promote only on green metrics |
| Lost deploy state | State file missing | Fall back to last-known good from history file |
