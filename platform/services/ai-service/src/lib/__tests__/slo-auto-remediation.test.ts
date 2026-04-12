import { describe, it, expect } from 'vitest';
import { SLOAutoRemediation, type SLODefinition, type SLOState } from '../slo-auto-remediation';

describe('SLOAutoRemediation', () => {
  const slo: SLODefinition = {
    serviceId: 'svc-a',
    metric: 'availability',
    target: 0.999,
    windowDays: 30,
  };

  it('detects critical violation on high burn rate', () => {
    const svc = new SLOAutoRemediation();
    const state: SLOState = {
      serviceId: 'svc-a',
      currentValue: 0.98,
      errorBudgetRemaining: 0.05,
      burnRatePerHour: 20,
    };
    const v = svc.detectViolation(state, slo);
    expect(v.violated).toBe(true);
    expect(v.severity).toBe('critical');
  });

  it('classifies bad deploy', () => {
    const svc = new SLOAutoRemediation();
    const cause = svc.classifyCause({
      trafficSpikeDetected: false,
      recentDeployWithin5Min: true,
      dependencyErrorRate: 0,
    });
    expect(cause).toBe('bad-deploy');
  });

  it('selects rollback action for bad deploy', () => {
    const svc = new SLOAutoRemediation();
    const sel = svc.selectAction('bad-deploy');
    expect(sel.action).toBe('rollback-deploy');
    expect(sel.confidence).toBeGreaterThan(0.8);
  });

  it('returns null plan when SLO healthy', () => {
    const svc = new SLOAutoRemediation();
    const state: SLOState = {
      serviceId: 'svc-a',
      currentValue: 0.9999,
      errorBudgetRemaining: 0.9,
      burnRatePerHour: 0.5,
    };
    const plan = svc.plan(state, slo, {
      trafficSpikeDetected: false,
      recentDeployWithin5Min: false,
      dependencyErrorRate: 0,
    });
    expect(plan).toBeNull();
  });

  it('records remediation history', () => {
    const svc = new SLOAutoRemediation();
    svc.recordResult({
      planId: 'P1-scale-out',
      executedAt: '2026-04-12T00:00:00Z',
      success: true,
      sloImprovedBy: 0.01,
    });
    expect(svc.getHistoryCount()).toBe(1);
    expect(svc.getSuccessRate('scale-out')).toBe(1);
  });
});
