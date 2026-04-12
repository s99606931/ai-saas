/**
 * AI Embedding Drift Monitor — SVC-AI-ADV-R128
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R128.design.md
 * Plan SC: FR-R128.1 ~ FR-R128.6
 *
 * 차원별 bin 히스토그램 기반 PSI + 평균 KL divergence 드리프트 감지.
 * 오프라인 통계 연산, 외부 라이브러리 비의존.
 * CSAP D-06 감사, N2SF N-05 등급 차단.
 */

export enum DataGrade {
  C = 'C',
  S = 'S',
  O = 'O',
}

export interface DriftMonitorOptions {
  bins?: number
  epsilon?: number
  psiMinor?: number
  psiMajor?: number
}

export interface DriftReport {
  baselineSize: number
  currentSize: number
  avgKL: number
  avgPSI: number
  severity: 'stable' | 'minor' | 'major'
  perDim: { dim: number; kl: number; psi: number }[]
  timestamp: number
}

export interface DriftAuditEntry {
  action: 'baselineSet' | 'sampleAdded' | 'driftComputed' | 'alertEmitted' | 'reset'
  timestamp: number
  details: Record<string, unknown>
}

interface DimRange {
  min: number
  max: number
}

export class AIEmbeddingDriftMonitor {
  private readonly bins: number
  private readonly epsilon: number
  private readonly psiMinor: number
  private readonly psiMajor: number

  private baseline: number[][] = []
  private samples: number[][] = []
  private dimRanges: DimRange[] = []
  private dimCount = 0

  private readonly listeners: Array<(r: DriftReport) => void> = []
  private readonly auditLog: DriftAuditEntry[] = []

  constructor(grade: DataGrade, options: DriftMonitorOptions = {}) {
    if (grade !== DataGrade.O) {
      throw new Error(
        `BLOCKED: ${grade}등급 데이터는 AI 임베딩 드리프트 모니터 사용 금지 (N2SF N-05)`,
      )
    }
    this.bins = options.bins ?? 10
    this.epsilon = options.epsilon ?? 1e-6
    this.psiMinor = options.psiMinor ?? 0.1
    this.psiMajor = options.psiMajor ?? 0.25

    if (this.bins < 2) {
      throw new Error('bins must be >= 2')
    }
  }

  /** FR-R128.1 */
  setBaseline(vectors: number[][]): void {
    if (vectors.length === 0) {
      throw new Error('baseline vectors must not be empty')
    }
    const firstVec = vectors[0]
    if (!firstVec || firstVec.length === 0) {
      throw new Error('baseline vectors must have at least one dimension')
    }
    this.dimCount = firstVec.length
    this.validateShape(vectors)

    this.baseline = vectors.map((v) => [...v])
    this.samples = []

    this.dimRanges = []
    for (let d = 0; d < this.dimCount; d++) {
      let min = Number.POSITIVE_INFINITY
      let max = Number.NEGATIVE_INFINITY
      for (const vec of this.baseline) {
        const v = vec[d] ?? 0
        if (v < min) min = v
        if (v > max) max = v
      }
      if (min === max) {
        max = min + this.epsilon
      }
      this.dimRanges.push({ min, max })
    }

    this.audit('baselineSet', { size: this.baseline.length, dims: this.dimCount })
  }

  /** FR-R128.2 */
  addSample(vectors: number[][]): void {
    if (this.baseline.length === 0) {
      throw new Error('baseline not set')
    }
    this.validateShape(vectors)
    for (const v of vectors) {
      this.samples.push([...v])
    }
    this.audit('sampleAdded', { added: vectors.length, total: this.samples.length })
  }

  /** FR-R128.3 */
  computeDrift(): DriftReport {
    if (this.baseline.length === 0) {
      throw new Error('baseline not set')
    }
    if (this.samples.length === 0) {
      throw new Error('no samples to compare')
    }

    const perDim: { dim: number; kl: number; psi: number }[] = []
    let totalKL = 0
    let totalPSI = 0

    for (let d = 0; d < this.dimCount; d++) {
      const range = this.dimRanges[d]
      if (!range) continue
      const baseHist = this.buildHistogram(this.baseline, d, range)
      const curHist = this.buildHistogram(this.samples, d, range)
      const kl = this.klDivergence(curHist, baseHist)
      const psi = this.psi(curHist, baseHist)
      totalKL += kl
      totalPSI += psi
      perDim.push({ dim: d, kl, psi })
    }

    const avgKL = totalKL / this.dimCount
    const avgPSI = totalPSI / this.dimCount

    let severity: 'stable' | 'minor' | 'major' = 'stable'
    if (avgPSI >= this.psiMajor) severity = 'major'
    else if (avgPSI >= this.psiMinor) severity = 'minor'

    const report: DriftReport = {
      baselineSize: this.baseline.length,
      currentSize: this.samples.length,
      avgKL,
      avgPSI,
      severity,
      perDim,
      timestamp: Date.now(),
    }

    this.audit('driftComputed', { severity, avgKL, avgPSI })

    if (severity === 'major') {
      for (const l of this.listeners) l(report)
      this.audit('alertEmitted', { severity, avgPSI })
    }

    return report
  }

  /** FR-R128.5 */
  onDriftAlert(listener: (r: DriftReport) => void): void {
    this.listeners.push(listener)
  }

  reset(): void {
    this.baseline = []
    this.samples = []
    this.dimRanges = []
    this.dimCount = 0
    this.audit('reset', {})
  }

  /** FR-R128.6 */
  getAuditLog(): DriftAuditEntry[] {
    return [...this.auditLog]
  }

  // ---------- private helpers ----------

  private validateShape(vectors: number[][]): void {
    for (const v of vectors) {
      if (v.length !== this.dimCount) {
        throw new Error(
          `vector dimension mismatch: expected ${this.dimCount}, got ${v.length}`,
        )
      }
      for (const x of v) {
        if (!Number.isFinite(x)) {
          throw new Error('vector value must be finite number')
        }
      }
    }
  }

  private buildHistogram(
    vectors: number[][],
    dim: number,
    range: DimRange,
  ): number[] {
    const hist = new Array<number>(this.bins).fill(0)
    const width = (range.max - range.min) / this.bins
    for (const vec of vectors) {
      const v = vec[dim] ?? 0
      let idx = Math.floor((v - range.min) / width)
      if (idx < 0) idx = 0
      if (idx >= this.bins) idx = this.bins - 1
      hist[idx] = (hist[idx] ?? 0) + 1
    }
    const total = vectors.length
    return hist.map((c) => c / total)
  }

  private klDivergence(p: number[], q: number[]): number {
    let kl = 0
    for (let i = 0; i < p.length; i++) {
      const pi = (p[i] ?? 0) + this.epsilon
      const qi = (q[i] ?? 0) + this.epsilon
      kl += pi * Math.log(pi / qi)
    }
    return kl
  }

  private psi(current: number[], base: number[]): number {
    let psi = 0
    for (let i = 0; i < current.length; i++) {
      const ci = (current[i] ?? 0) + this.epsilon
      const bi = (base[i] ?? 0) + this.epsilon
      psi += (ci - bi) * Math.log(ci / bi)
    }
    return psi
  }

  private audit(
    action: DriftAuditEntry['action'],
    details: Record<string, unknown>,
  ): void {
    this.auditLog.push({ action, timestamp: Date.now(), details })
  }
}
