// Design Ref: §Portal API 인증 가드
// Plan SC: FR-UP.21
// CSAP: D-08-01 인증, D-08-05 접근 통제

import { headers } from 'next/headers'

/**
 * Portal API 인증 정보
 * API 게이트웨이가 주입한 헤더에서 추출
 */
export interface PortalAuthContext {
  userId: string
  tenantId: string
  role: string
}

/**
 * Portal API 라우트 인증 검사
 *
 * API 게이트웨이가 JWT 검증 후 주입하는 헤더를 확인합니다.
 * 인증 실패 시 null을 반환합니다.
 *
 * CSAP D-08-01: 모든 API 엔드포인트에 인증 검사 필수
 *
 * @returns 인증 컨텍스트 또는 null
 */
export async function getAuthContext(): Promise<PortalAuthContext | null> {
  const headerStore = await headers()
  const userId = headerStore.get('x-user-id')
  const tenantId = headerStore.get('x-user-tenant-id')
  const role = headerStore.get('x-user-role')

  if (!userId || userId === 'anonymous') {
    return null
  }

  return {
    userId,
    tenantId: tenantId ?? '',
    role: role ?? 'VIEWER',
  }
}

/**
 * 관리자 권한 확인 (SUPER_ADMIN 또는 TENANT_ADMIN)
 * CSAP D-08-05: RBAC 접근 통제
 */
export function isAdmin(auth: PortalAuthContext): boolean {
  return auth.role === 'SUPER_ADMIN' || auth.role === 'TENANT_ADMIN'
}

/**
 * 슈퍼 관리자 권한 확인
 */
export function isSuperAdmin(auth: PortalAuthContext): boolean {
  return auth.role === 'SUPER_ADMIN'
}
