/**
 * Response Time SLA Tracker — SVC-AI-ADV-R162
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R162.design.md
 * Plan SC: FR-R162.1 ~ FR-R162.8
 *
 * AI 응답 시간 SLA 추적기.
 * 슬라이딩 윈도우로 p50/p95/p99 계산하고 임계값 초과 시 위반 알림 생성.
 */

export type DataGrade = 'O' | 'C' | 'S'

export interface Sample {
  latencyMs: number
  at: number
}

export interface Percentiles {
  p50: number
  p95: number
  p99: number
}

export interface Violation {
  percentile: 'p95' | 'p99'
  observed: number
  threshold: number
  at: number
}

export interface SlaConfig {
  p95: number
  p99: number
  windowSize: number
}

export interface SlaStats {
  total: number
  violations: number
  sampleCount: number
}

export interface AuditEntry {
  event: string
  detail: Record<string, unknown>
  at: number
}

export interface TrackerOptions {
  now?: () => number
  minSamples?: number
}

const DEFAULT_CONFIG: SlaConfig = {
  p95: 2000,
  p99: 5000,
  windowSize: 100,
}

export class ResponseTimeSlaTracker {
  private readonly samples: Sample[] = []
  private readonly violations: Violation[] = []
  private readonly auditLog: AuditEntry[] = []
  private readonly config: SlaConfig
  private readonly now: () => number
  private readonly minSamples: number
  private totalRecorded = 0

  constructor(config: Partial<SlaConfig> = {}, opts: TrackerOptions = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.now = opts.now ?? (() => Date.now())
    this.minSamples = opts.minSamples ?? 10
  }

  /** FR-R162.1: 응답 시간 기록 */
  record(latencyMs: number, grade: DataGrade = 'O'): void {
    this.assertGrade(grade)
    if (typeof latencyMs !== 'number' || !Number.isFinite(latencyMs) || latencyMs < 0) {
      throw new Error('invalid_latency')
    }

    const now = this.now()
    this.samples.push({ latencyMs, at: now })
    this.totalRecorded += 1

    // 윈도우 크기 초과 시 가장 오래된 샘플 제거
    while (this.samples.length > this.config.windowSize) {
      this.samples.shift()
    }

    this.checkViolations(now)
    this.audit('recorded', { latencyMs, windowSize: this.samples.length })
  }

  /** FR-R162.3: 퍼센타일 계산 */
  getPercentiles(): Percentiles | null {
    if (this.samples.length < this.minSamples) return null
    const sorted = this.samples.map((s) => s.latencyMs).sort((a, b) => a - b)
    return {
      p50: this.percentile(sorted, 0.5),
      p95: this.percentile(sorted, 0.95),
      p99: this.percentile(sorted, 0.99),
    }
  }

  /** FR-R162.5: 위반 이력 반환 */
  getViolations(): Violation[] {
    return [...this.violations]
  }

  getStats(): SlaStats {
    return {
      total: this.totalRecorded,
      violations: this.violations.length,
      sampleCount: this.samples.length,
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  // === 내부 ===

  private checkViolations(at: number): void {
    const p = this.getPercentiles()
    if (!p) return

    if (p.p95 > this.config.p95) {
      const v: Violation = {
        percentile: 'p95',
        observed: p.p95,
        threshold: this.config.p95,
        at,
      }
      this.violations.push(v)
      this.audit('violation', { ...v })
    }
    if (p.p99 > this.config.p99) {
      const v: Violation = {
        percentile: 'p99',
        observed: p.p99,
        threshold: this.config.p99,
        at,
      }
      this.violations.push(v)
      this.audit('violation', { ...v })
    }
  }

  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0
    const idx = Math.floor((sorted.length - 1) * p)
    return sorted[idx] ?? 0
  }

  private assertGrade(grade: DataGrade): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error('grade_blocked')
    }
  }

  private audit(event: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ event, detail, at: this.now() })
  }
}
