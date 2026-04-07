// API 게이트웨이 감사 로그 미들웨어
// Design Ref: DESIGN-MTU-Q1 §1 FR-P04.7
// Plan SC: FR-P04.7
// CSAP: D-06-01 침해사고 관리 — 모든 API 요청 감사 추적

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';

/** 감사 로그 제외 경로 (노이즈 방지) */
const EXCLUDED_PATHS = new Set(['/health', '/ready', '/health/services']);

/** 민감 헤더 마스킹 (N2SF 데이터 등급 준수) */
function maskAuthHeader(value: string | undefined): string {
  if (!value) return 'none';
  if (value.startsWith('Bearer ')) return 'Bearer ***';
  return '***';
}

interface AuditLogEntry {
  timestamp: string;
  level: string;
  service: string;
  action: string;
  actor: string;
  target: string;
  targetType: string;
  ip: string;
  requestId: string;
  metadata: {
    method: string;
    statusCode: number;
    latencyMs: number;
    userAgent: string;
    tenantId: string;
    auth: string;
  };
}

/**
 * Fastify 플러그인: 요청/응답 감사 로깅
 * onRequest 훅에서 시작 시각 기록, onResponse 훅에서 감사 로그 출력
 * 비동기 fire-and-forget 패턴으로 응답 지연 없음
 */
async function auditLoggerPlugin(app: FastifyInstance): Promise<void> {
  // onRequest: 요청 시작 시각 기록
  app.addHook('onRequest', async (request: FastifyRequest) => {
    (request as FastifyRequest & { startTime?: number }).startTime = Date.now();
  });

  // onResponse: 감사 로그 기록
  app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const url = request.url.split('?')[0] ?? request.url;

    // 헬스체크 경로 제외
    if (EXCLUDED_PATHS.has(url)) return;

    const startTime = (request as FastifyRequest & { startTime?: number }).startTime ?? Date.now();
    const latencyMs = Date.now() - startTime;

    // JWT에서 사용자 ID 추출 (인증된 요청인 경우)
    const user = (request as FastifyRequest & { user?: { sub?: string } }).user;
    const actor = user?.sub ?? 'anonymous';
    const tenantId = (request.headers['x-tenant-id'] as string) ?? 'unknown';

    const entry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      level: 'audit',
      service: 'api-gateway',
      action: 'API_REQUEST',
      actor,
      target: `${request.method} ${url}`,
      targetType: 'api-request',
      ip: request.ip,
      requestId: request.id,
      metadata: {
        method: request.method,
        statusCode: reply.statusCode,
        latencyMs,
        userAgent: (request.headers['user-agent'] as string) ?? 'unknown',
        tenantId,
        auth: maskAuthHeader(request.headers.authorization),
      },
    };

    // 비동기 fire-and-forget (응답 지연 방지)
    // 요청 본문은 의도적으로 로깅하지 않음 (N2SF 데이터 등급 위반 방지)
    app.log.info(entry, 'audit-log');
  });
}

export default fp(auditLoggerPlugin, {
  name: 'audit-logger',
  fastify: '5.x',
});
