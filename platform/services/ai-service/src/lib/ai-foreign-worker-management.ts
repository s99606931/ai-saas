// Design Ref: §외국인 근로자 관리 — 비자·보험·체류 통합 모니터링
// Plan SC: FR-R555.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type VisaType = 'E7' | 'E9' | 'H2' | 'F4' | 'F5' | 'D2';

export interface WorkerProfile {
  workerId: string; // pseudonymized
  visaType: VisaType;
  visaExpiryDate: string; // ISO date
  insuranceEnrolled: boolean;
  industryCode: string;
  employerRegNo: string; // pseudonymized
}

export interface WorkerAlert {
  workerId: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  daysUntilExpiry: number;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class ForeignWorkerManagementAI {
  private workers = new Map<string, WorkerProfile>();
  private readonly auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R555.1
  registerWorker(w: WorkerProfile, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (!/^\d{4}-\d{2}-\d{2}/.test(w.visaExpiryDate)) {
      throw new Error('비자 만료일 형식이 올바르지 않습니다 (ISO 날짜)');
    }
    if (!w.industryCode || !w.employerRegNo) {
      throw new Error('업종 코드/고용주 등록번호는 필수입니다');
    }
    this.workers.set(w.workerId, { ...w });
    this.append('REGISTER_WORKER', { workerId: w.workerId, visaType: w.visaType });
  }

  // Plan SC: FR-R555.2
  checkAlerts(referenceDate: string, grade: DataGrade = 'O'): WorkerAlert[] {
    blockClassifiedData(grade);
    const refTime = new Date(referenceDate).getTime();
    if (Number.isNaN(refTime)) throw new Error('기준일자가 올바르지 않습니다');

    const alerts: WorkerAlert[] = [];
    for (const w of this.workers.values()) {
      const expiry = new Date(w.visaExpiryDate).getTime();
      const daysUntil = Math.floor((expiry - refTime) / (1000 * 60 * 60 * 24));

      if (daysUntil < 0) {
        alerts.push({
          workerId: w.workerId,
          severity: 'critical',
          message: '비자 만료 — 즉시 조치 필요',
          daysUntilExpiry: daysUntil,
        });
      } else if (daysUntil <= 30) {
        alerts.push({
          workerId: w.workerId,
          severity: 'critical',
          message: '비자 만료 30일 이내',
          daysUntilExpiry: daysUntil,
        });
      } else if (daysUntil <= 90) {
        alerts.push({
          workerId: w.workerId,
          severity: 'warning',
          message: '비자 만료 90일 이내',
          daysUntilExpiry: daysUntil,
        });
      }

      if (!w.insuranceEnrolled) {
        alerts.push({
          workerId: w.workerId,
          severity: 'warning',
          message: '산재·건강보험 미가입',
          daysUntilExpiry: daysUntil,
        });
      }
    }
    this.append('CHECK_ALERTS', { refDate: referenceDate, alertCount: alerts.length });
    return alerts;
  }

  // Plan SC: FR-R555.3
  countByVisa(): Record<VisaType, number> {
    const result: Record<VisaType, number> = { E7: 0, E9: 0, H2: 0, F4: 0, F5: 0, D2: 0 };
    for (const w of this.workers.values()) result[w.visaType] += 1;
    return result;
  }

  // Plan SC: FR-R555.4
  listByEmployer(employerRegNo: string): WorkerProfile[] {
    return Array.from(this.workers.values())
      .filter(w => w.employerRegNo === employerRegNo)
      .map(w => ({ ...w }));
  }

  // Plan SC: FR-R555.5
  insuranceCoverageRate(): number {
    if (this.workers.size === 0) return 0;
    let enrolled = 0;
    for (const w of this.workers.values()) if (w.insuranceEnrolled) enrolled += 1;
    return Math.round((enrolled / this.workers.size) * 10000) / 100;
  }

  // Plan SC: FR-R555.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
