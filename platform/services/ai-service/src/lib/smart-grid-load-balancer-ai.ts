// SVC-AI-ADV-R430 Smart Grid Load Balancer AI
// Design Ref: SVC-AI-ADV-R430.design.md
// Plan SC: FR-430.1~5
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';
export type Status = 'OVERLOAD' | 'NORMAL' | 'SLACK';

export interface Region {
  readonly regionId: string;
  readonly demandMW: number;
  readonly capacityMW: number;
}

export interface RegionStatus {
  readonly regionId: string;
  readonly status: Status;
  readonly loadRatio: number;
}

export interface Transfer {
  readonly from: string;
  readonly to: string;
  readonly mw: number;
}

export interface GridPlan {
  readonly statuses: readonly RegionStatus[];
  readonly transfers: readonly Transfer[];
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

export class SmartGridLoadBalancerAI {
  private readonly auditLog: AuditEntry[] = [];

  balance(regions: readonly Region[], grade: DataGrade = 'O'): GridPlan {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 전력 데이터 차단 (N2SF N-05)`);
    }

    const statuses: RegionStatus[] = regions.map((r) => {
      if (r.capacityMW <= 0) {
        throw new Error(`INVALID_CAPACITY: ${r.regionId}`);
      }
      const loadRatio = Number((r.demandMW / r.capacityMW).toFixed(4));
      let status: Status;
      if (loadRatio > 0.9) status = 'OVERLOAD';
      else if (loadRatio < 0.5) status = 'SLACK';
      else status = 'NORMAL';
      return { regionId: r.regionId, status, loadRatio };
    });

    const transfers: Transfer[] = [];
    const overloads = regions.filter(
      (r) => statuses.find((s) => s.regionId === r.regionId)!.status === 'OVERLOAD',
    );
    const slacks = regions
      .filter((r) => statuses.find((s) => s.regionId === r.regionId)!.status === 'SLACK')
      .map((r) => ({
        regionId: r.regionId,
        slackMw: Math.max(0, r.capacityMW * 0.9 - r.demandMW),
      }))
      .sort((a, b) => b.slackMw - a.slackMw);

    for (const ov of overloads) {
      let overflow = ov.demandMW - ov.capacityMW * 0.9;
      for (const sl of slacks) {
        if (overflow <= 0 || sl.slackMw <= 0) continue;
        const mw = Number(Math.min(overflow, sl.slackMw).toFixed(2));
        transfers.push({ from: sl.regionId, to: ov.regionId, mw });
        sl.slackMw -= mw;
        overflow -= mw;
      }
    }

    this.record('BALANCE', 'grid', { overloads: overloads.length, transfers: transfers.length });
    return { statuses, transfers };
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
