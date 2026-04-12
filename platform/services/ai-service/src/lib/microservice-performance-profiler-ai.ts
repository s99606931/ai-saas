// Design Ref: §R304 — AI기반 마이크로서비스 성능 프로파일러
// Plan SC: SC-R304

export type DataGrade = 'O' | 'C' | 'S'

export interface ServiceRegistration {
  id: string
  name: string
  sloTargetMs: number
}

export interface MetricSample {
  cpuPercent: number
  memoryMb: number
  responseTimeMs: number
  timestamp: number
}

export interface PerformanceStats {
  serviceId: string
  avgResponseTimeMs: number
  p95ResponseTimeMs: number
  p99ResponseTimeMs: number
  sloTargetMs: number
  isBottleneck: boolean
  sampleCount: number
}

export interface BottleneckInfo {
  serviceId: string
  serviceName: string
  p99ResponseTimeMs: number
  sloTargetMs: number
  exceedRatio: number
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1))
  return sorted[idx] ?? 0
}

export class MicroservicePerformanceProfilerAI {
  private services = new Map<string, ServiceRegistration>()
  private metrics = new Map<string, MetricSample[]>()
  private auditLog: AuditEntry[] = []

  registerService(id: string, name: string, sloTargetMs: number): void {
    if (!id || !name) throw new Error('id와 name은 필수')
    if (sloTargetMs <= 0) throw new Error('sloTargetMs는 양수여야 합니다')
    this.services.set(id, { id, name, sloTargetMs })
    this.metrics.set(id, [])
    this.auditLog.push({ action: 'service.register', timestamp: new Date().toISOString(), detail: id })
  }

  recordMetrics(
    serviceId: string,
    cpuPercent: number,
    memoryMb: number,
    responseTimeMs: number,
    grade: DataGrade = 'O'
  ): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 지표 수집 금지 (N2SF N-05)`)
    }
    if (!this.services.has(serviceId)) throw new Error(`serviceId 없음: ${serviceId}`)
    if (cpuPercent < 0 || memoryMb < 0 || responseTimeMs < 0) {
      throw new Error('지표 값은 0 이상이어야 합니다')
    }
    const list = this.metrics.get(serviceId)!
    list.push({ cpuPercent, memoryMb, responseTimeMs, timestamp: Date.now() })
    this.auditLog.push({
      action: 'metrics.record',
      timestamp: new Date().toISOString(),
      detail: `${serviceId}:rt=${responseTimeMs}`,
    })
  }

  getStats(serviceId: string): PerformanceStats {
    const service = this.services.get(serviceId)
    if (!service) throw new Error(`serviceId 없음: ${serviceId}`)
    const samples = this.metrics.get(serviceId) ?? []
    const sorted = samples.map((s) => s.responseTimeMs).sort((a, b) => a - b)
    const avg = sorted.length === 0 ? 0 : sorted.reduce((a, b) => a + b, 0) / sorted.length
    const p95 = percentile(sorted, 0.95)
    const p99 = percentile(sorted, 0.99)
    return {
      serviceId,
      avgResponseTimeMs: Math.round(avg * 100) / 100,
      p95ResponseTimeMs: p95,
      p99ResponseTimeMs: p99,
      sloTargetMs: service.sloTargetMs,
      isBottleneck: p99 > service.sloTargetMs,
      sampleCount: sorted.length,
    }
  }

  getBottlenecks(): BottleneckInfo[] {
    const result: BottleneckInfo[] = []
    for (const service of this.services.values()) {
      const stats = this.getStats(service.id)
      if (stats.isBottleneck) {
        result.push({
          serviceId: service.id,
          serviceName: service.name,
          p99ResponseTimeMs: stats.p99ResponseTimeMs,
          sloTargetMs: service.sloTargetMs,
          exceedRatio: Math.round((stats.p99ResponseTimeMs / service.sloTargetMs) * 100) / 100,
        })
      }
    }
    return result
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
