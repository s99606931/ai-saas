// problem-details 테스트
// Plan SC: FR-PD.1~FR-PD.8

import { describe, it, expect } from 'vitest';
import {
  problem,
  withTraceId,
  withErrors,
  sanitize,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  methodNotAllowed,
  conflict,
  gone,
  preconditionFailed,
  payloadTooLarge,
  unsupportedMediaType,
  unprocessable,
  tooManyRequests,
  internalError,
  notImplemented,
  badGateway,
  serviceUnavailable,
  PRESET_LIST,
  PROBLEM_BASE_URI,
} from '../src/index.js';

describe('FR-PD.2: problem 빌더', () => {
  it('필수 필드 생성', () => {
    const pd = problem({ title: '오류', status: 500 });
    expect(pd.title).toBe('오류');
    expect(pd.status).toBe(500);
    expect(pd.type).toContain(PROBLEM_BASE_URI);
  });

  it('title 누락 → 예외', () => {
    expect(() => problem({ title: '', status: 400 })).toThrow();
  });

  it('잘못된 status → 예외', () => {
    expect(() => problem({ title: 'x', status: 99 })).toThrow();
    expect(() => problem({ title: 'x', status: 600 })).toThrow();
  });

  it('extensions 추가', () => {
    const pd = problem({
      title: 'oops',
      status: 500,
      extensions: { errorId: 'abc-123' },
    });
    expect(pd.errorId).toBe('abc-123');
  });

  it('extensions에서 핵심 필드는 무시', () => {
    const pd = problem({
      title: 'x',
      status: 500,
      extensions: { type: 'evil', title: 'evil', status: 999 },
    });
    expect(pd.title).toBe('x');
    expect(pd.status).toBe(500);
  });

  it('명시된 type 사용', () => {
    const pd = problem({
      type: 'urn:x:y',
      title: 't',
      status: 400,
    });
    expect(pd.type).toBe('urn:x:y');
  });
});

describe('FR-PD.3: 16종 preset', () => {
  const cases: Array<[string, () => { status: number }, number]> = [
    ['badRequest', badRequest, 400],
    ['unauthorized', unauthorized, 401],
    ['forbidden', forbidden, 403],
    ['notFound', notFound, 404],
    ['methodNotAllowed', methodNotAllowed, 405],
    ['conflict', conflict, 409],
    ['gone', gone, 410],
    ['preconditionFailed', preconditionFailed, 412],
    ['payloadTooLarge', payloadTooLarge, 413],
    ['unsupportedMediaType', unsupportedMediaType, 415],
    ['unprocessable', unprocessable, 422],
    ['tooManyRequests', tooManyRequests, 429],
    ['internalError', internalError, 500],
    ['notImplemented', notImplemented, 501],
    ['badGateway', badGateway, 502],
    ['serviceUnavailable', serviceUnavailable, 503],
  ];

  for (const [name, fn, status] of cases) {
    it(`${name} → ${status}`, () => {
      const pd = fn();
      expect(pd.status).toBe(status);
      expect(pd.title).toBeTruthy();
      expect(pd.type).toContain(PROBLEM_BASE_URI);
    });
  }

  it('PRESET_LIST는 16개', () => {
    expect(PRESET_LIST.length).toBe(16);
  });
});

describe('FR-PD.4: withTraceId', () => {
  it('traceId 주입', () => {
    const pd = withTraceId(notFound('user not found'), 'trace-abc');
    expect(pd.traceId).toBe('trace-abc');
    expect(pd.detail).toBe('user not found');
  });
});

describe('FR-PD.5: withErrors', () => {
  it('필드 에러 첨부', () => {
    const pd = withErrors(unprocessable(), [
      { field: 'email', message: 'invalid format', code: 'invalid' },
    ]);
    expect(pd.errors).toHaveLength(1);
    expect(pd.errors?.[0]?.field).toBe('email');
  });
});

describe('FR-PD.6: sanitize', () => {
  it('production은 detail 제거', () => {
    const pd = problem({
      title: 't',
      status: 500,
      detail: 'database password=xxx',
      extensions: { stack: 'Error: ...' },
    });
    const out = sanitize(pd, 'production');
    expect(out.detail).toBeUndefined();
    expect(out.stack).toBeUndefined();
    expect(out.title).toBe('t');
    expect(out.status).toBe(500);
  });

  it('development는 그대로', () => {
    const pd = problem({
      title: 't',
      status: 500,
      detail: 'verbose',
    });
    const out = sanitize(pd, 'development');
    expect(out.detail).toBe('verbose');
  });

  it('staging은 그대로', () => {
    const pd = problem({ title: 't', status: 500, detail: 'd' });
    const out = sanitize(pd, 'staging');
    expect(out.detail).toBe('d');
  });
});

describe('FR-PD.8: type URI', () => {
  it('preset은 base URI 사용', () => {
    expect(badRequest().type).toBe(`${PROBLEM_BASE_URI}/bad-request`);
  });
});
