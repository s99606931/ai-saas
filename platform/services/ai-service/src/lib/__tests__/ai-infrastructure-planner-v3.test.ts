import { describe, it, expect, beforeEach } from 'vitest';
import { AIInfrastructurePlannerV3 } from '../ai-infrastructure-planner-v3';

describe('AIInfrastructurePlannerV3', () => {
  let p: AIInfrastructurePlannerV3;

  beforeEach(() => {
    p = new AIInfrastructurePlannerV3();
    p.registerWorkload({ workloadId: 'wl-api', baseline: { cpu: 10, memory: 20, disk: 100 } });
  });

  it('FR-R706.3/4: HOLD when demand near baseline', () => {
    const r = p.plan({ workloadId: 'wl-api', forecast: { cpu: 9, memory: 18, disk: 90 } });
    expect(r.action).toBe('HOLD');
    expect(r.plan.cpu).toBe(Math.ceil(9 * 1.2));
    expect(r.maskedWorkloadId).toHaveLength(16);
    expect(r.maskedWorkloadId).not.toContain('wl-api');
  });

  it('FR-R706.4: SCALE_UP when demand grows', () => {
    const r = p.plan({ workloadId: 'wl-api', forecast: { cpu: 30, memory: 50, disk: 200 } });
    expect(r.action).toBe('SCALE_UP');
  });

  it('FR-R706.4: SCALE_DOWN when demand drops', () => {
    const r = p.plan({ workloadId: 'wl-api', forecast: { cpu: 2, memory: 3, disk: 10 } });
    expect(r.action).toBe('SCALE_DOWN');
  });

  it('FR-R706.2: blocks C/S grade (N2SF N-05)', () => {
    expect(() => p.plan({ workloadId: 'wl-api', forecast: { cpu: 1, memory: 1, disk: 1 } }, 'C')).toThrow('BLOCKED');
    expect(() => p.plan({ workloadId: 'wl-api', forecast: { cpu: 1, memory: 1, disk: 1 } }, 'S')).toThrow('BLOCKED');
  });

  it('FR-R706.1/2: rejects invalid and unknown inputs', () => {
    expect(() => p.registerWorkload({ workloadId: 'x', baseline: { cpu: -1, memory: 0, disk: 0 } })).toThrow('INVALID_BASELINE');
    expect(() => p.plan({ workloadId: 'ghost', forecast: { cpu: 1, memory: 1, disk: 1 } })).toThrow('UNKNOWN_WORKLOAD');
    expect(() => p.plan({ workloadId: 'wl-api', forecast: { cpu: -1, memory: 1, disk: 1 } })).toThrow('INVALID_FORECAST');
  });

  it('FR-R706.5: audit log masks workload ids', () => {
    p.plan({ workloadId: 'wl-api', forecast: { cpu: 10, memory: 20, disk: 100 } });
    const logs = p.getAuditLog();
    expect(logs.some((e) => e.action === 'PLAN')).toBe(true);
    for (const e of logs) {
      expect(JSON.stringify(e.details ?? {})).not.toContain('wl-api');
    }
  });
});
