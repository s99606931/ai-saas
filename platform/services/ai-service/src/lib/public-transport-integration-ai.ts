// SVC-AI-ADV-R488 Public Transport Integration AI
// Design Ref: SVC-AI-ADV-R488.design.md §공공교통통합
// Plan SC: FR-488.1~6
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

export type TransportMode = 'BUS' | 'SUBWAY' | 'TRAIN' | 'FERRY' | 'BIKE';

export interface Route {
  readonly routeId: string;
  readonly mode: TransportMode;
  readonly origin: string;
  readonly destination: string;
  readonly timetableMinutes: readonly number[];
  readonly dailyRidership: number;
  readonly capacityPerTrip: number;
}

export interface IntegrationPlan {
  readonly planId: string;
  readonly connectedRoutes: readonly string[];
  readonly transferWaitMinutes: number;
  readonly coverageScore: number;
  readonly suggestedAdjustments: readonly string[];
}

interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly details: Record<string, unknown>;
}

function block(grade: DataGrade): void {
  if (grade === 'C' || grade === 'S') {
    throw new Error(`N2SF_BLOCKED: ${grade}등급 교통 데이터 차단 (N2SF N-05)`);
  }
}

export class PublicTransportIntegrationAi {
  private readonly auditLog: AuditEntry[] = [];

  integrate(routes: readonly Route[], grade: DataGrade = 'O'): IntegrationPlan {
    block(grade);

    const connected = routes.map((r) => r.routeId);
    const allTimes = routes.flatMap((r) => r.timetableMinutes);
    const sorted = [...allTimes].sort((a, b) => a - b);
    let maxGap = 0;
    for (let i = 1; i < sorted.length; i += 1) {
      const gap = (sorted[i] ?? 0) - (sorted[i - 1] ?? 0);
      if (gap > maxGap) maxGap = gap;
    }
    const transferWaitMinutes = Math.min(60, Math.round(maxGap / 2));

    const modes = new Set(routes.map((r) => r.mode));
    const coverageScore = Math.min(100, modes.size * 20 + Math.min(40, routes.length * 5));

    const suggestions: string[] = [];
    for (const route of routes) {
      const occupancy =
        route.capacityPerTrip > 0 && route.timetableMinutes.length > 0
          ? route.dailyRidership / (route.capacityPerTrip * route.timetableMinutes.length)
          : 0;
      if (occupancy > 1.2) {
        suggestions.push(`${route.routeId}: 증편 필요 (점유율 ${Math.round(occupancy * 100)}%)`);
      } else if (occupancy < 0.3) {
        suggestions.push(`${route.routeId}: 감편 검토 (점유율 ${Math.round(occupancy * 100)}%)`);
      }
    }

    this.appendAudit('TRANSIT_INTEGRATE', {
      routes: routes.length,
      coverageScore,
      suggestions: suggestions.length,
    });

    return {
      planId: `PLAN-${Date.now()}`,
      connectedRoutes: connected,
      transferWaitMinutes,
      coverageScore,
      suggestedAdjustments: suggestions,
    };
  }

  simulateFareRevenue(routes: readonly Route[], farePerTripKrw: number): number {
    const total = routes.reduce((acc, r) => acc + r.dailyRidership, 0) * farePerTripKrw;
    this.appendAudit('FARE', { routes: routes.length, fare: farePerTripKrw, total });
    return total;
  }

  getAuditLog(): readonly AuditEntry[] {
    return [...this.auditLog];
  }

  private appendAudit(action: string, details: Record<string, unknown>): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      details,
    });
  }
}
