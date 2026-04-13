// Design Ref: §R506 — 의료 자원 배분 AI
// Plan SC: SVC-AI-ADV-R506-SC01

export type DataGrade = 'C' | 'S' | 'O'
export type AllocationStatus = 'OK' | 'PARTIAL' | 'UNMET'

const DATA_GRADE_BLOCK = ['C', 'S'] as const

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
  }
}

export interface Hospital {
  hospitalId: string
  region: string
  beds: number
  ventilators: number
  staff: number
}

export interface DemandRequest {
  requestId: string
  region: string
  beds: number
  ventilators: number
  staff: number
  priority: number // 1(최고) ~ 5(최저)
}

export interface AllocationPlan {
  requestId: string
  hospitalId: string | null
  status: AllocationStatus
  allocatedBeds: number
  allocatedVentilators: number
  allocatedStaff: number
  unmetReason?: string
}

interface AuditEntry {
  timestamp: string
  action: string
  detail: Record<string, unknown>
}

export class HealthcareResourceAllocatorAi {
  private readonly hospitals = new Map<string, Hospital>()
  private readonly auditLog: AuditEntry[] = []

  registerHospital(h: Hospital, grade: DataGrade): void {
    blockClassifiedData(grade)
    if (!h.hospitalId) throw new Error('hospitalId 필수')
    if (h.beds < 0 || h.ventilators < 0 || h.staff < 0) {
      throw new Error('자원 수는 0 이상')
    }
    if (this.hospitals.has(h.hospitalId)) throw new Error(`중복 hospitalId: ${h.hospitalId}`)
    this.hospitals.set(h.hospitalId, { ...h })
    this.appendAudit('hospital.register', { hospitalId: h.hospitalId, region: h.region })
  }

  allocate(request: DemandRequest, grade: DataGrade): AllocationPlan {
    blockClassifiedData(grade)
    if (request.priority < 1 || request.priority > 5) {
      throw new Error('priority는 1~5')
    }
    // 같은 지역 우선 → 다른 지역
    const sameRegion = [...this.hospitals.values()].filter((h) => h.region === request.region)
    const others = [...this.hospitals.values()].filter((h) => h.region !== request.region)
    const candidates = [...sameRegion, ...others]

    for (const h of candidates) {
      if (
        h.beds >= request.beds &&
        h.ventilators >= request.ventilators &&
        h.staff >= request.staff
      ) {
        h.beds -= request.beds
        h.ventilators -= request.ventilators
        h.staff -= request.staff
        this.appendAudit('allocate.full', {
          requestId: request.requestId,
          hospitalId: h.hospitalId,
        })
        return {
          requestId: request.requestId,
          hospitalId: h.hospitalId,
          status: 'OK',
          allocatedBeds: request.beds,
          allocatedVentilators: request.ventilators,
          allocatedStaff: request.staff,
        }
      }
    }

    // 부분 배분 — 가장 많은 자원을 가진 후보
    if (candidates.length === 0) {
      this.appendAudit('allocate.unmet', { requestId: request.requestId, reason: 'NO_HOSPITAL' })
      return {
        requestId: request.requestId,
        hospitalId: null,
        status: 'UNMET',
        allocatedBeds: 0,
        allocatedVentilators: 0,
        allocatedStaff: 0,
        unmetReason: '가용 병원 없음',
      }
    }
    const best = candidates.reduce((a, b) =>
      a.beds + a.ventilators + a.staff >= b.beds + b.ventilators + b.staff ? a : b
    )
    const allocBeds = Math.min(best.beds, request.beds)
    const allocVent = Math.min(best.ventilators, request.ventilators)
    const allocStaff = Math.min(best.staff, request.staff)
    best.beds -= allocBeds
    best.ventilators -= allocVent
    best.staff -= allocStaff
    this.appendAudit('allocate.partial', {
      requestId: request.requestId,
      hospitalId: best.hospitalId,
    })
    return {
      requestId: request.requestId,
      hospitalId: best.hospitalId,
      status: 'PARTIAL',
      allocatedBeds: allocBeds,
      allocatedVentilators: allocVent,
      allocatedStaff: allocStaff,
      unmetReason: '자원 부족',
    }
  }

  getHospital(id: string): Hospital | null {
    const h = this.hospitals.get(id)
    return h ? { ...h } : null
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail })
  }
}
