# Design: SVC-SAASCAT-R3 -- SaaS 카탈로그 서비스 설계

> 작성일: 2026-04-09 | 버전: 1.0 | 작성자: PM Lead
> Plan: docs/01-plan/mtus/SVC-SAASCAT-R3.plan.md

---

## Executive Summary

| 관점 | 설계 결정 |
|------|----------|
| 비즈니스 | 기존 서비스 패턴과 동일한 구조로 일관성 유지 |
| 기술 | Fastify + Zod + 인메모리 저장소 (프로덕션 시 Prisma 전환) |
| 보안 | 테넌트 격리, RBAC, 감사 로그, Zod 검증 |
| 운영 | OTel + responseTime + 헬스체크 |

## Design Anchor

- **결정**: 기존 16개 서비스와 동일 패턴 (Pragmatic Balance)
- **저장소**: 인메모리 맵 (개발/테스트 단계) -> 프로덕션 시 Prisma 전환
- **RBAC**: SYSTEM_ADMIN/TENANT_ADMIN은 전체 CRUD, USER/VIEWER는 읽기 전용

---

## 아키텍처

### 디렉토리 구조

```
platform/services/saas-catalog-service/
  src/
    index.ts                -- 진입점 (OTel + Fastify)
    routes.ts               -- 라우트 등록
    handlers/
      catalog.handler.ts    -- CRUD + 검색
      workflow.handler.ts   -- 승인 워크플로
      stats.handler.ts      -- 통계
    lib/
      store.ts              -- 인메모리 저장소
      audit.ts              -- 감사 로그
    schemas/
      catalog.schema.ts     -- Zod 스키마
  tests/
    unit/
      catalog-crud.test.ts
      catalog-workflow.test.ts
      catalog-csap.test.ts
    integration/
      catalog-search.test.ts
  package.json
  tsconfig.json
```

### 데이터 모델

```typescript
interface SaasCatalogItem {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  category: CatalogCategory;
  provider: string;
  version: string;
  status: CatalogStatus;
  csapGrade: 'STANDARD' | 'HIGH' | 'NONE';
  tags: string[];
  pricing: string | null;
  documentationUrl: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  createdBy: string;
  updatedBy: string;
}

type CatalogStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'DEPRECATED';
type CatalogCategory = 'BUSINESS' | 'DOCUMENT' | 'SECURITY' | 'AI_ML' | 'INFRA' | 'DATA' | 'COLLABORATION' | 'OTHER';
```

### 상태 전이 다이어그램

```
DRAFT -> PENDING (submit)
PENDING -> APPROVED (approve, 관리자)
PENDING -> REJECTED (reject, 관리자)
REJECTED -> DRAFT (재작성)
APPROVED -> DEPRECATED (deprecate, 관리자)
```

---

## CSAP 준수

- D-08-05: 모든 API에서 X-Tenant-Id 헤더 추출, 테넌트별 데이터 격리
- D-06: 모든 상태 변경 시 감사 로그 기록 (actor, action, target, timestamp)
- D-12: Zod 스키마로 모든 입력 검증
- D-10: Rate Limiting 적용
