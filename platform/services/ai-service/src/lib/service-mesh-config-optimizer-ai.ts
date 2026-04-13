// Design Ref: §핵심 알고리즘 — 설정 점수, 최적화 권고
// Plan SC: SVC-AI-ADV-R403
export type DataGrade = 'O' | 'C' | 'S'

export interface MeshConfig {
  serviceId: string
  retryCount: number
  timeoutMs: number
  circuitBreakerEnabled: boolean
}

export interface ConfigScoreResult {
  serviceId: string
  configScore: number
  recommendations: string[]
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class ServiceMeshConfigOptimizerAI {
  private services = new Map<string, string>()
  private configs = new Map<string, MeshConfig>()
  private auditLog: AuditEntry[] = []

  registerService(id: string, name: string, meshRole: string): void {
    if (!id || !name || !meshRole) throw new Error('id, name, meshRole은 필수')
    this.services.set(id, name)
    this.auditLog.push({ action: 'service.register', timestamp: new Date().toISOString(), detail: id })
  }

  recordConfig(serviceId: string, retryCount: number, timeoutMs: number, circuitBreakerEnabled: boolean, grade: DataGrade = 'O'): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 메시 설정 데이터 전송 금지 (N2SF N-05)`)
    }
    if (!this.services.has(serviceId)) throw new Error(`serviceId 없음: ${serviceId}`)
    this.configs.set(serviceId, { serviceId, retryCount, timeoutMs, circuitBreakerEnabled })
    this.auditLog.push({ action: 'config.record', timestamp: new Date().toISOString(), detail: `${serviceId}:retry=${retryCount}` })
  }

  getConfigScore(serviceId: string): ConfigScoreResult {
    if (!this.services.has(serviceId)) throw new Error(`serviceId 없음: ${serviceId}`)
    const cfg = this.configs.get(serviceId)
    if (!cfg) throw new Error(`설정 없음: ${serviceId}`)
    let deduction = 0
    const recommendations: string[] = []
    if (cfg.retryCount < 3 || cfg.retryCount > 5) {
      deduction += 20
      recommendations.push('retryCount를 3~5 범위로 설정 권고')
    }
    if (cfg.timeoutMs < 1000 || cfg.timeoutMs > 5000) {
      deduction += 20
      recommendations.push('timeoutMs를 1000~5000ms 범위로 설정 권고')
    }
    if (!cfg.circuitBreakerEnabled) {
      deduction += 30
      recommendations.push('Circuit Breaker 활성화 권고')
    }
    return { serviceId, configScore: Math.max(0, 100 - deduction), recommendations }
  }

  getOptimizationRecommendations(serviceId: string): string[] {
    return this.getConfigScore(serviceId).recommendations
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
