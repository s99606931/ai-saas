// SVC-AI-ADV-R447 시민 권리 침해 감지 AI
// Design Ref: SVC-AI-ADV-R447.design.md
// Plan SC: FR-447.1~5
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';
export type RightType = 'PRIVACY' | 'DISCRIMINATION' | 'LABOR' | 'FREEDOM' | 'NONE';
export type Severity = 'HIGH' | 'MED' | 'NONE';

export interface ViolationReport {
  readonly primaryType: RightType;
  readonly severity: Severity;
  readonly hits: Record<RightType, number>;
  readonly matched: readonly string[];
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

const DICTIONARY: Record<Exclude<RightType, 'NONE'>, readonly string[]> = {
  PRIVACY: ['개인정보', '유출', '도청'],
  DISCRIMINATION: ['차별', '배제', '혐오'],
  LABOR: ['강요', '해고', '임금'],
  FREEDOM: ['감시', '검열', '통제'],
};

export class CitizenRightsViolationDetectorAI {
  private readonly auditLog: AuditEntry[] = [];

  detect(text: string, grade: DataGrade = 'O'): ViolationReport {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 민원 차단 (N2SF N-05)`);
    }
    if (typeof text !== 'string') throw new Error('INVALID_TEXT');

    const hits: Record<RightType, number> = {
      PRIVACY: 0,
      DISCRIMINATION: 0,
      LABOR: 0,
      FREEDOM: 0,
      NONE: 0,
    };
    const matched: string[] = [];

    for (const [type, keywords] of Object.entries(DICTIONARY) as [
      Exclude<RightType, 'NONE'>,
      readonly string[],
    ][]) {
      for (const kw of keywords) {
        if (text.includes(kw)) {
          hits[type] += 1;
          matched.push(kw);
        }
      }
    }

    let primaryType: RightType = 'NONE';
    let maxHits = 0;
    for (const t of ['PRIVACY', 'DISCRIMINATION', 'LABOR', 'FREEDOM'] as const) {
      if (hits[t] > maxHits) {
        maxHits = hits[t];
        primaryType = t;
      }
    }

    const severity: Severity = maxHits >= 3 ? 'HIGH' : maxHits >= 1 ? 'MED' : 'NONE';

    this.record('DETECT', primaryType, { severity, maxHits });
    return { primaryType, severity, hits, matched };
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
