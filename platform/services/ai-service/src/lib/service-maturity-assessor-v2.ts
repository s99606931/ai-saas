// Plan SC: SVC-AI-ADV-R466
// Design Ref: §등급기준 — >=80:platinum, >=60:gold, >=40:silver, else bronze
type MaturityDimension = 'automation' | 'monitoring' | 'security' | 'documentation' | 'process' | 'technology'
type MaturityGrade = 'platinum' | 'gold' | 'silver' | 'bronze'
type DataGrade = 'O' | 'C' | 'S'

interface Service { serviceId: string; name: string; category: string }
interface AuditEntry { action: string; detail: string; timestamp: string }

export class ServiceMaturityAssessorV2 {
  private services = new Map<string, Service>()
  private scores = new Map<string, Map<MaturityDimension, number>>()
  private auditLog: AuditEntry[] = []

  private checkGrade(grade?: DataGrade): void {
    if (grade === 'C' || grade === 'S') throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
  }
  private log(action: string, detail: string): void {
    this.auditLog.push({ action, detail, timestamp: new Date().toISOString() })
  }

  registerService(serviceId: string, name: string, category = ''): Service {
    const svc: Service = { serviceId, name, category }
    this.services.set(serviceId, svc)
    this.scores.set(serviceId, new Map())
    this.log('service.register', `serviceId=${serviceId}`)
    return svc
  }

  recordDimensionScore(serviceId: string, dimension: MaturityDimension, score: number, dataGrade?: DataGrade): void {
    this.checkGrade(dataGrade)
    if (!this.services.has(serviceId)) throw new Error('serviceId 없음')
    this.scores.get(serviceId)!.set(dimension, score)
    this.log('dimension.record', `serviceId=${serviceId} dimension=${dimension} score=${score}`)
  }

  getMaturityScore(serviceId: string): number {
    const dimScores = this.scores.get(serviceId)
    if (!dimScores || dimScores.size === 0) return 0
    const values = Array.from(dimScores.values())
    return values.reduce((s, v) => s + v, 0) / values.length
  }

  getMaturityGrade(serviceId: string): MaturityGrade {
    const score = this.getMaturityScore(serviceId)
    if (score >= 80) return 'platinum'
    if (score >= 60) return 'gold'
    if (score >= 40) return 'silver'
    return 'bronze'
  }

  getLowMaturityServices(threshold = 60): Service[] {
    return Array.from(this.services.values()).filter((svc) => this.getMaturityScore(svc.serviceId) < threshold)
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
