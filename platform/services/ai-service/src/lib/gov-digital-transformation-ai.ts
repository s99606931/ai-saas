// SVC-AI-ADV-R490 Government Digital Transformation AI
// Design Ref: SVC-AI-ADV-R490.design.md §정부디지털전환
// Plan SC: FR-490.1~6
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

export interface AgencyMaturity {
  readonly agencyId: string;
  readonly legacySystemsCount: number;
  readonly cloudAdoptionPct: number;
  readonly apiCoveragePct: number;
  readonly dataDigitizationPct: number;
  readonly staffDigitalLiteracy: number;
  readonly citizenOnlineServicesPct: number;
}

export interface TransformationRoadmap {
  readonly agencyId: string;
  readonly maturityLevel: 1 | 2 | 3 | 4 | 5;
  readonly priorityActions: readonly string[];
  readonly estimatedDurationMonths: number;
  readonly estimatedBudgetKrw: number;
  readonly riskFactors: readonly string[];
}

interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly details: Record<string, unknown>;
}

function block(grade: DataGrade): void {
  if (grade === 'C' || grade === 'S') {
    throw new Error(`N2SF_BLOCKED: ${grade}등급 정부 데이터 차단 (N2SF N-05)`);
  }
}

export class GovDigitalTransformationAi {
  private readonly auditLog: AuditEntry[] = [];

  assess(maturity: AgencyMaturity, grade: DataGrade = 'O'): TransformationRoadmap {
    block(grade);

    const score =
      maturity.cloudAdoptionPct * 0.2 +
      maturity.apiCoveragePct * 0.2 +
      maturity.dataDigitizationPct * 0.2 +
      maturity.staffDigitalLiteracy * 0.2 +
      maturity.citizenOnlineServicesPct * 0.2;

    const maturityLevel: TransformationRoadmap['maturityLevel'] =
      score >= 85 ? 5 : score >= 70 ? 4 : score >= 50 ? 3 : score >= 30 ? 2 : 1;

    const actions: string[] = [];
    if (maturity.legacySystemsCount > 5) actions.push('legacy_modernization');
    if (maturity.cloudAdoptionPct < 50) actions.push('cloud_migration');
    if (maturity.apiCoveragePct < 60) actions.push('api_gateway_establishment');
    if (maturity.dataDigitizationPct < 70) actions.push('document_digitization');
    if (maturity.staffDigitalLiteracy < 60) actions.push('staff_training');
    if (maturity.citizenOnlineServicesPct < 70) actions.push('citizen_portal_expansion');
    if (actions.length === 0) actions.push('innovation_labs');

    const estimatedDurationMonths =
      maturityLevel === 1 ? 36 : maturityLevel === 2 ? 24 : maturityLevel === 3 ? 18 : maturityLevel === 4 ? 12 : 6;

    const estimatedBudgetKrw =
      actions.length * 500_000_000 + maturity.legacySystemsCount * 100_000_000;

    const riskFactors: string[] = [];
    if (maturity.legacySystemsCount > 10) riskFactors.push('technical_debt_high');
    if (maturity.staffDigitalLiteracy < 40) riskFactors.push('change_resistance');
    if (maturity.cloudAdoptionPct < 20) riskFactors.push('infrastructure_gap');

    this.appendAudit('DX_ASSESS', {
      agencyId: maturity.agencyId,
      maturityLevel,
      actions: actions.length,
    });

    return {
      agencyId: maturity.agencyId,
      maturityLevel,
      priorityActions: actions,
      estimatedDurationMonths,
      estimatedBudgetKrw,
      riskFactors,
    };
  }

  nationalIndex(agencies: readonly AgencyMaturity[]): number {
    if (agencies.length === 0) return 0;
    const plans = agencies.map((a) => this.assess(a));
    const avg = plans.reduce((acc, p) => acc + p.maturityLevel, 0) / plans.length;
    const idx = Math.round(avg * 20);
    this.appendAudit('NATIONAL_INDEX', { agencies: agencies.length, idx });
    return idx;
  }

  getAuditLog(): readonly AuditEntry[] {
    return [...this.auditLog];
  }

  private appendAudit(action: string, details: Record<string, unknown>): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      details,
    });
  }
}
