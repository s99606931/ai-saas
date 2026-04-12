// MTU-N335 보안 기준선 점검 테스트
import { describe, it, expect } from 'vitest';
import { SecurityBaselineCheckerService } from '../security-baseline-checker.js';

describe('MTU-N335 SecurityBaselineChecker', () => {
  const svc = new SecurityBaselineCheckerService('tenant-n335');

  it('FR-N335.1: 규칙 등록', () => {
    const rule = svc.register('R1', 'access', 'MFA 필수', 'MFA 설정 확인', 'high', 'mfa === true');
    expect(rule).toBeDefined();
  });

  it('FR-N335.2: 기준선 점검', () => {
    svc.register('R1', 'access', 'TLS 1.3', 'TLS 버전', 'high', 'tls === "1.3"');
    const report = svc.check({ tls: '1.3', mfa: true });
    expect(report).toBeDefined();
  });

  it('FR-N335.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
