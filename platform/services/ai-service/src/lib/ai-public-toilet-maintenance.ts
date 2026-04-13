// Design Ref: §AI 공중화장실 유지관리 — 이용량·민원·청결도 기반 청소 스케줄링
// Plan SC: FR-R590.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export interface ToiletFacility {
  facilityId: string;
  name: string;
  stallCount: number;
  avgDailyUsers: number;
  lastCleanedAt: string; // ISO
  openHours: number;
}

export interface MaintenanceSignal {
  facilityId: string;
  timestamp: string;
  usersSinceClean: number;
  complaintCount: number;
  sensorCleanlinessScore: number; // 0~100
}

export interface CleaningTask {
  facilityId: string;
  urgency: 'routine' | 'soon' | 'urgent' | 'immediate';
  reason: string;
  estimatedMinutes: number;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class AIPublicToiletMaintenance {
  private readonly audit: AuditEntry[] = [];
  private readonly facilities = new Map<string, ToiletFacility>();
  private readonly signals = new Map<string, MaintenanceSignal[]>();

  private log(action: string, detail: Record<string, unknown>): void {
    this.audit.push({ timestamp: new Date().toISOString(), action, detail });
  }

  register(facility: ToiletFacility, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (facility.stallCount <= 0) throw new Error('stallCount는 양수여야 함');
    this.facilities.set(facility.facilityId, facility);
    this.log('REGISTER', { facilityId: facility.facilityId });
  }

  recordSignal(signal: MaintenanceSignal, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (signal.sensorCleanlinessScore < 0 || signal.sensorCleanlinessScore > 100) {
      throw new Error('sensorCleanlinessScore는 0~100 범위');
    }
    const arr = this.signals.get(signal.facilityId) ?? [];
    arr.push(signal);
    this.signals.set(signal.facilityId, arr);
    this.log('SIGNAL', { facilityId: signal.facilityId });
  }

  plan(grade: DataGrade = 'O'): CleaningTask[] {
    blockClassifiedData(grade);
    const tasks: CleaningTask[] = [];
    for (const f of this.facilities.values()) {
      const arr = this.signals.get(f.facilityId) ?? [];
      const last = arr.length > 0 ? arr[arr.length - 1]! : null;
      let score = 0; // 높을수록 긴급
      const reasons: string[] = [];

      if (last) {
        if (last.sensorCleanlinessScore < 50) {
          score += 50;
          reasons.push(`청결도 ${last.sensorCleanlinessScore}`);
        } else if (last.sensorCleanlinessScore < 70) {
          score += 25;
          reasons.push(`청결도 ${last.sensorCleanlinessScore}`);
        }
        if (last.complaintCount >= 3) {
          score += 30;
          reasons.push(`민원 ${last.complaintCount}건`);
        } else if (last.complaintCount >= 1) {
          score += 10;
          reasons.push(`민원 ${last.complaintCount}건`);
        }
        const capacity = Math.max(1, f.avgDailyUsers);
        if (last.usersSinceClean > capacity * 0.5) {
          score += 20;
          reasons.push(`이용자 ${last.usersSinceClean}명`);
        }
      } else {
        reasons.push('센서 데이터 없음 — 기본 스케줄');
        score += 10;
      }

      const urgency: CleaningTask['urgency'] =
        score >= 70 ? 'immediate' : score >= 45 ? 'urgent' : score >= 20 ? 'soon' : 'routine';

      const estimatedMinutes = Math.max(10, f.stallCount * 5 + (urgency === 'immediate' ? 15 : 0));
      tasks.push({
        facilityId: f.facilityId,
        urgency,
        reason: reasons.join(', '),
        estimatedMinutes,
      });
    }
    // 우선순위 정렬
    const order: Record<CleaningTask['urgency'], number> = { immediate: 0, urgent: 1, soon: 2, routine: 3 };
    tasks.sort((a, b) => order[a.urgency] - order[b.urgency]);
    this.log('PLAN', { taskCount: tasks.length });
    return tasks;
  }

  listFacilities(): ToiletFacility[] {
    return [...this.facilities.values()];
  }

  getAuditLog(): AuditEntry[] {
    return [...this.audit];
  }
}
