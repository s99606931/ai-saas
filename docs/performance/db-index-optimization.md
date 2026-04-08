# DB 인덱스 최적화 가이드

> Plan SC: FR-N19.1
> Design Ref: D-N19.1
> CSAP: D-07 가용성 (쿼리 성능 최적화)

| 항목 | 내용 |
|------|------|
| 버전 | 1.0.0 |
| 작성일 | 2026-04-08 |
| 대상 | prisma/schema.prisma (PostgreSQL) |

---

## 1. 현재 인덱스 목록

### User 모델

| 인덱스 | 유형 | 컬럼 | 상태 |
|--------|------|------|------|
| `@@unique([tenantId, email])` | 복합 유니크 | tenantId + email | 적절 |
| `@@index([tenantId])` | B-Tree | tenantId | 적절 |
| `@@index([email])` | B-Tree | email | 유지 (단독 이메일 검색 지원) |

### Session 모델

| 인덱스 | 유형 | 컬럼 | 상태 |
|--------|------|------|------|
| `token @unique` | 유니크 | token | 적절 (토큰 검증) |
| `refreshToken @unique` | 유니크 | refreshToken | 적절 |
| `@@index([userId])` | B-Tree | userId | 적절 (사용자 세션 조회) |
| `@@index([expiresAt])` | B-Tree | expiresAt | 적절 (만료 세션 정리) |

### AuditLog 모델

| 인덱스 | 유형 | 컬럼 | 상태 |
|--------|------|------|------|
| `@@index([tenantId, createdAt])` | 복합 B-Tree | tenantId + createdAt | 적절 (테넌트별 시간순 조회) |
| `@@index([actorId])` | B-Tree | actorId | 적절 (행위자별 로그 조회) |
| `@@index([action])` | B-Tree | action | 검토 필요 (아래 분석 참조) |
| `@@index([createdAt])` | B-Tree | createdAt | 검토 필요 (아래 분석 참조) |

### 기타 모델 인덱스

| 모델 | 인덱스 | 상태 |
|------|--------|------|
| Tenant | `@@index([slug])`, `@@index([status])` | 적절 |
| Subscription | `@@index([tenantId])`, `@@index([status])` | 개선 가능 |
| Invoice | `@@index([subscriptionId])`, `@@index([status])` | 검토 필요 |
| Customer | `@@index([status])` | 검토 필요 |
| Contract | `@@index([customerId])`, `@@index([status])` | 개선 가능 |
| MenuItem | `@@index([tenantId])`, `@@index([parentId])` | 적절 |
| AiUsage | `@@index([tenantId, createdAt])`, `@@index([modelId])` | 적절 |
| Notification | `@@index([userId, createdAt])`, `@@index([status])` | 적절 |
| File | `@@index([tenantId])`, `@@index([uploadedBy])` | 개선 가능 |

---

## 2. 인덱스 분석 및 권고

### 2.1 중복/과잉 인덱스 후보

#### AuditLog.createdAt 단독 인덱스

- **현재**: `@@index([createdAt])` 단독 + `@@index([tenantId, createdAt])` 복합
- **분석**: 대부분의 감사 로그 조회는 테넌트 컨텍스트에서 수행됨. 전체 시간 범위 조회는 관리자 보고서에서만 발생
- **권고**: **유지** -- 관리자 전체 기간 조회 시 단독 인덱스 필요. 다만 데이터 증가 시 파티셔닝 고려

#### AuditLog.action 인덱스

- **현재**: `@@index([action])` 단독
- **분석**: action 값은 'USER_LOGIN', 'USER_DELETE' 등 열거형. Cardinality가 낮아 B-Tree 효율 저하 가능
- **권고**: **조건부 유지** -- action 기반 필터링이 빈번하면 유지, 그렇지 않으면 복합 인덱스 `@@index([tenantId, action])` 전환 검토

#### Customer.status, Invoice.status 인덱스

- **현재**: `@@index([status])` 단독
- **분석**: status는 cardinality가 매우 낮음 (3~5개 값). B-Tree 효율 저하
- **권고**: **조건부 유지** -- 상태별 필터링이 대시보드에서 빈번하면 유지. 대안으로 복합 인덱스 전환

### 2.2 누락 인덱스 추가 권고

```prisma
// Subscription: 테넌트별 활성 구독 조회 최적화
model Subscription {
  // 기존 인덱스...
  @@index([tenantId, status])  // 추가 권고
}

// Contract: 고객별 계약 상태 조회 최적화
model Contract {
  // 기존 인덱스...
  @@index([customerId, status])  // 기존 개별 인덱스 대체
}

// File: 테넌트별 최근 파일 조회 최적화
model File {
  // 기존 인덱스...
  @@index([tenantId, createdAt])  // 추가 권고
}
```

### 2.3 부분 인덱스 (Prisma v7.4+ 지원 시)

```sql
-- 활성 세션만 인덱싱 (만료 세션 제외)
CREATE INDEX idx_session_active ON "Session" ("expiresAt")
  WHERE "expiresAt" > NOW();

-- 미결 청구서만 인덱싱
CREATE INDEX idx_invoice_pending ON "Invoice" ("status")
  WHERE "status" IN ('draft', 'issued');
```

---

## 3. 쿼리 성능 모니터링

### EXPLAIN ANALYZE 사용법

```sql
-- 인덱스 사용 여부 확인
EXPLAIN ANALYZE
SELECT * FROM "AuditLog"
WHERE "tenantId" = 'tenant_123'
  AND "createdAt" > '2026-01-01'
ORDER BY "createdAt" DESC
LIMIT 100;

-- 결과 확인: Index Scan 또는 Index Only Scan이면 정상
-- Seq Scan이면 인덱스 미사용 (추가 필요)
```

### pg_stat_user_indexes로 미사용 인덱스 탐지

```sql
SELECT
  schemaname,
  relname AS table_name,
  indexrelname AS index_name,
  idx_scan AS times_used,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;
```

---

## 4. 인덱스 관리 체크리스트

- [ ] 분기별 미사용 인덱스 점검 (pg_stat_user_indexes)
- [ ] 신규 쿼리 추가 시 EXPLAIN ANALYZE 실행
- [ ] 테이블 데이터 100만 행 초과 시 파티셔닝 검토
- [ ] 인덱스 재구축 (REINDEX) 분기별 실행

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-08 | 초안 작성 | PM Lead Agent |
