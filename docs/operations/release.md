# Runbook: Release

## Standard release process

1. **Develop on a feature branch** following the [branching strategy](#branching-strategy)
2. **Open a PR to `main`** — CI runs lint, tests, and security audit
3. **Merge the PR** — build workflow produces a container image
4. **Bump the version** on `main`:
   ```bash
   git checkout main
   git pull
   npm run version:bump -- --type minor --tag
   git push origin main --follow-tags
   ```
5. **CI handles the rest**:
   - Full test suite runs
   - Source tarball is built and hashed
   - Changelog is generated from conventional commits
   - GitHub release is published with artifacts
   - Production deployment is triggered (after approval)

## Versioning policy

We follow [Semantic Versioning 2.0.0](https://semver.org/):

- **MAJOR** — Breaking API changes
- **MINOR** — New features, backward-compatible
- **PATCH** — Bug fixes, backward-compatible
- **Pre-release** — `-alpha.N`, `-beta.N`, `-rc.N` for testing releases

## Bump types

```bash
# Bug fix release: 1.0.0 → 1.0.1
npm run version:bump -- --type patch --tag

# New feature: 1.0.1 → 1.1.0
npm run version:bump -- --type minor --tag

# Breaking change: 1.1.0 → 2.0.0
npm run version:bump -- --type major --tag

# Pre-release: 1.0.0 → 1.1.0-alpha.0
npm run version:bump -- --type preminor --preid alpha --tag

# Custom identifier
npm run version:bump -- --type preminor --preid rc --tag
```

## Conventional commits

Changelog generation parses commit messages. Use one of these prefixes:

| Prefix | Category |
| ------ | -------- |
| `feat` | Features |
| `fix` | Bug Fixes |
| `perf` | Performance |
| `refactor` | Code refactoring |
| `docs` | Documentation |
| `test` | Tests |
| `build` | Build system |
| `ci` | CI/CD |
| `chore` | Chores |
| `revert` | Reverts |

A scope in parentheses is supported: `feat(api): add /v2 endpoint`

## Manual changelog generation

```bash
# Generate for a specific version (writes to docs/CHANGELOG.md)
node scripts/release/generate-changelog.js \
  --version 1.2.3 \
  --from v1.2.2 \
  --to HEAD \
  --write

# Print to stdout
node scripts/release/generate-changelog.js --version 1.2.3
```

## Branching strategy

```
main          ──●──────●──────────●──── (releases, hotfixes)
                \      /          /
feature/xyz    ──●────●          /
                             /
develop        ───────────●─● (integration, optional)
```

- `main` is always deployable
- Feature branches: `feature/<short-desc>` or `fix/<short-desc>`
- Hotfixes: branch from a tag, fix, tag, merge back

## Pre-release

For testing releases:

```bash
npm run version:bump -- --type prerelease --preid rc --tag
# Creates: 1.2.3-rc.0
```

The CI marks these as GitHub pre-releases and skips the production deploy.

## Hotfix process

For critical production issues:

1. Branch from the affected tag: `git checkout -b hotfix/critical-fix v1.2.3`
2. Make the minimal fix
3. Run tests locally
4. Bump patch version with `--tag`
5. Push the branch and tag
6. Open a PR to `main` — production approval gate will require sign-off
7. After merge, the fix version is automatically deployed

## Release artifacts

Each release produces:

- `ci-cd-demo-app-<version>.tar.gz` — source tree
- `SHA256SUMS` — checksums for verification
- `BUILD_INFO.json` — git SHA, build date, platform info (in dist)
- Container image at `ghcr.io/<org>/<repo>:v<version>`

## Verification

```bash
# Verify a downloaded release
curl -L https://github.com/<org>/<repo>/releases/download/v1.2.3/SHA256SUMS
sha256sum -c SHA256SUMS
```
