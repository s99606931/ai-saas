// RBAC 엔진 -- 권한 검증 핵심 로직
// Design Ref: SVC-RBAC-R8 Plan
// Plan SC: FR-RBAC.1, FR-RBAC.3
// CSAP: D-08 접근 통제

import { ROLE_PERMISSIONS, type Role, type PermissionValue, ROLES } from './permissions.js';

/**
 * 사용자 컨텍스트 (JWT 클레임에서 추출)
 */
export interface UserContext {
  userId: string;
  tenantId: string;
  role: Role;
  /** 테넌트별 커스텀 권한 (FR-RBAC.6) */
  customPermissions?: Record<string, boolean>;
}

/**
 * 권한 검증 결과
 */
export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  /** 'self' 권한인 경우 대상 userId 일치 필요 */
  selfOnly?: boolean;
}

/**
 * RBAC 엔진
 *
 * CSAP D-08 접근 통제 요건:
 * - D-08-01: 역할 기반 접근 통제
 * - D-08-02: 자원별 권한 정의
 * - D-08-03: 최소 권한 원칙
 * - D-08-04: 권한 상속 및 위임 제한
 */
export class RBACEngine {
  /**
   * 역할이 유효한지 검증
   */
  isValidRole(role: string): role is Role {
    return (ROLES as readonly string[]).includes(role);
  }

  /**
   * 권한 검증 (핵심 메서드)
   *
   * @param user - 사용자 컨텍스트
   * @param permission - 요청 권한 (예: "tenant:read")
   * @param targetUserId - 대상 사용자 ID ('self' 권한 검증용)
   */
  checkPermission(user: UserContext, permission: string, targetUserId?: string): PermissionCheckResult {
    // 1. 역할 유효성 검증
    if (!this.isValidRole(user.role)) {
      return { allowed: false, reason: `유효하지 않은 역할: ${user.role}` };
    }

    // 2. 커스텀 권한 우선 확인 (테넌트별 오버라이드)
    if (user.customPermissions?.[permission] !== undefined) {
      return {
        allowed: user.customPermissions[permission],
        reason: user.customPermissions[permission] ? '커스텀 권한에 의해 허용' : '커스텀 권한에 의해 거부',
      };
    }

    // 3. 역할 기반 권한 확인
    const rolePerms = ROLE_PERMISSIONS[user.role];
    const permValue: PermissionValue = rolePerms[permission] ?? false;

    if (permValue === true) {
      return { allowed: true };
    }

    if (permValue === 'self') {
      // 본인 데이터만 접근 가능
      if (!targetUserId) {
        return { allowed: true, selfOnly: true };
      }
      const isSelf = user.userId === targetUserId;
      return {
        allowed: isSelf,
        selfOnly: true,
        reason: isSelf ? undefined : '본인 데이터만 접근 가능합니다',
      };
    }

    return {
      allowed: false,
      reason: `권한 부족: ${user.role} 역할에 ${permission} 권한이 없습니다`,
    };
  }

  /**
   * 다중 권한 검증 (OR 조건: 하나라도 있으면 허용)
   */
  checkAnyPermission(user: UserContext, permissions: string[], targetUserId?: string): PermissionCheckResult {
    for (const perm of permissions) {
      const result = this.checkPermission(user, perm, targetUserId);
      if (result.allowed) return result;
    }
    return {
      allowed: false,
      reason: `다음 권한 중 하나 이상 필요: ${permissions.join(', ')}`,
    };
  }

  /**
   * 다중 권한 검증 (AND 조건: 모두 있어야 허용)
   */
  checkAllPermissions(user: UserContext, permissions: string[], targetUserId?: string): PermissionCheckResult {
    for (const perm of permissions) {
      const result = this.checkPermission(user, perm, targetUserId);
      if (!result.allowed) return result;
    }
    return { allowed: true };
  }

  /**
   * 사용자의 전체 권한 목록 반환
   */
  listPermissions(role: Role): string[] {
    if (!this.isValidRole(role)) return [];
    const perms = ROLE_PERMISSIONS[role];
    return Object.entries(perms)
      .filter(([, v]) => v === true || v === 'self')
      .map(([k]) => k);
  }
}

/**
 * 싱글턴 RBAC 엔진 인스턴스
 */
export const rbac = new RBACEngine();
