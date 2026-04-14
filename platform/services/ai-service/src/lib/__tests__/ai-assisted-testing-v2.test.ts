import { describe, it, expect, beforeEach } from 'vitest';
import { AiAssistedTestingV2 } from '../ai-assisted-testing-v2';

describe('SVC-AI-ADV-R642 AiAssistedTestingV2', () => {
  let svc: AiAssistedTestingV2;

  beforeEach(() => {
    svc = new AiAssistedTestingV2();
  });

  it('FR-R642.1: 테스트 등록', () => {
    svc.registerTest('t1', 'auth');
    expect(svc.getModulePassRate('auth')).toBe(0);
  });

  it('FR-R642.2: S등급 차단', () => {
    svc.registerTest('t1', 'auth');
    expect(() => svc.recordResult('t1', 'pass', 'S')).toThrow(/BLOCKED/);
  });

  it('FR-R642.3: 통과율 산출', () => {
    svc.registerTest('t1', 'auth');
    svc.recordResult('t1', 'pass');
    svc.recordResult('t1', 'pass');
    svc.recordResult('t1', 'fail');
    expect(svc.getModulePassRate('auth')).toBeCloseTo(2 / 3, 5);
  });

  it('FR-R642.4: 취약 모듈 탐지', () => {
    svc.registerTest('t1', 'auth');
    svc.registerTest('t2', 'payment');
    svc.recordResult('t1', 'fail');
    svc.recordResult('t2', 'pass');
    const weak = svc.getWeakModules(0.5);
    expect(weak).toContain('auth');
    expect(weak).not.toContain('payment');
  });

  it('FR-R642.5: 감사 로그 기록', () => {
    svc.registerTest('t1', 'auth');
    svc.recordResult('t1', 'pass');
    const log = svc.getAuditLog();
    expect(log.some((e) => e.action === 'RECORD_RESULT')).toBe(true);
  });
});
