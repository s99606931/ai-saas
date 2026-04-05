// 사용자 도메인 타입
// Design Ref: D-P00.2
// CSAP: D-08 접근 통제

/**
 * 사용자 역할
 * - super_admin: 플랫폼 전체 관리자
 * - tenant_admin: 테넌트 관리자
 * - user: 일반 사용자
 * - viewer: 읽기 전용
 * - auditor: 감리관 (읽기 + 감사 로그 접근)
 */
export type UserRole = 'super_admin' | 'tenant_admin' | 'user' | 'viewer' | 'auditor';

/**
 * 사용자 엔티티
 */
export interface User {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: UserRole;
  mfaEnabled: boolean;
  lastLoginAt: Date | null;
  failedLogins: number;
  lockedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * JWT 토큰 페이로드 (CSAP D-08)
 * - 접근 토큰: 15분 만료
 * - 갱신 토큰: 7일 만료
 */
export interface TokenPayload {
  /** 사용자 ID */
  sub: string;
  /** 테넌트 ID */
  tenantId: string;
  /** 사용자 역할 */
  role: UserRole;
  /** 권한 목록 (resource:action 형식) */
  permissions: string[];
  /** 발급 시각 (Unix timestamp) */
  iat: number;
  /** 만료 시각 (Unix timestamp) */
  exp: number;
}
