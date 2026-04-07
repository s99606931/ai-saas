// E2E 테스트용 JWT Mock 유틸리티
// Design Ref: MTU-N01
// Plan SC: FR-N01.1, FR-N01.8
// CSAP: D-08 접근 통제 검증용

/**
 * 테스트용 사용자 역할
 * CSAP D-08-05: RBAC 역할 체계
 */
export type TestRole = 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'USER' | 'VIEWER' | 'AUDITOR';

/**
 * 테스트용 사용자 컨텍스트
 */
export interface TestUser {
  userId: string;
  tenantId: string;
  role: TestRole;
  email: string;
  permissions: string[];
}

/**
 * 역할별 기본 권한 매핑 (proxy.ts ROLE_PERMISSIONS과 동일)
 */
const ROLE_PERMISSIONS: Record<TestRole, string[]> = {
  SUPER_ADMIN: ['audit:read', 'security:read', 'admin:all'],
  TENANT_ADMIN: ['audit:read'],
  AUDITOR: ['audit:read', 'security:read'],
  USER: [],
  VIEWER: [],
};

/**
 * 테스트용 사전 정의 사용자
 * 테넌트 격리 검증을 위해 2개 테넌트 사용
 */
export const TEST_USERS: Record<string, TestUser> = {
  superAdmin: {
    userId: 'user-super-001',
    tenantId: 'tenant-mois',
    role: 'SUPER_ADMIN',
    email: 'admin@mois-demo.go.kr',
    permissions: ROLE_PERMISSIONS['SUPER_ADMIN'],
  },
  tenantAdminA: {
    userId: 'user-admin-a-001',
    tenantId: 'tenant-a',
    role: 'TENANT_ADMIN',
    email: 'admin@tenant-a.go.kr',
    permissions: ROLE_PERMISSIONS['TENANT_ADMIN'],
  },
  tenantAdminB: {
    userId: 'user-admin-b-001',
    tenantId: 'tenant-b',
    role: 'TENANT_ADMIN',
    email: 'admin@tenant-b.go.kr',
    permissions: ROLE_PERMISSIONS['TENANT_ADMIN'],
  },
  userA: {
    userId: 'user-a-001',
    tenantId: 'tenant-a',
    role: 'USER',
    email: 'user@tenant-a.go.kr',
    permissions: ROLE_PERMISSIONS['USER'],
  },
  userB: {
    userId: 'user-b-001',
    tenantId: 'tenant-b',
    role: 'USER',
    email: 'user@tenant-b.go.kr',
    permissions: ROLE_PERMISSIONS['USER'],
  },
  viewer: {
    userId: 'user-viewer-001',
    tenantId: 'tenant-a',
    role: 'VIEWER',
    email: 'viewer@tenant-a.go.kr',
    permissions: ROLE_PERMISSIONS['VIEWER'],
  },
  auditor: {
    userId: 'user-auditor-001',
    tenantId: 'tenant-mois',
    role: 'AUDITOR',
    email: 'auditor@mois-demo.go.kr',
    permissions: ROLE_PERMISSIONS['AUDITOR'],
  },
};

/**
 * Mock JWT 토큰 생성 (Base64 인코딩 — 실제 서명 없음, 테스트 전용)
 */
export function createMockToken(user: TestUser): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    sub: user.userId,
    tenantId: user.tenantId,
    role: user.role,
    email: user.email,
    permissions: user.permissions,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600, // 1시간
  };

  const encodeBase64 = (obj: object): string =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');

  return `${encodeBase64(header)}.${encodeBase64(payload)}.mock-signature`;
}

/**
 * 만료된 Mock JWT 토큰 생성
 */
export function createExpiredToken(user: TestUser): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    sub: user.userId,
    tenantId: user.tenantId,
    role: user.role,
    email: user.email,
    permissions: user.permissions,
    iat: Math.floor(Date.now() / 1000) - 7200,
    exp: Math.floor(Date.now() / 1000) - 3600, // 1시간 전 만료
  };

  const encodeBase64 = (obj: object): string =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');

  return `${encodeBase64(header)}.${encodeBase64(payload)}.expired-mock-signature`;
}

/**
 * 인증 헤더 생성
 */
export function authHeaders(user: TestUser): Record<string, string> {
  return {
    authorization: `Bearer ${createMockToken(user)}`,
    'x-user-id': user.userId,
    'x-tenant-id': user.tenantId,
    'x-user-role': user.role,
    'content-type': 'application/json',
  };
}

/**
 * 비인증 헤더 (인증 토큰 없음)
 */
export function noAuthHeaders(): Record<string, string> {
  return {
    'content-type': 'application/json',
  };
}
