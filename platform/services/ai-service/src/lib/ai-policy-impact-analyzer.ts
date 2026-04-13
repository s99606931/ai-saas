// SVC-AI-ADV-R471 AI Policy Impact Analyzer
// Design Ref: SVC-AI-ADV-R471.design.md §정책영향도
// Plan SC: FR-471.1~6
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

export interface PolicyProposal {
  readonly id: string;
  readonly title: string;
  readonly budgetKrw: number;
  readonly affectedPopulation: number;
  readonly sectors: readonly string[];
  readonly durationMonths: number;
}

export interface ImpactScore {
  readonly economic: number;
  readonly social: number;
  readonly environmental: number;
  readonly overall: number;
  readonly grade: 'A' | 'B' | 'C' | 'D';
}

interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly details: Record<string, unknown>;
}

function blockClassified(grade: DataGrade): void {
  if (grade === 'C' || grade === 'S') {
    throw new Error(`N2SF_BLOCKED: ${grade}등급 정책 데이터 차단 (N2SF N-05)`);
  }
}

function clampNonNeg(n: number): number {
  return n < 0 ? 0 : n;
}

export class AiPolicyImpactAnalyzer {
  private readonly auditLog: AuditEntry[] = [];

  analyze(proposal: PolicyProposal, grade: DataGrade = 'O'): ImpactScore {
    blockClassified(grade);

    const budget = clampNonNeg(proposal.budgetKrw);
    const pop = clampNonNeg(proposal.affectedPopulation);
    const duration = clampNonNeg(proposal.durationMonths);

    const economic = Math.min(100, Math.log10(budget + 1) * 8 + duration * 0.5);
    const social = Math.min(100, Math.log10(pop + 1) * 12 + proposal.sectors.length * 3);
    const environmental = proposal.sectors.includes('environment')
      ? 80
      : Math.min(60, proposal.sectors.length * 10);

    const overall = Number(
      ((economic * 0.4 + social * 0.4 + environmental * 0.2)).toFixed(2),
    );

    const grade_: 'A' | 'B' | 'C' | 'D' =
      overall >= 80 ? 'A' : overall >= 60 ? 'B' : overall >= 40 ? 'C' : 'D';

    this.appendAudit('POLICY_IMPACT_ANALYZE', {
      policyId: proposal.id,
      overall,
      grade: grade_,
    });

    return {
      economic: Number(economic.toFixed(2)),
      social: Number(social.toFixed(2)),
      environmental: Number(environmental.toFixed(2)),
      overall,
      grade: grade_,
    };
  }

  compareProposals(proposals: readonly PolicyProposal[]): readonly {
    id: string;
    score: ImpactScore;
  }[] {
    const ranked = proposals.map((p) => ({ id: p.id, score: this.analyze(p) }));
    ranked.sort((a, b) => b.score.overall - a.score.overall);
    this.appendAudit('POLICY_COMPARE', { count: proposals.length });
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
