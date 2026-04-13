import { describe, it, expect } from 'vitest';
import { AIPolicyImpactSimulatorV3 } from '../ai-policy-impact-simulator-v3.js';

describe('SVC-AI-ADV-R429 AIPolicyImpactSimulatorV3', () => {
  const svc = new AIPolicyImpactSimulatorV3();

  it('FR-429.1: 세수 예측', () => {
    const r = svc.simulate({
      scenarioId: 's1',
      baseRevenue: 1000,
      baseBeneficiaries: 100,
      deltaTax: 0.1,
      deltaBenefit: 0,
      elasticityTax: 0.5,
      elasticityBenefit: 0.5,
    });
    // 1000 * (1 + 0.5*0.1) = 1050
    expect(r.projectedRevenue).toBe(1050);
  });

  it('FR-429.2: 수혜자 예측', () => {
    const r = svc.simulate({
      scenarioId: 's2',
      baseRevenue: 1000,
      baseBeneficiaries: 100,
      deltaTax: 0,
      deltaBenefit: 0.2,
      elasticityTax: 0.5,
      elasticityBenefit: 0.5,
    });
    // 100 * (1 + 0.5*0.2) = 110
    expect(r.projectedBeneficiaries).toBe(110);
  });

  it('FR-429.4: 낮은 부작용 → PROCEED', () => {
    const r = svc.simulate({
      scenarioId: 's3',
      baseRevenue: 1000,
      baseBeneficiaries: 100,
      deltaTax: 0.1,
      deltaBenefit: 0.1,
      elasticityTax: 0.5,
      elasticityBenefit: 0.5,
    });
    // |0.1|*50 + |0.1|*30 = 8 < 40
    expect(r.recommendation).toBe('PROCEED');
  });

  it('FR-429.4: 중간 부작용 → REVIEW', () => {
    const r = svc.simulate({
      scenarioId: 's4',
      baseRevenue: 1000,
      baseBeneficiaries: 100,
      deltaTax: 0.5,
      deltaBenefit: 0.5,
      elasticityTax: 0.5,
      elasticityBenefit: 0.5,
    });
    // 25 + 15 = 40, but < 70 → REVIEW
    expect(r.recommendation).toBe('REVIEW');
  });

  it('FR-429.4: 높은 부작용 → REJECT', () => {
    const r = svc.simulate({
      scenarioId: 's5',
      baseRevenue: 1000,
      baseBeneficiaries: 100,
      deltaTax: 1.0,
      deltaBenefit: 1.0,
      elasticityTax: 0.5,
      elasticityBenefit: 0.5,
    });
    // 50 + 30 = 80 ≥ 70
    expect(r.recommendation).toBe('REJECT');
  });

  it('FR-429.5: S 차단', () => {
    expect(() =>
      svc.simulate(
        {
          scenarioId: 's',
          baseRevenue: 1,
          baseBeneficiaries: 1,
          deltaTax: 0,
          deltaBenefit: 0,
          elasticityTax: 0,
          elasticityBenefit: 0,
        },
        'S',
      ),
    ).toThrow('N2SF_BLOCKED');
  });

  it('감사 로그', () => {
    svc.simulate({
      scenarioId: 's9',
      baseRevenue: 100,
      baseBeneficiaries: 10,
      deltaTax: 0,
      deltaBenefit: 0,
      elasticityTax: 0,
      elasticityBenefit: 0,
    });
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
