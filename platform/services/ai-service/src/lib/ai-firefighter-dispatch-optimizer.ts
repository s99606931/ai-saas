// Design Ref: §소방차 출동 최적화 — 거리·가용·장비 기반 최적 배차
// Plan SC: FR-R563.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type IncidentType = 'fire' | 'rescue' | 'medical' | 'hazmat';

export interface FireStation {
  stationId: string;
  lat: number;
  lng: number;
  availableTrucks: number;
  equipments: IncidentType[];
}

export interface Incident {
  incidentId: string;
  type: IncidentType;
  lat: number;
  lng: number;
  severity: 1 | 2 | 3 | 4 | 5;
}

export interface DispatchPlan {
  incidentId: string;
  stationId: string;
  distanceKm: number;
  etaMinutes: number;
  trucksAssigned: number;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class FirefighterDispatchOptimizer {
  private readonly stations = new Map<string, FireStation>();
  private readonly dispatches: DispatchPlan[] = [];
  private readonly auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R563.1
  registerStation(station: FireStation, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (station.availableTrucks < 0) throw new Error('가용 차량 수는 0 이상이어야 합니다');
    if (station.equipments.length === 0) throw new Error('최소 1개 이상의 장비가 필요합니다');
    this.stations.set(station.stationId, {
      ...station,
      equipments: [...station.equipments],
    });
    this.append('REGISTER_STATION', { stationId: station.stationId });
  }

  // Plan SC: FR-R563.2
  private haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
    const R = 6371;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((a.lat * Math.PI) / 180) *
        Math.cos((b.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.asin(Math.sqrt(h));
  }

  // Plan SC: FR-R563.3
  optimize(incident: Incident, grade: DataGrade = 'O'): DispatchPlan {
    blockClassifiedData(grade);
    if (this.stations.size === 0) throw new Error('등록된 소방서가 없습니다');

    const candidates = Array.from(this.stations.values())
      .filter(s => s.availableTrucks > 0 && s.equipments.includes(incident.type))
      .map(s => ({
        station: s,
        distance: this.haversineKm({ lat: incident.lat, lng: incident.lng }, s),
      }))
      .sort((a, b) => a.distance - b.distance);

    if (candidates.length === 0) {
      throw new Error(`${incident.type} 대응 가능 소방서 없음`);
    }
    const best = candidates[0]!;
    const trucks = Math.min(best.station.availableTrucks, Math.max(1, incident.severity - 1));
    const etaMinutes = Math.round((best.distance / 50) * 60 * 10) / 10; // 평균 50km/h

    const plan: DispatchPlan = {
      incidentId: incident.incidentId,
      stationId: best.station.stationId,
      distanceKm: Math.round(best.distance * 100) / 100,
      etaMinutes,
      trucksAssigned: trucks,
    };
    best.station.availableTrucks -= trucks;
    this.dispatches.push(plan);
    this.append('OPTIMIZE', { incidentId: incident.incidentId, stationId: best.station.stationId });
    return plan;
  }

  // Plan SC: FR-R563.4
  releaseTrucks(stationId: string, count: number): void {
    const s = this.stations.get(stationId);
    if (!s) throw new Error(`소방서 미등록: ${stationId}`);
    if (count < 0) throw new Error('복귀 차량 수는 0 이상이어야 합니다');
    s.availableTrucks += count;
    this.append('RELEASE', { stationId, count });
  }

  // Plan SC: FR-R563.5
  listDispatches(): DispatchPlan[] {
    return [...this.dispatches];
  }

  // Plan SC: FR-R563.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
