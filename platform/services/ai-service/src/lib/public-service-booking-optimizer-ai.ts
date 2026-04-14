// Design Ref: §R485 — AI기반 공공 서비스 예약 최적화
// Plan SC: SVC-AI-ADV-R485-SC01

export type BookingStatus = 'CONFIRMED' | 'WAITLISTED' | 'CANCELLED' | 'PENDING'
export type ServiceType = 'CIVIL' | 'MEDICAL' | 'EDUCATION' | 'WELFARE' | 'LEGAL'
export type SlotStatus = 'AVAILABLE' | 'FULL' | 'CLOSED'

export interface ServiceSlot {
  slotId: string
  serviceId: string
  serviceType: ServiceType
  date: string        // YYYY-MM-DD
  timeStart: string   // HH:mm
  capacity: number
  currentBookings: number
}

export interface BookingRequest {
  requestId: string
  citizenId: string
  serviceId: string
  preferredDates: string[]   // YYYY-MM-DD 우선순위 순
  priority: 'NORMAL' | 'URGENT' | 'EMERGENCY'
}

export interface BookingResult {
  requestId: string
  citizenId: string
  status: BookingStatus
  assignedSlotId?: string
  assignedDate?: string
  waitlistPosition?: number
  reason: string
}

export interface OptimizationReport {
  totalSlots: number
  totalRequests: number
  confirmedCount: number
  waitlistedCount: number
  utilizationRate: number   // 0..1
  recommendations: string[]
}

interface AuditEntry {
  timestamp: string
  action: string
  requestId: string
  detail: Record<string, unknown>
}

export class PublicServiceBookingOptimizerAI {
  private slots = new Map<string, ServiceSlot>()
  private requests: BookingRequest[] = []
  private results = new Map<string, BookingResult>()
  private auditLog: AuditEntry[] = []

  registerSlot(slot: ServiceSlot): void {
    this.slots.set(slot.slotId, slot)
    this.appendAudit('slot.register', 'system', { slotId: slot.slotId, serviceId: slot.serviceId, capacity: slot.capacity })
  }

  submitRequest(request: BookingRequest): BookingResult {
    this.appendAudit('booking.submit', request.requestId, { citizenId: request.citizenId, priority: request.priority })

    // 우선 날짜 순으로 가용 슬롯 탐색
    for (const preferredDate of request.preferredDates) {
      const availableSlots = Array.from(this.slots.values()).filter(
        (s) => s.serviceId === request.serviceId && s.date === preferredDate && s.currentBookings < s.capacity,
      )

      if (availableSlots.length > 0) {
        // 잔여 좌석이 가장 많은 슬롯 선택 (균등 배분)
        const slot = availableSlots.reduce((best, s) =>
          (s.capacity - s.currentBookings) > (best.capacity - best.currentBookings) ? s : best,
        )
        slot.currentBookings++

        const result: BookingResult = {
          requestId: request.requestId,
          citizenId: request.citizenId,
          status: 'CONFIRMED',
          assignedSlotId: slot.slotId,
          assignedDate: preferredDate,
          reason: `${preferredDate} 슬롯 배정 완료`,
        }
        this.results.set(request.requestId, result)
        this.requests.push(request)
        this.appendAudit('booking.confirmed', request.requestId, { slotId: slot.slotId, date: preferredDate })
        return result
      }
    }

    // 가용 슬롯 없음 → 대기열 등록
    const waitlistCount = Array.from(this.results.values()).filter(
      (r) => r.status === 'WAITLISTED' && this.requests.find((req) => req.requestId === r.requestId)?.serviceId === request.serviceId,
    ).length

    // EMERGENCY/URGENT 우선 순위 적용
    const priorityBoost = request.priority === 'EMERGENCY' ? -1000 : request.priority === 'URGENT' ? -500 : 0
    const position = Math.max(1, waitlistCount + 1 + priorityBoost)
    const waitlistPosition = Math.max(1, position)

    const result: BookingResult = {
      requestId: request.requestId,
      citizenId: request.citizenId,
      status: 'WAITLISTED',
      waitlistPosition,
      reason: `가용 슬롯 없음 — 대기 순번 ${waitlistPosition}`,
    }
    this.results.set(request.requestId, result)
    this.requests.push(request)
    this.appendAudit('booking.waitlisted', request.requestId, { position: waitlistPosition })
    return result
  }

  generateReport(): OptimizationReport {
    const allSlots = Array.from(this.slots.values())
    const totalCapacity = allSlots.reduce((s, sl) => s + sl.capacity, 0)
    const totalBookings = allSlots.reduce((s, sl) => s + sl.currentBookings, 0)
    const confirmedCount = Array.from(this.results.values()).filter((r) => r.status === 'CONFIRMED').length
    const waitlistedCount = Array.from(this.results.values()).filter((r) => r.status === 'WAITLISTED').length

    const recommendations: string[] = []
    if (totalCapacity > 0 && totalBookings / totalCapacity > 0.9) {
      recommendations.push('예약률 90% 초과 — 추가 슬롯 개설 검토')
    }
    if (waitlistedCount > confirmedCount * 0.3) {
      recommendations.push('대기자 비율 높음 — 서비스 창구 확대 또는 비대면 전환 권고')
    }

    return {
      totalSlots: allSlots.length,
      totalRequests: this.requests.length,
      confirmedCount,
      waitlistedCount,
      utilizationRate: totalCapacity > 0 ? totalBookings / totalCapacity : 0,
      recommendations,
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, requestId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, requestId, detail })
  }
}
