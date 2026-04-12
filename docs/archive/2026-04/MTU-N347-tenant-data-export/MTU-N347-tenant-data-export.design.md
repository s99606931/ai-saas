# MTU-N347-tenant-data-export: 테넌트 데이터 내보내기 — Design

> **버전**: 1.0.0 | **작성일**: 2026-04-11 | **작성자**: PM Lead (자율)

## Executive Summary

| 관점 | 결정 |
|------|------|
| 비즈니스 | 테넌트 데이터 내보내기 자동화 모듈 |
| 기술 | 단일 lib 모듈 + Service 클래스 통합 |
| 보안 | N2SF O등급, 감사 로그 전수 |
| 운영 | ai-service/lib, TypeScript strict |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | Plan 참조 |
| WHO | Plan 참조 |
| RISK | 오탐/미탐, 테넌트 격리 실패 |
| SUCCESS | Plan SC 달성 |
| SCOPE | Plan 참조 |

## 아키텍처 (Pragmatic Balance)

**선택**: 단일 lib 모듈 `platform/services/ai-service/src/lib/tenant-data-export.ts`

## 모듈 설계

### Service 클래스

```ts
export class TenantDataExportService {
  constructor(private tenantId: string) {}
  // FR 메서드 + getAuditLog()
}
```

### FR 매핑

| FR | CSAP |
|----|------|
| FR-N347.1~6 | D-06/D-08/D-12 |

## 추적성 매트릭스

| FR ID | 구현 | 테스트 |
|-------|------|--------|
| FR-N347.1~6 | tenant-data-export.ts | TC-N347.* |

## Design Anchor

- Module: `platform/services/ai-service/src/lib/tenant-data-export.ts`
- Test: `platform/services/ai-service/src/lib/__tests__/tenant-data-export.test.ts`
- Q-Gate: G1~G7 PASS
