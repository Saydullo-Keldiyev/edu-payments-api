# syntax=docker/dockerfile:1

# Debian slim (glibc) + openssl: what Prisma's query engine expects.
FROM node:22-bookworm-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Full toolchain: compiles the API. Also used by the compose `migrate` and `test` services,
# which need the Prisma CLI and Vitest (dev dependencies).
FROM base AS build
COPY package.json package-lock.json ./
COPY prisma ./prisma
# postinstall runs `prisma generate`, which needs prisma/schema.prisma (copied above).
RUN npm ci
COPY tsconfig.json tsconfig.build.json vitest.config.ts eslint.config.mjs ./
COPY src ./src
COPY tests ./tests
RUN npm run build

# Production dependencies only, installed fresh. The Prisma CLI and TypeScript are optional peers
# of @prisma/client (marked "devOptional" in the lockfile), so `--omit=optional` is needed to keep
# them out. Scripts are skipped because the Prisma CLI is a dev dependency; the client generated in
# the build stage is copied in instead.
FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --omit=optional --ignore-scripts && npm cache clean --force
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma

# Runtime: compiled JS + production dependencies, run as the unprivileged `node` user.
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=prod-deps /app/package.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER node
EXPOSE 4000
# Run node directly (not via npm) so SIGTERM reaches the graceful-shutdown handler.
CMD ["node", "dist/server.js"]
