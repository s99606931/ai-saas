// SVC-AI-ADV-R356 Citizen Portal Personalizer
// Design Ref: SVC-AI-ADV-R356.design.md
// Plan SC: SC-R356-1~4
// CSAP: D-06 감사, N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

export interface UsageRecord {
  readonly userId: string;
  readonly serviceId: string;
  readonly timestamp: number;
}

export interface Recommendation {
  readonly serviceId: string;
  readonly score: number;
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

export class CitizenPortalPersonalizer {
  private readonly records: UsageRecord[] = [];
  private readonly auditLog: AuditEntry[] = [];
  private readonly decay: number;

  constructor(decayLambda = 0.1) {
    this.decay = decayLambda;
  }

  recordUsage(record: UsageRecord, grade: DataGrade = 'O'): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 사용자 정보 수집 금지 (N2SF N-05)`);
    }
    this.records.push(record);
    this.record('USAGE_RECORD', record.userId, { serviceId: record.serviceId });
  }

  recommend(userId: string, topN: number, nowMs: number): readonly Recommendation[] {
    const userRecords = this.records.filter((r) => r.userId === userId);
    const scoreMap = new Map<string, number>();
    const dayMs = 24 * 60 * 60 * 1000;
    for (const record of userRecords) {
      const daysAgo = Math.max(0, (nowMs - record.timestamp) / dayMs);
      const score = Math.exp(-this.decay * daysAgo);
      scoreMap.set(record.serviceId, (scoreMap.get(record.serviceId) ?? 0) + score);
    }
    const sorted = Array.from(scoreMap.entries())
      .map<Recommendation>(([serviceId, score]) => ({ serviceId, score: Number(score.toFixed(6)) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topN);
    this.record('RECOMMEND', userId, { topN, resultCount: sorted.length });
    return sorted;
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
