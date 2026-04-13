// Plan SC: SVC-AI-ADV-R444
// Design Ref: §건전성점수 — 100 - cpu*0.3 - mem*0.3 - errorRate*0.4, floor 0
type DataGrade = 'O' | 'C' | 'S'

interface Service {
  serviceId: string
  name: string
  baselineScore: number
}

interface HealthSnapshot {
  serviceId: string
  cpuUsage: number
  memUsage: number
  errorRate: number
  healthScore: number
  timestamp: string
}

interface AuditEntry {
  action: string
  detail: string
  timestamp: string
}

export class RealtimeHealthPredictorV2 {
  private services = new Map<string, Service>()
  private snapshots = new Map<string, HealthSnapshot>()
  private auditLog: AuditEntry[] = []

  private checkGrade(grade?: DataGrade): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
  }

  private log(action: string, detail: string): void {
    this.auditLog.push({ action, detail, timestamp: new Date().toISOString() })
  }

  private calcHealth(cpu: number, mem: number, errorRate: number): number {
    return Math.max(0, 100 - cpu * 0.3 - mem * 0.3 - errorRate * 0.4)
  }

  registerService(serviceId: string, name: string, baselineScore: number): Service {
    const svc: Service = { serviceId, name, baselineScore }
    this.services.set(serviceId, svc)
    this.log('service.register', `serviceId=${serviceId}`)
    return svc
  }

  recordMetrics(
    serviceId: string,
    cpuUsage: number,
    memUsage: number,
    errorRate: number,
    dataGrade?: DataGrade,
  ): HealthSnapshot {
    this.checkGrade(dataGrade)
    if (!this.services.has(serviceId)) throw new Error('serviceId 없음')
    const snapshot: HealthSnapshot = {
      serviceId,
      cpuUsage,
      memUsage,
      errorRate,
      healthScore: this.calcHealth(cpuUsage, memUsage, errorRate),
      timestamp: new Date().toISOString(),
    }
    this.snapshots.set(serviceId, snapshot)
    this.log('metrics.record', `serviceId=${serviceId} healthScore=${snapshot.healthScore}`)
    return snapshot
  }

  getHealthScore(serviceId: string): number {
    const snap = this.snapshots.get(serviceId)
    if (!snap) return 100
    return snap.healthScore
  }

  getAtRiskServices(threshold: number): Service[] {
    return Array.from(this.services.values()).filter(
      (svc) => this.getHealthScore(svc.serviceId) < threshold,
    )
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
