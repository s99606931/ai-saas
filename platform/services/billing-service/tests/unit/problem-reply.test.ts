// problem-reply 헬퍼 단위 테스트
// Plan SC: FR-BILLR2.1, FR-BILLR2.3, FR-BILLR2.5

import { describe, it, expect, vi } from 'vitest';
import {
  extractTraceId,
  problemReply,
  BillingProblemTypes,
  BILLING_ERROR_BASE,
} from '../../src/lib/problem-reply.js';
import type { FastifyRequest, FastifyReply } from 'fastify';

function mockRequest(headers: Record<string, string> = {}, url = '/billing/invoices/1'): FastifyRequest {
  return { headers, url } as unknown as FastifyRequest;
}

function mockReply(): {
  reply: FastifyReply;
  status: ReturnType<typeof vi.fn>;
  header: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
} {
  const status = vi.fn();
  const header = vi.fn();
  const send = vi.fn();
  const reply = { status, header, send } as unknown as FastifyReply;
  status.mockReturnValue(reply);
  header.mockReturnValue(reply);
  send.mockResolvedValue(undefined);
  return { reply, status, header, send };
}

describe('BillingProblemTypes', () => {
  it('모든 타입이 billing 네임스페이스 사용', () => {
    for (const url of Object.values(BillingProblemTypes)) {
      expect(url.startsWith(BILLING_ERROR_BASE)).toBe(true);
    }
  });
});

describe('extractTraceId', () => {
  it('x-request-id 우선', () => {
    const req = mockRequest({ 'x-request-id': 'req-123', traceparent: '00-abcd-1-00' });
    expect(extractTraceId(req)).toBe('req-123');
  });

  it('traceparent W3C 포맷 파싱', () => {
    const req = mockRequest({ traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01' });
    expect(extractTraceId(req)).toBe('0af7651916cd43dd8448eb211c80319c');
  });

  it('헤더 없음 → undefined', () => {
    expect(extractTraceId(mockRequest({}))).toBeUndefined();
  });

  it('빈 x-request-id 무시', () => {
    const req = mockRequest({ 'x-request-id': '' });
    expect(extractTraceId(req)).toBeUndefined();
  });
});

describe('problemReply', () => {
  it('validation 에러 (400) 응답 작성', async () => {
    const req = mockRequest({ 'x-request-id': 'rq-1' });
    const { reply, status, header, send } = mockReply();
    await problemReply(req, reply, {
      type: BillingProblemTypes.validation,
      title: 'Validation Error',
      status: 400,
      detail: 'invalid',
    });
    expect(status).toHaveBeenCalledWith(400);
    expect(header).toHaveBeenCalledWith('content-type', 'application/problem+json; charset=utf-8');
    expect(send).toHaveBeenCalledOnce();
    const body = send.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(body['type']).toBe(BillingProblemTypes.validation);
    expect(body['status']).toBe(400);
    expect(body['detail']).toBe('invalid');
    expect(body['traceId']).toBe('rq-1');
    expect(body['instance']).toBe('/billing/invoices/1');
  });

  it('not found (404) 응답', async () => {
    const req = mockRequest({});
    const { reply, status, send } = mockReply();
    await problemReply(req, reply, {
      type: BillingProblemTypes.invoiceNotFound,
      title: 'Invoice Not Found',
      status: 404,
      detail: '없음',
    });
    expect(status).toHaveBeenCalledWith(404);
    const body = send.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(body['traceId']).toBeUndefined();
    expect(body['type']).toBe(BillingProblemTypes.invoiceNotFound);
  });

  it('forbidden (403) 응답 + traceparent 추출', async () => {
    const req = mockRequest({ traceparent: '00-deadbeefdeadbeefdeadbeefdeadbeef-00-00' });
    const { reply, status, send } = mockReply();
    await problemReply(req, reply, {
      type: BillingProblemTypes.forbidden,
      title: 'Forbidden',
      status: 403,
    });
    expect(status).toHaveBeenCalledWith(403);
    const body = send.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(body['traceId']).toBe('deadbeefdeadbeefdeadbeefdeadbeef');
  });

  it('alreadyPaid (409) 응답', async () => {
    const req = mockRequest({});
    const { reply, status, send } = mockReply();
    await problemReply(req, reply, {
      type: BillingProblemTypes.alreadyPaid,
      title: 'Already Paid',
      status: 409,
      detail: '중복',
    });
    expect(status).toHaveBeenCalledWith(409);
    const body = send.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(body['status']).toBe(409);
  });

  it('subscriptionNotFound (404) 응답', async () => {
    const req = mockRequest({ 'x-request-id': 'sub-req' });
    const { reply, send } = mockReply();
    await problemReply(req, reply, {
      type: BillingProblemTypes.subscriptionNotFound,
      title: 'Subscription Not Found',
      status: 404,
    });
    const body = send.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(body['type']).toBe(BillingProblemTypes.subscriptionNotFound);
    expect(body['traceId']).toBe('sub-req');
  });

  it('instance 명시 오버라이드', async () => {
    const req = mockRequest({});
    const { reply, send } = mockReply();
    await problemReply(req, reply, {
      type: BillingProblemTypes.validation,
      title: 'V',
      status: 400,
      instance: '/custom/path',
    });
    const body = send.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(body['instance']).toBe('/custom/path');
  });
});
