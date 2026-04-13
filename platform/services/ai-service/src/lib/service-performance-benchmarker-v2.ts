// Design Ref: §핵심 알고리즘 — 평균 응답시간, 회귀 탐지
// Plan SC: SVC-AI-ADV-R408
export type DataGrade = 'O' | 'C' | 'S'

export interface BenchmarkResult {
  serviceId: string
  name: string
  avgResponseMs: number
  baselineMs: number
  isRegression: boolean
  regressionPercent: number
  sampleCount: number
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class ServicePerformanceBenchmarkerV2 {
  private services = new Map<string, { name: string; baselineMs: number; measurements: number[] }>()
  private auditLog: AuditEntry[] = []

  registerService(id: string, name: string, baselineMs: number): void {
    if (!id || !name) throw new Error('id와 name은 필수')
    if (baselineMs <= 0) throw new Error('baselineMs는 양수여야 합니다')
    this.services.set(id, { name, baselineMs, measurements: [] })
    this.auditLog.push({ action: 'service.register', timestamp: new Date().toISOString(), detail: id })
  }

  recordMeasurement(serviceId: string, responseMs: number, grade: DataGrade = 'O'): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 성능 데이터 전송 금지 (N2SF N-05)`)
    }
    const svc = this.services.get(serviceId)
    if (!svc) throw new Error(`serviceId 없음: ${serviceId}`)
    svc.measurements.push(responseMs)
    this.auditLog.push({ action: 'measurement.record', timestamp: new Date().toISOString(), detail: `${serviceId}:${responseMs}ms` })
  }

  getBenchmarkResult(serviceId: string): BenchmarkResult {
    const svc = this.services.get(serviceId)
    if (!svc) throw new Error(`serviceId 없음: ${serviceId}`)
    const sampleCount = svc.measurements.length
    const avgResponseMs = sampleCount === 0
      ? 0
      : Math.round(svc.measurements.reduce((s, v) => s + v, 0) / sampleCount * 100) / 100
    const isRegression = sampleCount > 0 && avgResponseMs > svc.baselineMs * 1.2
    const regressionPercent = sampleCount === 0
      ? 0
      : Math.round((avgResponseMs / svc.baselineMs - 1) * 10000) / 100
    return { serviceId, name: svc.name, avgResponseMs, baselineMs: svc.baselineMs, isRegression, regressionPercent, sampleCount }
  }

  getRegressions(): BenchmarkResult[] {
    return [...this.services.keys()]
      .map((id) => this.getBenchmarkResult(id))
      .filter((r) => r.isRegression)
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
