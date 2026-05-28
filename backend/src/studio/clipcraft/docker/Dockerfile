# @filename: backend/src/studio/clipcraft/docker/Dockerfile
# ClipCraft / Sentinel Studio API — Node 20+ (adjust BASE_IMAGE for other runtimes)

ARG BASE_IMAGE=node:20-alpine
FROM ${BASE_IMAGE} AS base
WORKDIR /app
RUN apk add --no-cache curl tini 2>/dev/null || true

FROM base AS deps
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev 2>/dev/null || npm install --omit=dev

FROM base AS runtime
ENV NODE_ENV=production
ENV CLIPCRAFT_ENABLED=true
ENV CLIPCRAFT_PROVIDER_MODE=mock
ENV CLIPCRAFT_MAX_CONCURRENT_JOBS=4
ENV CLIPCRAFT_RATE_LIMIT_PER_MIN=30

COPY --from=deps /app/node_modules ./node_modules
COPY backend/package.json ./
COPY backend/src ./src

EXPOSE 5001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -f http://127.0.0.1:${PORT:-5001}/api/studio/clipcraft/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/server.js"]
