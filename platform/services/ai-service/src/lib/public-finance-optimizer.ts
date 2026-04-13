// SVC-AI-ADV-R403 Public Finance Optimizer
// Design Ref: SVC-AI-ADV-R403.design.md
// Plan SC: SC-R403-1~5
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

export interface ExpenseItem {
  readonly id: string;
  readonly name: string;
  readonly benefit: number;
  readonly cost: number;
}

export interface RoiEntry {
  readonly id: string;
  readonly name: string;
  readonly roi: number;
}

export interface OptimizationReport {
  readonly ranked: readonly RoiEntry[];
  readonly expandList: readonly RoiEntry[];
  readonly reduceList: readonly RoiEntry[];
  readonly reallocAmount: number;
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

export class PublicFinanceOptimizer {
  private readonly auditLog: AuditEntry[] = [];

  optimize(items: readonly ExpenseItem[], grade: DataGrade = 'O'): OptimizationReport {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 재정 데이터 차단 (N2SF N-05)`);
    }
    if (items.length === 0) {
      throw new Error('INVALID_INPUT: 항목 최소 1개 필요');
    }
    for (const item of items) {
      if (item.benefit < 0 || item.cost < 0) {
        throw new Error(`INVALID_ITEM: ${item.id} 음수`);
      }
    }

    const entries: RoiEntry[] = items.map((i) => ({
      id: i.id,
      name: i.name,
      roi: Number((i.benefit / Math.max(i.cost, 1)).toFixed(4)),
    }));

    const ranked = [...entries].sort((a, b) => b.roi - a.roi);
    const expandList = ranked.slice(0, Math.min(3, ranked.length));

    const lowItems = items.filter((i) => i.benefit / Math.max(i.cost, 1) < 1.0);
    const lowRanked = lowItems
      .map((i) => ({
        id: i.id,
        name: i.name,
        roi: Number((i.benefit / Math.max(i.cost, 1)).toFixed(4)),
        cost: i.cost,
      }))
      .sort((a, b) => a.roi - b.roi);
    const reduceList = lowRanked.slice(0, Math.min(3, lowRanked.length));
    const reallocAmount = Number(
      (reduceList.reduce((s, r) => s + r.cost, 0) * 0.2).toFixed(2),
    );

    const report: OptimizationReport = {
      ranked,
      expandList,
      reduceList: reduceList.map((r) => ({ id: r.id, name: r.name, roi: r.roi })),
      reallocAmount,
    };

    this.record('OPTIMIZE', 'finance', { items: items.length, reallocAmount });
    return report;
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
