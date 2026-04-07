# catalog-service Dockerfile
# Design Ref: DESIGN-MTU-DEP2
# CSAP: D-11 가상화 보안 -- non-root, 멀티스테이지 빌드
# NOTE: saas-catalog-service(placeholder)를 대체하는 실제 구현체

FROM node:22-alpine AS builder

WORKDIR /app

# pnpm 설치
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# 의존성 캐시 레이어
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY platform/services/catalog-service/package.json ./platform/services/catalog-service/
COPY platform/packages/types/package.json ./platform/packages/types/
COPY platform/packages/auth-sdk/package.json ./platform/packages/auth-sdk/
COPY platform/packages/audit-sdk/package.json ./platform/packages/audit-sdk/

RUN pnpm install --frozen-lockfile --filter @public-saas/catalog-service...

# 소스 복사 + 빌드
COPY platform/packages/ ./platform/packages/
COPY platform/services/catalog-service/ ./platform/services/catalog-service/

COPY prisma/ ./prisma/
RUN pnpm exec prisma generate

RUN pnpm --filter @public-saas/catalog-service... build

# 프로덕션 이미지
FROM node:22-alpine AS runner

# CSAP D-11: non-root 사용자
RUN addgroup --system --gid 1001 saas && \
    adduser --system --uid 1001 saas

WORKDIR /app

COPY --from=builder --chown=saas:saas /app/node_modules ./node_modules
COPY --from=builder --chown=saas:saas /app/platform/packages ./platform/packages
COPY --from=builder --chown=saas:saas /app/platform/services/catalog-service ./platform/services/catalog-service

USER saas

EXPOSE 3005

# 헬스체크
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3005/health || exit 1

CMD ["node", "platform/services/catalog-service/dist/index.js"]
