# Dockerfile 캐시 최적화 가이드

> **문서 ID**: MTU-N254.guide
> **Design Ref**: MTU-N254 Design
> **Plan SC**: FR-N254.3
> **CSAP**: D-12 (시스템 개발 보안 -- 빌드 재현성)

---

## 1. 레이어 순서 최적화

```dockerfile
# 1단계: 의존성 설치 (변경 빈도 낮음 → 캐시 활용도 높음)
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

# 2단계: 빌드 (소스코드 변경 시만 무효화)
FROM deps AS builder
COPY . .
RUN pnpm build

# 3단계: 프로덕션 이미지 (최소 크기)
FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
USER node
CMD ["node", "dist/main.js"]
```

**핵심 원칙**: 변경 빈도 낮은 레이어를 위에 배치

## 2. BuildKit 캐시 마운트

```dockerfile
# pnpm store 캐시 마운트 (러너 간 공유)
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    corepack enable && pnpm install --frozen-lockfile

# apt 캐시 마운트
RUN --mount=type=cache,target=/var/cache/apt \
    apt-get update && apt-get install -y --no-install-recommends curl
```

## 3. 원격 캐시 (Harbor OCI)

```bash
# 빌드 시 원격 캐시 활용
docker buildx build \
  --cache-from type=registry,ref=harbor.local/buildcache/myapp:cache \
  --cache-to type=registry,ref=harbor.local/buildcache/myapp:cache,mode=max \
  -t harbor.local/saas/myapp:latest \
  --push .
```

**mode=max**: 모든 빌드 레이어를 캐시 (기본값 min은 최종 레이어만)

## 4. CI/CD 파이프라인 설정

```yaml
# .gitea/workflows/ci.yml 내 빌드 단계
- name: 이미지 빌드 (캐시 활용)
  run: |
    docker buildx build \
      --cache-from type=registry,ref=harbor.local/buildcache/${{ matrix.service }}:cache \
      --cache-to type=registry,ref=harbor.local/buildcache/${{ matrix.service }}:cache,mode=max \
      --build-arg BUILDKIT_INLINE_CACHE=1 \
      -t harbor.local/saas/${{ matrix.service }}:${{ github.sha }} \
      -f platform/services/${{ matrix.service }}/Dockerfile \
      --push .
```

## 5. .dockerignore 최적화

```
# .dockerignore
node_modules
.git
.gitea
docs
tests
*.md
.env*
.claude
.bkit
evidence
```

## 6. 멀티 스테이지 빌드 패턴

| 패턴 | 용도 | 최종 이미지 크기 |
|------|------|----------------|
| deps → builder → runner | 일반 서비스 | ~150MB |
| deps → builder → distroless | 보안 강화 | ~80MB |
| deps → tester → builder → runner | 테스트 포함 | ~150MB |

## 7. 캐시 무효화 방지

```dockerfile
# COPY 순서: 변경 빈도 낮은 파일 먼저
COPY package.json pnpm-lock.yaml tsconfig.json ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile && pnpm prisma generate

# 소스코드는 마지막에 복사
COPY src ./src
RUN pnpm build
```

## 8. 모니터링

- Grafana 대시보드: `/d/build-cache`
- 목표 캐시 히트율: 80%+
- 목표 빌드 시간: 5분 이내

---

*가이드 작성: 2026-04-11 | MTU-N254*
