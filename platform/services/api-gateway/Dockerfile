# API 게이트웨이 Dockerfile
# Design Ref: DESIGN-MTU-P04
# CSAP: D-11 가상화 보안

FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY platform/services/api-gateway/package.json ./platform/services/api-gateway/
COPY platform/packages/types/package.json ./platform/packages/types/
COPY platform/packages/auth-sdk/package.json ./platform/packages/auth-sdk/
COPY platform/packages/audit-sdk/package.json ./platform/packages/audit-sdk/

RUN pnpm install --frozen-lockfile --filter @public-saas/api-gateway...

COPY tsconfig.base.json ./
COPY platform/packages/ ./platform/packages/
COPY platform/services/api-gateway/ ./platform/services/api-gateway/

RUN pnpm --filter @public-saas/api-gateway... build

FROM node:22-alpine AS runner
RUN addgroup --system --gid 1001 saas && adduser --system --uid 1001 saas
WORKDIR /app

COPY --from=builder --chown=saas:saas /app/platform/services/api-gateway/dist ./dist
COPY --from=builder --chown=saas:saas /app/node_modules ./node_modules

USER saas
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
