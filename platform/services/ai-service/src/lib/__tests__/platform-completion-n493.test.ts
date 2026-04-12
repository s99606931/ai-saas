import { describe, it, expect } from 'vitest';
import { PlatformCompletionN493 } from '../platform-completion-n493';

describe('PlatformCompletionN493', () => {
  it('FR-N493.1 초기화', () => {
    const svc = new PlatformCompletionN493();
    const r = svc.initialize({ name: 'test', version: '1.0.0' });
    expect(r.ready).toBe(true);
  });

  it('FR-N493.2 스모크 테스트', () => {
    const svc = new PlatformCompletionN493();
    const r = svc.runSmokeTest('mod-a');
    expect(r.passed).toBe(true);
    expect(r.checks.length).toBe(3);
  });

  it('FR-N493.3 감사 로그', () => {
    const svc = new PlatformCompletionN493();
    svc.record('user1', 'ACT', 'target1');
    expect(svc.getAuditLog().length).toBe(1);
    expect(svc.getAuditLog()[0]!.action).toBe('ACT');
  });
});
