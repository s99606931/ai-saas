# Docker 이미지 크기 최적화 가이드

> Plan SC: FR-N19.4
> Design Ref: D-N19.4
> CSAP: D-11 가상화 보안

| 항목 | 내용 |
|------|------|
| 버전 | 1.0.0 |
| 작성일 | 2026-04-08 |
| 대상 | platform/services/*/Dockerfile, platform/apps/*/Dockerfile |

---

## 1. 현재 Dockerfile 분석

### 적용된 최적화

| 항목 | 상태 | 비고 |
|------|------|------|
| 멀티스테이지 빌드 | 적용됨 | builder + runner |
| Alpine 기반 이미지 | 적용됨 | node:22-alpine |
| non-root 사용자 | 적용됨 | CSAP D-11 준수 |
| HEALTHCHECK | 적용됨 | 30초 간격 |
| .dockerignore | 부분 적용 | 강화 필요 |
| 레이어 캐시 최적화 | 적용됨 | package.json 우선 복사 |

### 이미지 크기 예측 (node:22-alpine 기준)

| 이미지 | 예상 크기 | 목표 |
|--------|---------|------|
| 기반 (node:22-alpine) | ~130MB | - |
| 서비스 (CRUD) | ~180MB | < 200MB |
| 서비스 (무거움: api-gateway, ai-service) | ~220MB | < 250MB |
| 포털 (Next.js SSR) | ~350MB | < 400MB |

---

## 2. 추가 최적화 권고

### 2.1 프로덕션 의존성만 설치

```dockerfile
# builder 단계에서 프로덕션 의존성만 별도 설치
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
RUN pnpm install --frozen-lockfile --prod  # devDependencies 제외

# runner 단계에서 프로덕션 의존성만 복사
FROM node:22-alpine AS runner
COPY --from=deps /app/node_modules ./node_modules
```

### 2.2 .dockerignore 강화

```dockerignore
# .dockerignore (프로젝트 루트)
node_modules
.git
.gitignore
*.md
docs/
tests/
coverage/
.env*
.claude/
.bkit/
reports/
k8s/
infra/
*.test.ts
*.spec.ts
jest.config.*
tsconfig.test.json
```

### 2.3 Prisma 클라이언트 최적화

```dockerfile
# Prisma 엔진 바이너리 최소화
ENV PRISMA_ENGINES_MIRROR="https://binaries.prisma.sh"
RUN pnpm exec prisma generate --generator=client

# 불필요 엔진 제거 (~30MB 절약)
RUN rm -rf node_modules/.prisma/client/libquery_engine-*
# 사용 중인 엔진만 유지 (linux-musl-openssl-3.0.x)
```

### 2.4 Alpine 보안 패키지 최소화

```dockerfile
# 빌드 단계에서만 필요한 패키지
FROM node:22-alpine AS builder
RUN apk add --no-cache python3 make g++  # native 모듈 빌드용

# 실행 단계: 최소 패키지만
FROM node:22-alpine AS runner
RUN apk add --no-cache tini wget  # tini (init), wget (healthcheck)
ENTRYPOINT ["/sbin/tini", "--"]
```

---

## 3. 이미지 크기 측정 방법

```bash
# 전체 서비스 이미지 크기 확인
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" | sort -k3 -h

# 레이어별 크기 분석
docker history saas-auth:latest --no-trunc --format "table {{.Size}}\t{{.CreatedBy}}"

# dive로 레이어 분석 (선택)
dive saas-auth:latest
```

---

## 4. 이미지 크기 목표 체크리스트

- [ ] 모든 서비스 이미지 < 250MB
- [ ] 포털 이미지 < 400MB
- [ ] .dockerignore에 tests/, docs/, .git/ 포함
- [ ] devDependencies 프로덕션 이미지에 미포함
- [ ] Prisma 불필요 엔진 바이너리 제거
- [ ] Alpine 기반 이미지 사용 (Debian 대비 ~60% 경량)

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-08 | 초안 작성 | PM Lead Agent |
