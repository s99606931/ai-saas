// problem-reply 유닛 테스트
// Design Ref: SVC-AUTHR2-R50.design.md §2
// Plan SC: FR-AUTHR2.1, FR-AUTHR2.2, FR-AUTHR2.5, FR-AUTHR2.6

import { describe, it, expect, vi } from 'vitest';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  AuthProblemTypes,
  extractTraceId,
  problemReply,
} from '../../src/lib/problem-reply.js';

function makeMockReply(): {
  reply: FastifyReply;
  state: { status?: number; headers: Record<string, string>; body?: unknown };
} {
  const state: { status?: number; headers: Record<string, string>; body?: unknown } = {
    headers: {},
  };
  const reply = {
    status: vi.fn((code: number) => {
      state.status = code;
      return reply;
    }),
    header: vi.fn((name: string, value: string) => {
      state.headers[name.toLowerCase()] = value;
      return reply;
    }),
    send: vi.fn(async (body: unknown) => {
      state.body = body;
      return reply;
    }),
  } as unknown as FastifyReply;
  return { reply, state };
}

function makeMockRequest(
  headers: Record<string, string> = {},
  options: { url?: string; routerPath?: string } = {},
): FastifyRequest {
  return {
    headers,
    url: options.url ?? '/auth/login',
    routerPath: options.routerPath ?? '/auth/login',
  } as unknown as FastifyRequest;
}

// ---------- extractTraceId ----------

describe('extractTraceId (FR-AUTHR2.2)', () => {
  it('x-request-id 헤더가 있으면 그 값을 반환한다', () => {
    const req = makeMockRequest({ 'x-request-id': 'req-123' });
    expect(extractTraceId(req)).toBe('req-123');
  });

  it('x-request-id가 없고 traceparent가 있으면 traceId(32자)를 반환한다', () => {
    const tp = '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01';
    const req = makeMockRequest({ traceparent: tp });
    expect(extractTraceId(req)).toBe('0af7651916cd43dd8448eb211c80319c');
  });

  it('둘 다 없으면 undefined를 반환한다', () => {
    const req = makeMockRequest();
    expect(extractTraceId(req)).toBeUndefined();
  });

  it('traceparent 형식이 올바르지 않으면 undefined를 반환한다', () => {
    const req = makeMockRequest({ traceparent: '00-short-xx-01' });
    expect(extractTraceId(req)).toBeUndefined();
  });
});

// ---------- problemReply ----------

describe('problemReply (FR-AUTHR2.1, FR-AUTHR2.5)', () => {
  it('RFC 7807 Content-Type을 설정한다', async () => {
    const req = makeMockRequest();
    const { reply, state } = makeMockReply();
    await problemReply(req, reply, {
      type: AuthProblemTypes.invalidCredentials,
      title: 'bad creds',
      status: 401,
    });
    expect(state.headers['content-type']).toBe('application/problem+json; charset=utf-8');
  });

  it('전달된 상태 코드를 반영한다', async () => {
    const req = makeMockRequest();
    const { reply, state } = makeMockReply();
    await problemReply(req, reply, {
      type: AuthProblemTypes.accountLocked,
      title: 'locked',
      status: 423,
    });
    expect(state.status).toBe(423);
  });

  it('routerPath를 instance로 사용한다', async () => {
    const req = makeMockRequest({}, { routerPath: '/auth/login' });
    const { reply, state } = makeMockReply();
    await problemReply(req, reply, {
      type: AuthProblemTypes.validation,
      title: 'v',
      status: 400,
    });
    const body = state.body as { instance?: string };
    expect(body.instance).toBe('/auth/login');
  });

  it('routerPath가 없으면 url을 instance로 사용한다', async () => {
    const req = {
      headers: {},
      url: '/auth/verify?x=1',
    } as unknown as FastifyRequest;
    const { reply, state } = makeMockReply();
    await problemReply(req, reply, {
      type: AuthProblemTypes.tokenInvalid,
      title: 't',
      status: 401,
    });
    const body = state.body as { instance?: string };
    expect(body.instance).toBe('/auth/verify?x=1');
  });

  it('x-request-id가 있으면 traceId를 본문에 포함한다', async () => {
    const req = makeMockRequest({ 'x-request-id': 'trace-abc' });
    const { reply, state } = makeMockReply();
    await problemReply(req, reply, {
      type: AuthProblemTypes.mfaRequired,
      title: 'mfa',
      status: 403,
    });
    const body = state.body as { traceId?: string };
    expect(body.traceId).toBe('trace-abc');
  });

  it('traceId가 없으면 본문에 포함하지 않는다', async () => {
    const req = makeMockRequest();
    const { reply, state } = makeMockReply();
    await problemReply(req, reply, {
      type: AuthProblemTypes.validation,
      title: 'v',
      status: 400,
    });
    const body = state.body as { traceId?: string };
    expect(body.traceId).toBeUndefined();
  });

  it('title과 type을 본문에 포함한다', async () => {
    const req = makeMockRequest();
    const { reply, state } = makeMockReply();
    await problemReply(req, reply, {
      type: AuthProblemTypes.tokenRevoked,
      title: '토큰이 무효화되었습니다',
      status: 401,
    });
    const body = state.body as { title?: string; type?: string; status?: number };
    expect(body.title).toBe('토큰이 무효화되었습니다');
    expect(body.type).toBe(AuthProblemTypes.tokenRevoked);
    expect(body.status).toBe(401);
  });

  it('extensions 필드를 본문에 병합한다', async () => {
    const req = makeMockRequest();
    const { reply, state } = makeMockReply();
    await problemReply(req, reply, {
      type: AuthProblemTypes.accountLocked,
      title: 'locked',
      status: 423,
      extensions: { lockedUntil: '2026-04-11T00:00:00Z' },
    });
    const body = state.body as Record<string, unknown>;
    expect(body['lockedUntil']).toBe('2026-04-11T00:00:00Z');
  });
});

// ---------- AuthProblemTypes ----------

describe('AuthProblemTypes (FR-AUTHR2.6)', () => {
  it('auth-service 전용 에러 타입 URI를 정의한다', () => {
    expect(AuthProblemTypes.invalidCredentials).toMatch(/\/errors\/auth\/invalid-credentials$/);
    expect(AuthProblemTypes.accountLocked).toMatch(/\/errors\/auth\/account-locked$/);
    expect(AuthProblemTypes.mfaRequired).toMatch(/\/errors\/auth\/mfa-required$/);
    expect(AuthProblemTypes.tokenRevoked).toMatch(/\/errors\/auth\/token-revoked$/);
  });

  it('모든 AuthProblemTypes는 https URI 포맷을 준수한다', () => {
    for (const uri of Object.values(AuthProblemTypes)) {
      expect(uri.startsWith('https://')).toBe(true);
    }
  });
});
