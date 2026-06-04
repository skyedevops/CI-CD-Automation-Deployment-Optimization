# CI/CD Automation & Deployment Optimization

Automated CI/CD pipelines for testing, deployment, and release workflows. This
project demonstrates a complete, production-grade delivery system that reduces
manual deployment effort and improves deployment consistency through repeatable,
auditable automation.

## Highlights

- **Continuous Integration** — Lint, multi-version unit tests, integration
  tests, security audit, and Docker smoke builds on every push and PR
- **Continuous Delivery** — Container image build, vulnerability scanning, and
  multi-environment deployment with environment-based approval gates
- **Continuous Deployment** — Zero-downtime blue-green and canary strategies
  with automatic rollback on health-check failure
- **Release Engineering** — Semantic versioning, automated changelog
  generation, and signed GitHub releases
- **Observability** — Structured JSON logging, liveness/readiness probes, and
  Prometheus-compatible metrics endpoints

## Architecture

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Source  │ ──> │   CI     │ ──> │ Registry │ ──> │  Deploy  │
│  (Git)   │     │ (Tests,  │     │ (Images) │     │ (Env)    │
└──────────┘     │  Lint,   │     └──────────┘     └──────────┘
                 │  Audit)  │            │               │
                 └──────────┘            v               v
                                     ┌──────────┐   ┌──────────┐
                                     │ Security │   │ Release  │
                                     │  Scan    │   │  Tag     │
                                     └──────────┘   └──────────┘
```

See [`docs/architecture/`](docs/architecture/) for a deeper dive.

## Repository layout

| Path | Purpose |
| ---- | ------- |
| `src/` | Application source code (Node.js/Express) |
| `tests/` | Unit and integration tests (Jest + Supertest) |
| `docker/` | Multi-stage Dockerfile and Compose definitions |
| `k8s/` | Kubernetes manifests (Deployment, Service, Ingress, HPA, PDB) |
| `scripts/deploy/` | Blue-green, canary, rolling, rollback, smoke tests |
| `scripts/release/` | Version bumping, changelog generation, release manifest |
| `scripts/build/` | Source-tree packaging and build verification |
| `.github/workflows/` | CI, build, deploy, release, dependency-update pipelines |
| `docs/` | Architecture, runbooks, and ADRs |

## Quick start

### Prerequisites

- Node.js 18, 20, or 22
- npm 9+
- Docker (for container builds)
- Bash (for deployment scripts)

### Run the app locally

```bash
npm install
npm start
# → http://localhost:3000
```

### Run tests

```bash
npm test              # all tests with coverage
npm run test:unit     # unit tests only
npm run test:integration   # integration tests only
```

### Build the container image

```bash
docker build -f docker/Dockerfile -t ci-cd-demo-app:dev --target production .
docker run --rm -p 3000:3000 ci-cd-demo-app:dev
```

### Deploy locally (blue-green)

```bash
docker compose -f docker/docker-compose.yml --profile blue-green up -d
bash scripts/deploy/smoke-test.sh --url http://localhost:3000
```

## CI/CD pipeline summary

| Workflow | Trigger | Purpose |
| -------- | ------- | ------- |
| `ci.yml` | push / PR | Lint, tests, security audit, Docker smoke build |
| `build.yml` | push to main / tags | Build & push container image, scan with Trivy |
| `deploy.yml` | push to main / tags / manual | Deploy to staging or production with strategies |
| `release.yml` | version tags | Build artifacts, generate changelog, publish release |
| `dependency-update.yml` | weekly schedule | Open PR with automated dependency bumps |

### Deployment strategies

The pipeline supports three deployment strategies, configurable per environment:

- **Blue-Green** — Run new version alongside old; switch traffic atomically;
  keep old running for instant rollback. *Default for staging.*
- **Canary** — Route a small percentage of traffic to new version, watch
  metrics, then promote. *Default for production.*
- **Rolling** — Update pods in-place with `maxUnavailable=0`. *Used for
  in-cluster updates.*

See `scripts/deploy/deploy.sh --help` for options.

### Approval gates

- `staging` environment: auto-approves on push to `main`
- `production` environment: requires manual approval (configured in
  repository settings under *Environments*)

### Automatic rollback

When `--rollback-on-failure` is set (default), the deploy script will
automatically restore the previous version if health checks fail within the
configured timeout.

## Environment configuration

Copy `.env.example` to `.env` and customize. All settings can be overridden at
runtime via environment variables; see `src/config/index.js` for the full list.

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `NODE_ENV` | `development` | Application environment |
| `PORT` | `3000` | HTTP port |
| `HOST` | `0.0.0.0` | Bind address |
| `LOG_LEVEL` | `info` | Log verbosity (error/warn/info/debug) |
| `LOG_FORMAT` | `combined` | morgan log format |
| `APP_VERSION` | `package.json` version | Injected by CI/CD |
| `GIT_SHA` | `unknown` | Injected by CI/CD |
| `SHUTDOWN_TIMEOUT_MS` | `10000` | Graceful shutdown timeout |

## Release process

1. **Bump version** (locally or via CI):
   ```bash
   npm run version:bump -- --type minor --tag
   ```
2. **Push the tag**:
   ```bash
   git push origin main --follow-tags
   ```
3. **CI/CD handles the rest** — runs full tests, builds image, generates
   changelog, creates GitHub release, and triggers production deployment.

## Operations

Operational runbooks (deployment, rollback, incident response) live in
[`docs/operations/`](docs/operations/).

Architecture Decision Records (ADRs) live in [`docs/adr/`](docs/adr/).

## Security

- Container images scanned with [Trivy](https://github.com/aquasecurity/trivy)
  on every build
- npm dependency audit runs in CI on every push
- Non-root user, read-only filesystem, dropped capabilities in containers
- Helmet security headers in application
- TLS termination at the ingress
- Secrets managed via environment-specific secret stores (never committed)

## Testing the pipeline locally

The CI pipeline can be reproduced locally with:

```bash
npm ci
npm run lint
npm test -- --ci --runInBand --coverage
docker build -f docker/Dockerfile --target test .
docker build -f docker/Dockerfile --target production .
```

## License

MIT
