// Design Ref: §R422 — Smart Parking Allocator AI
// Plan SC: SC-R422

export type PriorityClass = 'EMERGENCY' | 'DISABLED' | 'STAFF' | 'VISITOR'

export interface ParkingRequest {
  readonly requestId: string
  readonly priority: PriorityClass
}

export interface Slot {
  readonly slotId: string
  readonly distanceFromEntrance: number
  readonly occupied: boolean
}

export interface Allocation {
  readonly requestId: string
  readonly assigned: string | null
  readonly reason: string
  readonly alert?: 'SATURATED'
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

const PRIORITY_SCORE: Record<PriorityClass, number> = {
  EMERGENCY: 100,
  DISABLED: 90,
  STAFF: 60,
  VISITOR: 30,
}

export class PublicServiceDemandPredictorV2 {
  private slots = new Map<string, Slot & { occupied: boolean }>()
  private auditLog: AuditEntry[] = []

  registerSlot(slot: Slot): void {
    this.slots.set(slot.slotId, { ...slot })
    this.auditLog.push({ action: 'slot.register', timestamp: new Date().toISOString(), detail: slot.slotId })
  }

  allocate(request: ParkingRequest): Allocation {
    const freeSlots = Array.from(this.slots.values())
      .filter((s) => !s.occupied)
      .sort((a, b) => a.distanceFromEntrance - b.distanceFromEntrance)

    const totalSlots = this.slots.size
    const occupiedCount = Array.from(this.slots.values()).filter((s) => s.occupied).length

    if (freeSlots.length === 0) {
      this.auditLog.push({ action: 'parking.allocate', timestamp: new Date().toISOString(), detail: `${request.requestId}:NO_SLOT` })
      return { requestId: request.requestId, assigned: null, reason: 'NO_SLOT' }
    }

    const nearest = freeSlots[0]!
    this.slots.get(nearest.slotId)!.occupied = true

    const utilizationRate = totalSlots > 0 ? (occupiedCount + 1) / totalSlots : 0
    const alert: 'SATURATED' | undefined = utilizationRate > 0.9 ? 'SATURATED' : undefined

    const score = PRIORITY_SCORE[request.priority]
    this.auditLog.push({ action: 'parking.allocate', timestamp: new Date().toISOString(), detail: `${request.requestId}:${nearest.slotId}(priority=${score})` })
    return { requestId: request.requestId, assigned: nearest.slotId, reason: 'ALLOCATED', ...(alert ? { alert } : {}) }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
