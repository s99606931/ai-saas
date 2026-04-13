// Design Ref: §핵심 알고리즘 — 복구 성공률 계산, 장애 이력 관리
// Plan SC: SVC-AI-ADV-R378
export type DataGrade = 'O' | 'C' | 'S'

export interface IncidentEntry {
  id: string
  serviceId: string
  incidentType: string
  severity: string
  timestamp: string
}

export interface RecoveryEntry {
  incidentId: string
  actionName: string
  success: boolean
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

let incidentCounter = 0

export class ServiceAutoRecoveryV2 {
  private services = new Map<string, { name: string; recoveryActions: string[] }>()
  private incidents = new Map<string, IncidentEntry>()
  private recoveries: RecoveryEntry[] = []
  private auditLog: AuditEntry[] = []

  registerService(id: string, name: string, recoveryActions: string[]): void {
    if (!id || !name) throw new Error('id와 name은 필수')
    this.services.set(id, { name, recoveryActions: [...recoveryActions] })
    this.auditLog.push({ action: 'service.register', timestamp: new Date().toISOString(), detail: id })
  }

  recordIncident(serviceId: string, incidentType: string, severity: string, grade: DataGrade = 'O'): IncidentEntry {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 장애 데이터 전송 금지 (N2SF N-05)`)
    }
    if (!this.services.has(serviceId)) throw new Error(`serviceId 없음: ${serviceId}`)
    const id = `inc-${++incidentCounter}`
    const entry: IncidentEntry = { id, serviceId, incidentType, severity, timestamp: new Date().toISOString() }
    this.incidents.set(id, entry)
    this.auditLog.push({ action: 'incident.record', timestamp: new Date().toISOString(), detail: `${serviceId}:${incidentType}` })
    return entry
  }

  recordRecovery(incidentId: string, actionName: string, success: boolean): void {
    if (!this.incidents.has(incidentId)) throw new Error(`incidentId 없음: ${incidentId}`)
    this.recoveries.push({ incidentId, actionName, success })
    this.auditLog.push({ action: 'recovery.record', timestamp: new Date().toISOString(), detail: `${incidentId}:${actionName}=${success}` })
  }

  getRecoverySuccessRate(serviceId: string): number {
    if (!this.services.has(serviceId)) throw new Error(`serviceId 없음: ${serviceId}`)
    const serviceIncidentIds = new Set(
      [...this.incidents.values()].filter((i) => i.serviceId === serviceId).map((i) => i.id)
    )
    const relevant = this.recoveries.filter((r) => serviceIncidentIds.has(r.incidentId))
    if (relevant.length === 0) return 0
    const successCount = relevant.filter((r) => r.success).length
    return Math.round((successCount / relevant.length) * 10000) / 100
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
