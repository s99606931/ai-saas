// MTU-N285 공공데이터 포털 연동 테스트
import { describe, it, expect } from 'vitest';
import { PublicDataPortalService } from '../public-data-portal.js';

describe('MTU-N285 PublicDataPortal', () => {
  const svc = new PublicDataPortalService('tenant-n285');

  it('FR-N285.1: 커넥터 등록', () => {
    const c = svc.registerConnector('data_go_kr', 'DATA_GO_KR_KEY');
    expect(c.connectorId).toBeDefined();
  });

  it('FR-N285.2: 커넥터 목록', () => {
    expect(svc.listConnectors().length).toBeGreaterThan(0);
  });

  it('FR-N285.3: 데이터 수집 (모킹)', () => {
    const c = svc.registerConnector('kosis', 'KOSIS_KEY');
    const r = svc.collect('u1', c.connectorId, '/stats/population');
    expect(r.requestId).toBeDefined();
    expect(Array.isArray(r.normalizedRecords)).toBe(true);
  });

  it('FR-N285.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
