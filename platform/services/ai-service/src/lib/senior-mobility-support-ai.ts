// Design Ref: §노인 이동 지원 AI — 차량 배차 최적화
// Plan SC: FR-R578.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type MobilityLevel = 'independent' | 'cane' | 'walker' | 'wheelchair';
export type TripPurpose = 'medical' | 'welfare_center' | 'shopping' | 'family_visit';

export interface SeniorRequest {
  requestId: string;
  seniorCode: string;
  mobilityLevel: MobilityLevel;
  origin: string;
  destination: string;
  purpose: TripPurpose;
  requestedTime: string; // ISO
  requiresCaregiver: boolean;
}

export interface Vehicle {
  vehicleId: string;
  wheelchairAccessible: boolean;
  caregiverOnboard: boolean;
  currentLocation: string;
  availableFrom: string; // ISO
}

export interface Assignment {
  requestId: string;
  vehicleId: string | null;
  pickupTime: string;
  rationale: string[];
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class SeniorMobilitySupportAI {
  private requests = new Map<string, SeniorRequest>();
  private vehicles = new Map<string, Vehicle>();
  private assignments: Assignment[] = [];
  private auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R578.1
  submitRequest(req: SeniorRequest, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (!req.origin || !req.destination) throw new Error('출발지/목적지는 필수');
    this.requests.set(req.requestId, { ...req });
    this.append('SUBMIT_REQUEST', { requestId: req.requestId });
  }

  // Plan SC: FR-R578.2
  registerVehicle(v: Vehicle, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    this.vehicles.set(v.vehicleId, { ...v });
    this.append('REGISTER_VEHICLE', { vehicleId: v.vehicleId });
  }

  // Plan SC: FR-R578.3
  assignVehicle(requestId: string, grade: DataGrade = 'O'): Assignment {
    blockClassifiedData(grade);
    const req = this.requests.get(requestId);
    if (!req) throw new Error(`요청 미등록: ${requestId}`);

    const rationale: string[] = [];
    const candidates = Array.from(this.vehicles.values()).filter(v => {
      if (req.mobilityLevel === 'wheelchair' && !v.wheelchairAccessible) return false;
      if (req.requiresCaregiver && !v.caregiverOnboard) return false;
      if (new Date(v.availableFrom).getTime() > new Date(req.requestedTime).getTime()) return false;
      return true;
    });

    let vehicleId: string | null = null;
    if (candidates.length === 0) {
      rationale.push('요건 충족 차량 없음');
    } else {
      // 출발지 근접 우선 (같은 위치 문자열이면 우선)
      const nearest = candidates.find(v => v.currentLocation === req.origin) ?? candidates[0]!;
      vehicleId = nearest.vehicleId;
      rationale.push('요건 충족');
      if (nearest.currentLocation === req.origin) rationale.push('출발지 근접');
      if (req.purpose === 'medical') rationale.push('의료 이동 우선순위');
    }

    const assignment: Assignment = {
      requestId,
      vehicleId,
      pickupTime: req.requestedTime,
      rationale,
    };
    this.assignments.push(assignment);
    this.append('ASSIGN_VEHICLE', { requestId, vehicleId });
    return assignment;
  }

  // Plan SC: FR-R578.4
  listPendingRequests(): SeniorRequest[] {
    const assigned = new Set(this.assignments.filter(a => a.vehicleId).map(a => a.requestId));
    return Array.from(this.requests.values())
      .filter(r => !assigned.has(r.requestId))
      .map(r => ({ ...r }));
  }

  // Plan SC: FR-R578.5
  getAssignmentHistory(): Assignment[] {
    return this.assignments.map(a => ({ ...a, rationale: [...a.rationale] }));
  }

  // Plan SC: FR-R578.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
