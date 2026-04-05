// RBAC 권한 검사 미들웨어
// Design Ref: DESIGN-MTU-P01 Section 5
// Plan SC: FR-P01.5
// CSAP: D-08-05 접근 권한

import type { FastifyRequest, FastifyReply } from 'fastify';
import { hasPermission, requirePermissions } from '@public-saas/auth-sdk';

/**
 * 단일 권한 검사 미들웨어 생성
 *
 * @param permission - 필요 권한 (resource:action 형식)
 * @returns Fastify preHandler
 *
 * @example
 * ```typescript
 * app.get('/admin/users', {
 *   preHandler: requirePermission('user:read'),
 * }, handler);
 * ```
 */
export function requirePermission(permission: string) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      await reply.status(401).send({
        success: false,
        error: { code: 'AUTH_REQUIRED', message: '인증이 필요합니다' },
      });
      return;
    }

    if (!hasPermission(request.user, permission)) {
      await reply.status(403).send({
        success: false,
        error: {
          code: 'AUTH_FORBIDDEN',
          message: `권한이 부족합니다: ${permission}`,
        },
      });
    }
  };
}

/**
 * 복수 권한 검사 미들웨어 생성 (하나 이상 보유 시 통과)
 *
 * @param permissions - 필요 권한 목록
 * @returns Fastify preHandler
 */
export function requireAnyPermission(permissions: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      await reply.status(401).send({
        success: false,
        error: { code: 'AUTH_REQUIRED', message: '인증이 필요합니다' },
      });
      return;
    }

    if (!requirePermissions(request.user, permissions)) {
      await reply.status(403).send({
        success: false,
        error: {
          code: 'AUTH_FORBIDDEN',
          message: `다음 중 하나의 권한이 필요합니다: ${permissions.join(', ')}`,
        },
      });
    }
  };
}
