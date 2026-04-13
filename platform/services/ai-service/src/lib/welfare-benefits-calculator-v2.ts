// SVC-AI-ADV-R434 Welfare Benefits Calculator v2
// Design Ref: SVC-AI-ADV-R434.design.md
// Plan SC: FR-434.1~5
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

export interface Benefit {
  readonly id: string;
  readonly amount: number;
  readonly excludes: readonly string[];
}

export interface CalcResult {
  readonly selected: readonly string[];
  readonly totalAmount: number;
  readonly conflicts: readonly [string, string][];
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

export class WelfareBenefitsCalculatorV2 {
  private readonly auditLog: AuditEntry[] = [];

  calculate(benefits: readonly Benefit[], grade: DataGrade = 'O'): CalcResult {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 복지 데이터 차단 (N2SF N-05)`);
    }
    if (benefits.length > 20) {
      throw new Error('TOO_MANY_BENEFITS: max 20');
    }

    // 양방향 exclude 정규화
    const excludeMap = new Map<string, Set<string>>();
    for (const b of benefits) excludeMap.set(b.id, new Set(b.excludes));
    for (const b of benefits) {
      for (const ex of b.excludes) {
        if (!excludeMap.has(ex)) excludeMap.set(ex, new Set());
        excludeMap.get(ex)!.add(b.id);
      }
    }

    // 충돌쌍 (신청 목록 기준)
    const ids = benefits.map((b) => b.id);
    const conflicts: [string, string][] = [];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        if (excludeMap.get(ids[i]!)?.has(ids[j]!)) {
          conflicts.push([ids[i]!, ids[j]!]);
        }
      }
    }

    // 2^N 완전 탐색
    const n = benefits.length;
    let bestTotal = 0;
    let bestMask = 0;
    for (let mask = 0; mask < 1 << n; mask++) {
      const chosen: Benefit[] = [];
      for (let i = 0; i < n; i++) {
        if (mask & (1 << i)) chosen.push(benefits[i]!);
      }
      let valid = true;
      for (let i = 0; i < chosen.length && valid; i++) {
        for (let j = i + 1; j < chosen.length; j++) {
          if (excludeMap.get(chosen[i]!.id)?.has(chosen[j]!.id)) {
            valid = false;
            break;
          }
        }
      }
      if (!valid) continue;
      const total = chosen.reduce((s, b) => s + b.amount, 0);
      if (total > bestTotal) {
        bestTotal = total;
        bestMask = mask;
      }
    }

    const selected: string[] = [];
    for (let i = 0; i < n; i++) {
      if (bestMask & (1 << i)) selected.push(benefits[i]!.id);
    }

    this.record('CALCULATE', 'benefits', { selected, total: bestTotal });
    return { selected, totalAmount: bestTotal, conflicts };
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
