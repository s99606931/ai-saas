// Design Ref: §버스 노선 최적화 — 수요 가중 경로 점수
// Plan SC: FR-R525.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export interface BusStop {
  stopId: string;
  name: string;
  demandScore: number; // 0~100 (승하차 수요)
  transferHub: boolean;
}

export interface RouteProposal {
  routeId: string;
  stopIds: string[];
  totalDistanceKm: number;
}

export interface OptimizationResult {
  routeId: string;
  coverageScore: number;
  efficiencyScore: number;
  overallScore: number;
  coveredDemand: number;
  hubCount: number;
  recommendation: 'approve' | 'revise' | 'reject';
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class BusRouteOptimizerAI {
  private stops = new Map<string, BusStop>();
  private routes = new Map<string, RouteProposal>();
  private auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R525.1
  registerStop(stop: BusStop, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (stop.demandScore < 0 || stop.demandScore > 100) {
      throw new Error('수요 점수는 0~100 범위여야 합니다');
    }
    this.stops.set(stop.stopId, { ...stop });
    this.append('REGISTER_STOP', { stopId: stop.stopId });
  }

  // Plan SC: FR-R525.2
  proposeRoute(route: RouteProposal, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (route.stopIds.length < 2) throw new Error('노선은 최소 2개 정류장이 필요합니다');
    if (route.totalDistanceKm <= 0) throw new Error('총 거리는 0보다 커야 합니다');
    for (const sid of route.stopIds) {
      if (!this.stops.has(sid)) throw new Error(`정류장 미등록: ${sid}`);
    }
    this.routes.set(route.routeId, { ...route, stopIds: [...route.stopIds] });
    this.append('PROPOSE_ROUTE', { routeId: route.routeId, stopCount: route.stopIds.length });
  }

  // Plan SC: FR-R525.3
  optimize(routeId: string, grade: DataGrade = 'O'): OptimizationResult {
    blockClassifiedData(grade);
    const route = this.routes.get(routeId);
    if (!route) throw new Error(`노선 미등록: ${routeId}`);

    let coveredDemand = 0;
    let hubCount = 0;
    for (const sid of route.stopIds) {
      const stop = this.stops.get(sid);
      if (!stop) continue;
      coveredDemand += stop.demandScore;
      if (stop.transferHub) hubCount += 1;
    }

    const maxPossibleDemand = route.stopIds.length * 100;
    const coverageScore = maxPossibleDemand === 0 ? 0 : Math.round((coveredDemand / maxPossibleDemand) * 100);

    const demandPerKm = coveredDemand / route.totalDistanceKm;
    const efficiencyScore = Math.min(100, Math.round(demandPerKm * 2));

    const hubBonus = Math.min(20, hubCount * 5);
    const overallScore = Math.min(100, Math.round(coverageScore * 0.5 + efficiencyScore * 0.5 + hubBonus));

    const recommendation: 'approve' | 'revise' | 'reject' =
      overallScore >= 70 ? 'approve' : overallScore >= 40 ? 'revise' : 'reject';

    const result: OptimizationResult = {
      routeId,
      coverageScore,
      efficiencyScore,
      overallScore,
      coveredDemand,
      hubCount,
      recommendation,
    };
    this.append('OPTIMIZE', { routeId, overallScore, recommendation });
    return result;
  }

  // Plan SC: FR-R525.4
  listRoutes(): RouteProposal[] {
    return Array.from(this.routes.values()).map(r => ({ ...r, stopIds: [...r.stopIds] }));
  }

  // Plan SC: FR-R525.5
  listStops(): BusStop[] {
    return Array.from(this.stops.values()).map(s => ({ ...s }));
  }

  // Plan SC: FR-R525.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
