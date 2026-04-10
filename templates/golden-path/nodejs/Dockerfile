# Design Ref: MTU-N86 §Golden Path 구조
# Plan SC: FR-N86.1
# CSAP D-12: 안전한 컨테이너 이미지 빌드

# Stage 1: 빌드
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --production=false
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Stage 2: 프로덕션
FROM node:20-alpine AS production
LABEL maintainer="SaaS Platform Team"
LABEL org.opencontainers.image.source="harbor.saas-platform.local"

# 비특권 사용자 생성
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

WORKDIR /app

# 프로덕션 의존성만 설치
COPY package.json package-lock.json ./
RUN npm ci --production && npm cache clean --force

# 빌드 결과 복사
COPY --from=builder /app/dist ./dist/

# 비특권 사용자로 전환
USER 1001:1001

# 헬스체크
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3000}/health || exit 1

EXPOSE ${PORT:-3000}

CMD ["node", "dist/index.js"]
