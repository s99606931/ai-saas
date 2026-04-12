# 9장 3절: 성능 최적화 가이드

> **버전**: 1.1.0 | **작성일**: 2026-04-12
> **대상**: 개발자, DevOps 엔지니어, 인프라 담당자
> **CSAP**: D-06 (침해사고 관리), D-11 (가상화 보안)
> **선행 문서**: `05-monitoring/metrics/01-prometheus-basics.md`

---

## 목차

1. [성능 문제 감지 — 증상 먼저](#1-성능-문제-감지--증상-먼저)
2. [성능 조사 워크플로우](#2-성능-조사-워크플로우)
3. [CPU / 메모리 프로파일링 (Prometheus)](#3-cpu--메모리-프로파일링-prometheus)
4. [느린 DB 쿼리 찾기 (Prisma 쿼리 로깅)](#4-느린-db-쿼리-찾기-prisma-쿼리-로깅)
5. [Redis 캐시 미스 분석](#5-redis-캐시-미스-분석)
6. [k3s 리소스 쿼터와 Limit 설정](#6-k3s-리소스-쿼터와-limit-설정)
7. [수평 스케일링 — 언제 어떻게](#7-수평-스케일링--언제-어떻게)
8. [DB 연결 풀 최적화](#8-db-연결-풀-최적화)
9. [핵심 PromQL 쿼리 모음](#9-핵심-promql-쿼리-모음)

---

## 1. 성능 문제 감지 — 증상 먼저

### 1.1 성능 문제의 일반적인 증상

성능 문제는 대부분 다음 증상 중 하나로 나타납니다. 도구를 열기 전에 증상부터 정확히 파악하십시오.

```
증상 1: API 응답 느림
  - 사용자: "페이지가 느려요"
  - 알림: "P99 지연 시간이 2000ms 초과"
  - 실제 측정: curl -w "%{time_total}" http://api.saas.local/api/v1/users

증상 2: 오류율 증가
  - 알림: "에러율이 5%를 초과했습니다"
  - 사용자: "가끔 에러가 납니다"
  - Grafana: HTTP 5xx 급증 그래프

증상 3: 리소스 고갈
  - kubectl top pods: CPU 사용량 limit 근처
  - Grafana: 메모리 사용량 지속 증가 (누수 의심)
  - 알림: "Pod 메모리 사용률 90% 초과"

증상 4: 특정 시간대 성능 저하
  - 업무 시간에만 느림 → 트래픽 부하
  - 새벽에 느림 → 배치 작업 충돌
  - 배포 직후 느림 → 신규 코드 성능 문제
```

### 1.2 성능 문제 체크리스트

문제 발생 시 다음 순서로 확인합니다.

```
[ ] 1. 언제부터 발생했는가? (배포와 연관?)
[ ] 2. 어느 서비스/엔드포인트에서 발생하는가?
[ ] 3. 특정 사용자/테넌트에서만 발생하는가?
[ ] 4. 트래픽이 증가했는가? (정상 부하인가?)
[ ] 5. DB/Redis 응답 시간이 정상인가?
[ ] 6. 외부 API 연동이 느려졌는가?
[ ] 7. 메모리/CPU 사용량이 급증했는가?
```

---

## 2. 성능 조사 워크플로우

```mermaid
flowchart TD
  START([성능 저하 감지]) --> SYM["증상 특정\n어느 서비스? 어느 엔드포인트?\n얼마나 느린가?"]

  SYM --> METRIC["Grafana 메트릭 확인\nP99 지연, 에러율\nCPU/메모리 사용량"]

  METRIC --> Q1{"어느 계층이\n문제인가?"}

  Q1 -->|CPU 높음| CPU_PATH["CPU 프로파일링\n§3절 참조"]
  Q1 -->|메모리 증가| MEM_PATH["메모리 누수 분석\n§3.3 참조"]
  Q1 -->|DB 응답 느림| DB_PATH["Prisma 쿼리 로깅\n§4절 참조"]
  Q1 -->|캐시 미스 많음| CACHE_PATH["Redis 분석\n§5절 참조"]
  Q1 -->|트래픽 급증| SCALE_PATH["수평 스케일링\n§7절 참조"]

  CPU_PATH --> FIX["해결책 적용\n+ 성능 테스트 재실행"]
  MEM_PATH --> FIX
  DB_PATH --> FIX
  CACHE_PATH --> FIX
  SCALE_PATH --> FIX

  FIX --> VERIFY{"개선\n확인?"}
  VERIFY -->|예| DOC["개선 내용 문서화\n재발 방지책 추가"]
  VERIFY -->|아니오| Q1

  DOC --> END([완료])

  style START fill:#F44336,color:#fff
  style END fill:#4CAF50,color:#fff
  style FIX fill:#FF9800,color:#fff
```

---

## 3. CPU / 메모리 프로파일링 (Prometheus)

### 3.1 CPU 병목 찾기

```bash
# Prometheus에서 Pod별 CPU 사용률 확인
# http://localhost:9090 접속 후 쿼리 실행

# 전체 네임스페이스 Pod CPU 사용률 (%)
rate(container_cpu_usage_seconds_total{
  namespace="saas-platform",
  container!=""
}[5m]) * 100

# CPU throttling 발생 여부 (0이면 좋음, 높으면 CPU limit 부족)
rate(container_cpu_throttled_seconds_total{
  namespace="saas-platform"
}[5m]) /
rate(container_cpu_usage_seconds_total{
  namespace="saas-platform"
}[5m])
```

**Grafana에서 CPU 그래프 읽는 법:**

```
auth-service CPU 사용률 그래프:
  |
100%|                    ████
 80%|               ████████
 60%|          ████████████
 40%|     ████████████████
 20%|████████████████████
  0%|________________________
   09:00  10:00  11:00  12:00

해석:
- 지속적으로 80% 이상: CPU limit 증가 또는 수평 스케일링 필요
- 특정 시간에 급증: 트래픽 패턴 분석 필요
- 배포 직후 급증: 신규 코드에 효율성 문제
```

### 3.2 kubectl로 실시간 CPU/메모리 확인

```bash
# Pod별 현재 사용량 (메트릭 서버 필요)
kubectl top pods -n saas-platform --sort-by=cpu
# 또는 메모리순
kubectl top pods -n saas-platform --sort-by=memory

# 출력:
# NAME                      CPU(cores)   MEMORY(bytes)
# ai-service-9f5a-xxx       850m         1.2Gi   ← CPU 85%, 메모리 높음
# user-service-5c7b-xxx     120m         256Mi   ← 정상
# auth-service-6f8d-xxx     45m          112Mi   ← 정상

# 1초마다 갱신 (watch)
watch kubectl top pods -n saas-platform
```

### 3.3 메모리 누수 감지

메모리 누수는 Pod를 재시작하면 일시적으로 해결되지만 시간이 지나면 다시 증가합니다.

```
메모리 누수 패턴:
  |
1Gi|                              ████
768M|                     ████████
512M|              ████████
256M|       ████████
128M|████████
   0|________________________
    배포  +1h  +2h  +3h  +4h

해석: 배포 후 지속적으로 메모리 증가 → 누수 의심
     재시작 후 낮아졌다가 다시 증가하면 확실한 누수
```

**Node.js 메모리 누수 진단:**

```bash
# Pod 내부에서 힙 사용량 확인 (--expose-gc 필요)
kubectl exec -it <pod-name> -n saas-platform -- \
  node -e "console.log(process.memoryUsage())"

# 개발 환경에서 힙 스냅샷 생성
NODE_OPTIONS="--inspect" node dist/main.js

# Chrome DevTools → chrome://inspect 로 원격 프로파일링
# Heap Snapshot → 두 번 찍어서 차이 비교
```

**자주 발생하는 Node.js 메모리 누수 원인:**

```typescript
// ❌ 이벤트 리스너 미제거 (누수!)
export class UserService {
  constructor() {
    // 서비스 재사용 시마다 리스너가 쌓임
    process.on('message', this.handleMessage)
  }
}

// ✅ 올바른 패턴 (제거 필수)
export class UserService {
  private handleMessage = (msg: unknown) => { /* ... */ }

  start() {
    process.on('message', this.handleMessage)
  }

  stop() {
    process.off('message', this.handleMessage)  // 반드시 제거
  }
}

// ❌ 전역 Map/Set에 계속 추가 (TTL 없음)
const sessionCache = new Map<string, Session>()
// 세션이 만료되어도 Map에서 제거하지 않음 → 무한 증가

// ✅ 만료 시 삭제 또는 LRU 캐시 사용
import LRU from 'lru-cache'
const sessionCache = new LRU<string, Session>({ max: 1000, ttl: 900_000 })
```

---

## 4. 느린 DB 쿼리 찾기 (Prisma 쿼리 로깅)

### 4.1 Prisma 쿼리 로깅 활성화

```typescript
// prisma/client.ts
import { PrismaClient } from '@prisma/client'

export const prisma = new PrismaClient({
  log: [
    {
      emit: 'event',
      level: 'query',
    },
    {
      emit: 'stdout',
      level: 'error',
    },
  ],
})

// 느린 쿼리 감지 (100ms 이상)
prisma.$on('query', (e) => {
  if (e.duration > 100) {
    console.warn({
      level: 'warn',
      message: '느린 DB 쿼리 감지',
      query: e.query,
      params: e.params,
      durationMs: e.duration,
      timestamp: e.timestamp,
    })
  }
})
```

개발 환경에서만 모든 쿼리 로깅:

```bash
# .env (개발 환경에서만)
DATABASE_LOG_QUERIES=true
DATABASE_LOG_SLOW_THRESHOLD_MS=100
```

### 4.2 느린 쿼리 분석 — EXPLAIN ANALYZE

Prisma가 생성하는 쿼리가 느린 경우 PostgreSQL에서 직접 분석합니다.

```bash
# 포트 포워딩으로 DB 접속
kubectl port-forward svc/postgresql 5432:5432 -n saas-platform &
psql $DATABASE_URL

# EXPLAIN ANALYZE로 실행 계획 확인
EXPLAIN ANALYZE
SELECT u.*, p.* FROM users u
LEFT JOIN profiles p ON p.user_id = u.id
WHERE u.tenant_id = 'tenant_123'
ORDER BY u.created_at DESC
LIMIT 20;
```

출력 읽는 법:

```
EXPLAIN ANALYZE 출력:
Limit  (cost=0.00..2456.78 rows=20 width=256)
       (actual time=4215.123..4215.890 rows=20 loops=1)
  -> Seq Scan on users  (cost=0.00..98765.43 rows=50000 width=256)
                        (actual time=0.015..4214.456 rows=50000 loops=1)
       Filter: (tenant_id = 'tenant_123')
       Rows Removed by Filter: 950000
Planning Time: 1.234 ms
Execution Time: 4216.123 ms   ← 4.2초! 문제 구간

해석:
- "Seq Scan" = 테이블 전체 스캔 (인덱스 미사용) → 문제!
- Rows Removed: 950000 = 95만 행을 스캔 후 버림 → 매우 비효율
- 해결: tenant_id 컬럼에 인덱스 추가
```

### 4.3 인덱스 추가 (Prisma 스키마)

```prisma
// prisma/schema.prisma
model User {
  id        String   @id @default(cuid())
  tenantId  String
  email     String
  createdAt DateTime @default(now())

  // 인덱스 추가 — tenant 기반 쿼리 최적화
  @@index([tenantId])
  @@index([tenantId, createdAt(sort: Desc)])  // 정렬 포함 복합 인덱스

  // 유일 인덱스
  @@unique([tenantId, email])
}
```

```bash
# 인덱스 추가 후 마이그레이션
npx prisma migrate dev --name add_tenant_indexes

# 인덱스 적용 확인
psql $DATABASE_URL -c "\d users"  # 인덱스 목록 확인
```

인덱스 추가 전후 비교:

```
인덱스 없음: Seq Scan, 4216ms
인덱스 추가: Index Scan, 2.3ms  ← 1800배 빠름!
```

### 4.4 N+1 쿼리 문제

```typescript
// ❌ N+1 쿼리 문제 (사용자 100명 → DB 쿼리 101번)
const users = await prisma.user.findMany({ where: { tenantId } })
for (const user of users) {
  // 각 사용자마다 별도 쿼리 = N번 추가 쿼리!
  const profile = await prisma.profile.findUnique({
    where: { userId: user.id }
  })
  user.profile = profile
}

// ✅ Include로 1번에 조회
const users = await prisma.user.findMany({
  where: { tenantId },
  include: {
    profile: true,   // JOIN으로 한 번에 조회
    roles: true,
  }
})
```

Prisma 로그로 N+1 감지:

```
N+1 패턴이 있는 경우 로그:
prisma:query SELECT * FROM users WHERE tenant_id = ... (1회)
prisma:query SELECT * FROM profiles WHERE user_id = 'user_1' (1회)
prisma:query SELECT * FROM profiles WHERE user_id = 'user_2' (1회)
prisma:query SELECT * FROM profiles WHERE user_id = 'user_3' (1회)
... (N회 반복)

해결 후:
prisma:query SELECT u.*, p.* FROM users u LEFT JOIN profiles p ... (1회)
```

---

## 5. Redis 캐시 미스 분석

### 5.1 캐시 히트율 모니터링

```bash
# Redis CLI로 통계 확인
kubectl exec -n saas-platform <redis-pod> -- redis-cli info stats | \
  grep -E "keyspace_hits|keyspace_misses"

# 출력:
# keyspace_hits:12345      ← 캐시 히트 (좋음)
# keyspace_misses:8901     ← 캐시 미스 (DB 직접 조회 발생)

# 히트율 계산:
# hits / (hits + misses) = 12345 / (12345 + 8901) = 58% ← 낮음! 80% 이상이 목표
```

Prometheus 메트릭으로 히트율 추적:

```
# PromQL (redis_exporter가 필요)
redis_keyspace_hits_total /
(redis_keyspace_hits_total + redis_keyspace_misses_total)

# Grafana에서 시각화: 80% 이하 시 알림 설정
```

### 5.2 캐시 미스 원인 분석

```
캐시 미스 원인:
1. TTL이 너무 짧음 (캐시가 자주 만료)
2. 키 네임스페이스 설계 문제 (같은 데이터를 다른 키로 여러 번 저장)
3. 캐시 워밍(warming) 없이 서비스 재시작
4. 메모리 부족으로 eviction 발생 (LRU로 자동 삭제)
```

**캐시 적용 패턴:**

```typescript
// 캐시 어사이드 패턴 (Cache-Aside Pattern)
async function getUserProfile(userId: string): Promise<UserProfile> {
  const cacheKey = `user:${userId}:profile`

  // 1. 캐시 먼저 확인
  const cached = await redis.get(cacheKey)
  if (cached) {
    return JSON.parse(cached)  // 캐시 히트 → 즉시 반환
  }

  // 2. 캐시 미스 → DB 조회
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
  })

  if (!profile) {
    throw new Error(`사용자 ${userId}의 프로필을 찾을 수 없습니다`)
  }

  // 3. 캐시에 저장 (TTL: 10분)
  await redis.setex(cacheKey, 600, JSON.stringify(profile))

  return profile
}

// 데이터 수정 시 캐시 무효화
async function updateUserProfile(userId: string, data: UpdateProfileDto): Promise<void> {
  await prisma.userProfile.update({
    where: { userId },
    data,
  })

  // 캐시 삭제 (다음 조회 시 DB에서 새로 가져옴)
  await redis.del(`user:${userId}:profile`)
}
```

### 5.3 Redis 메모리 사용량 최적화

```bash
# 현재 메모리 사용량
kubectl exec -n saas-platform <redis-pod> -- redis-cli info memory | \
  grep -E "used_memory_human|maxmemory_human|mem_fragmentation_ratio"

# 키 분포 확인 (각 패턴별 키 수)
kubectl exec -n saas-platform <redis-pod> -- redis-cli --scan --pattern "user:*" | wc -l
kubectl exec -n saas-platform <redis-pod> -- redis-cli --scan --pattern "session:*" | wc -l

# TTL 없는 키 찾기 (메모리 누수 원인)
kubectl exec -n saas-platform <redis-pod> -- redis-cli \
  --scan --pattern "*" | while read key; do
    ttl=$(kubectl exec -n saas-platform <redis-pod> -- redis-cli TTL "$key")
    if [ "$ttl" = "-1" ]; then
      echo "TTL 없음: $key"
    fi
  done
```

**Redis maxmemory 정책 설정:**

```yaml
# Helm values.yaml (Redis 설정)
redis:
  master:
    configuration: |
      maxmemory 2gb
      maxmemory-policy allkeys-lru   # 메모리 가득 찼을 때 LRU로 자동 삭제
      # allkeys-lru: 전체 키 중 가장 오래된 것 삭제 (일반적으로 권장)
      # volatile-lru: TTL 있는 키 중에서만 삭제 (TTL 없는 키 보호)
      # noeviction: 삭제 안 함, 메모리 부족 시 에러 (프로덕션 주의)
```

---

## 6. k3s 리소스 쿼터와 Limit 설정

### 6.1 리소스 Request와 Limit 이해

```
Request (요청): "이 서비스는 최소 이 만큼의 CPU/메모리가 필요합니다"
  → 스케줄러가 이 만큼의 여유가 있는 노드에 Pod 배치
  → 항상 이 만큼을 보장받음

Limit (한도): "이 서비스는 최대 이 만큼만 사용할 수 있습니다"
  → CPU: 초과 시 throttling (느려짐, 죽지는 않음)
  → 메모리: 초과 시 OOMKilled (즉시 종료!)

권장 설정:
  CPU Request:  보통 사용량의 50%
  CPU Limit:    Request의 2~4배
  Memory Request: 보통 사용량의 80%
  Memory Limit:   Request의 1.2~1.5배
```

### 6.2 적절한 리소스 값 설정

```yaml
# Helm values.yaml — 서비스별 리소스 설정
resources:
  auth-service:
    requests:
      cpu: 50m        # 0.05 코어 보장
      memory: 128Mi   # 128MB 보장
    limits:
      cpu: 250m       # 최대 0.25 코어
      memory: 256Mi   # 최대 256MB, 초과 시 OOMKilled

  # AI 서비스는 더 많은 리소스 필요
  ai-service:
    requests:
      cpu: 200m
      memory: 512Mi
    limits:
      cpu: 1000m      # 1 코어
      memory: 1Gi
```

**현재 설정 확인:**

```bash
kubectl get pod <pod-name> -n saas-platform -o yaml | \
  grep -A8 "resources:"

# 출력:
# resources:
#   limits:
#     cpu: 250m
#     memory: 256Mi
#   requests:
#     cpu: 50m
#     memory: 128Mi
```

### 6.3 네임스페이스 ResourceQuota 설정

```yaml
# 전체 네임스페이스 리소스 한도
apiVersion: v1
kind: ResourceQuota
metadata:
  name: saas-platform-quota
  namespace: saas-platform
spec:
  hard:
    requests.cpu: "4"          # 전체 request CPU 합계 4코어
    requests.memory: 8Gi       # 전체 request 메모리 합계 8GB
    limits.cpu: "16"           # 전체 limit CPU 합계 16코어
    limits.memory: 32Gi        # 전체 limit 메모리 합계 32GB
    pods: "50"                  # 최대 Pod 수
```

```bash
# 현재 쿼터 사용량 확인
kubectl describe resourcequota -n saas-platform

# 출력:
# Resource           Used    Hard
# --------           ----    ----
# limits.cpu         3200m   16
# limits.memory      4Gi     32Gi
# pods               28      50
# requests.cpu       800m    4
# requests.memory    2Gi     8Gi
```

---

## 7. 수평 스케일링 — 언제 어떻게

### 7.1 수평 스케일링이 필요한 신호

```
수동 스케일링이 필요한 신호:
- CPU 사용률이 지속적으로 70% 이상
- P99 지연 시간이 SLO 목표를 초과
- 요청 실패율이 1% 이상
- 단일 Pod의 메모리가 한계에 도달

자동 스케일링(HPA/KEDA)이 필요한 신호:
- 트래픽이 시간대별로 크게 변동 (업무 시간/야간)
- 급격한 트래픽 급증이 예상됨 (이벤트, 공지)
```

### 7.2 수동 수평 스케일링

```bash
# 즉시 replicas 수 변경 (긴급 시)
kubectl scale deployment auth-service -n saas-platform --replicas=5

# 현재 상태 확인
kubectl get deployment auth-service -n saas-platform
# READY   UP-TO-DATE   AVAILABLE   AGE
# 5/5     5            5           2d

# 중요: 이 변경은 임시입니다!
# Flux가 다음 동기화 시 Helm values.yaml의 값으로 복원됩니다.
# 영구 변경은 반드시 Git을 통해 Helm values.yaml을 수정하십시오.
```

**Helm values.yaml로 영구 설정:**

```yaml
# infra/helm/values/auth-service.yaml
replicaCount: 3   # 기존 1 → 3으로 증가

# 또는 자동 스케일링
autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
```

### 7.3 HPA (Horizontal Pod Autoscaler) 설정

```yaml
# auth-service HPA
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: auth-service-hpa
  namespace: saas-platform
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: auth-service
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70   # CPU 70% 초과 시 스케일 아웃
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80   # 메모리 80% 초과 시
```

```bash
# HPA 상태 확인
kubectl get hpa -n saas-platform
# NAME                  REFERENCE            TARGETS           MINPODS  MAXPODS  REPLICAS
# auth-service-hpa      Deployment/auth      35%/70%, 0/80%    2        10       3

# HPA 상세 이벤트 확인
kubectl describe hpa auth-service-hpa -n saas-platform
```

### 7.4 스케일링 시 주의사항

```
수평 스케일링 전 확인사항:

1. Stateless인가?
   - 로컬 파일 저장, 인메모리 세션: 스케일링 불가
   - DB/Redis 기반 세션: 스케일링 가능

2. DB 연결 풀 계산
   - Pod 10개 × 연결 풀 10개 = DB 연결 100개
   - PostgreSQL 기본 max_connections: 100 → 풀 설정 조정 필요

3. 스케일 인(감소) 시 요청 처리 중인 Pod 보호
   - terminationGracePeriodSeconds: 30  (기본값)
   - preStop hook으로 연결 드레인

4. 배포 전략 확인
   - maxUnavailable: 0  → 스케일 다운 중에도 최소 유지
```

---

## 8. DB 연결 풀 최적화

### 8.1 Prisma 연결 풀 설정

```typescript
// prisma/client.ts — 연결 풀 최적화
export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Prisma 연결 풀 설정 (DATABASE_URL 쿼리 파라미터로도 설정 가능)
})

// 또는 DATABASE_URL에서:
// postgresql://user:pass@host:5432/db?connection_limit=5&pool_timeout=10
```

**연결 풀 크기 계산 공식:**

```
적절한 연결 풀 크기 = CPU 코어 수 × 2 + 1

예시:
- 서비스 CPU: 250m → 0.25 코어
- 연결 풀: 0.25 × 2 + 1 ≈ 2개 (최소 2~5개)

Pod 10개 × 연결 풀 5개 = PostgreSQL 연결 50개
PostgreSQL max_connections = 100 → 안전 (50% 사용)
```

### 8.2 PgBouncer — 연결 풀링 프록시

```
문제: Pod 100개가 각자 연결 풀 10개 = DB 연결 1000개 필요
     PostgreSQL max_connections 기본값: 100 → 연결 실패!

해결: PgBouncer를 중간에 배치

                    ┌──────────────────┐
Pod 100개 ──────→   │   PgBouncer      │  ──→  PostgreSQL
(각자 연결 10개)    │  연결 50개로 합침  │      (연결 50개)
                    └──────────────────┘

PgBouncer가 트랜잭션 단위로 연결을 재사용
→ 실제 PostgreSQL 연결은 50개로 유지 가능
```

```yaml
# Helm values.yaml — PgBouncer 활성화
pgbouncer:
  enabled: true
  poolMode: transaction       # transaction 모드 (권장)
  maxClientConn: 1000         # 최대 클라이언트 연결 수
  defaultPoolSize: 20         # 서비스당 실제 DB 연결 수
  minPoolSize: 5
```

### 8.3 연결 풀 모니터링

```bash
# PgBouncer 통계 확인
kubectl exec -n saas-platform <pgbouncer-pod> -- psql -p 6432 pgbouncer -c "SHOW POOLS"

# 출력:
# database  | user  | cl_active | cl_waiting | sv_active | sv_idle | maxwait
# saasdb    | app   | 45        | 0          | 20        | 5       | 0

# cl_waiting > 0: 연결 대기 중 (풀 크기 늘려야 함)
# maxwait > 0: 연결 대기 시간 (높으면 성능 문제)
```

```
# Prometheus PromQL로 연결 풀 모니터링
pgbouncer_pools_cl_waiting{database="saasdb"}  # 대기 클라이언트 수
pgbouncer_pools_sv_idle{database="saasdb"}     # 유휴 서버 연결 수
```

---

## 9. 핵심 PromQL 쿼리 모음

Grafana Explore → Prometheus에서 다음 쿼리를 사용합니다.

### 9.1 지연 시간 분석

```promql
# P99 응답 시간 (서비스별)
histogram_quantile(0.99,
  sum by(service, le) (
    rate(http_request_duration_seconds_bucket{
      namespace="saas-platform"
    }[5m])
  )
)

# P95 응답 시간 (특정 엔드포인트)
histogram_quantile(0.95,
  rate(http_request_duration_seconds_bucket{
    service="user-service",
    path="/api/v1/users/profile"
  }[5m])
)

# 평균 응답 시간
rate(http_request_duration_seconds_sum{namespace="saas-platform"}[5m])
/
rate(http_request_duration_seconds_count{namespace="saas-platform"}[5m])
```

### 9.2 에러율 분석

```promql
# 전체 에러율 (5xx)
sum(rate(http_requests_total{status=~"5..", namespace="saas-platform"}[5m]))
/
sum(rate(http_requests_total{namespace="saas-platform"}[5m]))

# 서비스별 에러율
sum by(service) (
  rate(http_requests_total{status=~"5..", namespace="saas-platform"}[5m])
)
/
sum by(service) (
  rate(http_requests_total{namespace="saas-platform"}[5m])
)

# 특정 서비스 에러율 (임계값 표시용)
sum(rate(http_requests_total{service="auth-service", status=~"5.."}[5m]))
/
sum(rate(http_requests_total{service="auth-service"}[5m]))
```

### 9.3 CPU 포화도 분석

```promql
# Pod별 CPU 사용률 (%)
sum by(pod) (
  rate(container_cpu_usage_seconds_total{
    namespace="saas-platform",
    container!="POD"
  }[5m])
)
/
sum by(pod) (
  container_spec_cpu_quota{namespace="saas-platform"}
  /
  container_spec_cpu_period{namespace="saas-platform"}
)
* 100

# CPU Throttling 비율 (0에 가까울수록 좋음)
sum by(pod) (
  rate(container_cpu_cfs_throttled_seconds_total{
    namespace="saas-platform"
  }[5m])
)
/
sum by(pod) (
  rate(container_cpu_usage_seconds_total{
    namespace="saas-platform"
  }[5m])
)
```

### 9.4 메모리 압박 분석

```promql
# Pod별 메모리 사용률 (%)
container_memory_working_set_bytes{
  namespace="saas-platform",
  container!="POD"
}
/
container_spec_memory_limit_bytes{
  namespace="saas-platform"
}
* 100

# 메모리 사용량 추세 (1시간 변화율 — 누수 감지)
deriv(
  container_memory_working_set_bytes{
    namespace="saas-platform",
    pod=~"user-service.*"
  }[1h]
)

# 전체 네임스페이스 메모리 사용량
sum(container_memory_working_set_bytes{namespace="saas-platform", container!="POD"})
```

### 9.5 트래픽 분석

```promql
# 초당 요청 수 (전체)
sum(rate(http_requests_total{namespace="saas-platform"}[1m]))

# 서비스별 RPS (Requests Per Second)
sum by(service) (
  rate(http_requests_total{namespace="saas-platform"}[1m])
)

# 지난 24시간 트래픽 패턴 (시간대별)
sum(rate(http_requests_total{namespace="saas-platform"}[5m]))
```

### 9.6 Grafana 알림 설정 — 성능 임계값

```yaml
# Grafana 알림 규칙 (YAML)
groups:
  - name: performance
    rules:
      # P99 지연 2초 초과 시 경고
      - alert: HighLatency
        expr: |
          histogram_quantile(0.99,
            rate(http_request_duration_seconds_bucket{namespace="saas-platform"}[5m])
          ) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "{{ $labels.service }} P99 지연 2초 초과"

      # 에러율 5% 초과 시 위험
      - alert: HighErrorRate
        expr: |
          sum(rate(http_requests_total{status=~"5..", namespace="saas-platform"}[5m]))
          /
          sum(rate(http_requests_total{namespace="saas-platform"}[5m]))
          > 0.05
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "에러율 5% 초과: {{ $value | humanizePercentage }}"

      # 메모리 사용률 90% 초과 시 경고
      - alert: HighMemoryUsage
        expr: |
          container_memory_working_set_bytes{namespace="saas-platform"}
          /
          container_spec_memory_limit_bytes{namespace="saas-platform"}
          > 0.9
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "{{ $labels.pod }} 메모리 사용률 90% 초과"
```

---

## 관련 문서

- [1절 자주 발생하는 오류](01-common-errors.md)
- [2절 디버깅 방법론](02-debugging-guide.md) — kubectl, k9s, stern
- [5장 모니터링 — Prometheus 기초](../05-monitoring/metrics/01-prometheus-basics.md)
- [5장 모니터링 — 분산 추적](../05-monitoring/tracing/01-tempo-otel.md)

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.1.0 | 2026-04-12 | 캐시 패턴, 연결 풀, 수평 스케일링, PromQL 쿼리 대폭 보강 | Implementer (Sonnet) |
| 1.0.0 | 2026-04-11 | 초안 작성 | Implementer (Sonnet) |
