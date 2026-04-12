// MTU-N378 단위 테스트
import { describe, it, expect } from 'vitest';
import {
  registerSessionToken,
  resolveSaasToken,
  transformEgovRequest,
  transformSaasResponse,
  validateEgovRequest,
  getEgovAuditLog,
  EgovFrameBridgeService,
  type EgovRequest,
  type SaasResponse,
} from '../../src/lib/egov-frame-bridge';

describe('MTU-N378 EgovFrameBridge', () => {
  it('세션 토큰 등록/조회', () => {
    registerSessionToken('sess-1', 'jwt-token');
    expect(resolveSaasToken('sess-1')).toBe('jwt-token');
  });

  it('요청 변환 성공', () => {
    registerSessionToken('sess-2', 'jwt-2');
    const req: EgovRequest = {
      serviceId: 'user',
      operationId: 'get',
      sessionKey: 'sess-2',
      params: { id: 1 },
    };
    const saas = transformEgovRequest('t1', req);
    expect(saas.endpoint).toBe('/saas/user/get');
    expect(saas.headers.Authorization).toContain('jwt-2');
  });

  it('매핑 없는 세션 예외', () => {
    const req: EgovRequest = {
      serviceId: 'user',
      operationId: 'get',
      sessionKey: 'unknown',
      params: {},
    };
    expect(() => transformEgovRequest('t1', req)).toThrow(/매핑 없음/);
  });

  it('응답 변환 - 200', () => {
    const resp: SaasResponse = { status: 200, body: { id: 1 } };
    const egov = transformSaasResponse('t1', resp);
    expect(egov.resultCode).toBe('0000');
    expect(egov.resultMessage).toBe('정상');
  });

  it('응답 변환 - 401', () => {
    const resp: SaasResponse = { status: 401, body: {} };
    const egov = transformSaasResponse('t1', resp);
    expect(egov.resultCode).toBe('4010');
  });

  it('알 수 없는 상태 코드', () => {
    const resp: SaasResponse = { status: 999, body: {} };
    const egov = transformSaasResponse('t1', resp);
    expect(egov.resultCode).toBe('9999');
  });

  it('요청 검증 - 필수 누락', () => {
    const r = validateEgovRequest({ serviceId: '', operationId: '', sessionKey: '', params: {} });
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('요청 검증 - 형식 오류', () => {
    const r = validateEgovRequest({ serviceId: 'user@', operationId: 'op', sessionKey: 's', params: {} });
    expect(r.valid).toBe(false);
  });

  it('서비스 클래스 통합', () => {
    const svc = new EgovFrameBridgeService('t2');
    svc.registerToken('sess-svc', 'tok');
    const saas = svc.transformRequest({
      serviceId: 'svc',
      operationId: 'op',
      sessionKey: 'sess-svc',
      params: {},
    });
    expect(saas.method).toBe('POST');
  });

  it('감사 로그 테넌트 격리', () => {
    registerSessionToken('sA', 'tA');
    registerSessionToken('sB', 'tB');
    transformEgovRequest('tenantA', { serviceId: 'a', operationId: 'o', sessionKey: 'sA', params: {} });
    transformEgovRequest('tenantB', { serviceId: 'b', operationId: 'o', sessionKey: 'sB', params: {} });
    expect(getEgovAuditLog('tenantA').every((e) => e.tenantId === 'tenantA')).toBe(true);
  });
});
