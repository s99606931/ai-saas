// SVC-AI-ADV-R459 스마트 폐기물 관리 AI
// Design Ref: SVC-AI-ADV-R459.design.md
// Plan SC: FR-459.1~6
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

export interface Bin {
  readonly id: string;
  readonly fillLevel: number;
  readonly x: number;
  readonly y: number;
}

export interface Route {
  readonly path: readonly string[];
  readonly totalDistance: number;
  readonly overflow: boolean;
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

export class SmartWasteManagementAI {
  private readonly auditLog: AuditEntry[] = [];

  plan(bins: readonly Bin[], grade: DataGrade = 'O'): Route {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 IoT 데이터 차단 (N2SF N-05)`);
    }

    for (const b of bins) {
      if (!b.id) throw new Error('INVALID_BIN_ID');
      if (b.fillLevel < 0) throw new Error(`INVALID_FILL: ${b.id}`);
    }

    const overflow = bins.some((b) => b.fillLevel >= 1.0);
    const targets = bins.filter((b) => b.fillLevel >= 0.8);
    if (targets.length === 0) {
      this.record('PLAN', 'route', { count: 0, overflow });
      return { path: [], totalDistance: 0, overflow };
    }

    const remaining = [...targets];
    let curX = 0;
    let curY = 0;
    let totalDistance = 0;
    const path: string[] = [];

    while (remaining.length > 0) {
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const b = remaining[i]!;
        const d = Math.hypot(b.x - curX, b.y - curY);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      const chosen = remaining.splice(bestIdx, 1)[0]!;
      totalDistance += bestDist;
      curX = chosen.x;
      curY = chosen.y;
      path.push(chosen.id);
    }

    const roundedTotal = Math.round(totalDistance * 1000) / 1000;
    this.record('PLAN', 'route', { count: path.length, overflow });
    return { path, totalDistance: roundedTotal, overflow };
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
