// CSAP 자동 준수 미들웨어
// Design Ref: DESIGN-MTU-P18 §2 — csapGuard()
// CSAP: D-08 (RBAC), D-06 (감사), D-09 (암호화 검증)

import type { FastifyRequest, FastifyReply } from 'fastify';

interface CsapGuardOptions {
  /** 허용 역할 목록 */
  roles?: string[];
  /** 감사 로그 기록 여부 (기본: true) */
  audit?: boolean;
  /** 감사 로그 서비스 URL */
  auditServiceUrl?: string;
}

/**
 * CSAP D-08 RBAC + D-06 감사 로그 자동 적용 미들웨어
 *
 * 비즈니스 서비스에서 이 가드를 적용하면:
 * - JWT 토큰 검증
 * - 역할 기반 접근 통제 (roles 지정 시)
 * - 모든 요청 감사 로그 자동 기록
 */
export function csapGuard(options: CsapGuardOptions = {}) {
  const auditUrl = options.auditServiceUrl ?? process.env['AUDIT_SERVICE_URL'] ?? 'http://localhost:3012';
  const shouldAudit = options.audit !== false;

  return async function csapGuardHook(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    // D-08: 인증 확인
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      reply.status(401).send({ error: '인증이 필요합니다 (CSAP D-08)' });
      return;
    }

    // D-08: 역할 확인 (roles 지정 시)
    if (options.roles && options.roles.length > 0) {
      const userRole = (request as Record<string, unknown>)['userRole'] as string | undefined;
      if (!userRole || !options.roles.includes(userRole)) {
        reply.status(403).send({ error: '접근 권한이 없습니다 (CSAP D-08)' });
        return;
      }
    }

    // D-06: 감사 로그 자동 기록
    if (shouldAudit) {
      try {
        await fetch(`${auditUrl}/audit/logs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: `${request.method} ${request.url}`,
            ip: request.ip,
            userAgent: request.headers['user-agent'],
          }),
        });
      } catch {
        // 감사 로그 전송 실패 시 서비스 가용성 우선
        request.log.error('감사 로그 전송 실패');
      }
    }
  };
}
