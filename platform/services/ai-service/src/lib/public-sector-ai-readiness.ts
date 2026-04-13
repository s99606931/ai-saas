// SVC-AI-ADV-R458 공공기관 AI 준비도 평가
// Design Ref: SVC-AI-ADV-R458.design.md
// Plan SC: FR-458.1~6
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';
export type Level = 'INITIAL' | 'EMERGING' | 'PROGRESSING' | 'ADVANCED';

export interface Assessment {
  readonly data: number;
  readonly infra: number;
  readonly talent: number;
  readonly governance: number;
}

export interface ReadinessResult {
  readonly score: number;
  readonly level: Level;
  readonly weakestArea: string;
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

const WEIGHTS = {
  data: 0.3,
  infra: 0.25,
  talent: 0.25,
  governance: 0.2,
} as const;

export class PublicSectorAIReadiness {
  private readonly auditLog: AuditEntry[] = [];

  evaluate(a: Assessment, grade: DataGrade = 'O'): ReadinessResult {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 진단 데이터 차단 (N2SF N-05)`);
    }

    const fields: Array<keyof Assessment> = ['data', 'infra', 'talent', 'governance'];
    for (const f of fields) {
      const v = a[f];
      if (v < 0 || v > 5) throw new Error(`INVALID_${f.toUpperCase()}`);
    }

    const weighted =
      a.data * WEIGHTS.data +
      a.infra * WEIGHTS.infra +
      a.talent * WEIGHTS.talent +
      a.governance * WEIGHTS.governance;
    const score = Math.round((weighted / 5) * 1000) / 1000;

    const level: Level =
      score >= 0.8
        ? 'ADVANCED'
        : score >= 0.6
          ? 'PROGRESSING'
          : score >= 0.4
            ? 'EMERGING'
            : 'INITIAL';

    let weakestArea: keyof Assessment = 'data';
    let minValue = a.data;
    for (const f of fields) {
      if (a[f] < minValue) {
        minValue = a[f];
        weakestArea = f;
      }
    }

    this.record('EVALUATE', 'ai-readiness', { score, level });
    return { score, level, weakestArea };
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
