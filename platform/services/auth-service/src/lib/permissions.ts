// 역할별 권한 조회
// Design Ref: DESIGN-MTU-P01 Section 5 RBAC
// Plan SC: FR-P01.1, FR-P01.3
// CSAP: D-08-05 역할 기반 접근 통제

import { prisma } from './prisma.js';

/**
 * 역할별 권한 조회
 *
 * DB에서 역할에 매핑된 권한 목록을 조회합니다.
 * login.handler와 refresh.handler에서 공통 사용합니다.
 *
 * @param role - 사용자 역할 (SUPER_ADMIN, TENANT_ADMIN 등)
 * @returns 권한 이름 목록
 */
export async function getUserPermissions(role: string): Promise<string[]> {
  // CSAP D-10: 방어 코딩 — 역할당 권한 최대 200개 제한
  const rolePermissions = await prisma.rolePermission.findMany({
    where: { role: role as 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'USER' | 'VIEWER' | 'AUDITOR' },
    include: { permission: true },
    take: 200,
  });

  return rolePermissions.map((rp) => rp.permission.name);
}
