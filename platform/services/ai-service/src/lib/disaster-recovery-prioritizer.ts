// SVC-AI-ADV-R454 재난 복구 우선순위 결정기
// Design Ref: SVC-AI-ADV-R454.design.md
// Plan SC: FR-454.1~6
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';
export type Criticality = 'low' | 'med' | 'high';

export interface Facility {
  readonly id: string;
  readonly type: string;
  readonly damage: number;
  readonly residents: number;
  readonly criticality: Criticality;
}

export interface Priority {
  readonly id: string;
  readonly score: number;
  readonly rank: number;
  readonly urgent: boolean;
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

const CRIT_WEIGHT: Record<Criticality, number> = { low: 1, med: 2, high: 3 };

export class DisasterRecoveryPrioritizer {
  private readonly auditLog: AuditEntry[] = [];

  prioritize(facilities: readonly Facility[], grade: DataGrade = 'O'): readonly Priority[] {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 시설 데이터 차단 (N2SF N-05)`);
    }

    const scored: { id: string; score: number; urgent: boolean }[] = [];
    for (const f of facilities) {
      if (!f.id) throw new Error('INVALID_FACILITY_ID');
      if (f.damage < 0 || f.damage > 1) throw new Error(`INVALID_DAMAGE: ${f.id}`);
      if (f.residents < 0) throw new Error(`INVALID_RESIDENTS: ${f.id}`);

      const residentPart = Math.min(f.residents / 10000, 1);
      const critPart = CRIT_WEIGHT[f.criticality] / 3;
      const score = f.damage * 0.4 + residentPart * 0.3 + critPart * 0.3;
      const urgent = f.damage >= 0.8 && f.criticality === 'high';
      scored.push({ id: f.id, score: Math.round(score * 1000) / 1000, urgent });
    }

    scored.sort((a, b) => b.score - a.score);
    const result: Priority[] = scored.map((s, i) => ({
      id: s.id,
      score: s.score,
      rank: i + 1,
      urgent: s.urgent,
    }));

    this.record('PRIORITIZE', 'disaster', { count: result.length });
    return result;
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
