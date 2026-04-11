# SVC-RBAC-R32 DESIGN: RBAC Authorization 라이브러리

> 버전: 1.0.0 | 작성일: 2026-04-12 | 작성자: PM Lead
> Plan 참조: docs/01-plan/mtus/SVC-RBAC-R32.plan.md

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-12 | 초안 작성 | PM Lead |

---

## 역할 계층 구조

```
super-admin (시스템 전체)
  └── admin (테넌트 관리)
       └── manager (팀 관리)
            └── user (일반 사용자)
                 └── viewer (읽기 전용)
```

상위 역할은 하위 역할의 모든 권한을 상속합니다.

---

## 권한 형식

```
{resource}:{action}

예:
  users:read       -- 사용자 목록 조회
  users:write      -- 사용자 생성/수정
  users:delete     -- 사용자 삭제
  users:*          -- 사용자 관련 모든 권한
  *:read           -- 모든 리소스 읽기
  *:*              -- 전체 권한 (super-admin)
```

---

## 주요 인터페이스

```typescript
interface RbacOptions {
  roles: Record<string, RoleDefinition>;
}

interface RoleDefinition {
  permissions: string[];
  inherits?: string[];  // 상속 역할
}

interface AccessCheckResult {
  allowed: boolean;
  role: string;
  permission: string;
  reason?: string;  // 거부 사유
}
```

---

## Session Guide

### 구현 순서
1. `src/rbac.ts` -- 코어 RBAC
2. `src/index.ts` -- 패키지 엔트리포인트
3. `tests/rbac.test.ts` -- 단위 테스트

### Design Anchor
- `// Design Ref: SVC-RBAC-R32 DESIGN`
- `// Plan SC: FR-RBAC.{번호}`
