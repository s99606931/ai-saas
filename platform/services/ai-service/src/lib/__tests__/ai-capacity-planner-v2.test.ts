import { describe, it, expect } from 'vitest';
import { AiCapacityPlannerV2 } from '../ai-capacity-planner-v2.js';

describe('SVC-AI-ADV-R355 AiCapacityPlannerV2', () => {
  const svc = new AiCapacityPlannerV2();
  const config = { targetUtilization: 70, lowWatermark: 30, perNodeCapacity: 20, windowSize: 3 };

  it('FR-355.1/2: scale-out 권고', () => {
    const r = svc.plan([60, 80, 90], config);
    expect(r.action).toBe('scale-out');
    expect(r.delta).toBeGreaterThan(0);
  });

  it('hold 권고', () => {
    const r = svc.plan([50, 55, 60], config);
    expect(r.action).toBe('hold');
  });

  it('scale-in 권고', () => {
    const r = svc.plan([10, 15, 20], config);
    expect(r.action).toBe('scale-in');
  });

  it('FR-355.3: C/S 차단', () => {
    expect(() => svc.plan([10], config, 'C')).toThrow('N2SF_BLOCKED');
  });

  it('FR-355.4: 감사 로그', () => {
    svc.plan([50, 50, 50], config);
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });

  it('빈 samples INVALID_PARAMS', () => {
    expect(() => svc.plan([], config)).toThrow('INVALID_PARAMS');
  });
});
