# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-06-04

### Features

- **ci**: automated CI/CD pipeline with lint, multi-version unit tests, integration tests, and security audit
- **ci**: multi-stage Docker build with BuildKit caching, SBOM, and provenance
- **ci**: container vulnerability scanning with Trivy
- **deploy**: blue-green deployment strategy with automatic rollback on health-check failure
- **deploy**: canary deployment strategy for production with configurable traffic percentage
- **deploy**: rolling update strategy for in-cluster updates
- **deploy**: comprehensive smoke tests with extended load testing mode
- **release**: semantic versioning with conventional commit-based changelog generation
- **release**: automated GitHub releases with tarball, SHA256 checksums, and metadata
- **release**: weekly automated dependency update PRs
- **observability**: structured JSON logging with levels and child loggers
- **observability**: liveness, readiness, and full health endpoints with system metrics
- **security**: non-root container user, read-only root filesystem, dropped capabilities
- **security**: Helmet security headers and content security policy
- **k8s**: production-ready manifests (Deployment, Service, Ingress, HPA, PDB)
- **docs**: architecture overview, runbooks (deploy, rollback, release, incident), and ADRs

### Infrastructure

- Multi-stage Dockerfile (`deps`, `test`, `production`) for cacheable, minimal images
- Docker Compose profiles for normal and blue-green local deployments
- GitHub Actions workflows: `ci`, `build`, `deploy`, `release`, `dependency-update`
- Deployment scripts: `deploy.sh`, `rollback.sh`, `smoke-test.sh`, `healthcheck.sh`
- Release scripts: `version-bump.js`, `generate-changelog.js`, `release-manifest.js`
- Build script: `build.js` for source tree packaging with build metadata
