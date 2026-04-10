// RBAC 권한 검사 헬퍼
// Design Ref: D-P00.3
// CSAP: D-08-05 권한 관리

import type { TokenPayload } from '@public-saas/types';

/**
 * 사용자가 특정 권한을 보유하고 있는지 확인
 *
 * @param user - JWT 토큰 페이로드
 * @param permission - 필요 권한 (resource:action 형식)
 * @returns 권한 보유 여부
 *
 * @example
 * ```typescript
 * if (!hasPermission(user, 'tenant:create')) {
 *   return Response.json({ error: 'Forbidden' }, { status: 403 });
 * }
 * ```
 */
export function hasPermission(user: TokenPayload, permission: string): boolean {
  // super_admin은 모든 권한 보유
  if (user.role === 'super_admin') {
    return true;
  }

  return user.permissions.includes(permission);
}

/**
 * 여러 권한 중 하나라도 보유하고 있는지 확인
 *
 * @param user - JWT 토큰 페이로드
 * @param permissions - 필요 권한 목록
 * @returns 하나 이상 보유 여부
 */
export function requirePermissions(user: TokenPayload, permissions: string[]): boolean {
  if (user.role === 'super_admin') {
    return true;
  }

  return permissions.some((perm) => user.permissions.includes(perm));
}
