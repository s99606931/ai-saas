// RBAC 권한 정의 무결성 검증 테스트
// Design Ref: SVC-RBAC-R8 Plan
// Plan SC: FR-RBAC.2
// CSAP: D-08 접근 통제, D-08-03 최소 권한 원칙

import { describe, it, expect } from 'vitest';
import {
  RESOURCES,
  ACTIONS,
  ROLES,
  ROLE_PERMISSIONS,
  type Role,
  type Resource,
  type Action,
} from '../src/permissions.js';

describe('RESOURCES 정의', () => {
  it('14개 자원이 정의되어 있다', () => {
    expect(RESOURCES).toHaveLength(14);
  });

  it('핵심 자원이 포함되어 있다', () => {
    const coreResources = ['tenant', 'user', 'billing', 'audit', 'security', 'ai'];
    for (const r of coreResources) {
      expect(RESOURCES).toContain(r);
    }
  });

  it('중복 자원이 없다', () => {
    const unique = new Set(RESOURCES);
    expect(unique.size).toBe(RESOURCES.length);
  });
});

describe('ACTIONS 정의', () => {
  it('6개 액션이 정의되어 있다', () => {
    expect(ACTIONS).toHaveLength(6);
  });

  it('CRUD 액션이 포함되어 있다', () => {
    expect(ACTIONS).toContain('create');
    expect(ACTIONS).toContain('read');
    expect(ACTIONS).toContain('update');
    expect(ACTIONS).toContain('delete');
  });

  it('확장 액션이 포함되어 있다', () => {
    expect(ACTIONS).toContain('manage');
    expect(ACTIONS).toContain('chat');
  });
});

describe('ROLES 정의', () => {
  it('4개 역할이 정의되어 있다', () => {
    expect(ROLES).toHaveLength(4);
  });

  it('SUPER_ADMIN이 포함되어 있다', () => {
    expect(ROLES).toContain('SUPER_ADMIN');
  });

  it('VIEWER가 포함되어 있다 (감사 목적)', () => {
    expect(ROLES).toContain('VIEWER');
  });
});

describe('ROLE_PERMISSIONS 무결성 (CSAP D-08-03 최소 권한)', () => {
  it('모든 역할에 대해 권한 매핑이 존재한다', () => {
    for (const role of ROLES) {
      expect(ROLE_PERMISSIONS[role]).toBeDefined();
      expect(typeof ROLE_PERMISSIONS[role]).toBe('object');
    }
  });

  it('SUPER_ADMIN은 가장 많은 권한을 가진다', () => {
    const superAdminPerms = Object.keys(ROLE_PERMISSIONS.SUPER_ADMIN).length;
    const adminPerms = Object.keys(ROLE_PERMISSIONS.ADMIN).length;
    const userPerms = Object.keys(ROLE_PERMISSIONS.USER).length;
    const viewerPerms = Object.keys(ROLE_PERMISSIONS.VIEWER).length;

    expect(superAdminPerms).toBeGreaterThan(adminPerms);
    expect(adminPerms).toBeGreaterThanOrEqual(userPerms);
    expect(userPerms).toBeGreaterThanOrEqual(viewerPerms);
  });

  it('VIEWER는 읽기 권한만 가진다 (최소 권한 원칙)', () => {
    const viewerPerms = ROLE_PERMISSIONS.VIEWER;
    for (const [key, value] of Object.entries(viewerPerms)) {
      if (value === true || value === 'self') {
        expect(key).toMatch(/:read$/);
      }
    }
  });

  it('USER의 self 권한이 올바르다', () => {
    const userPerms = ROLE_PERMISSIONS.USER;
    expect(userPerms['user:update']).toBe('self');
  });

  it('SUPER_ADMIN은 tenant CRUD 전체 권한을 가진다', () => {
    expect(ROLE_PERMISSIONS.SUPER_ADMIN['tenant:create']).toBe(true);
    expect(ROLE_PERMISSIONS.SUPER_ADMIN['tenant:read']).toBe(true);
    expect(ROLE_PERMISSIONS.SUPER_ADMIN['tenant:update']).toBe(true);
    expect(ROLE_PERMISSIONS.SUPER_ADMIN['tenant:delete']).toBe(true);
  });

  it('ADMIN은 tenant 삭제 권한이 없다', () => {
    expect(ROLE_PERMISSIONS.ADMIN['tenant:delete']).toBeUndefined();
  });

  it('USER는 tenant 생성/삭제 권한이 없다', () => {
    expect(ROLE_PERMISSIONS.USER['tenant:create']).toBeUndefined();
    expect(ROLE_PERMISSIONS.USER['tenant:delete']).toBeUndefined();
  });

  it('모든 역할이 AI 채팅 권한을 가진다 (VIEWER 제외)', () => {
    expect(ROLE_PERMISSIONS.SUPER_ADMIN['ai:chat']).toBe(true);
    expect(ROLE_PERMISSIONS.ADMIN['ai:chat']).toBe(true);
    expect(ROLE_PERMISSIONS.USER['ai:chat']).toBe(true);
  });

  it('audit:read는 관리자와 감사자만 가능하다', () => {
    expect(ROLE_PERMISSIONS.SUPER_ADMIN['audit:read']).toBe(true);
    expect(ROLE_PERMISSIONS.VIEWER['audit:read']).toBe(true);
    // USER에는 audit:read가 없음
    expect(ROLE_PERMISSIONS.USER['audit:read']).toBeUndefined();
  });

  it('권한 값은 boolean 또는 self만 허용한다', () => {
    for (const role of ROLES) {
      for (const [, value] of Object.entries(ROLE_PERMISSIONS[role])) {
        expect(value === true || value === false || value === 'self').toBe(true);
      }
    }
  });

  it('권한 키가 resource:action 형식이다', () => {
    const validPattern = /^[\w-]+:[\w-]+$/;
    for (const role of ROLES) {
      for (const key of Object.keys(ROLE_PERMISSIONS[role])) {
        expect(key).toMatch(validPattern);
      }
    }
  });
});
