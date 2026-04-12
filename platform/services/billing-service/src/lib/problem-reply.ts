// Billing service Problem Details 헬퍼
// Design Ref: SVC-BILLR2-R55.design.md §3
// Plan SC: FR-BILLR2.1, FR-BILLR2.3, FR-BILLR2.5

import { problem, withTraceId } from '@public-saas/problem-details';
import type { FastifyRequest, FastifyReply } from 'fastify';

export const BILLING_ERROR_BASE = 'https://problems.public-saas.kr/errors/billing';

export const BillingProblemTypes = {
  validation: `${BILLING_ERROR_BASE}/validation`,
  invoiceNotFound: `${BILLING_ERROR_BASE}/invoice-not-found`,
  subscriptionNotFound: `${BILLING_ERROR_BASE}/subscription-not-found`,
  forbidden: `${BILLING_ERROR_BASE}/forbidden`,
  alreadyPaid: `${BILLING_ERROR_BASE}/already-paid`,
} as const;

/**
 * 요청 헤더에서 trace id 추출.
 * 우선순위: x-request-id > traceparent (W3C) trace-id 부분
 * Plan SC: FR-BILLR2.3
 */
export function extractTraceId(request: FastifyRequest): string | undefined {
  const reqId = request.headers['x-request-id'];
  if (typeof reqId === 'string' && reqId.length > 0) return reqId;
  const tp = request.headers['traceparent'];
  if (typeof tp === 'string' && tp.length > 0) {
    // 00-<trace-id>-<parent-id>-<flags>
    const parts = tp.split('-');
    if (parts.length >= 2 && parts[1] && parts[1].length > 0) {
      return parts[1];
    }
  }
  return undefined;
}

export interface ProblemReplyOptions {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  extensions?: Record<string, unknown>;
}

/**
 * RFC 7807 Problem Details 응답 헬퍼.
 * Plan SC: FR-BILLR2.1, NFR-BILLR2.2
 */
export async function problemReply(
  request: FastifyRequest,
  reply: FastifyReply,
  opts: ProblemReplyOptions,
): Promise<void> {
  const instance = opts.instance ?? request.url;
  let pd = problem({
    type: opts.type,
    title: opts.title,
    status: opts.status,
    detail: opts.detail,
    instance,
    extensions: opts.extensions,
  });
  const traceId = extractTraceId(request);
  if (traceId) {
    pd = withTraceId(pd, traceId);
  }
  void reply
    .status(opts.status)
    .header('content-type', 'application/problem+json; charset=utf-8');
  await reply.send(pd);
}
