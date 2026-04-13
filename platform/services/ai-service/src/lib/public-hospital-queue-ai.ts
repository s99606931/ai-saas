// Design Ref: §공공 병원 대기열 AI — 환자 트리아지·대기시간 예측
// Plan SC: FR-R536.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type TriageLevel = 1 | 2 | 3 | 4 | 5; // KTAS 스타일: 1=resuscitation ~ 5=non-urgent

export interface Patient {
  patientId: string; // 익명화된 ID
  arrivedAt: string;
  chiefComplaint: string;
  age: number;
  initialTriage: TriageLevel;
}

export interface Department {
  departmentId: string;
  name: string;
  averageConsultationMinutes: number;
  parallelRooms: number;
}

export interface QueueEntry {
  patientId: string;
  departmentId: string;
  triage: TriageLevel;
  estimatedWaitMinutes: number;
  position: number;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

function maskPatientComplaint(text: string): string {
  return text
    .replace(/\d{6}[-\s]?\d{7}/g, '[RRN_MASKED]')
    .replace(/01[016789][-\s]?\d{3,4}[-\s]?\d{4}/g, '[PHONE_MASKED]');
}

export class PublicHospitalQueueAI {
  private readonly departments = new Map<string, Department>();
  private readonly queue = new Map<string, Patient[]>(); // departmentId -> patients
  private readonly auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R536.1
  registerDepartment(dept: Department, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (dept.averageConsultationMinutes <= 0) throw new Error('평균 진료시간은 양수여야 합니다');
    if (dept.parallelRooms <= 0) throw new Error('진료실 수는 양수여야 합니다');
    this.departments.set(dept.departmentId, { ...dept });
    if (!this.queue.has(dept.departmentId)) this.queue.set(dept.departmentId, []);
    this.append('REGISTER_DEPARTMENT', { departmentId: dept.departmentId });
  }

  // Plan SC: FR-R536.2
  checkIn(departmentId: string, patient: Patient, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (!this.departments.has(departmentId)) throw new Error(`진료과 미등록: ${departmentId}`);
    if (patient.age < 0) throw new Error('나이는 음수일 수 없습니다');
    const masked: Patient = {
      ...patient,
      chiefComplaint: maskPatientComplaint(patient.chiefComplaint),
    };
    const list = this.queue.get(departmentId)!;
    list.push(masked);
    // 재정렬: triage 오름차순 (1이 최우선)
    list.sort((a, b) => a.initialTriage - b.initialTriage);
    this.append('CHECK_IN', { departmentId, patientId: patient.patientId, triage: patient.initialTriage });
  }

  // Plan SC: FR-R536.3
  estimateWait(departmentId: string): QueueEntry[] {
    const dept = this.departments.get(departmentId);
    if (!dept) throw new Error(`진료과 미등록: ${departmentId}`);
    const list = this.queue.get(departmentId) ?? [];

    const perSlotMinutes = dept.averageConsultationMinutes;
    const rooms = dept.parallelRooms;
    const entries: QueueEntry[] = [];

    for (let i = 0; i < list.length; i++) {
      const patient = list[i]!;
      const slotIndex = Math.floor(i / rooms);
      const estimatedWaitMinutes = slotIndex * perSlotMinutes;
      entries.push({
        patientId: patient.patientId,
        departmentId,
        triage: patient.initialTriage,
        estimatedWaitMinutes,
        position: i + 1,
      });
    }
    this.append('ESTIMATE_WAIT', { departmentId, count: entries.length });
    return entries;
  }

  // Plan SC: FR-R536.4
  completeConsultation(departmentId: string, patientId: string): void {
    const list = this.queue.get(departmentId);
    if (!list) throw new Error(`진료과 미등록: ${departmentId}`);
    const idx = list.findIndex(p => p.patientId === patientId);
    if (idx < 0) throw new Error(`환자 미등록: ${patientId}`);
    list.splice(idx, 1);
    this.append('COMPLETE_CONSULTATION', { departmentId, patientId });
  }

  // Plan SC: FR-R536.5
  getQueueSize(departmentId: string): number {
    return this.queue.get(departmentId)?.length ?? 0;
  }

  // Plan SC: FR-R536.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
