// Design Ref: §SVC-AI-ADV-R454 — 재난 복구 우선순위 결정기
// Plan SC: FR-R454.1~5

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

interface AuditEvent {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

const CRITICALITY_WEIGHT: Record<Criticality, number> = {
  low: 1,
  med: 2,
  high: 3,
};

export class DisasterRecoveryPrioritizer {
  private readonly auditLog: AuditEvent[] = [];

  prioritize(facilities: readonly Facility[]): readonly Priority[] {
    if (facilities.length === 0) {
      this.auditLog.push({
        timestamp: new Date().toISOString(),
        action: 'disaster.prioritize',
        details: { facilityCount: 0 },
      });
      return [];
    }

    const scored = facilities.map(f => {
      const critW = CRITICALITY_WEIGHT[f.criticality];
      // score = damage*0.4 + min(residents/10000,1)*0.3 + critW/3*0.3
      const score =
        f.damage * 0.4 +
        Math.min(f.residents / 10000, 1) * 0.3 +
        (critW / 3) * 0.3;
      return { id: f.id, score: Math.round(score * 1000) / 1000 };
    }).sort((a, b) => b.score - a.score);

    const priorities: Priority[] = scored.map((s, i) => ({
      id: s.id,
      score: s.score,
      rank: i + 1,
      urgent: i === 0 || s.score >= 0.7,
    }));

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'disaster.prioritize',
      details: {
        facilityCount: facilities.length,
        urgentCount: priorities.filter(p => p.urgent).length,
        topFacility: priorities[0]!.id,
      },
    });

    return priorities;
  }

  getAuditLog(): readonly AuditEvent[] {
    return [...this.auditLog];
  }
}
