// MTU-N334 인증서 관리 테스트
import { describe, it, expect } from 'vitest';
import { CertificateManagerService } from '../certificate-manager.js';

describe('MTU-N334 CertificateManager', () => {
  const svc = new CertificateManagerService('tenant-n334');

  it('FR-N334.1: 인증서 등록', () => {
    const cert = svc.register('example.com', "Let's Encrypt", '2026-01-01', '2026-07-01', true);
    expect(cert).toBeDefined();
    expect(svc.list().length).toBeGreaterThan(0);
  });

  it('FR-N334.2: 만료 확인', () => {
    const cert = svc.register('test.com', 'DigiCert', '2026-01-01', '2026-05-01');
    const check = svc.checkExpiry(cert, 90);
    expect(check).toBeDefined();
  });

  it('FR-N334.3: 갱신 예약', () => {
    const sched = svc.scheduleRenewal('cert-1', 30);
    expect(sched).toBeDefined();
  });

  it('FR-N334.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
