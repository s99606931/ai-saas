// SVC-AI-ADV-R462 AI Urban Traffic Controller
// Design Ref: SVC-AI-ADV-R462.design.md
// Plan SC: FR-462.1~5
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';
export type Direction = 'N' | 'S' | 'E' | 'W';

export interface Intersection {
  readonly id: string;
  readonly directions: Readonly<Record<Direction, number>>;
}

export interface SignalPlan {
  readonly id: string;
  readonly greenTimes: Readonly<Record<Direction, number>>;
  readonly totalCycleSec: number;
  readonly priorityDir: Direction;
}

interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly details: Record<string, unknown>;
}

const MIN_GREEN = 10;
const MAX_GREEN = 60;
const MIN_CYCLE = 60;
const MAX_CYCLE = 120;
const DIRS: readonly Direction[] = ['N', 'S', 'E', 'W'];

export class AiUrbanTrafficController {
  private readonly auditLog: AuditEntry[] = [];

  optimize(intersection: Intersection, grade: DataGrade = 'O'): SignalPlan {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 교통 데이터 차단 (N2SF N-05)`);
    }

    const counts = intersection.directions;
    for (const d of DIRS) {
      if (counts[d] < 0) throw new Error(`INVALID_COUNT: ${d}`);
    }

    const total = DIRS.reduce((s, d) => s + counts[d], 0);
    let priorityDir: Direction = 'N';
    let maxCount = -1;
    for (const d of DIRS) {
      if (counts[d] > maxCount) {
        maxCount = counts[d];
        priorityDir = d;
      }
    }

    const raw: Record<Direction, number> = { N: 0, S: 0, E: 0, W: 0 };
    if (total === 0) {
      for (const d of DIRS) raw[d] = MIN_GREEN;
    } else {
      for (const d of DIRS) {
        const ratio = counts[d] / total;
        const green = Math.round(MIN_CYCLE * ratio);
        raw[d] = Math.max(MIN_GREEN, Math.min(MAX_GREEN, green));
      }
    }

    let cycle = DIRS.reduce((s, d) => s + raw[d], 0);
    if (cycle < MIN_CYCLE) {
      const diff = MIN_CYCLE - cycle;
      raw[priorityDir] = Math.min(MAX_GREEN, raw[priorityDir] + diff);
      cycle = DIRS.reduce((s, d) => s + raw[d], 0);
    }
    if (cycle > MAX_CYCLE) {
      const scale = MAX_CYCLE / cycle;
      for (const d of DIRS) {
        raw[d] = Math.max(MIN_GREEN, Math.round(raw[d] * scale));
      }
      cycle = DIRS.reduce((s, d) => s + raw[d], 0);
    }

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'SIGNAL_OPTIMIZE',
      details: { id: intersection.id, cycle },
    });

    return {
      id: intersection.id,
      greenTimes: raw,
      totalCycleSec: cycle,
      priorityDir,
    };
  }

  getAuditLog(): readonly AuditEntry[] {
    return [...this.auditLog];
  }
}
