// SVC-AI-ADV-R482 International Cooperation AI
// Design Ref: SVC-AI-ADV-R482.design.md §국제협력
// Plan SC: FR-482.1~6
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

export interface CooperationProject {
  readonly projectId: string;
  readonly partnerCountry: string;
  readonly domain: 'ICT' | 'HEALTH' | 'EDUCATION' | 'ENVIRONMENT' | 'INFRASTRUCTURE';
  readonly budgetUsd: number;
  readonly durationMonths: number;
  readonly expectedBeneficiaries: number;
}

export interface CooperationScore {
  readonly projectId: string;
  readonly strategicFit: number;
  readonly costEffectiveness: number;
  readonly riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  readonly recommendation: 'APPROVE' | 'REVIEW' | 'REJECT';
}

interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly details: Record<string, unknown>;
}

const HIGH_RISK_COUNTRIES: ReadonlySet<string> = new Set(['XX', 'YY']);

function block(grade: DataGrade): void {
  if (grade === 'C' || grade === 'S') {
    throw new Error(`N2SF_BLOCKED: ${grade}등급 외교 데이터 차단 (N2SF N-05)`);
  }
}

export class InternationalCooperationAi {
  private readonly auditLog: AuditEntry[] = [];

  evaluate(project: CooperationProject, grade: DataGrade = 'O'): CooperationScore {
    block(grade);

    const domainWeight: Record<CooperationProject['domain'], number> = {
      ICT: 90,
      HEALTH: 85,
      EDUCATION: 80,
      ENVIRONMENT: 75,
      INFRASTRUCTURE: 70,
    };
    const strategicFit = domainWeight[project.domain];

    const perBeneficiary =
      project.expectedBeneficiaries > 0
        ? project.budgetUsd / project.expectedBeneficiaries
        : Number.POSITIVE_INFINITY;
    const costEffectiveness =
      perBeneficiary < 50 ? 95 : perBeneficiary < 200 ? 75 : perBeneficiary < 1000 ? 50 : 20;

    const riskLevel: CooperationScore['riskLevel'] = HIGH_RISK_COUNTRIES.has(project.partnerCountry)
      ? 'HIGH'
      : project.budgetUsd > 10_000_000
        ? 'MEDIUM'
        : 'LOW';

    const combined = (strategicFit + costEffectiveness) / 2;
    const recommendation: CooperationScore['recommendation'] =
      riskLevel === 'HIGH' ? 'REJECT' : combined >= 70 ? 'APPROVE' : combined >= 50 ? 'REVIEW' : 'REJECT';

    this.appendAudit('COOP_EVAL', {
      projectId: project.projectId,
      partner: project.partnerCountry,
      recommendation,
    });

    return {
      projectId: project.projectId,
      strategicFit,
      costEffectiveness,
      riskLevel,
      recommendation,
    };
  }

  rankPortfolio(projects: readonly CooperationProject[]): readonly CooperationScore[] {
    const scores = projects.map((p) => this.evaluate(p));
    const ranked = [...scores].sort(
      (a, b) => b.strategicFit + b.costEffectiveness - (a.strategicFit + a.costEffectiveness),
    );
    this.appendAudit('COOP_RANK', { total: projects.length });
    return ranked;
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
