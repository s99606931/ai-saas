# Design: 데모 배포 + E2E 테스트 패키지

> **버전**: 1.0.0 | **작성일**: 2026-04-06
> **Plan 참조**: docs/01-plan/features/demo-deployment.plan.md
> **PDCA 단계**: Design

---

## 아키텍처 결정

### MTU-DEP1: 포털 DB 연동 방식

| 옵션 | 설명 | 결정 |
|------|------|------|
| A: 서비스 API 경유 | 포털 → API Gateway → 각 서비스 | 서비스 미기동 시 불가 |
| **B: Prisma 직접** | 포털 Server Component → Prisma → PostgreSQL | **선택** — 데모 환경 단순화 |
| C: Mock API | 정적 JSON 반환 | DB 연동 목적에 부합 X |

**선택 이유**: 데모 환경에서 15개 서비스를 모두 기동할 필요 없이 PostgreSQL만으로 실DB 데이터 화면 제공 가능.

### MTU-DEMO1: 시드 데이터 구조

```
[슈퍼 관리자]
  └── superadmin@platform.go.kr (SUPER_ADMIN)

[행안부 데모 테넌트] slug: mois-demo (ACTIVE)
  ├── admin@mois-demo.go.kr (TENANT_ADMIN)
  ├── user1@mois-demo.go.kr (USER)
  ├── user2@mois-demo.go.kr (USER)
  └── auditor@mois-demo.go.kr (AUDITOR)
  └── Subscription: 표준형 (ACTIVE)

[국토부 데모 테넌트] slug: molit-demo (TRIAL)
  ├── admin@molit-demo.go.kr (TENANT_ADMIN)
  └── user@molit-demo.go.kr (USER)
  └── Subscription: 기본형 (TRIALING)

[SaaS 서비스 카탈로그]
  ├── 전자문서관리시스템 (edms)
  ├── AI 정책 분석 (ai-policy)
  ├── 공공데이터 포털 (data-portal)
  ├── 통합보안감사 (security-audit)
  └── ERP 연동 허브 (erp-hub)

[플랜]
  ├── 기본형 (300,000 KRW/month)
  ├── 표준형 (800,000 KRW/month)
  └── 기업형 (2,000,000 KRW/month)
```

### MTU-E2E1: 테스트 전략

```
포털 (Next.js, port 4000)
  │
  ├── API Routes 검증 (Playwright request API)
  │    GET /api/dashboard/stats  → 200, tenants>0
  │    GET /api/tenants          → 200, total>0
  │    GET /api/users            → 200, users[].role 존재
  │    GET /api/compliance/csap  → 200, domains[].rate>0
  │
  └── UI 검증 (page.getByText)
       대시보드 → 통계 카드 4개
       테넌트 목록 → 행안부/국토부 표시
       CSAP 준수 → 분야별 항목 수

전략: 정적 포털의 현실을 감안, API 검증 우선 + UI 텍스트 기반 검증 병행
```

### MTU-Q1: API 게이트웨이 개선

| 개선 항목 | 기존 | 개선 후 |
|---------|------|--------|
| `/ready` | 서비스 목록만 반환 | 실제 `/health` ping 결과 포함 |
| `/health/services` | 없음 | 신규 — 2초 타임아웃, 병렬 확인 |
| 동적 프록시 쿼리스트링 | 누락 | `?param=value` 보존 |

---

## API Routes 명세 (FR-DEP1.1~1.6)

### GET /api/dashboard/stats
```typescript
Response: {
  tenants: number,          // Tenant.count()
  users: number,            // User.count()
  activeSubscriptions: number, // Subscription.count({status: ACTIVE})
  revenue: number           // Invoice.aggregate(sum)
}
```

### GET /api/tenants?page=1&limit=20
```typescript
Response: {
  tenants: Array<{id, name, slug, status, userCount, createdAt}>,
  total: number
}
```

### GET /api/users?page=1&limit=20
```typescript
Response: {
  users: Array<{id, email, name, role, tenantName, lastLoginAt}>,
  total: number
}
// 보안: passwordHash, mfaSecret select 절대 금지
```

### GET /api/compliance/csap
```typescript
Response: {
  domains: Array<{id, name, totalItems, passCount, rate}>, // 13개 분야
  overallRate: number
}
```

### GET /api/subscriptions
```typescript
Response: {
  subscriptions: Array<{id, tenantName, planName, status, price, currentPeriodEnd}>,
  total: number
}
```

### GET /api/audit-logs
```typescript
Response: {
  logs: Array<{id, action, actorEmail, tenantName, createdAt}>,
  total: number  // 최근 20건
}
```

---

## 보안 설계 (CSAP)

| 항목 | 적용 |
|------|------|
| D-06 감사 로그 | 시드 시 SHA-256 해시 체인 구현 |
| D-08 접근 통제 | API Routes: 데모용 간소화 (세션 검증 생략, GET 전용) |
| D-09 암호화 | 시드 비밀번호 bcrypt cost=12, API 응답에서 passwordHash 제외 |
| D-12 개발 보안 | Prisma ORM (SQL 주입 차단), Zod 파라미터 범위 검증 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-06 | 최초 작성 | PM Agent |
