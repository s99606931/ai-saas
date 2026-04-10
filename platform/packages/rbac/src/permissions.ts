// RBAC 권한 정의
// Design Ref: SVC-RBAC-R8 Plan
// Plan SC: FR-RBAC.2
// CSAP: D-08 접근 통제

/**
 * 자원 목록 (공공기관 SaaS 프레임워크)
 */
export const RESOURCES = [
  'tenant',
  'user',
  'billing',
  'catalog',
  'menu',
  'subscription',
  'file',
  'security',
  'audit',
  'ai',
  'compliance',
  'notification',
  'crm',
  'saas-catalog',
] as const;

export type Resource = (typeof RESOURCES)[number];

/**
 * 액션 목록
 */
export const ACTIONS = ['create', 'read', 'update', 'delete', 'manage', 'chat'] as const;

export type Action = (typeof ACTIONS)[number];

/**
 * 권한 문자열: "resource:action"
 */
export type Permission = `${Resource}:${Action}`;

/**
 * 시스템 역할
 */
export const ROLES = ['SUPER_ADMIN', 'ADMIN', 'USER', 'VIEWER'] as const;

export type Role = (typeof ROLES)[number];

/**
 * 특수 권한 키워드
 * - 'self': 본인 데이터만 접근 가능
 * - true: 전체 접근 가능
 * - false: 접근 불가
 */
export type PermissionValue = boolean | 'self';

/**
 * 역할-권한 매핑 테이블 (CSAP D-08-03)
 *
 * 공공기관 최소 권한 원칙(Least Privilege) 적용
 */
export const ROLE_PERMISSIONS: Record<Role, Record<string, PermissionValue>> = {
  SUPER_ADMIN: {
    // 전체 시스템 관리 (최고 관리자)
    'tenant:create': true,
    'tenant:read': true,
    'tenant:update': true,
    'tenant:delete': true,
    'user:create': true,
    'user:read': true,
    'user:update': true,
    'user:delete': true,
    'billing:read': true,
    'billing:create': true,
    'billing:update': true,
    'billing:delete': true,
    'catalog:read': true,
    'catalog:create': true,
    'catalog:update': true,
    'catalog:delete': true,
    'menu:read': true,
    'menu:create': true,
    'menu:update': true,
    'menu:delete': true,
    'subscription:read': true,
    'subscription:create': true,
    'subscription:update': true,
    'subscription:delete': true,
    'file:read': true,
    'file:create': true,
    'file:delete': true,
    'security:read': true,
    'security:create': true,
    'security:update': true,
    'security:manage': true,
    'audit:read': true,
    'ai:chat': true,
    'ai:manage': true,
    'ai:read': true,
    'compliance:read': true,
    'compliance:update': true,
    'notification:read': true,
    'notification:create': true,
    'crm:read': true,
    'crm:create': true,
    'crm:update': true,
    'crm:delete': true,
    'saas-catalog:read': true,
    'saas-catalog:create': true,
    'saas-catalog:update': true,
    'saas-catalog:delete': true,
  },
  ADMIN: {
    // 테넌트 내 관리자
    'tenant:read': true,
    'tenant:update': true,
    'user:create': true,
    'user:read': true,
    'user:update': true,
    'user:delete': true,
    'billing:read': true,
    'billing:create': true,
    'billing:update': true,
    'catalog:read': true,
    'catalog:create': true,
    'catalog:update': true,
    'menu:read': true,
    'menu:create': true,
    'menu:update': true,
    'menu:delete': true,
    'subscription:read': true,
    'subscription:create': true,
    'subscription:update': true,
    'file:read': true,
    'file:create': true,
    'file:delete': true,
    'security:read': true,
    'audit:read': true,
    'ai:chat': true,
    'ai:read': true,
    'compliance:read': true,
    'notification:read': true,
    'notification:create': true,
    'crm:read': true,
    'crm:create': true,
    'crm:update': true,
    'saas-catalog:read': true,
    'saas-catalog:create': true,
    'saas-catalog:update': true,
  },
  USER: {
    // 일반 사용자
    'tenant:read': true,
    'user:read': true,
    'user:update': 'self', // 본인만 수정 가능
    'billing:read': true,
    'catalog:read': true,
    'menu:read': true,
    'subscription:read': true,
    'file:read': true,
    'file:create': true,
    'ai:chat': true,
    'ai:read': true,
    'compliance:read': true,
    'notification:read': true,
    'crm:read': true,
    'saas-catalog:read': true,
  },
  VIEWER: {
    // 읽기 전용 (감사·모니터링 목적)
    'tenant:read': true,
    'user:read': true,
    'billing:read': true,
    'catalog:read': true,
    'menu:read': true,
    'subscription:read': true,
    'file:read': true,
    'audit:read': true,
    'compliance:read': true,
    'notification:read': true,
    'crm:read': true,
    'saas-catalog:read': true,
  },
};
