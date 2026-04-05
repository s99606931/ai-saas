# MTU-P03: 테넌트 관리 서비스 -- Design 문서

> **문서 ID**: DESIGN-MTU-P03
> **Plan 참조**: PLAN-MTU-P03
> **버전**: 1.1.0
> **작성일**: 2026-04-05
> **복잡도**: HIGH
> **아키텍처**: Option B -- Pragmatic Balance
> **작성자**: PM Agent + CTO Review

---

## Design Anchor

| Plan FR | 설계 결정 | 근거 |
|---------|---------|------|
| FR-P03.1 | Prisma + slug 기반 | URL-friendly 테넌트 식별 |
| FR-P03.5 | tenantId 필터 미들웨어 | N2SF N-03 DB 수준 격리 |
| FR-P03.6 | maxUsers/maxStorage | 테넌트 할당량 초과 방지 |
| FR-P03.7 | JSON theme 필드 | 테넌트별 테마 커스터마이제이션 |

---

## 1. 서비스 아키텍처

```
tenant-service/ (Fastify 5, 포트: 3003)
├── src/
│   ├── index.ts                # 서비스 진입점
│   ├── handlers/
│   │   └── tenant.handler.ts   # 테넌트 CRUD + 상태 변경
│   ├── lib/
│   │   └── isolation.ts        # 테넌트 격리 미들웨어 + 필터
│   └── routes.ts               # 라우트 등록
├── package.json
└── tsconfig.json
```

---

## 2. API 설계

| 메서드 | 경로 | 설명 | 권한 | Plan FR |
|--------|------|------|------|---------|
| GET | /tenants | 테넌트 목록 (상태 필터, 페이지네이션) | tenant:read (SUPER_ADMIN) | FR-P03.2 |
| GET | /tenants/:id | 테넌트 상세 (사용자/구독 수 포함) | tenant:read | FR-P03.2 |
| POST | /tenants | 테넌트 생성 (이름, slug, 할당량) | tenant:create | FR-P03.1 |
| PUT | /tenants/:id | 테넌트 수정 (설정, 테마, 할당량) | tenant:update | FR-P03.3, FR-P03.7 |
| PUT | /tenants/:id/status | 상태 변경 (ACTIVE/SUSPENDED/ARCHIVED) | tenant:update:status | FR-P03.4 |

---

## 3. 데이터 모델 (Prisma)

Tenant 모델은 MTU-P00에서 정의 완료:
- id, name, slug(unique), status(4종), maxUsers, maxStorage(BigInt)
- config(JSON), theme(JSON)
- users[], subscriptions[], menuItems[], auditLogs[] 관계

TenantStatus: ACTIVE, SUSPENDED, TRIAL, ARCHIVED

---

## 4. 테넌트 격리 미들웨어 설계

```typescript
// N2SF N-03: 모든 쿼리에 tenantId 필터 자동 적용
// tenantIsolationMiddleware: JWT tenantId vs 요청 tenantId 일치 검증
// getTenantFilter: Prisma where 조건에 tenantId 자동 주입
// SUPER_ADMIN은 전체 접근, 그 외 자기 테넌트만 접근
```

---

## 5. 보안 요건 매핑

| 규제 ID | 항목 | 구현 방법 |
|---------|------|---------|
| N2SF N-03 | 격리 아키텍처 | tenantId 필터 미들웨어, slug 기반 격리 |
| CSAP D-08-05 | 접근 권한 | SUPER_ADMIN만 전체 테넌트 목록 접근 |
| CSAP D-06 | 감사 로그 | 테넌트 생성/수정/상태변경 로깅 (MTU-P13 연동 예정) |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 초안 작성 | PM Agent |
| 1.1.0 | 2026-04-05 | 아키텍처, 데이터 모델, 보안 매핑, 격리 설계 보완 | PM Agent |
