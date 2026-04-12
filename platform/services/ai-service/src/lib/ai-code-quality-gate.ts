// SVC-AI-ADV-R361 AI Code Quality Gate
// Design Ref: SVC-AI-ADV-R361.design.md
// Plan SC: SC-R361-1~4
// CSAP D-12 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

export interface CodeMetrics {
  readonly complexity: number; // 0~10
  readonly coverage: number; // 0~1
  readonly duplication: number; // 0~1
  readonly securityIssues: number; // 0~10
}

export interface QualityGateResult {
  readonly score: number;
  readonly block: boolean;
  readonly reasons: readonly string[];
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

export class AiCodeQualityGate {
  private readonly auditLog: AuditEntry[] = [];

  evaluate(
    prId: string,
    metrics: CodeMetrics,
    threshold = 0.7,
    grade: DataGrade = 'O',
  ): QualityGateResult {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 코드 메트릭 차단 (N2SF N-05)`);
    }
    if (threshold < 0 || threshold > 1) {
      throw new Error('INVALID_PARAMS: threshold out of range');
    }

    const reasons: string[] = [];
    const complexityScore = 1 - Math.min(1, metrics.complexity / 10);
    const dupScore = 1 - Math.min(1, metrics.duplication);
    const secScore = 1 - Math.min(1, metrics.securityIssues / 10);
    const covScore = Math.max(0, Math.min(1, metrics.coverage));

    if (covScore < 0.6) reasons.push('LOW_COVERAGE');
    if (metrics.complexity > 7) reasons.push('HIGH_COMPLEXITY');
    if (metrics.duplication > 0.3) reasons.push('DUPLICATION');
    if (metrics.securityIssues > 0) reasons.push('SECURITY_ISSUES');

    const score = Number(
      (covScore * 0.3 + complexityScore * 0.2 + dupScore * 0.2 + secScore * 0.3).toFixed(4),
    );
    const block = score < threshold;

    this.record('GATE', prId, { score, block, reasons });

    return { score, block, reasons };
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
