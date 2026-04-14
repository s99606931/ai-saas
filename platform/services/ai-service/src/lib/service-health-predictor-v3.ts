// Design Ref: §설계 결정 — 최근 5개 평균 지표 기반 위험 판정
// Plan SC: SVC-AI-ADV-R614
export type DataGrade = 'O' | 'C' | 'S'

export interface HealthSample {
  cpu: number
  mem: number
  errorRate: number
}

export interface ServiceState {
  id: string
  name: string
  samples: HealthSample[]
}

export type HealthStatus = 'HEALTHY' | 'WARNING' | 'CRITICAL'

export interface HealthPrediction {
  serviceId: string
  avgCpu: number
  avgMem: number
  avgErrorRate: number
  status: HealthStatus
  confidence: number
}

export interface AuditEntry {
  timestamp: string
  action: string
  details?: Record<string, unknown>
}

export class ServiceHealthPredictorV3 {
  private services = new Map<string, ServiceState>()
  private auditLog: AuditEntry[] = []

  register(id: string, name: string): void {
    if (!id || !name) throw new Error('id와 name은 필수')
    this.services.set(id, { id, name, samples: [] })
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'service.register',
      details: { id },
    })
  }

  recordSample(id: string, sample: HealthSample, grade: DataGrade = 'O'): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 AI API 전송 금지 (N2SF N-05)`)
    }
    const s = this.services.get(id)
    if (!s) throw new Error(`id 없음: ${id}`)
    if (sample.cpu < 0 || sample.mem < 0 || sample.errorRate < 0) {
      throw new Error('지표는 음수일 수 없습니다')
    }
    s.samples.push(sample)
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'sample.record',
      details: { id },
    })
  }

  predict(id: string): HealthPrediction {
    const s = this.services.get(id)
    if (!s) throw new Error(`id 없음: ${id}`)
    const recent = s.samples.slice(-5)
    if (recent.length === 0) {
      return {
        serviceId: id,
        avgCpu: 0,
        avgMem: 0,
        avgErrorRate: 0,
        status: 'HEALTHY',
        confidence: 0,
      }
    }
    const avgCpu = this.avg(recent.map((r) => r.cpu))
    const avgMem = this.avg(recent.map((r) => r.mem))
    const avgErr = this.avg(recent.map((r) => r.errorRate))
    let status: HealthStatus = 'HEALTHY'
    if (avgCpu > 80 && avgMem > 85) status = 'CRITICAL'
    else if (avgCpu > 70 || avgMem > 75 || avgErr > 0.05) status = 'WARNING'
    const confidence = Math.min(recent.length / 5, 1)
    return {
      serviceId: id,
      avgCpu: this.round(avgCpu),
      avgMem: this.round(avgMem),
      avgErrorRate: this.round(avgErr),
      status,
      confidence,
    }
  }

  private avg(arr: number[]): number {
    return arr.reduce((s, v) => s + v, 0) / arr.length
  }

  private round(v: number): number {
    return Math.round(v * 100) / 100
  }

  getCriticalServices(): HealthPrediction[] {
    return Array.from(this.services.keys())
      .map((id) => this.predict(id))
      .filter((p) => p.status === 'CRITICAL')
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
