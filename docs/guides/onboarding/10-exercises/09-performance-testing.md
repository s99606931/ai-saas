# Lab 9: 성능 테스트 실습 — API 부하 테스트 및 병목 분석

> **문서 ID**: ONBOARD-10-09
> **버전**: 1.0.0 | **작성일**: 2026-04-12 | **작성자**: Implementer (Sonnet)
> **목적**: k6로 부하 테스트를 실행하고 Grafana에서 병목을 발견한 뒤 Prisma 쿼리와 Redis 캐싱으로 최적화한다
> **소요 시간**: 120~180분
> **난이도**: 중급
> **선행 문서**: `09-troubleshooting/03-performance-guide.md`, Lab 1~8 완료

---

## 목차

1. [학습 목표](#1-학습-목표)
2. [k6 기본 사용법](#2-k6-기본-사용법)
3. [부하 테스트 시나리오 작성](#3-부하-테스트-시나리오-작성)
4. [Grafana에서 결과 분석](#4-grafana에서-결과-분석)
5. [병목 발견 후 최적화](#5-병목-발견-후-최적화)
6. [최적화 전후 성능 비교](#6-최적화-전후-성능-비교)
7. [SLO 달성 여부 확인](#7-slo-달성-여부-확인)
8. [학습 체크리스트](#학습-체크리스트)
9. [다음 단계](#다음-단계)

---

## 1. 학습 목표

이 실습을 완료하면 다음을 할 수 있습니다.

- k6로 실제 API에 부하 테스트를 실행하고 결과를 해석한다
- Grafana 대시보드에서 레이턴시, 오류율, DB 커넥션 풀 상태를 읽는다
- `EXPLAIN ANALYZE`로 슬로우 쿼리를 찾고 인덱스로 개선한다
- Prisma `select`로 N+1 쿼리 문제를 해결한다
- Redis 캐싱을 추가하고 성능 개선 전후를 수치로 비교한다
- SLO 임계값 달성 여부를 데이터로 증명한다

### 1.1 목표 성능 지표 (SLO)

이 실습의 최종 목표입니다. 최적화 후 아래 수치를 달성해야 합니다.

| 지표 | 목표값 | 측정 방법 |
|------|------|---------|
| P95 응답 시간 | < 500ms | k6 `http_req_duration` |
| P99 응답 시간 | < 1000ms | k6 `http_req_duration` |
| 에러율 | < 1% | k6 `http_req_failed` |
| 처리량 | > 50 req/s | k6 `http_reqs` |
| DB 커넥션 풀 사용률 | < 80% | Grafana `pg_stat_activity` |

---

## 2. k6 기본 사용법

### 2.1 k6 설치

```bash
# Ubuntu/Debian (WSL2 포함)
sudo gpg -k
sudo gpg --no-default-keyring \
  --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 \
  --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | \
  sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# macOS
brew install k6

# 버전 확인
k6 version
# 출력: k6 v0.51.0 (...)
```

### 2.2 k6 스크립트 기본 구조

```javascript
// k6 스크립트는 자바스크립트(ES6+) 로 작성합니다
// TypeScript가 아닙니다 — 타입 선언 없이 작성하십시오

import http from 'k6/http';
import { check, sleep } from 'k6';

// 테스트 설정 (옵션)
export const options = {
  vus: 10,          // Virtual Users (동시 사용자 수)
  duration: '30s',  // 테스트 지속 시간
};

// 기본 함수 — VU마다 반복 실행됨
export default function () {
  // HTTP 요청
  const response = http.get('http://localhost:3001/api/tenants');

  // 검증 (check 실패 시 카운터 증가, 테스트 중단 아님)
  check(response, {
    '상태 코드가 200이어야 한다': (r) => r.status === 200,
    '응답에 data 필드가 있어야 한다': (r) => {
      const body = JSON.parse(r.body);
      return Array.isArray(body.data);
    },
    '응답 시간이 500ms 미만이어야 한다': (r) => r.timings.duration < 500,
  });

  // VU 간 대기 시간 (실제 사용자처럼 행동)
  sleep(1);  // 1초 대기 후 다음 반복
}
```

### 2.3 k6 주요 메트릭 이해

```
k6 실행 후 출력되는 메트릭:

http_req_duration.........: avg=45.23ms  min=12.1ms   med=38.5ms   max=2.1s
                             p(90)=78.3ms p(95)=124ms  p(99)=890ms

해석:
- avg: 평균 응답 시간 (과부하 감지에 부적합, 이상치에 취약)
- p(95): 95번째 백분위 — 100개 요청 중 95개가 이 시간 이내 완료
- p(99): 99번째 백분위 — 가장 느린 1%
- max: 최대 응답 시간 (이상치일 수 있으므로 주의)

http_req_failed...........: 0.5%   ✓ 5 ✗ 995  ← 실패율과 성공/실패 건수

http_reqs.................: 1000   16.67/s    ← 총 요청 수, 초당 요청 수

vus.......................: 10               ← 동시 사용자 수
vus_max...................: 10
iterations...............: 1000   16.67/s    ← 함수 실행 횟수 (=요청 수)
```

```mermaid
graph LR
    subgraph "k6 메트릭 계층"
        P50["P50 중앙값\n일반 사용자 경험"]
        P95["P95\nSLO 기준"]
        P99["P99\n느린 케이스"]
        MAX["MAX\n이상치"]
    end
    P50 --> P95 --> P99 --> MAX
    style P95 fill:#2196F3,color:#fff
    style P99 fill:#FF9800,color:#fff
    style MAX fill:#f44336,color:#fff
```

---

## 3. 부하 테스트 시나리오 작성

### 3.1 기본 시나리오: 100 VU, 5분간 테스트

```bash
mkdir -p /data/ai-saas/tests/performance
```

```javascript
// /data/ai-saas/tests/performance/01-basic-load.js
// Lab 9 실습: 기본 부하 테스트
// 목표: /api/tenants 엔드포인트의 기본 성능 특성 파악

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// 커스텀 메트릭 정의
const errorRate = new Rate('error_rate');
const responseTime = new Trend('response_time_custom');

export const options = {
  stages: [
    { duration: '1m', target: 20 },   // 1분간 0→20 VU 증가 (워밍업)
    { duration: '3m', target: 100 },  // 3분간 100 VU 유지 (정상 부하)
    { duration: '1m', target: 0 },    // 1분간 100→0 VU 감소 (쿨다운)
  ],
  // 임계값: 이 기준을 초과하면 테스트 실패로 표시
  thresholds: {
    'http_req_duration': [
      'p(95)<500',   // P95 < 500ms
      'p(99)<1000',  // P99 < 1000ms
    ],
    'http_req_failed': ['rate<0.01'],  // 에러율 < 1%
    'error_rate': ['rate<0.01'],
  },
};

// 테스트 환경 설정
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'test-super-admin-token';

// 공통 헤더
const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${AUTH_TOKEN}`,
  'x-user-role': 'SUPER_ADMIN',
};

export default function () {
  // 시나리오 1: 테넌트 목록 조회
  const listResponse = http.get(`${BASE_URL}/api/tenants?page=1&pageSize=20`, { headers });

  const listOk = check(listResponse, {
    '테넌트 목록 200 OK': (r) => r.status === 200,
    '테넌트 목록 data 배열 포함': (r) => {
      try {
        return Array.isArray(JSON.parse(r.body).data);
      } catch {
        return false;
      }
    },
    'P95 < 500ms': (r) => r.timings.duration < 500,
  });

  errorRate.add(!listOk);
  responseTime.add(listResponse.timings.duration);

  sleep(1);

  // 시나리오 2: 플랜 목록 조회 (캐시 효과 측정)
  const planResponse = http.get(`${BASE_URL}/api/plans`, { headers });
  check(planResponse, {
    '플랜 목록 200 OK': (r) => r.status === 200,
  });

  sleep(0.5);
}
```

### 3.2 임계값(Threshold) 설정 심화

```javascript
// 임계값 설정 방법 예시
export const options = {
  thresholds: {
    // 절대값 기준
    'http_req_duration': ['p(95)<500'],   // 95% 요청이 500ms 이내

    // 비율 기준
    'http_req_failed': ['rate<0.01'],     // 실패율 1% 미만

    // 특정 API만 임계값 적용 (태그 활용)
    'http_req_duration{name:tenants}': ['p(95)<300'],  // /api/tenants는 300ms 이내
    'http_req_duration{name:plans}': ['p(95)<100'],    // /api/plans은 100ms 이내 (캐시 기대)

    // 복합 조건
    'http_req_duration': [
      'p(95)<500',
      'p(99)<1000',
      'avg<200',     // 평균도 200ms 이하
    ],
  },
};
```

### 3.3 스파이크 테스트: 갑자기 500 VU까지 올리기

```javascript
// /data/ai-saas/tests/performance/02-spike-test.js
// Lab 9 실습: 스파이크 테스트
// 목표: 갑작스러운 트래픽 급증 시 서비스 동작 확인

import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // 정상 트래픽
    { duration: '10s', target: 500 },  // 갑자기 500 VU로 스파이크! (10초만에)
    { duration: '2m', target: 500 },   // 2분간 유지
    { duration: '10s', target: 10 },   // 정상으로 복귀
    { duration: '30s', target: 0 },    // 종료
  ],
  thresholds: {
    // 스파이크 테스트에서는 임계값을 완화 (서비스 생존 여부 확인 목적)
    'http_req_duration': ['p(95)<2000'],  // 500ms → 2초로 완화
    'http_req_failed': ['rate<0.05'],     // 1% → 5%로 완화
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

export default function () {
  const response = http.get(`${BASE_URL}/api/tenants`, {
    tags: { name: 'tenants-spike' },
  });

  check(response, {
    '서비스가 응답하고 있다 (503 아님)': (r) => r.status !== 503,
    '응답 코드가 2xx 또는 429': (r) => r.status < 500 || r.status === 429,
  });

  // 스파이크 테스트에서는 대기 시간 최소화
  sleep(0.1);
}
```

### 3.4 실제 사용자 시나리오 (복합 시나리오)

```javascript
// /data/ai-saas/tests/performance/03-user-journey.js
// Lab 9 실습: 실제 사용자 여정 시뮬레이션
// 목표: CRUD 전체 플로우의 성능 특성 파악

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { SharedArray } from 'k6/data';

export const options = {
  scenarios: {
    // 시나리오 1: 읽기 전용 사용자 (70%)
    read_only_users: {
      executor: 'constant-vus',
      vus: 70,
      duration: '5m',
      exec: 'readOnlyFlow',
    },
    // 시나리오 2: 관리자 사용자 (30%)
    admin_users: {
      executor: 'constant-vus',
      vus: 30,
      duration: '5m',
      exec: 'adminFlow',
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<500'],
    'http_req_failed': ['rate<0.01'],
    // 그룹별 임계값
    'group_duration{group:::테넌트 조회}': ['p(95)<300'],
    'group_duration{group:::플랜 변경}': ['p(95)<1000'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

// 읽기 전용 사용자 플로우
export function readOnlyFlow() {
  group('테넌트 조회', () => {
    const r = http.get(`${BASE_URL}/api/tenants?page=1&pageSize=10`, {
      headers: { 'x-user-role': 'TENANT_ADMIN' },
      tags: { name: 'list-tenants' },
    });
    check(r, { '200 OK': (resp) => resp.status === 200 });
  });

  sleep(2);

  group('플랜 목록 조회', () => {
    const r = http.get(`${BASE_URL}/api/plans`, {
      tags: { name: 'list-plans' },
    });
    check(r, { '200 OK': (resp) => resp.status === 200 });
  });

  sleep(1);
}

// 관리자 플로우 (읽기 + 쓰기)
export function adminFlow() {
  group('테넌트 조회', () => {
    const r = http.get(`${BASE_URL}/api/tenants`, {
      headers: { 'x-user-role': 'SUPER_ADMIN' },
      tags: { name: 'list-tenants-admin' },
    });
    check(r, { '200 OK': (resp) => resp.status === 200 });
  });

  sleep(3);
}
```

### 3.5 테스트 실행 방법

```bash
# 기본 테스트 실행
k6 run tests/performance/01-basic-load.js

# 환경 변수 전달
k6 run \
  --env BASE_URL=http://localhost:3001 \
  --env AUTH_TOKEN=your-token \
  tests/performance/01-basic-load.js

# JSON 결과 저장
k6 run --out json=results/basic-load-$(date +%Y%m%d-%H%M%S).json \
  tests/performance/01-basic-load.js

# 그라파나 InfluxDB에 결과 전송 (실시간 대시보드)
k6 run \
  --out influxdb=http://localhost:8086/k6 \
  tests/performance/01-basic-load.js

# 스파이크 테스트 (임계값 위반 예상)
k6 run tests/performance/02-spike-test.js
```

---

## 4. Grafana에서 결과 분석

### 4.1 k6 대시보드 임포트하기

Grafana에서 k6 결과를 시각화하려면 공식 대시보드를 임포트합니다.

```bash
# Grafana 접속 (기본 포트)
open http://localhost:3000
# 또는
kubectl port-forward svc/grafana 3000:80 -n monitoring
```

```
대시보드 임포트 절차:
1. Grafana 좌측 메뉴 → Dashboards → Import
2. "Import via grafana.com" 입력란에: 2587
   (k6 Load Testing Results 공식 대시보드 ID)
3. "Load" 클릭
4. 데이터 소스: InfluxDB 선택
5. "Import" 클릭
```

수동 대시보드 생성 (InfluxDB 없이 Prometheus 사용 시):

```
Grafana에서 새 패널 생성:
1. + New Panel
2. 쿼리 입력: (k6 결과가 Prometheus에 저장된 경우)
   http_req_duration_p95{job="k6"}

3. 또는 Grafana Explore에서 직접 쿼리:
   k6_http_req_duration_p(95)
```

### 4.2 API 레이턴시 패널 보기

```
API 레이턴시 패널 읽는 방법:

그래프 형태:
  응답|   스파이크 구간 →  ████
  시간|                 ████████
  (ms)|         ████████████████
     |█████████████████████████
     |________________________
     0분   1분   2분   3분   4분   5분

패널 메트릭:
- 상단 선 (빨강): P99 — 가장 느린 1%
- 중간 선 (주황): P95 — SLO 기준선
- 하단 선 (초록): P50 중앙값

정상 상태:
- P95 선이 500ms 기준선 아래 유지
- 스파이크 구간에서 일시 상승 후 복귀

문제 상태:
- P95 선이 지속적으로 500ms 초과
- 스파이크 후 원래 수준으로 복귀 안 됨
- P50과 P99 차이가 10배 이상 (이상치 많음)
```

```mermaid
graph TD
    subgraph "Grafana 패널 읽기 순서"
        STEP1["1. API 레이턴시 패널\n- P95 기준선(500ms) 초과 여부\n- 스파이크 구간 확인"]
        STEP2["2. 에러율 패널\n- 5xx 에러 발생 시점\n- 에러 유형 분류"]
        STEP3["3. DB 커넥션 풀 패널\n- 풀 사용률이 80% 초과하는지\n- 대기 연결 수 확인"]
        STEP4["4. Redis 메트릭 패널\n- 캐시 히트율\n- 커맨드 레이턴시"]
    end
    STEP1 --> STEP2 --> STEP3 --> STEP4
```

### 4.3 DB 커넥션 풀 패널 보기

```bash
# Prometheus에서 DB 연결 수 확인 쿼리
# Grafana Explore에서 실행:

# 현재 활성 연결 수
pg_stat_activity_count{state="active"}

# 대기 중인 연결 수 (커넥션 풀 고갈 신호)
pg_stat_activity_count{wait_event_type="Lock"}

# 연결 풀 사용률 (%) — 목표: 80% 미만
pg_stat_activity_count / pg_settings_max_connections * 100
```

```
DB 커넥션 풀 패널 정상 vs 문제:

정상:
  활성 연결: 5~20개 (안정적)
  대기 연결: 0 (대기 없음)
  풀 사용률: < 50%

문제:
  활성 연결: 갑자기 100개+ 급증
  대기 연결: 10개+ (풀 고갈)
  풀 사용률: 90%+ → 연결 타임아웃 발생

해결:
  1. DATABASE_URL에 connection_limit 증가 (빠른 임시 해결)
  2. 쿼리 최적화로 연결 점유 시간 단축 (근본 해결)
  3. 읽기 전용 복제본 추가 (장기적 해결)
```

### 4.4 k6 실행 결과 직접 분석

```bash
# 기본 테스트 실행 후 결과 확인
k6 run tests/performance/01-basic-load.js 2>&1 | tee results/test-output.txt

# 임계값 통과 여부 확인
grep "✓\|✗\|PASSED\|FAILED" results/test-output.txt

# 기대 출력 (임계값 미통과 시):
#    ✗ p(95)<500
#      ↳  96% — ✓ 96 / ✗ 4    ← 95% 요청이 500ms 이내이지만 임계값 미충족
#    ✓ p(99)<1000
#    ✗ rate<0.01
#      ↳  1.2%                 ← 에러율 1.2% (목표 1% 초과)
#
# FAILED: 1 thresholds have been met
```

---

## 5. 병목 발견 후 최적화

### 5.1 슬로우 쿼리 찾기 — EXPLAIN ANALYZE

```bash
# 1. DB 접속
kubectl port-forward svc/postgresql 5432:5432 -n saas-platform &
psql $DATABASE_URL
# 또는 로컬
psql postgresql://user:pass@localhost:5432/saas_db
```

```sql
-- 2. 현재 느린 쿼리 상위 10개 확인
SELECT
  query,
  calls,
  total_exec_time / calls AS avg_exec_ms,
  rows / calls AS avg_rows
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 10;

-- 3. 특정 쿼리 EXPLAIN ANALYZE
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT t.*, u.email, u.name
FROM "Tenant" t
LEFT JOIN "User" u ON u."tenantId" = t.id
WHERE t.status = 'ACTIVE'
ORDER BY t."createdAt" DESC
LIMIT 20;
```

```
EXPLAIN ANALYZE 결과 해석 예시:

-- 문제 있는 결과:
Limit  (cost=0.00..2456.78 rows=20 width=256)
       (actual time=4215.123..4215.890 rows=20 loops=1)
  -> Seq Scan on "Tenant"                     ← 인덱스 미사용! (Seq Scan)
       Filter: (status = 'ACTIVE')
       Rows Removed by Filter: 99980          ← 10만 행 스캔 후 20개만 사용
       actual time=0.015..4214.456

Execution Time: 4216.123 ms                   ← 4.2초 쿼리

-- 최적화 후 결과:
Limit  (cost=0.43..8.49 rows=20 width=256)
       (actual time=0.123..0.456 rows=20 loops=1)
  -> Index Scan using idx_tenant_status on "Tenant"  ← 인덱스 사용!
       Index Cond: (status = 'ACTIVE')
       actual time=0.041..0.398

Execution Time: 0.523 ms                      ← 0.5ms (8000배 개선!)
```

### 5.2 인덱스 추가

```bash
# Prisma 스키마에 인덱스 추가
code /data/ai-saas/platform/packages/database/prisma/schema.prisma
```

```prisma
// schema.prisma — 인덱스 추가 예시
model Tenant {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique
  status      String   @default("ACTIVE")
  createdAt   DateTime @default(now())
  // ... 기타 필드

  @@index([status])                    // status 단일 인덱스
  @@index([status, createdAt])         // 복합 인덱스 (status + 정렬)
  @@index([createdAt(sort: Desc)])     // 최신순 정렬 최적화
}

model User {
  id       String @id @default(cuid())
  tenantId String
  email    String

  @@index([tenantId])                  // 테넌트별 조회 최적화 (필수!)
  @@index([tenantId, email])           // 테넌트+이메일 복합 인덱스
}
```

```bash
# 마이그레이션 생성 및 적용
cd /data/ai-saas
pnpm exec prisma migrate dev --name add_performance_indexes

# 마이그레이션 파일 확인
cat prisma/migrations/*/migration.sql
# 출력:
# CREATE INDEX "Tenant_status_idx" ON "Tenant"("status");
# CREATE INDEX "Tenant_status_createdAt_idx" ON "Tenant"("status", "createdAt" DESC);
# CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");
```

### 5.3 Prisma select로 N+1 문제 해결

```typescript
// N+1 문제: 테넌트 목록 조회 시 각 테넌트마다 별도 쿼리 발생
// ❌ 문제 있는 코드
const tenants = await prisma.tenant.findMany({ take: 20 });
const tenantsWithUsers = await Promise.all(
  tenants.map(async (tenant) => {
    const userCount = await prisma.user.count({      // N번 추가 쿼리!
      where: { tenantId: tenant.id },
    });
    return { ...tenant, userCount };
  }),
);
// 결과: 1 + N 쿼리 = 21개 쿼리 (N=20인 경우)

// ✅ 올바른 코드: include와 _count 활용
const tenantsWithCount = await prisma.tenant.findMany({
  where: { status: 'ACTIVE' },
  take: 20,
  orderBy: { createdAt: 'desc' },
  select: {
    // 필요한 필드만 선택 (불필요한 컬럼 전송 제거)
    id: true,
    name: true,
    slug: true,
    status: true,
    createdAt: true,
    // N+1 없이 집계
    _count: {
      select: { users: true },
    },
  },
});
// 결과: 1개 쿼리로 모든 정보 가져오기
```

실제 tenant-service에 적용:

```typescript
// platform/services/tenant-service/src/handlers/tenant.handler.ts 수정
// Lab 9 실습: N+1 최적화 적용
// Design Ref: Lab9 §Step3 — Prisma select 최적화

export async function listTenantsHandler(
  request: FastifyRequest<{ Querystring: ListTenantsQuery }>,
  reply: FastifyReply,
): Promise<void> {
  const { page = 1, pageSize = 20, status, search } = /* 파싱 로직 */ {} as any;

  const where = {
    ...(status ? { status } : {}),
    ...(search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' as const } },
        { slug: { contains: search, mode: 'insensitive' as const } },
      ],
    } : {}),
  };

  // ✅ 최적화된 쿼리: select로 필요한 필드만, _count로 N+1 방지
  const [tenants, total] = await Promise.all([
    prisma.tenant.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        createdAt: true,
        maxUsers: true,
        _count: {
          select: { users: true }, // 사용자 수 집계 (추가 쿼리 없음)
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.tenant.count({ where }),
  ]);

  await reply.send({
    success: true,
    data: tenants.map((t) => ({
      ...t,
      userCount: t._count.users,
    })),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}
```

### 5.4 Redis 캐싱 추가

자주 조회되지만 변경이 적은 데이터에 Redis 캐싱을 적용합니다.

```typescript
// platform/services/subscription-service/src/handlers/subscription.handler.ts
// Lab 9 실습: 플랜 목록 캐싱 추가
// Design Ref: Lab9 §Step4 — Redis 캐싱

import { redis, connectRedis } from '../lib/redis.js';

const PLANS_CACHE_KEY = 'plans:list:active';
const PLANS_CACHE_TTL_SECONDS = 300; // 5분 (플랜은 자주 바뀌지 않음)

/**
 * 플랜 목록 조회 (Redis 캐싱 적용)
 * 캐시 히트: ~1ms
 * 캐시 미스: DB 조회 후 캐시 저장 (최대 50ms)
 */
export async function listPlansHandlerCached(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  await connectRedis();

  // 1. 캐시 조회
  const cached = await redis.get(PLANS_CACHE_KEY);
  if (cached) {
    await reply.header('X-Cache', 'HIT').send({
      success: true,
      data: JSON.parse(cached),
      _cached: true,
    });
    return;
  }

  // 2. 캐시 미스: DB 조회
  const plans = await prisma.plan.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      slug: true,
      price: true,
      currency: true,
      interval: true,
      maxUsers: true,
      maxStorage: true,
    },
    orderBy: { price: 'asc' },
    take: 100,
  });

  // 3. 캐시 저장 (5분 TTL)
  await redis.setex(PLANS_CACHE_KEY, PLANS_CACHE_TTL_SECONDS, JSON.stringify(plans));

  await reply.header('X-Cache', 'MISS').send({ success: true, data: plans });
}

// 플랜 추가/수정 시 캐시 무효화 (캐시 일관성)
export async function invalidatePlansCache(): Promise<void> {
  await connectRedis();
  await redis.del(PLANS_CACHE_KEY);
}
```

**캐시 성능 측정**:

```bash
# X-Cache 헤더로 캐시 히트/미스 확인
for i in {1..5}; do
  curl -s -I http://localhost:3007/plans | grep X-Cache
done

# 출력:
# X-Cache: MISS    ← 첫 번째 요청: DB 조회
# X-Cache: HIT     ← 이후 요청: 캐시 반환 (매우 빠름)
# X-Cache: HIT
# X-Cache: HIT
# X-Cache: HIT
```

---

## 6. 최적화 전후 성능 비교

### 6.1 최적화 단계별 측정

각 최적화 단계 후 k6 테스트를 다시 실행하고 결과를 기록합니다.

```bash
# 각 단계 후 동일한 테스트 실행
# 결과를 별도 파일에 저장

# 최적화 전 (baseline)
k6 run --out json=results/baseline.json tests/performance/01-basic-load.js

# 인덱스 추가 후
k6 run --out json=results/after-index.json tests/performance/01-basic-load.js

# N+1 해결 후
k6 run --out json=results/after-n1-fix.json tests/performance/01-basic-load.js

# Redis 캐싱 후
k6 run --out json=results/after-redis.json tests/performance/01-basic-load.js
```

### 6.2 결과 비교 표

다음은 이 실습에서 달성 가능한 일반적인 개선 수치입니다.

| 최적화 단계 | P50 (ms) | P95 (ms) | P99 (ms) | 에러율 | req/s |
|-----------|---------|---------|---------|------|------|
| **최적화 전 (Baseline)** | 180 | 850 | 2100 | 2.3% | 18 |
| 인덱스 추가 후 | 85 | 380 | 920 | 0.8% | 38 |
| N+1 해결 후 | 45 | 210 | 480 | 0.3% | 65 |
| **Redis 캐싱 후 (최종)** | **12** | **85** | **180** | **0.1%** | **120+** |
| SLO 목표 | - | < 500 | < 1000 | < 1% | > 50 |

```
성능 개선 요약:
- P95: 850ms → 85ms (10배 개선)
- 처리량: 18 req/s → 120+ req/s (6배 개선)
- 에러율: 2.3% → 0.1% (23배 개선)
```

### 6.3 k6 결과 JSON 파싱 스크립트

```bash
# /data/ai-saas/tests/performance/compare-results.sh 생성
#!/bin/bash
# 최적화 전후 결과 비교

echo "=== 성능 테스트 결과 비교 ==="
echo ""

for result_file in results/baseline.json results/after-index.json results/after-n1-fix.json results/after-redis.json; do
  if [ -f "$result_file" ]; then
    label=$(basename "$result_file" .json)
    p95=$(cat "$result_file" | jq '[.[] | select(.type == "Point" and .metric == "http_req_duration") | .data.value] | sort | .[length * 0.95 | floor]' 2>/dev/null || echo "N/A")
    echo "$label: P95=${p95}ms"
  fi
done
```

### 6.4 Grafana에서 전후 비교

```
Grafana Time Range 활용:
1. 최적화 전 테스트: 14:00~14:10
2. 인덱스 추가 후 테스트: 14:20~14:30
3. 최종 테스트: 14:40~14:50

Grafana에서:
- 상단 시간 범위를 "Last 1 hour"로 설정
- 각 구간에 Annotation 추가 (Add Annotation → "인덱스 추가")
- 같은 패널에서 전후 추세 비교
```

---

## 7. SLO 달성 여부 확인

### 7.1 k6 임계값으로 자동 확인

```bash
# 최종 최적화 후 SLO 임계값 테스트
k6 run tests/performance/01-basic-load.js

# 임계값 통과 시 출력:
#    ✓ p(95)<500
#       ↳  100% — ✓ 1000 / ✗ 0
#    ✓ p(99)<1000
#       ↳  100% — ✓ 1000 / ✗ 0
#    ✓ rate<0.01
#       ↳  0.1% — ✓ 999 / ✗ 1
#
# ✓ Thresholds: 3 of 3 passed
# ✓ Checks: 3000 of 3000 (100%)
```

### 7.2 지속적 SLO 모니터링 설정

```yaml
# Grafana Alert 설정 (UI 또는 YAML)
# /data/ai-saas/monitoring/alerts/api-slo.yaml

groups:
  - name: api-slo-alerts
    rules:
      # P95 레이턴시 SLO 위반 알림
      - alert: APILatencyP95Exceeded
        expr: |
          histogram_quantile(0.95,
            rate(http_request_duration_seconds_bucket{
              job="tenant-service"
            }[5m])
          ) > 0.5
        for: 2m
        labels:
          severity: warning
          slo: latency
        annotations:
          summary: "API P95 레이턴시 SLO 위반"
          description: "tenant-service P95 레이턴시가 500ms를 초과했습니다 (현재: {{ $value }}s)"

      # 에러율 SLO 위반 알림
      - alert: APIErrorRateExceeded
        expr: |
          rate(http_requests_total{
            job="tenant-service",
            status_code=~"5.."
          }[5m]) /
          rate(http_requests_total{
            job="tenant-service"
          }[5m]) > 0.01
        for: 1m
        labels:
          severity: critical
          slo: error_rate
        annotations:
          summary: "API 에러율 SLO 위반"
          description: "에러율이 1%를 초과했습니다 (현재: {{ $value | humanizePercentage }})"
```

### 7.3 SLO 달성 증거 문서화

CSAP 감리에서 성능 요건 충족 증거로 제출할 수 있습니다.

```markdown
# 성능 테스트 결과 보고서
# (실습 완료 후 직접 작성하십시오)

## 테스트 일시
- 실행일: 2026-04-12
- 테스트 환경: 로컬 개발 (k3s 배포 후 재테스트 권장)

## 테스트 조건
- 도구: k6 v0.51.0
- 시나리오: 100 VU, 5분 지속
- 대상 API: /api/tenants, /api/plans

## 측정 결과
| 지표 | 목표 | 측정값 | 통과 여부 |
|------|------|-------|---------|
| P95 | < 500ms | 85ms | ✅ |
| P99 | < 1000ms | 180ms | ✅ |
| 에러율 | < 1% | 0.1% | ✅ |
| 처리량 | > 50 req/s | 120 req/s | ✅ |

## 적용한 최적화
1. Prisma 인덱스 추가 (Tenant.status, User.tenantId)
2. N+1 쿼리 제거 (select + _count)
3. Redis 캐싱 (플랜 목록, TTL 5분)

## 스크린샷 (Grafana)
[첨부: 부하 테스트 중 Grafana 대시보드 캡처]
```

### 7.4 SLO 미달성 시 진단 가이드

```mermaid
flowchart TD
    FAIL["SLO 미달성\nP95 > 500ms"] --> CHECK1{"DB 쿼리\n문제인가?"}
    CHECK1 -->|Seq Scan 발견| FIX_INDEX["인덱스 추가\n§5.2 참조"]
    CHECK1 -->|N+1 쿼리 발견| FIX_N1["select + include\n§5.3 참조"]
    CHECK1 -->|쿼리 정상| CHECK2{"Redis 캐시\n히트율 확인"}
    CHECK2 -->|히트율 < 80%| FIX_CACHE["캐싱 전략 재검토\n§5.4 참조"]
    CHECK2 -->|히트율 정상| CHECK3{"CPU/메모리\n병목인가?"}
    CHECK3 -->|CPU limit 초과| FIX_RESOURCE["Pod CPU limit 증가\n또는 HPA 설정"]
    CHECK3 -->|정상| CHECK4{"외부 API\n지연인가?"}
    CHECK4 -->|외부 API 느림| FIX_EXTERNAL["타임아웃 설정\n회로 차단기 적용"]
    CHECK4 -->|정상| DEEP["심층 분석 필요\nNode.js 프로파일링\n03-performance-guide.md §3"]

    style FAIL fill:#f44336,color:#fff
    style FIX_INDEX fill:#4caf50,color:#fff
    style FIX_N1 fill:#4caf50,color:#fff
    style FIX_CACHE fill:#4caf50,color:#fff
```

---

## 학습 체크리스트

이 실습을 완료하면 다음을 할 수 있어야 합니다.

**k6 사용법**

- [ ] k6 스크립트를 작성하고 실행할 수 있다
- [ ] stages로 램프업/정상/쿨다운 단계를 설정할 수 있다
- [ ] thresholds로 SLO 기준을 설정하고 통과 여부를 자동 확인할 수 있다
- [ ] 스파이크 테스트와 기본 부하 테스트의 차이를 설명할 수 있다
- [ ] k6 결과에서 P95, P99, 에러율을 읽고 해석할 수 있다

**Grafana 분석**

- [ ] k6 대시보드를 Grafana에 임포트할 수 있다
- [ ] API 레이턴시 패널에서 P95 기준선 초과 여부를 확인할 수 있다
- [ ] DB 커넥션 풀 패널에서 풀 고갈 징후를 발견할 수 있다
- [ ] 최적화 전후 구간을 Annotation으로 표시하고 비교할 수 있다

**병목 분석 및 최적화**

- [ ] EXPLAIN ANALYZE 결과에서 Seq Scan과 Index Scan의 차이를 설명할 수 있다
- [ ] Prisma 스키마에 인덱스를 추가하고 마이그레이션을 실행할 수 있다
- [ ] N+1 쿼리 문제를 발견하고 select + _count로 해결할 수 있다
- [ ] Redis 캐싱을 추가하고 X-Cache 헤더로 동작을 확인할 수 있다
- [ ] 최적화 전후 성능 수치를 표로 정리할 수 있다

**SLO 관리**

- [ ] P95 < 500ms, 에러율 < 1% SLO 달성을 수치로 증명할 수 있다
- [ ] Grafana Alert 규칙을 YAML로 작성할 수 있다
- [ ] SLO 미달성 시 원인 진단 플로우를 따라 해결책을 찾을 수 있다

---

## 다음 단계

이 실습을 완료했다면 다음으로 진행하십시오.

1. **온보딩 최종 평가**: `07-assessment.md` — 전체 온보딩 내용 종합 평가
2. **심화 성능 최적화**: `09-troubleshooting/03-performance-guide.md` — Redis 캐시 미스 분석, 수평 스케일링
3. **CI/CD 통합**: k6 테스트를 CI 파이프라인에 추가
   ```yaml
   # .gitea/workflows/performance-test.yml
   - name: k6 부하 테스트
     run: k6 run --threshold-abort tests/performance/01-basic-load.js
   ```
4. **관련 FAQ**: `11-faq/01-dev-faq.md` Q12 — DB 쿼리 최적화 질문

---

*문서 ID: ONBOARD-10-09 | 버전 1.0.0 | 2026-04-12*
