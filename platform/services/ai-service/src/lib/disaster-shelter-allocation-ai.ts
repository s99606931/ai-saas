// Design Ref: §핵심 알고리즘 — 거리·수용량 기반 대피소 배분 최적화
// Plan SC: FR-R514.1~5

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

interface Shelter {
  id: string;
  name: string;
  lat: number;
  lng: number;
  capacity: number;
  occupied: number;
  accessibility: boolean;
}

interface AffectedGroup {
  groupId: string;
  lat: number;
  lng: number;
  size: number;
  needsAccessibility: boolean;
}

interface Allocation {
  groupId: string;
  shelterId: string;
  assignedCount: number;
  distanceKm: number;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class DisasterShelterAllocationAI {
  private shelters = new Map<string, Shelter>();
  private readonly auditLog: AuditEntry[] = [];

  private appendAudit(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R514.1
  registerShelter(shelter: Shelter, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (shelter.capacity < 0) throw new Error('capacity >= 0 필요');
    this.shelters.set(shelter.id, { ...shelter });
    this.appendAudit('REGISTER_SHELTER', { id: shelter.id, capacity: shelter.capacity });
  }

  // Haversine 간단화 — 평면 근사
  private distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const dLat = (lat2 - lat1) * 111;
    const dLng = (lng2 - lng1) * 88;
    return Math.sqrt(dLat * dLat + dLng * dLng);
  }

  // Plan SC: FR-R514.2
  findNearestAvailable(group: AffectedGroup): Shelter | null {
    const candidates = Array.from(this.shelters.values())
      .filter(s => s.capacity - s.occupied > 0)
      .filter(s => !group.needsAccessibility || s.accessibility);
    if (candidates.length === 0) return null;

    let best: Shelter | null = null;
    let bestDist = Infinity;
    for (const s of candidates) {
      const d = this.distanceKm(group.lat, group.lng, s.lat, s.lng);
      if (d < bestDist) {
        bestDist = d;
        best = s;
      }
    }
    return best;
  }

  // Plan SC: FR-R514.3
  allocateGroup(group: AffectedGroup, grade: DataGrade = 'O'): Allocation[] {
    blockClassifiedData(grade);
    const allocations: Allocation[] = [];
    let remaining = group.size;

    while (remaining > 0) {
      const shelter = this.findNearestAvailable(group);
      if (!shelter) break;
      const available = shelter.capacity - shelter.occupied;
      const assign = Math.min(available, remaining);
      shelter.occupied += assign;
      remaining -= assign;
      const dist = this.distanceKm(group.lat, group.lng, shelter.lat, shelter.lng);
      allocations.push({
        groupId: group.groupId,
        shelterId: shelter.id,
        assignedCount: assign,
        distanceKm: Math.round(dist * 100) / 100,
      });
    }

    this.appendAudit('ALLOCATE_GROUP', { groupId: group.groupId, allocations: allocations.length, unallocated: remaining });
    return allocations;
  }

  // Plan SC: FR-R514.4
  computeUtilization(): Array<{ shelterId: string; utilizationPct: number }> {
    const arr: Array<{ shelterId: string; utilizationPct: number }> = [];
    for (const s of this.shelters.values()) {
      const util = s.capacity > 0 ? Math.round((s.occupied / s.capacity) * 100) : 0;
      arr.push({ shelterId: s.id, utilizationPct: util });
    }
    return arr;
  }

  resetOccupancy(shelterId: string): void {
    const s = this.shelters.get(shelterId);
    if (!s) throw new Error(`대피소 미등록: ${shelterId}`);
    s.occupied = 0;
    this.appendAudit('RESET_OCCUPANCY', { shelterId });
  }

  // Plan SC: FR-R514.5
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
