// Design Ref: §R423 — Public Transport Optimizer
// Plan SC: SC-R423

export interface RouteInput {
  readonly routeId: string
  readonly passengers: number
  readonly capacity: number
  readonly headwayPerHour: number
  readonly dataGrade?: 'O' | 'C' | 'S'
}

export type Action = 'INCREASE' | 'DECREASE' | 'MAINTAIN'

export interface RouteAdvice {
  readonly routeId: string
  readonly loadRatio: number
  readonly action: Action
  readonly estimatedWaitMin: number
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class DataMigrationPlannerAi {
  private auditLog: AuditEntry[] = []

  optimize(route: RouteInput): RouteAdvice {
    // N2SF: C/S 등급 차단
    if (route.dataGrade === 'C' || route.dataGrade === 'S') {
      throw new Error(`BLOCKED: ${route.dataGrade}등급 데이터 처리 차단 (N2SF N-05)`)
    }

    const loadRatio = route.capacity > 0 ? route.passengers / route.capacity : 0
    const estimatedWaitMin = Math.round(60 / Math.max(route.headwayPerHour, 1))

    let action: Action
    if (loadRatio > 0.85) {
      action = 'INCREASE'
    } else if (loadRatio < 0.3) {
      action = 'DECREASE'
    } else {
      action = 'MAINTAIN'
    }

    this.auditLog.push({ action: 'route.optimize', timestamp: new Date().toISOString(), detail: `${route.routeId}:${action}` })
    return { routeId: route.routeId, loadRatio: Math.round(loadRatio * 100) / 100, action, estimatedWaitMin }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
