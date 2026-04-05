# subscription-service Dockerfile
# Design Ref: DESIGN-MTU-DEP2
# CSAP: D-11 가상화 보안 — non-root, 멀티스테이지 빌드

FROM node:22-alpine AS builder

WORKDIR /app

# pnpm 설치
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# 의존성 캐시 레이어
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY platform/services/subscription-service/package.json ./platform/services/subscription-service/
COPY platform/packages/types/package.json ./platform/packages/types/
COPY platform/packages/auth-sdk/package.json ./platform/packages/auth-sdk/
COPY platform/packages/audit-sdk/package.json ./platform/packages/audit-sdk/

RUN pnpm install --frozen-lockfile --filter @public-saas/subscription-service...

# 소스 복사 + 빌드
COPY platform/packages/ ./platform/packages/
COPY platform/services/subscription-service/ ./platform/services/subscription-service/

RUN pnpm --filter @public-saas/subscription-service... build

# 프로덕션 이미지
FROM node:22-alpine AS runner

# CSAP D-11: non-root 사용자
RUN addgroup --system --gid 1001 saas && \
    adduser --system --uid 1001 saas

WORKDIR /app

COPY --from=builder --chown=saas:saas /app/platform/services/subscription-service/dist ./dist
COPY --from=builder --chown=saas:saas /app/node_modules ./node_modules

USER saas

EXPOSE 3006

# 헬스체크
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3006/health || exit 1

CMD ["node", "dist/index.js"]
