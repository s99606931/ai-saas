// Design Ref: §R268 — 공공 API SLA 예측 엔진
// Plan SC: SVC-AI-ADV-R268-SC01

export type DataGrade = 'C' | 'S' | 'O'
export type Severity = 'OK' | 'WARN' | 'CRITICAL'

export interface ApiSample {
  timestamp: string
  latencyMs: number
  success: boolean
}

export interface ApiStats {
  apiId: string
  count: number
  p50: number
  p95: number
  p99: number
  successRate: number
}

export interface SlaPrediction {
  apiId: string
  predictedLatencyMs: number
  currentP95: number
  slaTargetMs: number
  violationProbability: number
  severity: Severity
}

interface AuditEntry {
  timestamp: string
  action: string
  callerMasked: string
  detail: Record<string, unknown>
}

export class PublicApiSlaPredictor {
  private samples = new Map<string, ApiSample[]>()
  private auditLog: AuditEntry[] = []
  private readonly alpha = 0.3
  private readonly maxSamples = 1000

  recordSample(
    apiId: string,
    latencyMs: number,
    success: boolean,
    grade: DataGrade,
    caller: string
  ): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 메트릭 기록 금지 (N2SF N-05)`)
    }
    if (latencyMs < 0) {
      throw new Error('latencyMs는 0 이상이어야 합니다')
    }
    if (!apiId) {
      throw new Error('apiId 필수')
    }
    const list = this.samples.get(apiId) ?? []
    list.push({ timestamp: new Date().toISOString(), latencyMs, success })
    // 순환 버퍼
    if (list.length > this.maxSamples) {
      list.splice(0, list.length - this.maxSamples)
    }
    this.samples.set(apiId, list)
    this.appendAudit('sample.record', this.mask(caller), {
      apiId,
      latencyMs,
      success,
    })
  }

  computeStats(apiId: string): ApiStats {
    const list = this.samples.get(apiId) ?? []
    if (list.length === 0) {
      throw new Error(`샘플 없음: ${apiId}`)
    }
    const latencies = list.map((s) => s.latencyMs).sort((a, b) => a - b)
    const successCount = list.filter((s) => s.success).length
    return {
      apiId,
      count: list.length,
      p50: this.percentile(latencies, 0.5),
      p95: this.percentile(latencies, 0.95),
      p99: this.percentile(latencies, 0.99),
      successRate: successCount / list.length,
    }
  }

  predictSla(apiId: string, slaTargetMs: number): SlaPrediction {
    if (slaTargetMs <= 0) {
      throw new Error('slaTargetMs는 양수여야 합니다')
    }
    const stats = this.computeStats(apiId)
    const list = this.samples.get(apiId) ?? []
    if (list.length < 3) {
      throw new Error(`예측을 위한 최소 3개 샘플 필요 (현재 ${list.length})`)
    }

    // EWMA 계산
    let ewma = list[0]?.latencyMs ?? 0
    for (let i = 1; i < list.length; i++) {
      const v = list[i]?.latencyMs ?? 0
      ewma = this.alpha * v + (1 - this.alpha) * ewma
    }

    // 위반 확률: 최근 샘플 중 target 초과 비율
    const recent = list.slice(-20)
    const violations = recent.filter((s) => s.latencyMs > slaTargetMs).length
    const violationProb = violations / recent.length

    const severity = this.determineSeverity(violationProb, ewma, slaTargetMs)

    const result: SlaPrediction = {
      apiId,
      predictedLatencyMs: Math.round(ewma),
      currentP95: stats.p95,
      slaTargetMs,
      violationProbability: Math.round(violationProb * 100) / 100,
      severity,
    }

    this.appendAudit('sla.predict', 'SYSTEM', {
      apiId,
      severity,
      violationProb: result.violationProbability,
    })
    return result
  }

  listApis(): string[] {
    return [...this.samples.keys()]
  }

  clearSamples(apiId: string, caller: string): void {
    if (!this.samples.has(apiId)) {
      throw new Error(`apiId 없음: ${apiId}`)
    }
    this.samples.delete(apiId)
    this.appendAudit('sample.clear', this.mask(caller), { apiId })
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0
    const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p))
    return sorted[idx] ?? 0
  }

  private determineSeverity(prob: number, predicted: number, target: number): Severity {
    if (prob >= 0.3 || predicted > target * 1.2) return 'CRITICAL'
    if (prob >= 0.1 || predicted > target) return 'WARN'
    return 'OK'
  }

  private mask(id: string): string {
    if (id.length <= 4) return '***'
    return `${id.slice(0, 2)}***${id.slice(-2)}`
  }

  private appendAudit(
    action: string,
    callerMasked: string,
    detail: Record<string, unknown>
  ): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      callerMasked,
      detail,
    })
  }
}
