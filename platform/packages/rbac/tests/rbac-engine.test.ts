// @public-saas/rbac RBAC 엔진 테스트
// Design Ref: SVC-RBAC-R8 Plan
// Plan SC: FR-RBAC.1~FR-RBAC.6
// CSAP: D-08 접근 통제

import { describe, it, expect } from 'vitest';
import { RBACEngine, type UserContext } from '../src/rbac-engine.js';

describe('RBACEngine -- 기본 권한 검증', () => {
  const engine = new RBACEngine();

  const superAdmin: UserContext = {
    userId: 'sa-1',
    tenantId: 't-global',
    role: 'SUPER_ADMIN',
  };

  const admin: UserContext = {
    userId: 'admin-1',
    tenantId: 't-001',
    role: 'ADMIN',
  };

  const user: UserContext = {
    userId: 'user-1',
    tenantId: 't-001',
    role: 'USER',
  };

  const viewer: UserContext = {
    userId: 'viewer-1',
    tenantId: 't-001',
    role: 'VIEWER',
  };

  it('SUPER_ADMIN은 모든 자원에 접근 가능', () => {
    expect(engine.checkPermission(superAdmin, 'tenant:create').allowed).toBe(true);
    expect(engine.checkPermission(superAdmin, 'tenant:delete').allowed).toBe(true);
    expect(engine.checkPermission(superAdmin, 'security:manage').allowed).toBe(true);
    expect(engine.checkPermission(superAdmin, 'ai:manage').allowed).toBe(true);
  });

  it('ADMIN은 테넌트 생성/삭제 불가', () => {
    expect(engine.checkPermission(admin, 'tenant:read').allowed).toBe(true);
    expect(engine.checkPermission(admin, 'tenant:update').allowed).toBe(true);
    expect(engine.checkPermission(admin, 'tenant:create').allowed).toBe(false);
    expect(engine.checkPermission(admin, 'tenant:delete').allowed).toBe(false);
  });

  it('ADMIN은 사용자 CRUD 가능', () => {
    expect(engine.checkPermission(admin, 'user:create').allowed).toBe(true);
    expect(engine.checkPermission(admin, 'user:read').allowed).toBe(true);
    expect(engine.checkPermission(admin, 'user:update').allowed).toBe(true);
    expect(engine.checkPermission(admin, 'user:delete').allowed).toBe(true);
  });

  it('USER는 카탈로그 읽기만 가능 (쓰기 불가)', () => {
    expect(engine.checkPermission(user, 'catalog:read').allowed).toBe(true);
    expect(engine.checkPermission(user, 'catalog:create').allowed).toBe(false);
    expect(engine.checkPermission(user, 'catalog:update').allowed).toBe(false);
    expect(engine.checkPermission(user, 'catalog:delete').allowed).toBe(false);
  });

  it('VIEWER는 읽기 전용', () => {
    expect(engine.checkPermission(viewer, 'tenant:read').allowed).toBe(true);
    expect(engine.checkPermission(viewer, 'user:read').allowed).toBe(true);
    expect(engine.checkPermission(viewer, 'billing:read').allowed).toBe(true);
    // 쓰기 불가
    expect(engine.checkPermission(viewer, 'user:create').allowed).toBe(false);
    expect(engine.checkPermission(viewer, 'billing:create').allowed).toBe(false);
    // AI 채팅 불가
    expect(engine.checkPermission(viewer, 'ai:chat').allowed).toBe(false);
  });

  it('USER는 보안/감사 접근 불가', () => {
    expect(engine.checkPermission(user, 'security:read').allowed).toBe(false);
    expect(engine.checkPermission(user, 'audit:read').allowed).toBe(false);
  });
});

describe('RBACEngine -- self 권한 (본인 데이터만)', () => {
  const engine = new RBACEngine();

  const user: UserContext = {
    userId: 'user-123',
    tenantId: 't-001',
    role: 'USER',
  };

  it('USER의 user:update는 self -- 본인 수정 허용', () => {
    const result = engine.checkPermission(user, 'user:update', 'user-123');
    expect(result.allowed).toBe(true);
    expect(result.selfOnly).toBe(true);
  });

  it('USER의 user:update는 self -- 타인 수정 거부', () => {
    const result = engine.checkPermission(user, 'user:update', 'user-999');
    expect(result.allowed).toBe(false);
    expect(result.selfOnly).toBe(true);
    expect(result.reason).toContain('본인');
  });

  it('targetUserId 미제공 시 selfOnly 플래그만 설정', () => {
    const result = engine.checkPermission(user, 'user:update');
    expect(result.allowed).toBe(true);
    expect(result.selfOnly).toBe(true);
  });
});

describe('RBACEngine -- 커스텀 권한 (테넌트별 오버라이드)', () => {
  const engine = new RBACEngine();

  it('커스텀 권한이 역할 권한보다 우선', () => {
    const userWithCustom: UserContext = {
      userId: 'user-custom',
      tenantId: 't-special',
      role: 'USER',
      customPermissions: {
        'catalog:create': true, // 원래 USER에겐 없는 권한
      },
    };

    expect(engine.checkPermission(userWithCustom, 'catalog:create').allowed).toBe(true);
    expect(engine.checkPermission(userWithCustom, 'catalog:create').reason).toContain('커스텀');
  });

  it('커스텀 권한으로 역할 권한 제한 가능', () => {
    const restrictedAdmin: UserContext = {
      userId: 'admin-restricted',
      tenantId: 't-001',
      role: 'ADMIN',
      customPermissions: {
        'user:delete': false, // ADMIN이지만 삭제 권한 제거
      },
    };

    expect(engine.checkPermission(restrictedAdmin, 'user:delete').allowed).toBe(false);
    expect(engine.checkPermission(restrictedAdmin, 'user:create').allowed).toBe(true);
  });
});

describe('RBACEngine -- 다중 권한 검증', () => {
  const engine = new RBACEngine();

  const user: UserContext = {
    userId: 'user-1',
    tenantId: 't-1',
    role: 'USER',
  };

  it('checkAnyPermission (OR) -- 하나라도 있으면 허용', () => {
    const result = engine.checkAnyPermission(user, ['catalog:delete', 'catalog:read']);
    expect(result.allowed).toBe(true);
  });

  it('checkAnyPermission (OR) -- 모두 없으면 거부', () => {
    const result = engine.checkAnyPermission(user, ['security:read', 'security:write']);
    expect(result.allowed).toBe(false);
  });

  it('checkAllPermissions (AND) -- 모두 있어야 허용', () => {
    const result = engine.checkAllPermissions(user, ['catalog:read', 'menu:read', 'file:read']);
    expect(result.allowed).toBe(true);
  });

  it('checkAllPermissions (AND) -- 하나라도 없으면 거부', () => {
    const result = engine.checkAllPermissions(user, ['catalog:read', 'catalog:delete']);
    expect(result.allowed).toBe(false);
  });
});

describe('RBACEngine -- 유틸리티', () => {
  const engine = new RBACEngine();

  it('isValidRole -- 유효한 역할', () => {
    expect(engine.isValidRole('SUPER_ADMIN')).toBe(true);
    expect(engine.isValidRole('ADMIN')).toBe(true);
    expect(engine.isValidRole('USER')).toBe(true);
    expect(engine.isValidRole('VIEWER')).toBe(true);
  });

  it('isValidRole -- 유효하지 않은 역할', () => {
    expect(engine.isValidRole('HACKER')).toBe(false);
    expect(engine.isValidRole('')).toBe(false);
  });

  it('listPermissions -- 역할별 권한 목록', () => {
    const viewerPerms = engine.listPermissions('VIEWER');
    expect(viewerPerms).toContain('tenant:read');
    expect(viewerPerms).not.toContain('tenant:create');
    expect(viewerPerms).not.toContain('ai:chat');

    const userPerms = engine.listPermissions('USER');
    expect(userPerms).toContain('ai:chat');
    expect(userPerms).toContain('user:update'); // self 포함
  });

  it('유효하지 않은 역할로 검증 시 거부', () => {
    const invalid: UserContext = {
      userId: 'x',
      tenantId: 't-1',
      role: 'HACKER' as never,
    };
    const result = engine.checkPermission(invalid, 'tenant:read');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('유효하지 않은');
  });

  it('정의되지 않은 권한 요청 시 거부', () => {
    const admin: UserContext = {
      userId: 'a',
      tenantId: 't-1',
      role: 'ADMIN',
    };
    const result = engine.checkPermission(admin, 'nonexistent:action');
    expect(result.allowed).toBe(false);
  });
});

describe('RBACEngine -- CSAP D-08 보안 시나리오', () => {
  const engine = new RBACEngine();

  it('D-08-03: 최소 권한 -- VIEWER가 AI 채팅 불가', () => {
    const viewer: UserContext = { userId: 'v-1', tenantId: 't-1', role: 'VIEWER' };
    expect(engine.checkPermission(viewer, 'ai:chat').allowed).toBe(false);
    expect(engine.checkPermission(viewer, 'ai:manage').allowed).toBe(false);
  });

  it('D-08-04: 권한 상승 방지 -- USER가 보안 관리 불가', () => {
    const user: UserContext = { userId: 'u-1', tenantId: 't-1', role: 'USER' };
    expect(engine.checkPermission(user, 'security:read').allowed).toBe(false);
    expect(engine.checkPermission(user, 'security:manage').allowed).toBe(false);
    expect(engine.checkPermission(user, 'audit:read').allowed).toBe(false);
  });

  it('D-08-05: 테넌트 내 격리 -- ADMIN도 테넌트 삭제 불가', () => {
    const admin: UserContext = { userId: 'a-1', tenantId: 't-1', role: 'ADMIN' };
    expect(engine.checkPermission(admin, 'tenant:delete').allowed).toBe(false);
    expect(engine.checkPermission(admin, 'catalog:delete').allowed).toBe(false);
  });
});
