# notification-service Dockerfile
# Design Ref: DESIGN-MTU-DEP2
# CSAP: D-11 가상화 보안 — non-root, 멀티스테이지 빌드

FROM node:22-alpine AS builder

WORKDIR /app

# pnpm 설치
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# 의존성 캐시 레이어 — 모든 워크스페이스 패키지 package.json 복사 (pnpm dep 해결용)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY platform/services/notification-service/package.json ./platform/services/notification-service/
COPY platform/packages/types/package.json ./platform/packages/types/
COPY platform/packages/auth-sdk/package.json ./platform/packages/auth-sdk/
COPY platform/packages/audit-sdk/package.json ./platform/packages/audit-sdk/
COPY platform/packages/observability/package.json ./platform/packages/observability/
COPY platform/packages/health/package.json ./platform/packages/health/
COPY platform/packages/rate-limit/package.json ./platform/packages/rate-limit/
COPY platform/packages/rbac/package.json ./platform/packages/rbac/
COPY platform/packages/mesh-ready/package.json ./platform/packages/mesh-ready/
COPY platform/packages/config-vault/package.json ./platform/packages/config-vault/
COPY platform/packages/event-bus/package.json ./platform/packages/event-bus/
COPY platform/packages/ssrf-guard/package.json ./platform/packages/ssrf-guard/
COPY platform/packages/problem-details/package.json ./platform/packages/problem-details/
COPY platform/packages/circuit-breaker/package.json ./platform/packages/circuit-breaker/
COPY platform/packages/structured-logger/package.json ./platform/packages/structured-logger/
COPY platform/packages/backoff/package.json ./platform/packages/backoff/
COPY platform/packages/cidr/package.json ./platform/packages/cidr/

RUN pnpm install --frozen-lockfile --filter @public-saas/notification-service...

# 소스 복사 + 빌드
COPY platform/packages/ ./platform/packages/
COPY platform/services/notification-service/ ./platform/services/notification-service/

COPY prisma/ ./prisma/
RUN pnpm exec prisma generate

RUN pnpm --filter @public-saas/notification-service... build

# 프로덕션 이미지
FROM node:22-alpine AS runner

# CSAP D-11: non-root 사용자
RUN addgroup --system --gid 1001 saas && \
    adduser --system --uid 1001 saas

WORKDIR /app

COPY --from=builder --chown=saas:saas /app/node_modules ./node_modules
COPY --from=builder --chown=saas:saas /app/platform/packages ./platform/packages
COPY --from=builder --chown=saas:saas /app/platform/services/notification-service ./platform/services/notification-service

USER saas

EXPOSE 3010

# 헬스체크
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3010/health || exit 1

CMD ["node", "platform/services/notification-service/dist/index.js"]
