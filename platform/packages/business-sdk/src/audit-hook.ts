// 감사 로그 자동 기록 훅
// Design Ref: DESIGN-MTU-P18 §2 — auditHook()
// CSAP: D-06

import type { FastifyInstance } from 'fastify';

interface AuditHookOptions {
  /** 서비스 이름 (로그에 기록) */
  serviceName: string;
  /** 감사 로그 서비스 URL */
  auditServiceUrl?: string;
  /** 제외할 경로 패턴 */
  excludePaths?: string[];
}

/**
 * Fastify 전역 훅으로 모든 요청을 감사 로그에 자동 기록합니다.
 *
 * @param app - Fastify 인스턴스
 * @param options - 훅 옵션
 */
export function auditHook(app: FastifyInstance, options: AuditHookOptions): void {
  const auditUrl = options.auditServiceUrl ?? process.env['AUDIT_SERVICE_URL'] ?? 'http://localhost:3012';
  const excludes = new Set(options.excludePaths ?? ['/health', '/metrics']);

  app.addHook('onResponse', async (request, reply) => {
    if (excludes.has(request.url)) return;

    try {
      await fetch(`${auditUrl}/audit/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: `${request.method} ${request.url}`,
          targetType: options.serviceName,
          ip: request.ip,
          userAgent: request.headers['user-agent'],
          metadata: {
            statusCode: reply.statusCode,
            responseTime: reply.elapsedTime,
          },
        }),
      });
    } catch {
      request.log.error('감사 훅: 로그 전송 실패');
    }
  });
}
