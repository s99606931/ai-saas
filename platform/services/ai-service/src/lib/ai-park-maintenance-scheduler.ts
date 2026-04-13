// Design Ref: §R509 — AI 공원 유지관리 스케줄러
// Plan SC: SVC-AI-ADV-R509-SC01

export type DataGrade = 'C' | 'S' | 'O'
export type MaintenanceTask = 'MOWING' | 'PRUNING' | 'WATERING' | 'CLEANING' | 'INSPECTION'
export type Urgency = 'ROUTINE' | 'SOON' | 'URGENT'

const DATA_GRADE_BLOCK = ['C', 'S'] as const

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
  }
}

export interface ParkAsset {
  parkId: string
  area: number // m^2
  treeCount: number
  lastMowedDays: number
  lastPrunedDays: number
  lastInspectedDays: number
  visitorPerDay: number
}

export interface MaintenanceItem {
  task: MaintenanceTask
  urgency: Urgency
  estimatedHours: number
  scheduledDay: number // 며칠 후
}

export interface MaintenanceSchedule {
  parkId: string
  items: MaintenanceItem[]
  totalHours: number
}

interface AuditEntry {
  timestamp: string
  action: string
  detail: Record<string, unknown>
}

export class AiParkMaintenanceScheduler {
  private readonly parks = new Map<string, ParkAsset>()
  private readonly auditLog: AuditEntry[] = []

  registerPark(park: ParkAsset, grade: DataGrade): void {
    blockClassifiedData(grade)
    if (!park.parkId) throw new Error('parkId 필수')
    if (park.area <= 0) throw new Error('area는 양수')
    if (park.treeCount < 0) throw new Error('treeCount는 0 이상')
    if (this.parks.has(park.parkId)) throw new Error(`중복 parkId: ${park.parkId}`)
    this.parks.set(park.parkId, { ...park })
    this.appendAudit('park.register', { parkId: park.parkId, area: park.area })
  }

  schedule(parkId: string): MaintenanceSchedule {
    const p = this.parks.get(parkId)
    if (!p) throw new Error(`parkId 없음: ${parkId}`)
    const items: MaintenanceItem[] = []

    // 잔디깎기 — 14일 주기
    const mowingUrgency = this.urgency(p.lastMowedDays, 14)
    items.push({
      task: 'MOWING',
      urgency: mowingUrgency,
      estimatedHours: Math.round((p.area / 1000) * 10) / 10,
      scheduledDay: this.scheduleDay(mowingUrgency),
    })

    // 가지치기 — 90일 주기
    if (p.treeCount > 0) {
      const pruneUrgency = this.urgency(p.lastPrunedDays, 90)
      items.push({
        task: 'PRUNING',
        urgency: pruneUrgency,
        estimatedHours: Math.round(p.treeCount * 0.3 * 10) / 10,
        scheduledDay: this.scheduleDay(pruneUrgency),
      })
    }

    // 안전 점검 — 30일 주기
    const inspectUrgency = this.urgency(p.lastInspectedDays, 30)
    items.push({
      task: 'INSPECTION',
      urgency: inspectUrgency,
      estimatedHours: 2,
      scheduledDay: this.scheduleDay(inspectUrgency),
    })

    // 방문자가 많으면 청소 추가
    if (p.visitorPerDay >= 100) {
      items.push({
        task: 'CLEANING',
        urgency: p.visitorPerDay >= 500 ? 'URGENT' : 'SOON',
        estimatedHours: Math.round((p.visitorPerDay / 100) * 10) / 10,
        scheduledDay: 1,
      })
    }

    const totalHours = Math.round(items.reduce((s, i) => s + i.estimatedHours, 0) * 10) / 10
    items.sort((a, b) => a.scheduledDay - b.scheduledDay)
    this.appendAudit('park.schedule', { parkId, itemCount: items.length, totalHours })
    return { parkId, items, totalHours }
  }

  listParks(): string[] {
    return [...this.parks.keys()]
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private urgency(lastDays: number, cycleDays: number): Urgency {
    if (lastDays >= cycleDays * 1.5) return 'URGENT'
    if (lastDays >= cycleDays) return 'SOON'
    return 'ROUTINE'
  }

  private scheduleDay(u: Urgency): number {
    if (u === 'URGENT') return 1
    if (u === 'SOON') return 3
    return 7
  }

  private appendAudit(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail })
  }
}
