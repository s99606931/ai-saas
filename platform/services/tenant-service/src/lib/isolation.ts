// 테넌트 격리 로직
// Design Ref: DESIGN-MTU-P03
// Plan SC: FR-P03.5
// CSAP: N2SF N-03 격리 아키텍처

import type { FastifyRequest, FastifyReply } from 'fastify';
import type { TokenPayload } from '@public-saas/types';

/**
 * 테넌트 격리 미들웨어
 *
 * N2SF N-03 요건:
 * - 모든 API 요청에서 JWT의 tenantId와 요청 대상 tenantId 일치 검증
 * - SUPER_ADMIN은 전체 테넌트 접근 허용
 * - 테넌트 간 데이터 접근 차단
 *
 * @param request - Fastify 요청 (user 속성에 TokenPayload 바인딩 필요)
 * @param reply - Fastify 응답
 */
export async function tenantIsolationMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const user = (request as FastifyRequest & { user?: TokenPayload }).user;

  if (!user) {
    await reply.status(401).send({
      success: false,
      error: { code: 'AUTH_REQUIRED', message: '인증이 필요합니다' },
    });
    return;
  }

  // SUPER_ADMIN은 전체 접근 허용
  if (user.role === 'super_admin') {
    return;
  }

  // URL 파라미터에서 tenantId 추출
  const params = request.params as Record<string, string>;
  const requestedTenantId = params['tenantId'] ?? params['id'];

  if (requestedTenantId && requestedTenantId !== user.tenantId) {
    await reply.status(403).send({
      success: false,
      error: {
        code: 'TENANT_ISOLATION_VIOLATION',
        message: '다른 테넌트의 데이터에 접근할 수 없습니다 (N2SF N-03)',
      },
    });
  }
}

/**
 * 쿼리에 tenantId 필터 자동 적용
 *
 * @param user - 인증된 사용자 정보
 * @returns Prisma where 조건에 추가할 tenantId 필터
 */
export function getTenantFilter(user: TokenPayload): { tenantId?: string } {
  if (user.role === 'super_admin') {
    return {}; // 전체 접근
  }
  return { tenantId: user.tenantId };
}
