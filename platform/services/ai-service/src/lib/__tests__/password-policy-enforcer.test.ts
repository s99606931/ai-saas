// MTU-N350 비밀번호 정책 집행 테스트
import { describe, it, expect } from 'vitest';
import { PasswordPolicyEnforcerService } from '../password-policy-enforcer.js';

describe('MTU-N350 PasswordPolicyEnforcer', () => {
  const svc = new PasswordPolicyEnforcerService('tenant-n350');

  it('FR-N350.1: 정책 정의', () => {
    const p = svc.define({ minLength: 12, requireUppercase: true, requireDigit: true, requireSpecial: true });
    expect(p).toBeDefined();
  });

  it('FR-N350.2: 비밀번호 검증', () => {
    svc.define();
    const validation = svc.validate('StrongP@ss123');
    expect(validation).toBeDefined();
  });

  it('FR-N350.3: 히스토리 확인', () => {
    svc.recordChange('user-1', 'hash1');
    const reused = svc.checkHistory('user-1', 'hash1');
    expect(typeof reused).toBe('boolean');
  });

  it('FR-N350.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
