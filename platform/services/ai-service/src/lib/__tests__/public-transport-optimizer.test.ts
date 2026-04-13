import { describe, it, expect } from 'vitest';
import { PublicTransportOptimizer } from '../public-transport-optimizer.js';

describe('SVC-AI-ADV-R423 PublicTransportOptimizer', () => {
  const svc = new PublicTransportOptimizer();

  it('FR-423.2: 과부하 → INCREASE', () => {
    const out = svc.optimize([
      { routeId: 'R1', passengers: 95, capacity: 100, headwayPerHour: 4 },
    ]);
    expect(out[0]!.action).toBe('INCREASE');
  });

  it('FR-423.2: 저부하 → DECREASE', () => {
    const out = svc.optimize([
      { routeId: 'R2', passengers: 20, capacity: 100, headwayPerHour: 4 },
    ]);
    expect(out[0]!.action).toBe('DECREASE');
  });

  it('FR-423.2: 정상 → MAINTAIN', () => {
    const out = svc.optimize([
      { routeId: 'R3', passengers: 60, capacity: 100, headwayPerHour: 4 },
    ]);
    expect(out[0]!.action).toBe('MAINTAIN');
  });

  it('FR-423.3: 대기시간 계산', () => {
    const out = svc.optimize([
      { routeId: 'R4', passengers: 50, capacity: 100, headwayPerHour: 6 },
    ]);
    expect(out[0]!.estimatedWaitMin).toBe(10); // 60/6
  });

  it('FR-423.4: C 등급 차단', () => {
    expect(() =>
      svc.optimize([{ routeId: 'x', passengers: 1, capacity: 1, headwayPerHour: 1 }], 'C'),
    ).toThrow('N2SF_BLOCKED');
  });

  it('FR-423.5: 감사 로그', () => {
    svc.optimize([{ routeId: 'R5', passengers: 50, capacity: 100, headwayPerHour: 4 }]);
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
