// SVC-AI-ADV-R429 AI Policy Impact Simulator v3
// Design Ref: SVC-AI-ADV-R429.design.md
// Plan SC: FR-429.1~5
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';
export type SimRec = 'PROCEED' | 'REVIEW' | 'REJECT';

export interface PolicyScenario {
  readonly scenarioId: string;
  readonly baseRevenue: number;
  readonly baseBeneficiaries: number;
  readonly deltaTax: number; // -1.0 ~ +1.0
  readonly deltaBenefit: number; // -1.0 ~ +1.0
  readonly elasticityTax: number;
  readonly elasticityBenefit: number;
}

export interface SimResult {
  readonly scenarioId: string;
  readonly projectedRevenue: number;
  readonly projectedBeneficiaries: number;
  readonly sideEffectScore: number;
  readonly recommendation: SimRec;
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

export class AIPolicyImpactSimulatorV3 {
  private readonly auditLog: AuditEntry[] = [];

  simulate(scenario: PolicyScenario, grade: DataGrade = 'O'): SimResult {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 정책 데이터 차단 (N2SF N-05)`);
    }
    if (scenario.baseRevenue < 0 || scenario.baseBeneficiaries < 0) {
      throw new Error('INVALID_BASE');
    }

    const projectedRevenue = Number(
      (scenario.baseRevenue * (1 + scenario.elasticityTax * scenario.deltaTax)).toFixed(2),
    );
    const projectedBeneficiaries = Math.round(
      scenario.baseBeneficiaries * (1 + scenario.elasticityBenefit * scenario.deltaBenefit),
    );
    const sideEffectScore = Number(
      Math.max(
        0,
        Math.min(100, Math.abs(scenario.deltaTax) * 50 + Math.abs(scenario.deltaBenefit) * 30),
      ).toFixed(2),
    );

    let recommendation: SimRec;
    if (sideEffectScore < 40) recommendation = 'PROCEED';
    else if (sideEffectScore < 70) recommendation = 'REVIEW';
    else recommendation = 'REJECT';

    this.record('SIMULATE', scenario.scenarioId, {
      projectedRevenue,
      projectedBeneficiaries,
      sideEffectScore,
      recommendation,
    });
    return {
      scenarioId: scenario.scenarioId,
      projectedRevenue,
      projectedBeneficiaries,
      sideEffectScore,
      recommendation,
    };
  }

  getAuditLog(): readonly AuditEntry[] {
    return this.auditLog;
  }

  private record(action: string, target: string, details: Record<string, unknown>): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      target,
      details,
    });
  }
}
