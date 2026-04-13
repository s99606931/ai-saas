// Design Ref: §긴급 대피소 수용력 AI
// Plan SC: FR-R627.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

type ShelterType = 'school' | 'gym' | 'community_center' | 'underground';
type DisasterType = 'earthquake' | 'flood' | 'typhoon' | 'fire' | 'chemical';

interface Shelter {
  shelterId: string;
  type: ShelterType;
  maxCapacity: number;
  currentOccupants: number;
  lat: number;
  lng: number;
  suitableFor: DisasterType[];
}

interface CapacityForecast {
  region: string;
  disasterType: DisasterType;
  estimatedEvacuees: number;
  totalCapacity: number;
  availableCapacity: number;
  deficitCount: number;
  utilizationRate: number;
  recommendedShelters: Array<{ shelterId: string; assignCount: number }>;
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

export class EmergencyShelterCapacityAI {
  private shelters = new Map<string, Shelter>();
  private forecasts = new Map<string, CapacityForecast>();
  private readonly audit: AuditEntry[] = [];

  private log(action: string, detail: Record<string, unknown>): void {
    this.audit.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R627.1
  registerShelter(s: Shelter, grade: DataGrade = DataGrade.O): void {
    blockClassifiedData(grade);
    if (s.maxCapacity <= 0) throw new Error('capacity > 0 필요');
    if (s.currentOccupants < 0 || s.currentOccupants > s.maxCapacity) {
      throw new Error('currentOccupants 범위 오류');
    }
    this.shelters.set(s.shelterId, s);
    this.log('REGISTER_SHELTER', { shelterId: s.shelterId });
  }

  // Plan SC: FR-R627.2
  private suitableShelters(disaster: DisasterType): Shelter[] {
    return Array.from(this.shelters.values()).filter((s) => s.suitableFor.includes(disaster));
  }

  // Plan SC: FR-R627.3
  private assignEvacuees(shelters: Shelter[], evacuees: number): Array<{ shelterId: string; assignCount: number }> {
    const sorted = [...shelters].sort((a, b) => b.maxCapacity - b.currentOccupants - (a.maxCapacity - a.currentOccupants));
    const assignments: Array<{ shelterId: string; assignCount: number }> = [];
    let remaining = evacuees;
    for (const s of sorted) {
      if (remaining <= 0) break;
      const avail = s.maxCapacity - s.currentOccupants;
      if (avail <= 0) continue;
      const take = Math.min(avail, remaining);
      assignments.push({ shelterId: s.shelterId, assignCount: take });
      remaining -= take;
    }
    return assignments;
  }

  // Plan SC: FR-R627.4
  forecast(params: {
    region: string;
    disasterType: DisasterType;
    estimatedEvacuees: number;
  }, grade: DataGrade = DataGrade.O): CapacityForecast {
    blockClassifiedData(grade);
    if (params.estimatedEvacuees < 0) throw new Error('대피인원 음수 불가');
    const suitable = this.suitableShelters(params.disasterType);
    const totalCapacity = suitable.reduce((s, x) => s + x.maxCapacity, 0);
    const available = suitable.reduce((s, x) => s + (x.maxCapacity - x.currentOccupants), 0);
    const deficit = Math.max(0, params.estimatedEvacuees - available);
    const assignments = this.assignEvacuees(suitable, params.estimatedEvacuees);
    const utilization = totalCapacity > 0
      ? +((suitable.reduce((s, x) => s + x.currentOccupants, 0) + params.estimatedEvacuees - deficit) / totalCapacity).toFixed(3)
      : 0;

    const forecast: CapacityForecast = {
      region: params.region,
      disasterType: params.disasterType,
      estimatedEvacuees: params.estimatedEvacuees,
      totalCapacity,
      availableCapacity: available,
      deficitCount: deficit,
      utilizationRate: Math.min(1, utilization),
      recommendedShelters: assignments,
    };
    this.forecasts.set(params.region, forecast);
    this.log('FORECAST', { region: params.region, deficit });
    return forecast;
  }

  // Plan SC: FR-R627.5
  getForecast(region: string): CapacityForecast | undefined {
    return this.forecasts.get(region);
  }

  getAuditLog(): readonly AuditEntry[] {
    return this.audit;
  }
}
