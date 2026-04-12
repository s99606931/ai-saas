import { describe, it, expect, beforeEach } from 'vitest';
import { SecurityCertificationAI } from '../security-certification-ai';

describe('SecurityCertificationAI', () => {
  let certManager: SecurityCertificationAI;
  const futureDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;
  const expiringSoonDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;
  const expiredDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;

  beforeEach(() => {
    certManager = new SecurityCertificationAI();
  });

  it('인증을 등록한다', () => {
    certManager.registerCertification('csap', 'CSAP 중등급', futureDate, [
      { id: 'd-06', description: '침해사고 관리' },
    ]);
    const logs = certManager.getAuditLog();
    expect(logs.some(l => l.action === 'REGISTER_CERTIFICATION')).toBe(true);
  });

  it('항목 체크 결과를 기록한다', () => {
    certManager.registerCertification('csap', 'CSAP', futureDate, [{ id: 'd-06', description: '감사' }]);
    certManager.recordItemCheck('csap', 'd-06', true, '감사 로그 확인');
    expect(certManager.getAuditLog().some(l => l.action === 'RECORD_ITEM_CHECK')).toBe(true);
  });

  it('통과율을 올바르게 계산한다', () => {
    certManager.registerCertification('csap', 'CSAP', futureDate, [
      { id: 'a', description: '항목A' },
      { id: 'b', description: '항목B' },
      { id: 'c', description: '항목C' },
      { id: 'd', description: '항목D' },
    ]);
    certManager.recordItemCheck('csap', 'a', true, '통과');
    certManager.recordItemCheck('csap', 'b', true, '통과');
    certManager.recordItemCheck('csap', 'c', false, '미흡');
    certManager.recordItemCheck('csap', 'd', false, '미흡');
    const report = certManager.generateReport('csap');
    expect(report.passRate).toBe(50);
  });

  it('만료 임박 알림을 반환한다', () => {
    certManager.registerCertification('cert1', '인증1', expiringSoonDate, []);
    certManager.registerCertification('cert2', '인증2', futureDate, []);
    const alerts = certManager.getExpiryAlerts(30);
    expect(alerts.some(a => a.certId === 'cert1')).toBe(true);
    expect(alerts.some(a => a.certId === 'cert2')).toBe(false);
  });

  it('만료된 인증의 expiryStatus가 expired이다', () => {
    certManager.registerCertification('cert-expired', '만료인증', expiredDate, []);
    const report = certManager.generateReport('cert-expired');
    expect(report.expiryStatus).toBe('expired');
  });

  it('C등급 데이터 전송을 차단한다', () => {
    certManager.registerCertification('csap', 'CSAP', futureDate, [{ id: 'a', description: '항목' }]);
    expect(() => certManager.recordItemCheck('csap', 'a', true, '근거', 'C' as never)).toThrow('BLOCKED');
  });

  it('미등록 인증 보고서 요청 시 오류를 던진다', () => {
    expect(() => certManager.generateReport('unknown')).toThrow('인증 미등록');
  });
});
