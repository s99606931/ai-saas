# MTU-DEP2 Design: Docker Compose 전체 서비스 기동

> **버전**: 1.0.0 | **일자**: 2026-04-06 | **작성자**: PM Agent
> **Plan 참조**: docs/01-plan/features/mtu-dep2-docker-compose.plan.md
> **아키텍처 선택**: Option B — Pragmatic Balance

---

## Design Anchor

| 항목 | 결정 |
|------|------|
| **빌드 전략** | 공통 멀티스테이지 Dockerfile 템플릿 (pnpm --filter 기반) |
| **네트워크** | 단일 브리지 네트워크 (saas-network) — 서비스명으로 DNS 해석 |
| **헬스체크** | HTTP GET /health 엔드포인트 (30s 간격, 5s 타임아웃) |
| **의존성** | depends_on + condition: service_healthy |
| **환경변수** | .env.example 제공, docker-compose.yml에서 ${VAR:-default} |
| **보안** | CSAP D-11: non-root (UID 1001), read_only: true, tmpfs |

---

## 1. 공통 Dockerfile 패턴

모든 마이크로서비스는 동일 패턴의 멀티스테이지 Dockerfile 사용.

### 구조

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY platform/packages/ ./platform/packages/
COPY platform/services/{service}/ ./platform/services/{service}/
RUN pnpm install --frozen-lockfile --filter @public-saas/{service}...
RUN pnpm --filter @public-saas/{service}... build

FROM node:22-alpine AS runner
RUN addgroup --system --gid 1001 saas && adduser --system --uid 1001 saas
WORKDIR /app
COPY --from=builder --chown=saas:saas /app/platform/services/{service}/dist ./dist
COPY --from=builder --chown=saas:saas /app/node_modules ./node_modules
USER saas
EXPOSE {port}
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:{port}/health || exit 1
CMD ["node", "dist/index.js"]
```

### 변수

| 서비스 | {service} | {port} |
|--------|-----------|--------|
| api-gateway | api-gateway | 3000 |
| auth-service | auth-service | 3001 |
| user-service | user-service | 3002 |
| tenant-service | tenant-service | 3003 |
| menu-service | menu-service | 3004 |
| saas-catalog-service | saas-catalog-service | 3005 |
| subscription-service | subscription-service | 3006 |
| billing-service | billing-service | 3007 |
| crm-service | crm-service | 3008 |
| ai-service | ai-service | 3009 |
| notification-service | notification-service | 3010 |
| file-service | file-service | 3011 |
| audit-service | audit-service | 3012 |
| compliance-service | compliance-service | 3013 |
| security-monitor-service | security-monitor-service | 3014 |

---

## 2. docker-compose.yml 확장 설계

### 2.1 인프라 서비스 (기존 유지)

- postgres (5432), redis (6379), minio (9000/9001)
- 기존 헬스체크 유지

### 2.2 마이크로서비스 (신규 추가)

각 서비스의 docker-compose 정의:

```yaml
{service}:
  build:
    context: .
    dockerfile: platform/services/{service}/Dockerfile
  container_name: saas-{service}
  ports:
    - "{port}:{port}"
  environment:
    NODE_ENV: production
    DATABASE_URL: postgresql://${DB_USER:-saas}:${DB_PASSWORD:-saas_dev_2026}@postgres:5432/${DB_NAME:-saas_platform}
    REDIS_URL: redis://default:${REDIS_PASSWORD:-redis_dev_2026}@redis:6379
    JWT_SECRET: ${JWT_SECRET:-dev-jwt-secret-change-in-production}
  depends_on:
    postgres:
      condition: service_healthy
    redis:
      condition: service_healthy
  networks:
    - saas-network
  restart: unless-stopped
  deploy:
    resources:
      limits:
        memory: 256M
```

### 2.3 포털 (Next.js)

별도 Dockerfile 필요 (Next.js standalone 빌드).

### 2.4 네트워크

```yaml
networks:
  saas-network:
    driver: bridge
```

---

## 3. .env.example 설계

```env
# 데이터베이스
DB_USER=saas
DB_PASSWORD=saas_dev_2026
DB_NAME=saas_platform
DB_PORT=5432

# Redis
REDIS_PASSWORD=redis_dev_2026
REDIS_PORT=6379

# MinIO
MINIO_USER=minio_admin
MINIO_PASSWORD=minio_dev_2026
MINIO_PORT=9000
MINIO_CONSOLE_PORT=9001

# JWT
JWT_SECRET=dev-jwt-secret-change-in-production

# AI (LM Studio)
LM_STUDIO_URL=http://host.docker.internal:1234
```

---

## 4. 검증 스크립트 설계

`scripts/healthcheck.sh`:
- 19개 컨테이너 상태 확인
- HTTP /health 엔드포인트 확인
- 결과 테이블 출력

---

## Session Guide

1. 공통 Dockerfile 13개 생성 (기존 2개 제외)
2. docker-compose.yml 확장 (15개 서비스 + 포털 추가)
3. .env.example 생성
4. 헬스체크 스크립트 생성
5. 검증: `docker compose config` 유효성

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-06 | 최초 작성 | PM Agent |
