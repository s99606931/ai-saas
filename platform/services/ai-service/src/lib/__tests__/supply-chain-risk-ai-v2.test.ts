import { describe, it, expect, beforeEach } from 'vitest';
import { SupplyChainRiskAIV2 } from '../supply-chain-risk-ai-v2';

describe('SupplyChainRiskAIV2', () => {
  let svc: SupplyChainRiskAIV2;

  beforeEach(() => {
    svc = new SupplyChainRiskAIV2();
    svc.registerVendor({ vendorId: 'v1', name: 'AcmeCo', criticality: 'MEDIUM' });
  });

  it('classifies HIGH + REPLACE for score >= 70', () => {
    const a = svc.assessRisk({ signalId: 's1', vendorId: 'v1', riskScore: 80 });
    expect(a.level).toBe('HIGH');
    expect(a.action).toBe('REPLACE');
  });

  it('classifies MEDIUM + MONITOR for score 40~70', () => {
    const a = svc.assessRisk({ signalId: 's1', vendorId: 'v1', riskScore: 50 });
    expect(a.level).toBe('MEDIUM');
    expect(a.action).toBe('MONITOR');
  });

  it('classifies LOW + ACCEPT for score < 40', () => {
    const a = svc.assessRisk({ signalId: 's1', vendorId: 'v1', riskScore: 20 });
    expect(a.level).toBe('LOW');
    expect(a.action).toBe('ACCEPT');
  });

  it('escalates one rank when criticality HIGH', () => {
    svc.registerVendor({ vendorId: 'v2', name: 'CritCo', criticality: 'HIGH' });
    const a = svc.assessRisk({ signalId: 's', vendorId: 'v2', riskScore: 50 });
    expect(a.action).toBe('REPLACE');
  });

  it('blocks C/S grade (N2SF N-05)', () => {
    expect(() =>
      svc.assessRisk({ signalId: 's', vendorId: 'v1', riskScore: 50 }, 'C'),
    ).toThrow('BLOCKED');
    expect(() =>
      svc.assessRisk({ signalId: 's', vendorId: 'v1', riskScore: 50 }, 'S'),
    ).toThrow('BLOCKED');
  });

  it('rejects unknown vendor and invalid score', () => {
    expect(() =>
      svc.assessRisk({ signalId: 's', vendorId: 'unknown', riskScore: 50 }),
    ).toThrow('UNKNOWN_VENDOR');
    expect(() =>
      svc.assessRisk({ signalId: 's', vendorId: 'v1', riskScore: 200 }),
    ).toThrow('INVALID_RISK_SCORE');
  });

  it('lists replace candidates and maintains audit log', () => {
    svc.assessRisk({ signalId: 's1', vendorId: 'v1', riskScore: 90 });
    svc.assessRisk({ signalId: 's2', vendorId: 'v1', riskScore: 5 });
    expect(svc.getReplaceCandidates().map((a) => a.signalId)).toEqual(['s1']);
    expect(svc.getAuditLog().some((e) => e.action === 'ASSESS_RISK')).toBe(true);
  });
});
