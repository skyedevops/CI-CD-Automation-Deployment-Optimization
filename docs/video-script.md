# Video Script: Building a Production CI/CD Pipeline

> **Format:** Talking-head + screen recording + diagrams
> **Target length:** ~22 minutes
> **Audience:** Engineers setting up or improving a CI/CD pipeline
> **Repo reference:** `/workspaces/CI-CD-Automation-Deployment-Optimization`

---

## Pre-production checklist

- [ ] Slides for diagrams (Mermaid → PNG export)
- [ ] Local clone of the repo with a clean working tree
- [ ] Recording set to 1920×1080, terminal font size bumped 2-3 steps
- [ ] `node src/server.js` running in one terminal for live demo
- [ ] Test browser tab open to `http://localhost:3000/health`
- [ ] Code editor with split view: source on left, file tree on right
- [ ] Slack/Discord muted, notifications off

---

# SLIDE 1 — Title Card (0:00)

**On screen:** "Building a Production CI/CD Pipeline" / "From push to production in four minutes"
**B-roll:** Slow pan over the `tree` output of the project
**Music:** Subtle, lo-fi, 5 seconds then ducked

---

## INTRO (0:05 – 1:00)

**[Looking at camera]**

> "Every team eventually hits the same wall. You have an app. You have a repo.
> Now you need to ship it without paging someone at 2 AM. So you write a deploy
> script. Then you wrap it in CI. Then you wrap the CI in a runner. Then
> someone says 'we need rollback' and you're reinventing Kubernetes at 11 PM
> on a Friday.
>
> This is the build I wish I'd had three jobs ago. A complete CI/CD pipeline
> for a Node.js service that takes a commit and ships it to production with
> zero manual steps — but with the safety rails that stop a bad commit from
> waking anyone up.
>
> We're going to walk through every file, every workflow, and every decision.
> By the end, you'll know what each piece does *and* why I made the
> trade-offs I did."

**On screen:** Project name and link to repo
**B-roll:** 3-second fly-through of folders

---

# SLIDE 2 — The Goals (1:00 – 2:30)

**[Screen: high-level diagram]**

```
commit  →  test  →  build  →  scan  →  deploy  →  release
```

> "Before I wrote a single file, I wrote down six constraints. Every
> decision in this build is traceable to one of these."

**On screen, bullet by bullet:**

1. **Repeatability** — every deploy is byte-identical
2. **Auditability** — every change ties to a commit, a tag, and an actor
3. **Recoverability** — rollback is fast, automatic, and tested
4. **Speed** — parallel jobs, cached layers, fast feedback
5. **Safety** — no prod deploy without passing checks and approvals
6. **Low ops overhead** — no separate platform to maintain

> "Constraint six is the one I almost violated. The team is small. We don't
> want a Jenkins server in a closet. We don't want a separate CI vendor. So
> we live inside the GitHub ecosystem. That's an ADR-003 decision — and
> we'll come back to the trade-offs."

**Visual:** ADR file flickers past quickly: `docs/adr/003-github-actions.md`

---

# SECTION 1 — The Demo App (2:30 – 5:00)

**[Screen: editor, side-by-side with file tree]**

> "I needed something real to ship. A `hello-world.js` doesn't exercise the
> pipeline, and a Rails app would distract from the pipeline. So I picked
> Express — small surface, well-known, and fast to containerize."

**Walk through `src/server.js` (5 minutes per view):**

> "Look at what this app does. It has a `/health/live` probe, a
> `/health/ready` probe, and a full `/health` dump that returns memory and
> CPU stats. That's three separate probes because the orchestrator needs to
> know three different things: is the process alive, can it serve traffic,
> and what's its state.
>
> I used `helmet` for security headers. I disabled `x-powered-by`. I set
> `trust proxy` because we terminate TLS at the ingress and need accurate
> client IPs in the request log.
>
> The graceful-shutdown handler is the bit most people forget. When k8s
> sends SIGTERM, we have 10 seconds to drain in-flight requests before the
> `force shutdown` timer fires. Without this, you get truncated responses
> on rolling deploys."

**Trade-off callout (on screen):**

> "**Trade-off: Express vs Fastify.** Fastify is ~3x faster and has
> built-in JSON schema validation. I picked Express because every dev on
> the planet can read it in 10 seconds. For a *demo* project that teaches
> pipeline, the cognitive load of the framework should be zero."

**Run the test suite live:**

```bash
npm test
```

> "42 tests. All green. Two seconds. The unit tests run against the
> service modules in isolation. The integration tests boot the actual
> Express app and hit it with `supertest`. No mocking of the framework —
> if `helmet` is misconfigured, the integration test catches it."

---

# SECTION 2 — Multi-Stage Docker (5:00 – 8:00)

**[Screen: split view of `docker/Dockerfile` and a rendered diagram]**

> "This Dockerfile has three stages. Most teams have one. Let me explain
> why three is worth the complexity."

**Stage by stage:**

**Stage 1: `deps`**

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund
```

> "Stage one is dependency installation. The critical thing here is the
> `COPY` order. By copying *only* the lockfile before `npm ci`, the layer
> is cached and reused as long as the dependencies don't change. If I'd
> done `COPY . .` first, every code change would bust this layer and we'd
> reinstall node_modules on every build."

**Stage 2: `test`**

> "Stage two runs the test suite as part of the *Docker build itself*. This
> is the single most underrated CI pattern. The test stage guarantees that
> the image you publish is one that passed tests on the exact same base
> image your tests ran against. No 'works on my machine' between CI and
> production."

**Stage 3: `production`**

> "Stage three is the one that ships. It installs *only* production deps
> with `npm ci --omit=dev`, copies the source, switches to a non-root user
> named `nodejs`, drops all Linux capabilities, mounts the root filesystem
> read-only, and adds a healthcheck that hits `/health/live`.
>
> The result is an image that is small, runs as nobody, and refuses to
> start if it can't prove it's healthy."

**On screen: `docker images` showing sizes**

```
ci-cd-demo-app:dev   148 MB    # 3-stage
ci-cd-demo-app:single 423 MB   # 1-stage baseline
```

**Trade-off callout:**

> "**Trade-off: Alpine vs distroless vs full Debian.** Alpine gives a small
> image but uses musl libc, which occasionally breaks Node native modules.
> distroless is the gold standard for security but is harder to debug. I
> picked Alpine here because the demo has no native deps. For a real
> production service, I'd revisit this when adding things like `bcrypt` or
> `sharp`."

---

# SECTION 3 — The CI Workflow (8:00 – 11:00)

**[Screen: `.github/workflows/ci.yml` open in editor]**

> "This is the part that runs on every push and every PR. Six jobs. Most
> of them run in parallel. Let me walk through each."

```yaml
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
```

> "First — concurrency. This is the cheapest optimization in CI. When a
> developer pushes three commits in a row, the first two runs are wasted.
> `cancel-in-progress: true` kills the older run as soon as a newer one
> starts. The `${{ github.ref }}` means each branch gets its own
> concurrency group, so a push to `develop` doesn't cancel a PR build."

**Job 1: Lint**

> "ESLint and Prettier. Two minutes. The format check matters because
> `lint --fix` would change behavior in CI versus local. If we wanted
> formatting enforced, we have to fail on it. So we do."

**Job 2: Unit tests (matrix)**

```yaml
strategy:
  matrix:
    node-version: [18, 20, 22]
```

> "Matrix build across three Node versions. This catches the
> 'works-on-Node-20-dies-on-Node-22' class of bugs before they reach
> anyone. Three matrix slots × 30 seconds = 90 seconds of CI time, but
> the alternative is a production incident that costs 90 minutes."

**Trade-off callout:**

> "**Trade-off: matrix vs single-version.** I get pushback on this a lot.
> 'We're not a library, why test against three versions?' Answer:
> because your OS upgrade, your base image bump, or your Lambda runtime
> will eventually move you to a newer Node. Testing against the version
> you're *on* is the same as testing against the version you'll be on
> next year — which is what matrix gives you for free."

**Job 3: Integration tests**

> "These run *after* lint and unit. The `needs:` keyword creates a job
> dependency. If lint fails, integration never starts. This is
> intentional — we want the cheapest failing job to fail first, so the
> developer learns about it fastest."

**Job 4: Security audit**

> "`npm audit --audit-level=high`. The `high` threshold means we block on
> real risk, not on transitive dev-dep noise. There is a separate weekly
> workflow that opens a PR with the noise, so it doesn't get lost."

**Job 5: Docker smoke**

> "This builds the production image without pushing it. It's a 'can the
> image even be built' gate. We don't run the full container test inside
> CI — that's what staging is for — but we do want to know if our
> Dockerfile or dependencies are broken at the build-step level."

**Job 6: CI summary**

```yaml
ci-success:
  needs: [lint, unit-tests, integration-tests, security-audit, docker-smoke]
  if: always()
```

> "A final job that only succeeds if *all* the others did. The
> `if: always()` is critical — it runs even when upstream jobs fail, so
> we get a single success/fail signal at the branch-protection level.
> GitHub doesn't let you require 'all of these five things' in branch
> protection; it lets you require 'this one job'. So we make that one
> job the rollup."

---

# SECTION 4 — Build & Publish (11:00 – 14:00)

**[Screen: `.github/workflows/build.yml`]**

> "The CI workflow proves the code is good. The build workflow produces
> the artifact. These are deliberately separate so we can rerun one
> without the other."

**Walk through the build job:**

```yaml
- uses: docker/metadata-action@v5
  with:
    tags: |
      type=ref,event=branch
      type=ref,event=pr
      type=semver,pattern={{version}}
      type=sha,format=short
```

> "This action computes the image tags automatically. A push to `main`
> gets `main-<sha>`. A tag `v1.2.3` gets `1.2.3`, `1.2`, and `1.2.3-<sha>`.
> A PR gets a throwaway tag that never gets pushed to the registry.
> This is the single best ROI tag-derivation pattern in the Docker
> ecosystem."

```yaml
provenance: true
sbom: true
```

> "Two flags that didn't exist three years ago and are now free. SBOM
> is a software bill of materials — a list of every package in the
> image. Provenance is a signed attestation that says 'this image was
> built from this commit by this action on this runner'. For compliance
> work, these are gold. For everyone else, they're free defense in
> depth."

```yaml
- uses: aquasecurity/trivy-action@0.20.0
  with:
    image-ref: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}@${{ needs.build.outputs.image-digest }}
    severity: 'CRITICAL,HIGH'
```

> "Trivy scans the pushed image. The `image-digest` reference is
> important — we scan the *exact* image by SHA256, not by tag, so a
> subsequent tag-mutation can't fool us. Severity is restricted to
> CRITICAL and HIGH so we don't fail the build on medium issues that
> need human triage."

**Trade-off callout:**

> "**Trade-off: Trivy vs Grype vs Snyk.** Trivy is free, fast, and
> covers OS packages, language packages, and IaC. Snyk has a better
> UI and a richer vuln database, but costs money and adds a vendor.
> For a small team, Trivy is the right call. For an enterprise with
> compliance needs, Snyk pays for itself."

---

# SECTION 5 — Deployment Strategies (14:00 – 18:00)

**[Screen: `scripts/deploy/deploy.sh` open, terminal on the right]**

> "This is where the pipeline gets interesting. We have three
> strategies: blue-green, canary, and rolling. The same script drives
> all three. The trade-off is *how much risk you take per deploy*."

### Blue-Green

**[Diagramming slide]**

```
             Router
            /      \
           ▼        ▼
       ┌──────┐  ┌──────┐
       │ Blue │  │Green │
       │ old  │  │ new  │
       └──────┘  └──────┘
```

> "Blue-green runs two full copies of your service. You start the new
> version in the *inactive* slot, health-check it, then flip the
> router. If the new version is bad, you flip back. The old version
> stays warm for a few minutes in case you need to flip back *again*.
>
> The cost is 2x compute during deploy. The benefit is zero-downtime
> and sub-second rollback."

**Show the code path:**

```bash
deploy_blue_green() {
  new_slot=$(determine_slot)        # alternate
  # ... start new slot ...
  if ! health_check "http://127.0.0.1:${new_port}/health/live"; then
    cleanup_slot "$new_slot"        # tear it down
    exit 1
  fi
  # switch traffic, save state, clean up old slot
}
```

> "The state file at `~/.deploy-state/state.json` remembers which
> slot is active. That's how `determine_slot` knows to alternate.
> In CI, this file is per-run, so it resets each deploy. In a long-lived
> environment, you'd back this with S3 or etcd — but the contract is
> the same."

### Canary

> "Canary runs the new version with a small percentage of real
> traffic, watches the metrics, then promotes. In this demo, canary
> is implemented as a separate container that takes traffic on a
> different port. In a real k8s setup, you'd use Istio or a service
> mesh to do the percentage split. The script is structured so the
> strategy is swappable."

### Rolling

> "Rolling is the k8s default — `maxSurge: 1, maxUnavailable: 0` in
> the Deployment manifest. Replace one pod at a time. No extra
> resources, but slower and harder to roll back atomically."

**Trade-off callout:**

> "**Trade-off: blue-green vs canary vs rolling.**
>
> | Strategy | Downtime | Rollback | Resource cost | Risk surface |
> | --- | --- | --- | --- | --- |
> | Recreate | Yes | Slow | 1x | Whole fleet |
> | Rolling | None | Slow | 1.25x | Per pod |
> | Blue-Green | None | Instant | 2x | Whole fleet |
> | Canary | None | Fast | 1.1x | 10% of users |
>
> I picked **blue-green for staging, canary for production**. Staging
> is where you want to *prove* the new version works end-to-end, so
> you want the full traffic. Production is where you want to *limit
> the blast radius*, so you want canary. This is encoded in
> `.github/workflows/deploy.yml` lines that pick the strategy based
> on the target environment."

### Rollback

**[Screen: `scripts/deploy/rollback.sh`]**

> "Rollback is a deploy in reverse. It reads the second-to-last
> entry from the history file and runs blue-green with that image.
> The history file is append-only — every deploy and rollback writes
> a line, so we always have a record."

**Show `~/.deploy-state/history-production.jsonl`:**

```jsonl
{"action":"deploy","image":"v1.2.3",...}
{"action":"deploy","image":"v1.2.4",...}
{"action":"rollback","from":"v1.2.4","to":"v1.2.3",...}
```

**Trade-off callout:**

> "**Trade-off: file-based state vs S3 vs etcd.** File-based is
> simple and works for a single deploy runner. It doesn't work for
> multiple runners, doesn't survive disk loss, and doesn't scale to
> multi-region. The migration path is straightforward: replace
> `read_state` and `write_state` in `lib.sh` with an S3 client. The
> calling code doesn't change."

---

# SECTION 6 — Release Engineering (18:00 – 20:30)

**[Screen: `scripts/release/` files, then `.github/workflows/release.yml`]**

> "Releases are a workflow, not a ceremony. The release script does
> four things, in order."

1. **Validate semver** — fail loudly if the tag is `v1.2` instead of `v1.2.3`
2. **Run the full test suite** — no skipping
3. **Build artifacts** — source tarball with `BUILD_INFO.json` and `SHA256SUMS`
4. **Generate changelog** — by parsing conventional commits

> "The version bump script is a counterpart — it's the local tool
> that *creates* the tag."

```bash
npm run version:bump -- --type minor --tag
```

> "The `--tag` flag means it creates both a commit and an annotated
> tag. The CI picks up the tag push and triggers `release.yml`,
> which in turn calls the GitHub API to create a release with the
> tarball attached."

**Trade-off callout:**

> "**Trade-off: conventional commits vs ad-hoc messages.** I used
> to think conventional commits were overkill. Then I spent an
> afternoon manually curating a changelog for a project with 200
> PRs and swore off ad-hoc messages forever. The discipline costs
> you 5 seconds per commit. The payoff is a changelog that writes
> itself and a history that's actually queryable. `git log
> --grep='^feat'` becomes a meaningful query."

---

# SECTION 7 — The Trade-offs I Didn't Pick (20:30 – 21:30)

**[Looking at camera, slide with bullet list]**

> "Things I considered and rejected."

- **Jenkins / Drone / CircleCI** — operational overhead for a small team that lives in GitHub
- **Helm / Kustomize for k8s manifests** — adds tooling; plain YAML is fine for this scope
- **ArgoCD / Flux for GitOps** — great tool, but a separate control plane to operate
- **Terraform for infrastructure** — out of scope for a build-process demo
- **Service mesh (Istio/Linkerd) for canary** — too heavy for the demo; the script is structured to be replaceable
- **OPA / policy-as-code** — `npm audit` and Trivy are good enough for now
- **Postgres / Redis** — no state, no need
- **TypeScript** — would have doubled the surface area; this is a *pipeline* demo, not a TS tutorial

> "Every one of these is the *right* choice for some team. None of
> them is the right choice for *this* build."

---

# OUTRO (21:30 – 22:00)

**[Looking at camera]**

> "If you take one thing from this video, take this: the value of a
> CI/CD pipeline is not the cleverness of the deploy strategy. It's
> the ratio of *time spent thinking about deployment* to *time
> spent shipping features*. The build you just saw is the lowest
> ratio I could achieve while still having rollback, scanning,
> approvals, and a clean audit trail.
>
> The repo is linked below. The ADRs in `docs/adr/` explain the
> rejected alternatives in more detail. The runbooks in
> `docs/operations/` are the documents you'll actually need at 2 AM.
>
> Thanks for watching. Ship something."

**On screen:** Repo URL, link to `docs/adr/`, link to `docs/operations/`
**Music:** Bed fades in for 5 seconds

---

# Post-production notes

## B-roll shot list

| Timestamp | Shot |
| --- | --- |
| 0:00 | Slow pan over `tree` of the project |
| 0:05 | Title card with subtle motion |
| 1:00 | Animated Mermaid diagram of pipeline stages |
| 2:30 | File tree expanding into `src/` |
| 5:00 | Three-stage Dockerfile with stage boundaries highlighted |
| 5:30 | `docker images` output showing size comparison |
| 8:00 | GitHub Actions UI screenshot of CI run with parallel jobs |
| 11:00 | GHCR page showing image with multiple tags |
| 14:00 | Animated blue-green diagram with traffic flipping |
| 14:30 | Canary diagram with traffic split visualization |
| 18:00 | Terminal showing version-bump output |
| 20:30 | Slide with rejected options |

## Code-on-screen timings

| Code block | On-screen time | Why |
| --- | --- | --- |
| `package.json` scripts | 30s | Reference for npm commands |
| Multi-stage Dockerfile | 90s | Walk through each stage |
| CI workflow concurrency | 20s | Highlight the optimization |
| `deploy.sh` blue-green path | 60s | The core deploy logic |
| `version-bump.js` semver logic | 30s | Show the math |
| k8s HPA | 20s | Quick visual |

## Diagrams to pre-render

1. **Pipeline overview** — stages from commit to production
2. **Blue-Green architecture** — router with two slots
3. **Canary architecture** — router with 90/10 split
4. **CI matrix** — three Node versions in parallel
5. **Deployment strategy comparison table**

## Lower-thirds and on-screen text

- `[ON-SCREEN: REPO LINK]` at start
- `[ON-SCREEN: ADR REFERENCE]` when each ADR is mentioned
- Chapter markers every 2 minutes
- Code line numbers visible (in the editor, not overlaid)

## Cut points for short-form derivatives

- **60-second cut:** Intro + Section 3 (multi-stage Docker) + Outro
- **90-second cut:** Section 5 (deployment strategies) only
- **3-minute cut:** Sections 2 + 5 + 6 — Docker, deploy, release

---

## Alternative cut: Screen-recording-only version

For a silent, text-overlay version (e.g., for embedding in docs or
social posts), the same script works if the talking head is replaced
with on-screen text callouts. Each section becomes a self-contained
screen recording:

1. **Section 1** — 90s, terminal-only: `npm test` + `npm run lint`
2. **Section 2** — 120s, editor + `docker build` terminal
3. **Section 3** — 90s, GitHub Actions UI
4. **Section 4** — 60s, terminal: `docker pull` and inspect
5. **Section 5** — 180s, editor + dry-run terminal
6. **Section 6** — 90s, terminal: version bump + changelog

Total: 10 minutes of screen recording, paced for a 12-minute video
with text overlays.
