import { describe, it, expect, beforeEach } from 'vitest';
import { AIPoweredDisasterRecoveryV2 } from '../ai-powered-disaster-recovery-v2';

describe('AIPoweredDisasterRecoveryV2', () => {
  let dr: AIPoweredDisasterRecoveryV2;

  beforeEach(() => {
    dr = new AIPoweredDisasterRecoveryV2();
    dr.registerSystem({ systemId: 'sys1', name: 'portal', tier: 'TIER2' });
  });

  it('classifies CATASTROPHIC + FAILOVER for loss >= 0.8', () => {
    const p = dr.assessIncident({ incidentId: 'i', systemId: 'sys1', availabilityLoss: 0.9 });
    expect(p.level).toBe('CATASTROPHIC');
    expect(p.action).toBe('FAILOVER');
  });

  it('classifies MAJOR + RESTORE for loss 0.4~0.8', () => {
    const p = dr.assessIncident({ incidentId: 'i', systemId: 'sys1', availabilityLoss: 0.5 });
    expect(p.level).toBe('MAJOR');
    expect(p.action).toBe('RESTORE');
  });

  it('classifies MINOR + MONITOR for loss < 0.4', () => {
    const p = dr.assessIncident({ incidentId: 'i', systemId: 'sys1', availabilityLoss: 0.1 });
    expect(p.level).toBe('MINOR');
    expect(p.action).toBe('MONITOR');
  });

  it('escalates one rank when tier TIER1', () => {
    dr.registerSystem({ systemId: 'sys2', name: 'core', tier: 'TIER1' });
    const p = dr.assessIncident({ incidentId: 'i', systemId: 'sys2', availabilityLoss: 0.5 });
    expect(p.action).toBe('FAILOVER');
  });

  it('blocks C/S grade (N2SF N-05)', () => {
    expect(() =>
      dr.assessIncident({ incidentId: 'i', systemId: 'sys1', availabilityLoss: 0.5 }, 'C'),
    ).toThrow('BLOCKED');
    expect(() =>
      dr.assessIncident({ incidentId: 'i', systemId: 'sys1', availabilityLoss: 0.5 }, 'S'),
    ).toThrow('BLOCKED');
  });

  it('rejects unknown system and invalid loss', () => {
    expect(() =>
      dr.assessIncident({ incidentId: 'i', systemId: 'unknown', availabilityLoss: 0.5 }),
    ).toThrow('UNKNOWN_SYSTEM');
    expect(() =>
      dr.assessIncident({ incidentId: 'i', systemId: 'sys1', availabilityLoss: 2 }),
    ).toThrow('INVALID_AVAILABILITY_LOSS');
  });

  it('lists failover plans and maintains audit log', () => {
    dr.assessIncident({ incidentId: 'i1', systemId: 'sys1', availabilityLoss: 0.95 });
    dr.assessIncident({ incidentId: 'i2', systemId: 'sys1', availabilityLoss: 0.1 });
    expect(dr.getFailoverPlans().map((p) => p.incidentId)).toEqual(['i1']);
    expect(dr.getAuditLog().some((e) => e.action === 'ASSESS_INCIDENT')).toBe(true);
  });
});
