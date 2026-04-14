import { describe, it, expect, beforeEach } from 'vitest';
import { ResourceQuotaOptimizerV3 } from '../resource-quota-optimizer-v3';

describe('SVC-AI-ADV-R644 ResourceQuotaOptimizerV3', () => {
  let svc: ResourceQuotaOptimizerV3;

  beforeEach(() => {
    svc = new ResourceQuotaOptimizerV3();
  });

  it('FR-R644.1: 네임스페이스 등록', () => {
    svc.registerNamespace('ns-a', 100);
    expect(svc.getUtilization('ns-a')).toBe(0);
  });

  it('FR-R644.2: S등급 차단', () => {
    svc.registerNamespace('ns-a', 100);
    expect(() => svc.recordUsage('ns-a', 10, 'S')).toThrow(/BLOCKED/);
  });

  it('FR-R644.3: 사용률 산출', () => {
    svc.registerNamespace('ns-a', 100);
    svc.recordUsage('ns-a', 30);
    svc.recordUsage('ns-a', 20);
    expect(svc.getUtilization('ns-a')).toBeCloseTo(0.5, 5);
  });

  it('FR-R644.4: 한도 초과 반환', () => {
    svc.registerNamespace('ns-a', 50);
    svc.registerNamespace('ns-b', 100);
    svc.recordUsage('ns-a', 60);
    svc.recordUsage('ns-b', 30);
    const over = svc.getOverLimitNamespaces();
    expect(over.map((n) => n.ns)).toEqual(['ns-a']);
  });

  it('FR-R644.5: 감사 로그 기록', () => {
    svc.registerNamespace('ns-a', 100);
    svc.recordUsage('ns-a', 10);
    const log = svc.getAuditLog();
    expect(log.some((e) => e.action === 'RECORD_USAGE')).toBe(true);
  });
});
