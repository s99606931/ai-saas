// Design Ref: §R398 — AI기반 스마트 리소스 예약 관리
// Plan SC: SVC-AI-ADV-R398-SC01

export type ResourceType = 'MEETING_ROOM' | 'SERVER' | 'LICENSE' | 'VEHICLE' | 'EQUIPMENT'
export type ReservationStatus = 'CONFIRMED' | 'WAITLISTED' | 'REJECTED' | 'CANCELLED'

export interface Resource {
  resourceId: string
  name: string
  type: ResourceType
  capacity: number
  available: boolean
  tags: string[]
}

export interface ReservationRequest {
  requestId: string
  userId: string
  resourceType: ResourceType
  requiredCapacity: number
  startTime: number   // epoch ms
  endTime: number     // epoch ms
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
  tags?: string[]
}

export interface ReservationResult {
  requestId: string
  status: ReservationStatus
  assignedResourceId?: string
  waitlistPosition?: number
  reason?: string
}

interface AuditEntry {
  timestamp: string
  action: string
  requestId: string
  detail: Record<string, unknown>
}

export class SmartResourceReservationAI {
  private resources = new Map<string, Resource>()
  private reservations: Array<{ resourceId: string; startTime: number; endTime: number; userId: string; priority: string }> = []
  private waitlist: Array<ReservationRequest & { position: number }> = []
  private auditLog: AuditEntry[] = []

  registerResource(resource: Resource): void {
    this.resources.set(resource.resourceId, resource)
    this.appendAudit('resource.register', resource.resourceId, { type: resource.type, capacity: resource.capacity })
  }

  reserve(request: ReservationRequest): ReservationResult {
    // 유효성 검사
    if (request.endTime <= request.startTime) {
      this.appendAudit('reservation.reject', request.requestId, { reason: '종료 시각이 시작 시각보다 빠름' })
      return { requestId: request.requestId, status: 'REJECTED', reason: '예약 시간 오류: 종료 시각이 시작 시각보다 이전' }
    }

    // 조건에 맞는 리소스 탐색
    const candidates = Array.from(this.resources.values()).filter((r) => {
      if (!r.available) return false
      if (r.type !== request.resourceType) return false
      if (r.capacity < request.requiredCapacity) return false
      if (request.tags && request.tags.length > 0) {
        if (!request.tags.every((t) => r.tags.includes(t))) return false
      }
      return true
    })

    // 시간 충돌 없는 리소스 선택
    const available = candidates.filter((r) => {
      const conflicts = this.reservations.filter(
        (res) => res.resourceId === r.resourceId &&
          !(request.endTime <= res.startTime || request.startTime >= res.endTime),
      )
      return conflicts.length === 0
    })

    if (available.length > 0) {
      // 가장 적합한 리소스 선택 (용량 초과 최소화)
      const best = available.reduce((a, b) => a.capacity < b.capacity ? a : b)
      this.reservations.push({
        resourceId: best.resourceId,
        startTime: request.startTime,
        endTime: request.endTime,
        userId: request.userId,
        priority: request.priority,
      })

      this.appendAudit('reservation.confirm', request.requestId, { resourceId: best.resourceId })
      return { requestId: request.requestId, status: 'CONFIRMED', assignedResourceId: best.resourceId }
    }

    // 대기열 등록 (URGENT는 앞으로)
    const position = request.priority === 'URGENT'
      ? 1
      : this.waitlist.length + 1
    this.waitlist.push({ ...request, position })

    this.appendAudit('reservation.waitlist', request.requestId, { position })
    return { requestId: request.requestId, status: 'WAITLISTED', waitlistPosition: position, reason: '가용 리소스 없음 — 대기열 등록' }
  }

  cancel(requestId: string, userId: string): boolean {
    const idx = this.reservations.findIndex((r) => r.userId === userId)
    if (idx === -1) return false
    this.reservations.splice(idx, 1)
    this.appendAudit('reservation.cancel', requestId, { userId })
    return true
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, requestId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, requestId, detail })
  }
}
