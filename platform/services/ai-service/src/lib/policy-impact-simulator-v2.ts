// Design Ref: SVC-AI-ADV-R647.design.md — AI기반 정책 영향 시뮬레이터 v2
// Plan SC: FR-R647.1~5

export type PolicyRec = 'PROCEED' | 'REVIEW' | 'REJECT';

interface PolicyScenario {
  scenarioId: string;
  baseBeneficiaries: number;
  baseCost: number;
  delta: number;
  elasticity: number;
  costDelta: number;
  costElasticity: number;
}
interface SimResult {
  scenarioId: string;
  projectedBeneficiaries: number;
  projectedCost: number;
  sideEffectScore: number;
  recommendation: PolicyRec;
}
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

export class PolicyImpactSimulatorV2 {
  private auditLog: AuditEntry[] = [];

  simulate(scenario: PolicyScenario, dataGrade?: string): SimResult {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`);
    }
    if (scenario.baseBeneficiaries < 0 || scenario.baseCost < 0) {
      throw new Error('INVALID_BASE');
    }
    const projectedBeneficiaries = Math.round(
      scenario.baseBeneficiaries * (1 + scenario.elasticity * scenario.delta),
    );
    const projectedCost = Number(
      (scenario.baseCost * (1 + scenario.costElasticity * scenario.costDelta)).toFixed(2),
    );
    const raw = Math.abs(scenario.delta) * 50 + Math.abs(scenario.costDelta) * 30;
    const sideEffectScore = Number(Math.max(0, Math.min(100, raw)).toFixed(2));

    let recommendation: PolicyRec;
    if (sideEffectScore < 40) recommendation = 'PROCEED';
    else if (sideEffectScore < 70) recommendation = 'REVIEW';
    else recommendation = 'REJECT';

    const result: SimResult = {
      scenarioId: scenario.scenarioId,
      projectedBeneficiaries,
      projectedCost,
      sideEffectScore,
      recommendation,
    };
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'SIMULATE',
      details: { ...result },
    });
    return result;
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
