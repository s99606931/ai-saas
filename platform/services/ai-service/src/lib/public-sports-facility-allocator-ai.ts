// Design Ref: §공공 체육시설 배분 — 다수요·공정성 기반 시간대 배정
// Plan SC: FR-R560.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type FacilityType = 'soccer' | 'basketball' | 'swimming' | 'tennis' | 'gym' | 'track';

export interface Facility {
  facilityId: string;
  type: FacilityType;
  capacity: number;
  operatingHoursStart: number; // 0~23
  operatingHoursEnd: number; // 0~24
}

export interface BookingRequest {
  requestId: string;
  facilityId: string;
  groupSize: number;
  preferredStartHour: number;
  durationHours: number;
  priorityCategory: 'senior' | 'youth' | 'disability' | 'general';
  previousAllocationCount: number;
}

export interface Allocation {
  requestId: string;
  facilityId: string;
  startHour: number;
  endHour: number;
  fairnessScore: number;
  status: 'granted' | 'waitlist' | 'denied';
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

const PRIORITY_WEIGHT: Record<BookingRequest['priorityCategory'], number> = {
  senior: 10,
  disability: 10,
  youth: 8,
  general: 5,
};

export class SportsFacilityAllocator {
  private facilities = new Map<string, Facility>();
  private requests = new Map<string, BookingRequest>();
  private schedule = new Map<string, Set<number>>(); // facilityId -> set of hours booked
  private readonly auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R560.1
  registerFacility(f: Facility, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (f.capacity <= 0) throw new Error('수용 인원은 0보다 커야 합니다');
    if (f.operatingHoursStart < 0 || f.operatingHoursStart > 23) {
      throw new Error('운영 시작 시각은 0~23 범위여야 합니다');
    }
    if (f.operatingHoursEnd <= f.operatingHoursStart || f.operatingHoursEnd > 24) {
      throw new Error('운영 종료 시각이 올바르지 않습니다');
    }
    this.facilities.set(f.facilityId, { ...f });
    this.schedule.set(f.facilityId, new Set());
    this.append('REGISTER_FACILITY', { facilityId: f.facilityId, type: f.type });
  }

  // Plan SC: FR-R560.2
  submitRequest(r: BookingRequest, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (!this.facilities.has(r.facilityId)) throw new Error(`시설 미등록: ${r.facilityId}`);
    if (r.groupSize <= 0) throw new Error('단체 인원은 0보다 커야 합니다');
    if (r.durationHours <= 0 || r.durationHours > 24) {
      throw new Error('이용 시간은 0~24시간 범위여야 합니다');
    }
    if (r.preferredStartHour < 0 || r.preferredStartHour > 23) {
      throw new Error('희망 시작 시각은 0~23 범위여야 합니다');
    }
    if (r.previousAllocationCount < 0) {
      throw new Error('이전 배정 횟수는 0 이상이어야 합니다');
    }
    this.requests.set(r.requestId, { ...r });
    this.append('SUBMIT_REQUEST', { requestId: r.requestId, facilityId: r.facilityId });
  }

  // Plan SC: FR-R560.3
  allocate(grade: DataGrade = 'O'): Allocation[] {
    blockClassifiedData(grade);
    // Score and sort by fairness
    const scored = Array.from(this.requests.values()).map(r => {
      const priority = PRIORITY_WEIGHT[r.priorityCategory];
      const fairness = priority - Math.min(r.previousAllocationCount * 2, 8);
      return { req: r, fairness };
    });
    scored.sort((a, b) => b.fairness - a.fairness);

    const allocations: Allocation[] = [];
    for (const { req, fairness } of scored) {
      const facility = this.facilities.get(req.facilityId);
      if (!facility) continue;
      if (req.groupSize > facility.capacity) {
        allocations.push({
          requestId: req.requestId,
          facilityId: req.facilityId,
          startHour: -1,
          endHour: -1,
          fairnessScore: fairness,
          status: 'denied',
        });
        continue;
      }

      const bookedHours = this.schedule.get(req.facilityId)!;
      const duration = Math.ceil(req.durationHours);

      const tryAllocate = (startHour: number): Allocation | null => {
        if (startHour < facility.operatingHoursStart) return null;
        if (startHour + duration > facility.operatingHoursEnd) return null;
        for (let h = startHour; h < startHour + duration; h++) {
          if (bookedHours.has(h)) return null;
        }
        for (let h = startHour; h < startHour + duration; h++) bookedHours.add(h);
        return {
          requestId: req.requestId,
          facilityId: req.facilityId,
          startHour,
          endHour: startHour + duration,
          fairnessScore: fairness,
          status: 'granted',
        };
      };

      let result = tryAllocate(req.preferredStartHour);
      if (!result) {
        // Search alternate slots
        for (let h = facility.operatingHoursStart; h + duration <= facility.operatingHoursEnd; h++) {
          result = tryAllocate(h);
          if (result) break;
        }
      }
      if (!result) {
        result = {
          requestId: req.requestId,
          facilityId: req.facilityId,
          startHour: -1,
          endHour: -1,
          fairnessScore: fairness,
          status: 'waitlist',
        };
      }
      allocations.push(result);
    }
    this.append('ALLOCATE', { total: allocations.length });
    return allocations;
  }

  // Plan SC: FR-R560.4
  utilizationRate(facilityId: string): number {
    const facility = this.facilities.get(facilityId);
    if (!facility) throw new Error(`시설 미등록: ${facilityId}`);
    const booked = this.schedule.get(facilityId)?.size ?? 0;
    const total = facility.operatingHoursEnd - facility.operatingHoursStart;
    if (total === 0) return 0;
    return Math.round((booked / total) * 10000) / 100;
  }

  // Plan SC: FR-R560.5
  listFacilities(type?: FacilityType): Facility[] {
    const all = Array.from(this.facilities.values());
    return (type ? all.filter(f => f.type === type) : all).map(f => ({ ...f }));
  }

  // Plan SC: FR-R560.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
