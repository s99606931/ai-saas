// RFC 7807 Problem Details 응답 헬퍼
// Design Ref: SVC-AUTHR2-R50.design.md §2.1
// Plan SC: FR-AUTHR2.1, FR-AUTHR2.2, FR-AUTHR2.5
// CSAP: D-12-03 표준 에러 응답, D-06-02 traceId 상관관계

import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  problem,
  withTraceId,
  type ProblemDetails,
  type ProblemOptions,
} from '@public-saas/problem-details';

export const AUTH_ERROR_BASE = 'https://problems.public-saas.kr/errors/auth';

/**
 * auth-service 에러 타입 URI
 * Plan SC: FR-AUTHR2.6
 */
export const AuthProblemTypes = {
  validation: `${AUTH_ERROR_BASE}/validation`,
  invalidCredentials: `${AUTH_ERROR_BASE}/invalid-credentials`,
  tenantNotFound: `${AUTH_ERROR_BASE}/tenant-not-found`,
  userNotFound: `${AUTH_ERROR_BASE}/user-not-found`,
  accountLocked: `${AUTH_ERROR_BASE}/account-locked`,
  mfaRequired: `${AUTH_ERROR_BASE}/mfa-required`,
  mfaInvalid: `${AUTH_ERROR_BASE}/mfa-invalid`,
  tokenRevoked: `${AUTH_ERROR_BASE}/token-revoked`,
  tokenExpired: `${AUTH_ERROR_BASE}/token-expired`,
  tokenInvalid: `${AUTH_ERROR_BASE}/token-invalid`,
  noToken: `${AUTH_ERROR_BASE}/no-token`,
} as const;

export type ProblemReplyOptions = Omit<ProblemOptions, 'status'> & {
  status: number;
};

/**
 * 요청 헤더에서 traceId 추출
 * 우선순위: x-request-id → traceparent 파싱
 */
export function extractTraceId(request: FastifyRequest): string | undefined {
  const requestId = request.headers['x-request-id'];
  if (typeof requestId === 'string' && requestId.length > 0) {
    return requestId;
  }

  const traceparent = request.headers['traceparent'];
  if (typeof traceparent === 'string') {
    // W3C: 00-{traceId32}-{spanId16}-{flags2}
    const parts = traceparent.split('-');
    if (parts.length === 4 && parts[1] && parts[1].length === 32) {
      return parts[1];
    }
  }
  return undefined;
}

/**
 * Problem Details 응답 전송
 * Design Ref: §2.1
 *
 * @param request - Fastify 요청 객체
 * @param reply - Fastify 응답 객체
 * @param opts - Problem Details 옵션
 */
export async function problemReply(
  request: FastifyRequest,
  reply: FastifyReply,
  opts: ProblemReplyOptions,
): Promise<void> {
  const instance =
    opts.instance ??
    (request as unknown as { routerPath?: string }).routerPath ??
    request.url;

  let pd: ProblemDetails = problem({
    ...opts,
    instance,
  });

  const traceId = extractTraceId(request);
  if (traceId) {
    pd = withTraceId(pd, traceId);
  }

  void reply
    .status(opts.status)
    .header('Content-Type', 'application/problem+json; charset=utf-8');
  await reply.send(pd);
}
