# syntax=docker/dockerfile:1.6

############################
# Stage 1: Base dependencies
############################
FROM node:20-alpine AS deps
WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then \
      npm ci --no-audit --no-fund; \
    else \
      npm install --no-audit --no-fund; \
    fi

############################
# Stage 2: Development (optional)
############################
FROM node:20-alpine AS dev
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=development
EXPOSE 3000
USER node
CMD ["npm", "run", "dev"]

############################
# Stage 3: Test runner
############################
FROM deps AS test
WORKDIR /app
COPY . .
ENV NODE_ENV=test CI=true
RUN npm run lint --if-present && \
    npm test -- --ci --runInBand --coverage

############################
# Stage 4: Production runtime
############################
FROM node:20-alpine AS production
WORKDIR /app

RUN apk add --no-cache dumb-init wget && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    NODE_OPTIONS="--enable-source-maps"

COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then \
      npm ci --omit=dev --no-audit --no-fund && npm cache clean --force; \
    else \
      npm install --omit=dev --no-audit --no-fund && npm cache clean --force; \
    fi

COPY --chown=nodejs:nodejs src ./src
COPY --chown=nodejs:nodejs scripts ./scripts
COPY --chown=nodejs:nodejs package.json ./

USER nodejs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/health/live || exit 1

LABEL org.opencontainers.image.title="ci-cd-demo-app" \
      org.opencontainers.image.description="CI/CD automation demo application" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.source="https://github.com/example/ci-cd-demo"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]
