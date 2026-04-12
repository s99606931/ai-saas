// MTU-N378 eGovFrame 브리지 테스트
import { describe, it, expect } from 'vitest';
import { EgovFrameBridgeService, type EgovRequest, type SaasResponse } from '../egov-frame-bridge.js';

describe('MTU-N378 EgovFrameBridge', () => {
  const svc = new EgovFrameBridgeService('tenant-n378');

  const req: EgovRequest = {
    serviceId: 'svc1',
    operationId: 'op1',
    sessionKey: 'sess-1',
    params: { q: 'test', n: 10 },
  };

  it('FR-N378.1: 요청 검증', () => {
    expect(svc.validate(req).valid).toBe(true);
    expect(svc.validate({ ...req, serviceId: '' }).valid).toBe(false);
  });

  it('FR-N378.2: 요청 변환 (토큰 매핑)', () => {
    svc.registerToken('sess-1', 'saas-token-xxx');
    const saasReq = svc.transformRequest(req);
    expect(saasReq.headers.Authorization).toContain('saas-token-xxx');
    expect(saasReq.headers['X-Tenant-Id']).toBe('tenant-n378');
  });

  it('FR-N378.3: 응답 변환', () => {
    const resp: SaasResponse = { status: 200, body: { ok: true } };
    const egov = svc.transformResponse(resp);
    expect(egov.resultCode).toBe('0000');
  });

  it('FR-N378.4: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
