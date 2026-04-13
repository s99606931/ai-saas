// SVC-AI-ADV-R423 Public Transport Optimizer
// Design Ref: SVC-AI-ADV-R423.design.md
// Plan SC: FR-423.1~5
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';
export type Action = 'INCREASE' | 'DECREASE' | 'MAINTAIN';

export interface RouteInput {
  readonly routeId: string;
  readonly passengers: number;
  readonly capacity: number;
  readonly headwayPerHour: number;
}

export interface RouteAdvice {
  readonly routeId: string;
  readonly loadRatio: number;
  readonly action: Action;
  readonly estimatedWaitMin: number;
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

export class PublicTransportOptimizer {
  private readonly auditLog: AuditEntry[] = [];

  optimize(routes: readonly RouteInput[], grade: DataGrade = 'O'): readonly RouteAdvice[] {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 교통 데이터 차단 (N2SF N-05)`);
    }

    return routes.map((r) => {
      if (r.capacity <= 0) {
        throw new Error(`INVALID_CAPACITY: ${r.routeId}`);
      }
      const loadRatio = Number((r.passengers / r.capacity).toFixed(4));
      let action: Action;
      if (loadRatio > 0.85) action = 'INCREASE';
      else if (loadRatio < 0.3) action = 'DECREASE';
      else action = 'MAINTAIN';

      const hz = Math.max(r.headwayPerHour, 1);
      const estimatedWaitMin = Number((60 / hz).toFixed(2));

      this.record('OPTIMIZE', r.routeId, { loadRatio, action, estimatedWaitMin });
      return { routeId: r.routeId, loadRatio, action, estimatedWaitMin };
    });
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
