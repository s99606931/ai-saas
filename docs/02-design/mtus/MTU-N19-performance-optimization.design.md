# MTU-N19: 성능 최적화 Design

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-N19 |
| Phase | Phase 7 New (성능) |
| 버전 | 1.0.0 |
| 상태 | Approved |
| 작성일 | 2026-04-08 |
| 작성자 | PM Lead Agent (Claude Opus) |
| Plan 참조 | docs/01-plan/mtus/MTU-N19-performance-optimization.plan.md |

---

## Design Anchor

| 항목 | 내용 |
|------|------|
| 아키텍처 옵션 | Option B: Pragmatic Balance (문서 가이드 + 최소 설정 변경) |
| 선택 근거 | v1.0.0은 문서 프레임워크이므로 실 운영 코드 변경보다 가이드 문서 중심 |
| 제약 | CLAUDE.md 절대 제약 준수, CSAP D-07/D-11 준수 |

---

## D-N19.1: DB 인덱스 최적화 가이드

### 현재 인덱스 분석

Prisma 스키마 기준 현재 인덱스 현황:

| 모델 | 인덱스 | 유형 | 분석 |
|------|--------|------|------|
| User | @@unique([tenantId, email]) | 복합 유니크 | 적절 -- 테넌트별 이메일 유일성 보장 |
| User | @@index([tenantId]) | 단일 | 적절 -- 테넌트별 사용자 조회 |
| User | @@index([email]) | 단일 | 검토 필요 -- 복합 유니크가 이미 커버 |
| Session | @@index([userId]) | 단일 | 적절 |
| Session | @@index([expiresAt]) | 단일 | 적절 -- 만료 세션 정리 |
| AuditLog | @@index([tenantId, createdAt]) | 복합 | 적절 -- 테넌트별 시간순 조회 |
| AuditLog | @@index([actorId]) | 단일 | 적절 |
| AuditLog | @@index([action]) | 단일 | 검토 필요 -- cardinality 낮을 수 있음 |
| AuditLog | @@index([createdAt]) | 단일 | 검토 필요 -- 복합 인덱스가 이미 커버 |
| AiUsage | @@index([tenantId, createdAt]) | 복합 | 적절 |
| Notification | @@index([userId, createdAt]) | 복합 | 적절 |
| Customer | @@index([status]) | 단일 | 검토 필요 -- cardinality 낮음 |
| Invoice | @@index([subscriptionId]) | 단일 | 적절 |
| Invoice | @@index([status]) | 단일 | 검토 필요 -- cardinality 낮음 |

### 권고 사항

1. **중복 인덱스 제거 후보**: User.email (복합 유니크가 email을 포함하지 않으므로 유지 필요), AuditLog.createdAt (복합 인덱스 [tenantId, createdAt]이 tenantId 없는 조회에는 비효율)
2. **누락 인덱스 추가 후보**:
   - Subscription: `@@index([tenantId, status])` -- 테넌트별 활성 구독 조회
   - Contract: `@@index([customerId, status])` -- 고객별 계약 상태 조회
   - File: `@@index([tenantId, createdAt])` -- 테넌트별 최근 파일 조회
3. **부분 인덱스 (Prisma v7.4+)**:
   - Session: `@@index([expiresAt], where: { expiresAt: { gt: now() } })` -- 활성 세션만
   - Invoice: `@@index([status], where: { status: "draft" })` -- 미발행 청구서만

---

## D-N19.2: k8s 리소스 튜닝

### 서비스별 권장 리소스

| 서비스 | CPU req | CPU lim | Mem req | Mem lim | 비고 |
|--------|---------|---------|---------|---------|------|
| api-gateway | 100m | 500m | 128Mi | 256Mi | 프록시 + rate limit |
| auth-service | 50m | 200m | 64Mi | 128Mi | bcrypt CPU 집약적 |
| user-service | 50m | 200m | 64Mi | 128Mi | CRUD 경량 |
| tenant-service | 50m | 200m | 64Mi | 128Mi | CRUD 경량 |
| audit-service | 100m | 300m | 128Mi | 256Mi | SHA-256 체인 연산 |
| ai-service | 100m | 500m | 128Mi | 256Mi | LLM API 프록시 |
| security-monitor | 100m | 300m | 128Mi | 256Mi | 로그 분석 |
| compliance-service | 50m | 200m | 64Mi | 128Mi | CRUD 경량 |
| 기타 서비스 (9개) | 50m | 200m | 64Mi | 128Mi | CRUD 경량 |
| portal (Next.js) | 100m | 500m | 128Mi | 512Mi | SSR 메모리 집약 |
| PostgreSQL | 200m | 1000m | 512Mi | 1Gi | 주 DB |
| Redis | 50m | 200m | 64Mi | 128Mi | 캐시/세션 |
| MinIO | 100m | 500m | 128Mi | 256Mi | 오브젝트 스토리지 |

### k3s 최적화 옵션

```bash
# k3s 설치 시 불필요 컴포넌트 비활성화 (~70MB 절약)
curl -sfL https://get.k3s.io | sh -s - \
  --disable traefik \
  --disable servicelb \
  --disable metrics-server \
  --kubelet-arg="--max-pods=50"
```

### 총 리소스 예산 (최소 환경)

- CPU: ~2.5 코어 (requests), ~7.5 코어 (limits)
- Memory: ~2.5GB (requests), ~5GB (limits)
- WSL2 최소 권장: 8GB RAM (4GB 호스트 예약)

---

## D-N19.3: WSL2 .wslconfig 권장 설정

```ini
# %UserProfile%\.wslconfig
[wsl2]
memory=8GB          # 호스트 16GB 기준 (50%)
processors=4        # 전체 코어의 50~75%
swap=4GB            # 메모리의 50%
localhostForwarding=true
nestedVirtualization=false  # k3s는 불필요

[experimental]
autoMemoryReclaim=gradual  # 메모리 자동 회수
```

### RAM 분배 가이드

| 호스트 RAM | WSL2 할당 | k3s + 서비스 | 여유 |
|-----------|----------|-------------|------|
| 8GB | 4GB | 3GB | 1GB |
| 16GB | 8GB | 5GB | 3GB |
| 32GB | 16GB | 8GB | 8GB |

---

## D-N19.4: Docker 이미지 최적화

### 현재 Dockerfile 분석

- 멀티스테이지 빌드: 적용됨 (builder + runner)
- 기반 이미지: node:22-alpine (경량)
- non-root 사용자: 적용됨 (CSAP D-11)
- HEALTHCHECK: 적용됨

### 추가 최적화 권고

1. **node_modules 선택 복사**: `--production` 플래그로 devDependencies 제외
2. **.dockerignore 강화**: `tests/`, `docs/`, `*.md`, `.git/` 제외 확인
3. **이미지 크기 목표**: 서비스당 < 200MB (현재 Alpine 기반으로 달성 가능)
4. **레이어 캐시 최적화**: package.json 먼저 복사 후 install (이미 적용됨)

---

## D-N19.5: 연결 풀 튜닝

### Prisma 연결 풀

```
# DATABASE_URL에 connection_limit 파라미터 추가
DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=5&pool_timeout=10"
```

| 환경 | connection_limit | pool_timeout | 비고 |
|------|-----------------|-------------|------|
| 개발 (단일 서비스) | 5 | 10s | 최소 |
| 스테이징 (17 서비스) | 3 | 10s | 총 51 연결 |
| 프로덕션 | 10 | 30s | PostgreSQL max_connections=200 기준 |

### Redis 연결 풀

```typescript
// ioredis 옵션
const redis = new Redis({
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true,
  // 연결 풀은 ioredis가 내부 관리
});
```

---

## Session Guide (구현 순서)

1. docs/performance/ 디렉토리 생성
2. FR-N19.1: db-index-optimization.md 작성 (현재 인덱스 분석 + 권고)
3. FR-N19.2: k8s-resource-tuning.md 작성 (서비스별 권장값)
4. FR-N19.3: wsl2-config-guide.md 작성 (.wslconfig 템플릿)
5. FR-N19.4: docker-image-optimization.md 작성 (최적화 체크리스트)
6. FR-N19.5: connection-pool-tuning.md 작성 (Prisma/Redis 설정)

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-08 | 초안 작성 | PM Lead Agent (Opus) |
