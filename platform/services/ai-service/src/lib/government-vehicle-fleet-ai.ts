// Design Ref: §정부 차량 관리 AI — 정비·교체·배차 최적화
// Plan SC: FR-R589.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type VehicleType = 'sedan' | 'van' | 'truck' | 'ev' | 'special';
export type FuelType = 'gasoline' | 'diesel' | 'hybrid' | 'electric';

export interface Vehicle {
  vehicleId: string;
  type: VehicleType;
  fuel: FuelType;
  yearBuilt: number;
  odometerKm: number;
  lastServiceKm: number;
  monthlyMileageKm: number;
  assignedDept: string;
}

export interface ServiceTask {
  vehicleId: string;
  action: 'routine_service' | 'replace_tire' | 'replace_battery' | 'retire' | 'reallocate';
  priority: 'low' | 'medium' | 'high';
  reason: string;
}

export interface DispatchRequest {
  requestId: string;
  dept: string;
  passengerCount: number;
  tripDistanceKm: number;
  requiresCargo: boolean;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

const SERVICE_INTERVAL_KM = 10000;
const RETIREMENT_AGE_YEARS = 10;
const RETIREMENT_KM = 200000;

export class GovernmentVehicleFleetAI {
  private readonly audit: AuditEntry[] = [];
  private readonly fleet = new Map<string, Vehicle>();
  private readonly currentYear: number;

  constructor(currentYear: number = new Date().getFullYear()) {
    this.currentYear = currentYear;
  }

  private log(action: string, detail: Record<string, unknown>): void {
    this.audit.push({ timestamp: new Date().toISOString(), action, detail });
  }

  register(vehicle: Vehicle, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (vehicle.odometerKm < 0) throw new Error('odometerKm 음수 불가');
    this.fleet.set(vehicle.vehicleId, vehicle);
    this.log('REGISTER', { vehicleId: vehicle.vehicleId, type: vehicle.type });
  }

  planMaintenance(grade: DataGrade = 'O'): ServiceTask[] {
    blockClassifiedData(grade);
    const tasks: ServiceTask[] = [];
    for (const v of this.fleet.values()) {
      const age = this.currentYear - v.yearBuilt;
      if (age >= RETIREMENT_AGE_YEARS || v.odometerKm >= RETIREMENT_KM) {
        tasks.push({
          vehicleId: v.vehicleId,
          action: 'retire',
          priority: 'high',
          reason: `차령 ${age}년 / 주행 ${v.odometerKm}km 폐차 기준 도달`,
        });
        continue;
      }
      const sinceService = v.odometerKm - v.lastServiceKm;
      if (sinceService >= SERVICE_INTERVAL_KM) {
        tasks.push({
          vehicleId: v.vehicleId,
          action: 'routine_service',
          priority: sinceService >= SERVICE_INTERVAL_KM * 1.5 ? 'high' : 'medium',
          reason: `정기 정비 주기 경과 ${sinceService}km`,
        });
      }
      if (v.fuel === 'electric' && age >= 7) {
        tasks.push({
          vehicleId: v.vehicleId,
          action: 'replace_battery',
          priority: 'medium',
          reason: 'EV 배터리 권장 교체 주기',
        });
      }
    }
    this.log('PLAN_MAINTENANCE', { taskCount: tasks.length });
    return tasks;
  }

  dispatch(request: DispatchRequest, grade: DataGrade = 'O'): Vehicle | null {
    blockClassifiedData(grade);
    const candidates: Vehicle[] = [];
    for (const v of this.fleet.values()) {
      if (request.requiresCargo && v.type !== 'truck' && v.type !== 'van') continue;
      if (request.passengerCount > 2 && v.type === 'sedan') continue;
      if (request.passengerCount > 7 && v.type !== 'van') continue;
      candidates.push(v);
    }
    if (candidates.length === 0) {
      this.log('DISPATCH', { requestId: request.requestId, assigned: null });
      return null;
    }
    // EV 우선 → 연식 최신 → 주행 적은 것
    candidates.sort((a, b) => {
      if (a.fuel === 'electric' && b.fuel !== 'electric') return -1;
      if (a.fuel !== 'electric' && b.fuel === 'electric') return 1;
      if (b.yearBuilt !== a.yearBuilt) return b.yearBuilt - a.yearBuilt;
      return a.odometerKm - b.odometerKm;
    });
    const chosen = candidates[0]!;
    this.log('DISPATCH', { requestId: request.requestId, assigned: chosen.vehicleId });
    return chosen;
  }

  listFleet(): Vehicle[] {
    return [...this.fleet.values()];
  }

  getAuditLog(): AuditEntry[] {
    return [...this.audit];
  }
}
