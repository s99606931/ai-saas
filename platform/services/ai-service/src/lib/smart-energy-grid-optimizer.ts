// SVC-AI-ADV-R466 Smart Energy Grid Optimizer
// Design Ref: SVC-AI-ADV-R466.design.md
// Plan SC: FR-466.1~5
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

export interface Region {
  readonly id: string;
  readonly demandKw: number;
  readonly supplyKw: number;
}

export interface Transfer {
  readonly from: string;
  readonly to: string;
  readonly amountKw: number;
}

export interface GridPlan {
  readonly transfers: readonly Transfer[];
  readonly shortageRegions: readonly string[];
  readonly surplusRegions: readonly string[];
}

interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly details: Record<string, unknown>;
}

export class SmartEnergyGridOptimizer {
  private readonly auditLog: AuditEntry[] = [];

  optimize(regions: readonly Region[], grade: DataGrade = 'O'): GridPlan {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 전력 데이터 차단 (N2SF N-05)`);
    }
    for (const r of regions) {
      if (r.demandKw < 0 || r.supplyKw < 0) {
        throw new Error(`INVALID_REGION: ${r.id}`);
      }
    }

    const surplus: Array<{ id: string; amt: number }> = [];
    const shortage: Array<{ id: string; amt: number }> = [];
    for (const r of regions) {
      const delta = r.supplyKw - r.demandKw;
      if (delta > 0) surplus.push({ id: r.id, amt: delta });
      else if (delta < 0) shortage.push({ id: r.id, amt: -delta });
    }

    const transfers: Transfer[] = [];
    let si = 0;
    let hi = 0;
    while (si < surplus.length && hi < shortage.length) {
      const s = surplus[si];
      const h = shortage[hi];
      if (!s || !h) break;
      const amt = Math.min(s.amt, h.amt);
      if (amt > 0) {
        transfers.push({ from: s.id, to: h.id, amountKw: Number(amt.toFixed(2)) });
        s.amt -= amt;
        h.amt -= amt;
      }
      if (s.amt <= 0) si += 1;
      if (h.amt <= 0) hi += 1;
    }

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'GRID_OPTIMIZE',
      details: { transfers: transfers.length },
    });

    return {
      transfers,
      shortageRegions: shortage.filter((x) => x.amt > 0).map((x) => x.id),
      surplusRegions: surplus.filter((x) => x.amt > 0).map((x) => x.id),
    };
  }

  getAuditLog(): readonly AuditEntry[] {
    return [...this.auditLog];
  }
}
