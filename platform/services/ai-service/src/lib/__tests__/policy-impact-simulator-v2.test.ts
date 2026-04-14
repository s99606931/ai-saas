import { describe, it, expect, beforeEach } from 'vitest';
import { PolicyImpactSimulatorV2 } from '../policy-impact-simulator-v2';

describe('PolicyImpactSimulatorV2', () => {
  let sim: PolicyImpactSimulatorV2;

  beforeEach(() => {
    sim = new PolicyImpactSimulatorV2();
  });

  const base = {
    scenarioId: 's1',
    baseBeneficiaries: 10000,
    baseCost: 1000000,
    delta: 0.1,
    elasticity: 0.5,
    costDelta: 0.1,
    costElasticity: 0.8,
  };

  it('computes projected beneficiaries and cost', () => {
    const r = sim.simulate(base);
    expect(r.projectedBeneficiaries).toBe(10500);
    expect(r.projectedCost).toBeCloseTo(1080000, 0);
  });

  it('recommends PROCEED when side effect score < 40', () => {
    const r = sim.simulate({ ...base, delta: 0.1, costDelta: 0.1 });
    expect(r.recommendation).toBe('PROCEED');
  });

  it('recommends REVIEW when side effect 40~69', () => {
    const r = sim.simulate({ ...base, delta: 0.8, costDelta: 0.1 });
    expect(r.recommendation).toBe('REVIEW');
  });

  it('recommends REJECT when side effect >= 70', () => {
    const r = sim.simulate({ ...base, delta: 1, costDelta: 1 });
    expect(r.recommendation).toBe('REJECT');
  });

  it('blocks C/S grade (N2SF N-05)', () => {
    expect(() => sim.simulate(base, 'C')).toThrow('BLOCKED');
    expect(() => sim.simulate(base, 'S')).toThrow('BLOCKED');
  });

  it('rejects negative baseline', () => {
    expect(() => sim.simulate({ ...base, baseCost: -1 })).toThrow('INVALID_BASE');
  });

  it('records audit log', () => {
    sim.simulate(base);
    expect(sim.getAuditLog().some((e) => e.action === 'SIMULATE')).toBe(true);
  });
});
