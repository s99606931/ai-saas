// SVC-AI-ADV-R367 Public Infrastructure Health
// Design Ref: SVC-AI-ADV-R367.design.md
// Plan SC: SC-R367-1~4
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';
export type Priority = 'HIGH' | 'MEDIUM' | 'LOW';

export interface InfrastructureAsset {
  readonly id: string;
  readonly type: 'road' | 'bridge' | 'water' | 'sewer';
  readonly age: number;
  readonly maxAge: number;
  readonly usage: number;
  readonly maxUsage: number;
  readonly damage: number; // 0~1
}

export interface HealthReport {
  readonly assetId: string;
  readonly type: string;
  readonly health: number;
  readonly priority: Priority;
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

export class PublicInfrastructureHealth {
  private readonly auditLog: AuditEntry[] = [];

  assess(
    assets: readonly InfrastructureAsset[],
    grade: DataGrade = 'O',
  ): readonly HealthReport[] {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 인프라 데이터 차단 (N2SF N-05)`);
    }
    if (assets.length === 0) {
      throw new Error('INVALID_PARAMS: empty assets');
    }

    const reports: HealthReport[] = assets.map((a) => {
      if (a.maxAge <= 0 || a.maxUsage <= 0) {
        throw new Error(`INVALID_PARAMS: maxAge/maxUsage must be positive for ${a.id}`);
      }
      const ageRatio = Math.min(1, a.age / a.maxAge);
      const useRatio = Math.min(1, a.usage / a.maxUsage);
      const damage = Math.max(0, Math.min(1, a.damage));
      const health = Math.max(0, 1 - ageRatio * 0.3 - useRatio * 0.3 - damage * 0.4);

      let priority: Priority;
      if (health < 0.4) priority = 'HIGH';
      else if (health < 0.7) priority = 'MEDIUM';
      else priority = 'LOW';

      return {
        assetId: a.id,
        type: a.type,
        health: Number(health.toFixed(4)),
        priority,
      };
    });

    reports.sort((a, b) => {
      const rank: Record<Priority, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      const pd = rank[a.priority] - rank[b.priority];
      if (pd !== 0) return pd;
      return a.health - b.health;
    });

    this.record('ASSESS', 'infrastructure', { count: reports.length });

    return reports;
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
