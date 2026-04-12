import { describe, it, expect } from 'vitest';
import { PlatformCompletionN497 } from '../platform-completion-n497';

describe('PlatformCompletionN497', () => {
  it('FR-N497.1 초기화', () => {
    const svc = new PlatformCompletionN497();
    const r = svc.initialize({ name: 'test', version: '1.0.0' });
    expect(r.ready).toBe(true);
  });

  it('FR-N497.2 스모크 테스트', () => {
    const svc = new PlatformCompletionN497();
    const r = svc.runSmokeTest('mod-a');
    expect(r.passed).toBe(true);
    expect(r.checks.length).toBe(3);
  });

  it('FR-N497.3 감사 로그', () => {
    const svc = new PlatformCompletionN497();
    svc.record('user1', 'ACT', 'target1');
    expect(svc.getAuditLog().length).toBe(1);
    expect(svc.getAuditLog()[0]!.action).toBe('ACT');
  });
});
