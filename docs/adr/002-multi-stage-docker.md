# ADR-002: Multi-Stage Docker Build

## Status

Accepted (2026-01-20)

## Context

We need a Docker image that:

- Is small (fast to push, fast to scan, small attack surface)
- Is reproducible
- Has a clear separation of build-time and runtime dependencies
- Is runnable as a non-root user

## Decision

Use a multi-stage Dockerfile with these stages:

1. **`deps`** — install all dependencies (cached layer for fast rebuilds)
2. **`test`** — copy source, run lint + tests as a CI gate inside the build
3. **`production`** — install only production dependencies, copy source, drop
   privileges, add healthcheck

Build the final image with `--target production`.

## Consequences

- **Positive**: Final image is ~150 MB (vs 400+ MB for single-stage)
- **Positive**: Clear cache invalidation rules
- **Positive**: Build-time secrets cannot leak into the final image
- **Positive**: Image runs as non-root with read-only root FS
- **Negative**: Slightly more complex Dockerfile
- **Negative**: The `test` stage is optional and may be skipped for some
  builds

## Notes

The `--enable-source-maps` Node option is set so that production stack traces
can be resolved to original source even with minification (we don't minify
yet, but this is forward-compatible).
