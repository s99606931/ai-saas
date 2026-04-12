// 전역 에러 핸들러 + 404 핸들러 (RFC 7807 Problem Details)
// Design Ref: SVC-APIGWR2-R51.design.md §2.1
// Plan SC: FR-APIGWR2.1, FR-APIGWR2.2, FR-APIGWR2.5, FR-APIGWR2.6
// CSAP: D-12-03 표준 에러, D-06-01 로그, D-06-02 상관관계

import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import {
  internalError,
  notFound,
  problem,
  withTraceId,
  type ProblemDetails,
} from '@public-saas/problem-details';

const GATEWAY_ERROR_BASE = 'https://problems.public-saas.kr/errors/gateway';

/**
 * 요청에서 traceId 추출
 * 우선순위: x-request-id → Fastify request.id
 */
export function extractGatewayTraceId(request: FastifyRequest): string | undefined {
  const headerId = request.headers['x-request-id'];
  if (typeof headerId === 'string' && headerId.length > 0) {
    return headerId;
  }
  const reqId = (request as unknown as { id?: string }).id;
  if (typeof reqId === 'string' && reqId.length > 0) {
    return reqId;
  }
  return undefined;
}

/**
 * HTTP 상태 코드와 에러 정보를 기반으로 ProblemDetails 빌드
 * Design Ref: §2.1
 */
export function buildProblemFromError(
  err: Error & { statusCode?: number },
): ProblemDetails {
  const status = err.statusCode && err.statusCode >= 400 && err.statusCode <= 599 ? err.statusCode : 500;

  if (status >= 500) {
    return internalError(err.message || '처리 중 오류가 발생했습니다');
  }

  return problem({
    type: `${GATEWAY_ERROR_BASE}/client-error`,
    title: err.name || 'Client Error',
    status,
    detail: err.message,
  });
}

/**
 * Fastify 전역 Problem Details 에러 플러그인
 * Plan SC: FR-APIGWR2.1, FR-APIGWR2.2
 */
async function problemErrorPlugin(app: FastifyInstance): Promise<void> {
  app.setErrorHandler(async (err, request, reply) => {
    const traceId = extractGatewayTraceId(request);
    let pd = buildProblemFromError(err as Error & { statusCode?: number });

    if (traceId) {
      pd = withTraceId(pd, traceId);
    }

    // 로그 상관관계 (FR-APIGWR2.6)
    request.log.error(
      { err, traceId, status: pd.status, path: request.url },
      'gateway problem error handler',
    );

    void reply
      .status(pd.status)
      .header('content-type', 'application/problem+json; charset=utf-8');
    await reply.send(pd);
  });

  app.setNotFoundHandler(async (request, reply) => {
    const traceId = extractGatewayTraceId(request);
    let pd: ProblemDetails = notFound(`경로 ${request.url}를 찾을 수 없습니다`);
    if (traceId) {
      pd = withTraceId(pd, traceId);
    }
    void reply
      .status(404)
      .header('content-type', 'application/problem+json; charset=utf-8');
    await reply.send(pd);
  });
}

export default fp(problemErrorPlugin, {
  name: 'problem-error',
  fastify: '5.x',
});

export { GATEWAY_ERROR_BASE };
