# SVC-AI-ADV-R84 — Tenant Isolation Verifier (Design)

> v1.0.0 | 2026-04-12

## 구조
```ts
export interface ResourceMeta {
  resourceId: string;
  ownerTenantId: string;
  sharedWith?: string[]; // 명시적 공유 테넌트
  kind: 'document' | 'embedding' | 'session' | 'agent' | 'dataset';
}

export interface AccessContext {
  actorId: string;
  actorTenantId: string;
  resourceId: string;
  action: 'read' | 'write' | 'delete';
}

export class TenantIsolationVerifier {
  register(resource: ResourceMeta): void;
  verify(ctx: AccessContext): void; // 위반 시 throw TenantIsolationViolation
  canAccess(ctx: AccessContext): boolean; // 불리언 버전
  share(resourceId: string, targetTenantId: string): void;
  getAuditLog(): readonly AuditEvent[];
}
```

## 알고리즘
1. register: Map<resourceId, ResourceMeta>
2. verify: 리소스 조회 → ownerTenantId 일치? 또는 sharedWith 포함?
3. 모두 실패 시 `TenantIsolationViolation` throw + DENY 로그
4. share: sharedWith 배열에 추가, SHARE 로그

## 차별화
- `multitenant-rls.ts`: Postgres RLS 정책 수준
- 본 모듈: 서비스 레이어 자원 메타데이터 기반 경량 검증

## Session Guide
- 구현: `tenant-isolation-verifier.ts`
- 테스트: `__tests__/tenant-isolation-verifier.test.ts`
- Plan SC: FR-R84.1~5
