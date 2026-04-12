// MTU-N321 SOC 사고 분류기 테스트
import { describe, it, expect } from 'vitest';
import { SOCIncidentClassifierService } from '../soc-incident-classifier.js';

describe('MTU-N321 SOCIncidentClassifier', () => {
  const svc = new SOCIncidentClassifierService('tenant-n321');

  it('FR-N321.1: 사고 분류', () => {
    const result = svc.classify({
      incidentId: 'inc-1',
      tenantId: 'tenant-n321',
      title: '비정상 로그인 시도',
      description: 'Multiple failed logins from single IP',
      sourceIp: '1.2.3.4',
      affectedAssets: ['auth-service'],
      rawLogs: 'brute force attempt detected',
      reportedAt: '2026-04-11',
    });
    expect(result).toBeDefined();
  });

  it('FR-N321.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
