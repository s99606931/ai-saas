// MTU-N357 정책 시뮬레이터 테스트
import { describe, it, expect } from 'vitest';
import { PolicySimulatorService } from '../policy-simulator.js';

describe('MTU-N357 PolicySimulator', () => {
  const svc = new PolicySimulatorService('tenant-n357');

  it('FR-N357.1: 시나리오 정의', () => {
    const scenario = svc.define('세제 개편', { taxRate: 0.22 }, '법인세 인하');
    expect(scenario).toBeDefined();
  });

  it('FR-N357.2: 시뮬레이션 실행', () => {
    const scenario = svc.define('지원금', { amount: 100 });
    const result = svc.simulate(scenario, { baseline: 50 });
    expect(result).toBeDefined();
  });

  it('FR-N357.3: 영향 리포트', () => {
    const s1 = svc.define('옵션 A', { x: 1 });
    const report = svc.report([s1], { baseline: 10 });
    expect(report).toBeDefined();
  });

  it('FR-N357.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
