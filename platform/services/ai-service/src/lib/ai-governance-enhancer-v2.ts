// Design Ref: §거버넌스점수 — 4항목×25점, C/S등급+!explain||!oversight→VIOLATION
// Plan SC: SC-R607-1, SC-R607-2, SC-R607-3

interface GovernanceInput {
  systemId: string;
  hasExplainability: boolean;
  hasBiasCheck: boolean;
  hasAuditLog: boolean;
  hasHumanOversight: boolean;
  dataGrade: 'C' | 'S' | 'O';
}

type GovernanceGrade = 'COMPLIANT' | 'PARTIAL' | 'NON_COMPLIANT';

interface GovernanceResult {
  systemId: string;
  governanceScore: number;
  grade: GovernanceGrade;
  hasViolation: boolean;
  violationReason: string | null;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  systemId: string;
  grade: GovernanceGrade;
  hasViolation: boolean;
}

export class AiGovernanceEnhancerV2 {
  private readonly auditLog: AuditEntry[] = [];

  evaluate(input: GovernanceInput): GovernanceResult {
    const { systemId, hasExplainability, hasBiasCheck, hasAuditLog, hasHumanOversight, dataGrade } = input;

    const governanceScore =
      (hasExplainability ? 25 : 0) +
      (hasBiasCheck ? 25 : 0) +
      (hasAuditLog ? 25 : 0) +
      (hasHumanOversight ? 25 : 0);

    const grade = this.classifyGrade(governanceScore);

    const isSensitiveGrade = dataGrade === 'C' || dataGrade === 'S';
    const hasViolation = isSensitiveGrade && (!hasExplainability || !hasHumanOversight);
    const violationReason = hasViolation
      ? `${dataGrade}등급 AI 사용 시 설명가능성 및 인간 감독 필수`
      : null;

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'GOVERNANCE_EVALUATED',
      systemId,
      grade,
      hasViolation,
    });

    return { systemId, governanceScore, grade, hasViolation, violationReason };
  }

  private classifyGrade(score: number): GovernanceGrade {
    if (score >= 75) return 'COMPLIANT';
    if (score >= 50) return 'PARTIAL';
    return 'NON_COMPLIANT';
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
