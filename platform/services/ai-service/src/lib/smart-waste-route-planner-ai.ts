// Design Ref: §스마트 폐기물 수거 경로 AI
// Plan SC: FR-R622.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

type BinType = 'general' | 'recycle' | 'food' | 'hazard';

interface WasteBin {
  binId: string;
  lat: number;
  lng: number;
  type: BinType;
  fillLevel: number; // 0~100
  lastCollectedAt: string;
}

interface RouteStop {
  binId: string;
  order: number;
  estimatedMinutes: number;
}

interface CollectionRoute {
  routeId: string;
  vehicleId: string;
  stops: RouteStop[];
  totalDistanceKm: number;
  estimatedDurationMin: number;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

function blockClassifiedData(grade: DataGrade): void {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

const COLLECTION_THRESHOLD = 70;
const AVG_SPEED_KMH = 25;
const STOP_TIME_MIN = 4;

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export class SmartWasteRoutePlannerAI {
  private bins = new Map<string, WasteBin>();
  private routes = new Map<string, CollectionRoute>();
  private readonly audit: AuditEntry[] = [];

  private log(action: string, detail: Record<string, unknown>): void {
    this.audit.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R622.1
  registerBin(bin: WasteBin, grade: DataGrade = DataGrade.O): void {
    blockClassifiedData(grade);
    if (bin.fillLevel < 0 || bin.fillLevel > 100) {
      throw new Error('fillLevel 범위 오류');
    }
    this.bins.set(bin.binId, bin);
    this.log('REGISTER_BIN', { binId: bin.binId, type: bin.type });
  }

  // Plan SC: FR-R622.2
  selectCollectionTargets(type?: BinType): WasteBin[] {
    const all = Array.from(this.bins.values());
    return all.filter((b) => b.fillLevel >= COLLECTION_THRESHOLD && (!type || b.type === type));
  }

  // Plan SC: FR-R622.3
  private nearestNeighborOrder(start: { lat: number; lng: number }, targets: WasteBin[]): WasteBin[] {
    const remaining = [...targets];
    const ordered: WasteBin[] = [];
    let current = start;
    while (remaining.length > 0) {
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const b = remaining[i]!;
        const d = haversineKm(current, b);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      const next = remaining.splice(bestIdx, 1)[0]!;
      ordered.push(next);
      current = { lat: next.lat, lng: next.lng };
    }
    return ordered;
  }

  // Plan SC: FR-R622.4
  planRoute(
    routeId: string,
    vehicleId: string,
    depot: { lat: number; lng: number },
    type?: BinType,
    grade: DataGrade = DataGrade.O,
  ): CollectionRoute {
    blockClassifiedData(grade);
    const targets = this.selectCollectionTargets(type);
    if (targets.length === 0) {
      const empty: CollectionRoute = {
        routeId,
        vehicleId,
        stops: [],
        totalDistanceKm: 0,
        estimatedDurationMin: 0,
      };
      this.routes.set(routeId, empty);
      this.log('PLAN_ROUTE_EMPTY', { routeId });
      return empty;
    }
    const ordered = this.nearestNeighborOrder(depot, targets);
    let totalKm = 0;
    let current = depot;
    const stops: RouteStop[] = ordered.map((b, idx) => {
      const d = haversineKm(current, b);
      totalKm += d;
      current = { lat: b.lat, lng: b.lng };
      const travelMin = (d / AVG_SPEED_KMH) * 60;
      return {
        binId: b.binId,
        order: idx + 1,
        estimatedMinutes: +(travelMin + STOP_TIME_MIN).toFixed(1),
      };
    });
    // 복귀
    totalKm += haversineKm(current, depot);
    const totalMin = stops.reduce((a, s) => a + s.estimatedMinutes, 0) + (haversineKm(current, depot) / AVG_SPEED_KMH) * 60;

    const route: CollectionRoute = {
      routeId,
      vehicleId,
      stops,
      totalDistanceKm: +totalKm.toFixed(2),
      estimatedDurationMin: +totalMin.toFixed(1),
    };
    this.routes.set(routeId, route);
    this.log('PLAN_ROUTE', { routeId, stops: stops.length, km: route.totalDistanceKm });
    return route;
  }

  // Plan SC: FR-R622.5
  getRoute(routeId: string): CollectionRoute | undefined {
    return this.routes.get(routeId);
  }

  getAuditLog(): readonly AuditEntry[] {
    return this.audit;
  }
}
