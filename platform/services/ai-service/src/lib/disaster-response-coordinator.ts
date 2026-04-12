// Design Ref: §R260 — 재난 대응 코디네이터
// Plan SC: SVC-AI-ADV-R260-SC01

export type DataGrade = 'C' | 'S' | 'O'
export type DisasterType = 'FLOOD' | 'EARTHQUAKE' | 'FIRE' | 'TYPHOON' | 'HEATWAVE' | 'OTHER'
export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type AlertLevel = 'ADVISORY' | 'WATCH' | 'WARNING' | 'EMERGENCY'

export interface DisasterEvent {
  eventId: string
  type: DisasterType
  locationCode: string
  affectedCount: number
  occurredAt: string
}

export interface Shelter {
  shelterId: string
  locationCode: string
  capacity: number
  currentOccupancy: number
}

export interface ShelterAllocation {
  shelterId: string
  assignedCount: number
}

export interface AllocationResult {
  eventId: string
  allocations: ShelterAllocation[]
  shortage: number
}

export interface ResourcePlan {
  eventId: string
  severity: Severity
  medicalKits: number
  foodPacks: number
  waterLiters: number
  reliefKits: number
}

export interface CitizenAlert {
  eventId: string
  alertLevel: AlertLevel
  message: string
  targetLocationCode: string
}

interface AuditEntry {
  timestamp: string
  action: string
  callerMasked: string
  detail: Record<string, unknown>
}

export class DisasterResponseCoordinator {
  private events = new Map<string, DisasterEvent>()
  private shelters = new Map<string, Shelter>()
  private auditLog: AuditEntry[] = []

  registerEvent(event: DisasterEvent, caller: string, grade: DataGrade): void {
    this.assertOpenGrade(grade)
    if (event.affectedCount < 0) {
      throw new Error('affectedCount는 0 이상이어야 합니다')
    }
    if (this.events.has(event.eventId)) {
      throw new Error(`중복 이벤트: ${event.eventId}`)
    }
    this.events.set(event.eventId, { ...event })
    this.appendAudit('event.register', this.mask(caller), {
      eventId: event.eventId,
      type: event.type,
      affectedCount: event.affectedCount,
    })
  }

  classifySeverity(eventId: string): Severity {
    const event = this.events.get(eventId)
    if (!event) throw new Error(`Unknown event: ${eventId}`)
    const n = event.affectedCount
    if (n < 100) return 'LOW'
    if (n < 1000) return 'MEDIUM'
    if (n < 10000) return 'HIGH'
    return 'CRITICAL'
  }

  registerShelter(shelter: Shelter): void {
    if (shelter.capacity <= 0) {
      throw new Error('capacity는 양수여야 합니다')
    }
    if (shelter.currentOccupancy < 0 || shelter.currentOccupancy > shelter.capacity) {
      throw new Error('currentOccupancy 범위 오류')
    }
    this.shelters.set(shelter.shelterId, { ...shelter })
    this.appendAudit('shelter.register', 'SYSTEM', {
      shelterId: shelter.shelterId,
      capacity: shelter.capacity,
    })
  }

  allocateShelter(eventId: string): AllocationResult {
    const event = this.events.get(eventId)
    if (!event) throw new Error(`Unknown event: ${eventId}`)

    // 동일 지역 우선, 없으면 전체
    const localShelters = [...this.shelters.values()].filter(
      (s) => s.locationCode === event.locationCode
    )
    const pool = localShelters.length > 0 ? localShelters : [...this.shelters.values()]
    // 여유 용량 큰 순 정렬
    const sorted = pool
      .map((s) => ({ shelter: s, free: s.capacity - s.currentOccupancy }))
      .filter((x) => x.free > 0)
      .sort((a, b) => b.free - a.free)

    let remaining = event.affectedCount
    const allocations: ShelterAllocation[] = []
    for (const item of sorted) {
      if (remaining <= 0) break
      const assign = Math.min(item.free, remaining)
      allocations.push({ shelterId: item.shelter.shelterId, assignedCount: assign })
      item.shelter.currentOccupancy += assign
      remaining -= assign
    }
    const result: AllocationResult = { eventId, allocations, shortage: remaining }
    this.appendAudit('shelter.allocate', 'SYSTEM', {
      eventId,
      totalAssigned: event.affectedCount - remaining,
      shortage: remaining,
    })
    return result
  }

  planResources(eventId: string): ResourcePlan {
    const severity = this.classifySeverity(eventId)
    const table: Record<Severity, Omit<ResourcePlan, 'eventId' | 'severity'>> = {
      LOW: { medicalKits: 10, foodPacks: 50, waterLiters: 100, reliefKits: 20 },
      MEDIUM: { medicalKits: 50, foodPacks: 500, waterLiters: 1000, reliefKits: 200 },
      HIGH: { medicalKits: 200, foodPacks: 3000, waterLiters: 10000, reliefKits: 1500 },
      CRITICAL: { medicalKits: 1000, foodPacks: 15000, waterLiters: 50000, reliefKits: 8000 },
    }
    const base = table[severity]
    const plan: ResourcePlan = { eventId, severity, ...base }
    this.appendAudit('resource.plan', 'SYSTEM', { eventId, severity })
    return plan
  }

  issueAlert(eventId: string): CitizenAlert {
    const event = this.events.get(eventId)
    if (!event) throw new Error(`Unknown event: ${eventId}`)
    const severity = this.classifySeverity(eventId)
    const levelMap: Record<Severity, AlertLevel> = {
      LOW: 'ADVISORY',
      MEDIUM: 'WATCH',
      HIGH: 'WARNING',
      CRITICAL: 'EMERGENCY',
    }
    const level = levelMap[severity]
    const message = `[${level}] ${event.type} 발생 — ${event.locationCode} 지역 주민은 대피 지침을 확인하십시오.`
    const alert: CitizenAlert = {
      eventId,
      alertLevel: level,
      message,
      targetLocationCode: event.locationCode,
    }
    this.appendAudit('alert.issue', 'SYSTEM', { eventId, level })
    return alert
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private assertOpenGrade(grade: DataGrade): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 데이터는 재난 조정 입력 금지 (N2SF N-05)`)
    }
  }

  private mask(id: string): string {
    if (id.length <= 4) return '***'
    return `${id.slice(0, 2)}***${id.slice(-2)}`
  }

  private appendAudit(action: string, callerMasked: string, detail: Record<string, unknown>): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      callerMasked,
      detail,
    })
  }
}
