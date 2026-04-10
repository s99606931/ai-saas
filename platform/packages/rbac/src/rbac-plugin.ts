// Fastify RBAC 플러그인
// Design Ref: SVC-RBAC-R8 Plan
// Plan SC: FR-RBAC.4, FR-RBAC.5
// CSAP: D-08 접근 통제, D-06 감사 로그

import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { RBACEngine, type UserContext } from './rbac-engine.js';
import type { Role } from './permissions.js';

declare module 'fastify' {
  interface FastifyInstance {
    rbac: RBACEngine;
  }
  interface FastifyRequest {
    userContext?: UserContext;
  }
}

export interface RBACPluginOptions {
  /** 감사 로그 함수 (CSAP D-06) */
  auditLogger?: (event: {
    action: string;
    actor: string;
    permission: string;
    allowed: boolean;
    reason?: string;
    ip: string;
    timestamp: string;
  }) => void;
}

/**
 * Fastify RBAC 플러그인
 *
 * JWT 헤더에서 사용자 컨텍스트 추출 후 권한 검증 인프라 제공
 */
export const rbacPlugin = fp(
  async (fastify: FastifyInstance, opts: RBACPluginOptions) => {
    const engine = new RBACEngine();
    fastify.decorate('rbac', engine);

    // JWT 헤더에서 사용자 컨텍스트 추출 (API 게이트웨이가 설정)
    fastify.addHook('onRequest', async (request) => {
      const userId = request.headers['x-user-id'] as string;
      const tenantId = request.headers['x-user-tenant-id'] as string;
      const role = request.headers['x-user-role'] as string;

      if (userId && tenantId && role && engine.isValidRole(role)) {
        request.userContext = {
          userId,
          tenantId,
          role: role as Role,
        };
      }
    });

    // 옵션으로 전달된 감사 로거 저장
    if (opts.auditLogger) {
      fastify.decorate('rbacAuditLogger', opts.auditLogger);
    }
  },
  {
    name: '@public-saas/rbac',
    fastify: '5.x',
  },
);

/**
 * 권한 검증 미들웨어 팩토리
 *
 * CSAP D-08-04: 모든 API 엔드포인트에 권한 검사
 *
 * @param permission - 필요 권한 (예: "tenant:read")
 * @param options - 추가 옵션
 */
export function requirePermission(permission: string, options: { targetUserIdParam?: string } = {}) {
  return async function permissionGuard(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const rbacEngine = (request.server as FastifyInstance & { rbac: RBACEngine }).rbac;
    const user = request.userContext;

    // 인증 정보 없음
    if (!user) {
      await reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '인증 정보가 필요합니다',
        },
      });
      return;
    }

    // 대상 사용자 ID 추출 (self 검증용)
    let targetUserId: string | undefined;
    if (options.targetUserIdParam) {
      targetUserId = (request.params as Record<string, string>)[options.targetUserIdParam];
    }

    const result = rbacEngine.checkPermission(user, permission, targetUserId);

    if (!result.allowed) {
      // CSAP D-06: 권한 거부 감사 로그
      const auditLogger = (request.server as unknown as Record<string, unknown>)['rbacAuditLogger'] as
        | RBACPluginOptions['auditLogger']
        | undefined;
      if (auditLogger) {
        auditLogger({
          action: 'PERMISSION_DENIED',
          actor: user.userId,
          permission,
          allowed: false,
          reason: result.reason,
          ip: request.ip,
          timestamp: new Date().toISOString(),
        });
      }

      await reply.status(403).send({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: result.reason ?? '접근 권한이 없습니다',
          permission,
          role: user.role,
        },
      });
      return;
    }
  };
}

/**
 * 다중 권한 검증 미들웨어 (OR 조건)
 */
export function requireAnyPermission(...permissions: string[]) {
  return async function anyPermissionGuard(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const rbacEngine = (request.server as FastifyInstance & { rbac: RBACEngine }).rbac;
    const user = request.userContext;

    if (!user) {
      await reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: '인증 정보가 필요합니다' },
      });
      return;
    }

    const result = rbacEngine.checkAnyPermission(user, permissions);
    if (!result.allowed) {
      await reply.status(403).send({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: result.reason ?? '접근 권한이 없습니다',
        },
      });
      return;
    }
  };
}
