# 포털 (Next.js 15) Dockerfile
# Design Ref: DESIGN-MTU-DEP2
# CSAP: D-11 가상화 보안 — non-root, 멀티스테이지 빌드

FROM node:22-alpine AS base

# pnpm 설치
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

FROM base AS deps
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY platform/apps/portal/package.json ./platform/apps/portal/
COPY platform/packages/types/package.json ./platform/packages/types/

RUN pnpm install --frozen-lockfile --filter @public-saas/portal...

FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/platform/apps/portal/node_modules ./platform/apps/portal/node_modules
COPY tsconfig.base.json ./
COPY platform/packages/ ./platform/packages/
COPY platform/apps/portal/ ./platform/apps/portal/
COPY prisma/ ./prisma/

WORKDIR /app/platform/apps/portal

RUN pnpm exec prisma generate --schema=/app/prisma/schema.prisma

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npx next build

# 프로덕션 이미지
FROM base AS runner
WORKDIR /app

# CSAP D-11: non-root 사용자
RUN addgroup --system --gid 1001 saas && \
    adduser --system --uid 1001 saas

COPY --from=builder --chown=saas:saas /app/platform/apps/portal/.next/standalone ./
COPY --from=builder --chown=saas:saas /app/platform/apps/portal/.next/static ./platform/apps/portal/.next/static

USER saas

EXPOSE 4000

ENV PORT=4000
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/ || exit 1

CMD ["node", "platform/apps/portal/server.js"]
