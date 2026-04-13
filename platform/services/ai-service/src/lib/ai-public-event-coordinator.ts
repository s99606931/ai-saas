// Design Ref: §R505 — AI 공공 행사 코디네이터
// Plan SC: SVC-AI-ADV-R505-SC01

export type DataGrade = 'C' | 'S' | 'O'
export type EventStatus = 'PLANNED' | 'READY' | 'ATTENTION' | 'BLOCKED'

const DATA_GRADE_BLOCK = ['C', 'S'] as const

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
  }
}

export interface EventResource {
  resourceId: string
  type: 'VENUE' | 'STAFF' | 'EQUIPMENT' | 'PERMIT'
  required: number
  available: number
}

export interface PublicEvent {
  eventId: string
  name: string
  date: string
  expectedAttendance: number
  resources: EventResource[]
}

export interface CoordinationReport {
  eventId: string
  status: EventStatus
  readinessPct: number
  blockers: string[]
  recommendations: string[]
}

interface AuditEntry {
  timestamp: string
  action: string
  detail: Record<string, unknown>
}

export class AiPublicEventCoordinator {
  private readonly events = new Map<string, PublicEvent>()
  private readonly auditLog: AuditEntry[] = []

  registerEvent(event: PublicEvent, grade: DataGrade): void {
    blockClassifiedData(grade)
    if (!event.eventId) throw new Error('eventId 필수')
    if (event.expectedAttendance < 0) throw new Error('expectedAttendance는 0 이상')
    if (this.events.has(event.eventId)) throw new Error(`중복 eventId: ${event.eventId}`)
    this.events.set(event.eventId, { ...event, resources: [...event.resources] })
    this.appendAudit('event.register', { eventId: event.eventId, attendance: event.expectedAttendance })
  }

  coordinate(eventId: string): CoordinationReport {
    const event = this.events.get(eventId)
    if (!event) throw new Error(`eventId 없음: ${eventId}`)
    const blockers: string[] = []
    const recommendations: string[] = []

    let satisfied = 0
    for (const res of event.resources) {
      if (res.available >= res.required) {
        satisfied += 1
      } else {
        const gap = res.required - res.available
        blockers.push(`${res.type}:${res.resourceId} 부족(${gap})`)
        if (res.type === 'PERMIT') {
          recommendations.push(`${res.resourceId} 허가 즉시 신청`)
        } else {
          recommendations.push(`${res.resourceId} 추가 확보 필요`)
        }
      }
    }

    const readinessPct =
      event.resources.length === 0
        ? 0
        : Math.round((satisfied / event.resources.length) * 100)

    let status: EventStatus
    if (readinessPct === 100) status = 'READY'
    else if (blockers.some((b) => b.startsWith('PERMIT'))) status = 'BLOCKED'
    else if (readinessPct >= 70) status = 'ATTENTION'
    else status = 'PLANNED'

    if (event.expectedAttendance > 1000 && readinessPct < 100) {
      recommendations.push('대규모 행사 — 안전관리계획 보강')
    }

    this.appendAudit('event.coordinate', { eventId, status, readinessPct })

    return { eventId, status, readinessPct, blockers, recommendations }
  }

  listEvents(): string[] {
    return [...this.events.keys()]
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail })
  }
}
