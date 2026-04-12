/**
 * AI Load Balancer — SVC-AI-ADV-R119
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R119.design.md
 * Plan SC: FR-R119.1 ~ FR-R119.8
 *
 * 다수 AI 백엔드 간 요청 부하 분산. 전략 패턴 + 메트릭 수집 + fallback.
 * CSAP D-06 감사, N2SF C/S 차단.
 */

export enum DataGrade {
  C = 'C',
  S = 'S',
  O = 'O',
}

export type Strategy =
  | 'round-robin'
  | 'weighted'
  | 'least-loaded'
  | 'cost-optimal'
  | 'latency-optimal'

export type Health = 'healthy' | 'degraded' | 'down'

export interface Backend {
  id: string
  weight: number
  maxConcurrency: number
  costPerToken: number
  tags?: string[]
}

export interface BackendMetrics {
  inFlight: number
  totalRequests: number
  successCount: number
  failureCount: number
  p95LatencyMs: number
  lastLatencies: number[]
  recentOutcomes: boolean[]
  health: Health
}

export interface LBAuditEntry {
  timestamp: string
  action:
    | 'register'
    | 'select'
    | 'recordSuccess'
    | 'recordFailure'
    | 'setHealth'
    | 'gradeBlocked'
    | 'noBackend'
  detail?: Record<string, unknown>
}

export interface LoadBalancerOptions {
  strategy?: Strategy
  latencyWindow?: number
  outcomeWindow?: number
}

export class NoBackendAvailableError extends Error {
  constructor(message = 'No healthy backend available') {
    super(message)
    this.name = 'NoBackendAvailableError'
  }
}

export class AILoadBalancer {
  private readonly backends: Map<string, Backend> = new Map()
  private readonly metrics: Map<string, BackendMetrics> = new Map()
  private strategy: Strategy
  private rrIndex = 0
  private readonly auditLog: LBAuditEntry[] = []
  private readonly latencyWindow: number
  private readonly outcomeWindow: number

  constructor(options: LoadBalancerOptions = {}) {
    this.strategy = options.strategy ?? 'weighted'
    this.latencyWindow = options.latencyWindow ?? 20
    this.outcomeWindow = options.outcomeWindow ?? 10
  }

  getAuditLog(): readonly LBAuditEntry[] {
    return this.auditLog
  }

  private audit(
    action: LBAuditEntry['action'],
    detail?: Record<string, unknown>,
  ): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      ...(detail !== undefined ? { detail } : {}),
    })
  }

  setStrategy(strategy: Strategy): void {
    this.strategy = strategy
  }

  /**
   * FR-R119.1: 백엔드 등록.
   */
  register(backend: Backend): void {
    this.backends.set(backend.id, backend)
    this.metrics.set(backend.id, {
      inFlight: 0,
      totalRequests: 0,
      successCount: 0,
      failureCount: 0,
      p95LatencyMs: 0,
      lastLatencies: [],
      recentOutcomes: [],
      health: 'healthy',
    })
    this.audit('register', { id: backend.id, weight: backend.weight })
  }

  getMetrics(id: string): BackendMetrics | undefined {
    return this.metrics.get(id)
  }

  listBackends(): Backend[] {
    return Array.from(this.backends.values())
  }

  /**
   * FR-R119.4: 백엔드 헬스 설정.
   */
  setHealth(id: string, health: Health): void {
    const m = this.metrics.get(id)
    if (!m) return
    m.health = health
    this.audit('setHealth', { id, health })
  }

  private eligible(hint?: { tag?: string }): Backend[] {
    const list: Backend[] = []
    for (const backend of this.backends.values()) {
      const m = this.metrics.get(backend.id)
      if (!m) continue
      if (m.health === 'down') continue
      if (m.inFlight >= backend.maxConcurrency) continue
      if (hint?.tag && !(backend.tags ?? []).includes(hint.tag)) continue
      list.push(backend)
    }
    return list
  }

  /**
   * FR-R119.2: 전략 기반 백엔드 선택.
   * FR-R119.7: 등급 guard.
   */
  select(grade: DataGrade, hint?: { tag?: string }): Backend {
    if (grade === DataGrade.C || grade === DataGrade.S) {
      this.audit('gradeBlocked', { grade })
      throw new Error(
        `BLOCKED: ${grade}등급 데이터는 AI 백엔드 전송 금지 (N2SF N-05)`,
      )
    }

    const eligible = this.eligible(hint)
    if (eligible.length === 0) {
      this.audit('noBackend', { strategy: this.strategy })
      throw new NoBackendAvailableError()
    }

    let selected: Backend
    switch (this.strategy) {
      case 'round-robin':
        selected = eligible[this.rrIndex % eligible.length] as Backend
        this.rrIndex++
        break
      case 'weighted':
        selected = this.pickWeighted(eligible)
        break
      case 'least-loaded':
        selected = this.pickLeastLoaded(eligible)
        break
      case 'cost-optimal':
        selected = this.pickCostOptimal(eligible)
        break
      case 'latency-optimal':
        selected = this.pickLatencyOptimal(eligible)
        break
      default:
        selected = eligible[0] as Backend
    }

    const m = this.metrics.get(selected.id)
    if (m) {
      m.inFlight++
      m.totalRequests++
    }
    this.audit('select', {
      id: selected.id,
      strategy: this.strategy,
      inFlight: m?.inFlight ?? 0,
    })
    return selected
  }

  private pickWeighted(list: Backend[]): Backend {
    const total = list.reduce((s, b) => s + Math.max(1, b.weight), 0)
    let roll = Math.random() * total
    for (const b of list) {
      roll -= Math.max(1, b.weight)
      if (roll <= 0) return b
    }
    return list[list.length - 1] as Backend
  }

  private pickLeastLoaded(list: Backend[]): Backend {
    let best = list[0] as Backend
    let bestLoad = Number.POSITIVE_INFINITY
    for (const b of list) {
      const m = this.metrics.get(b.id)
      const load = m ? m.inFlight / Math.max(1, b.maxConcurrency) : 0
      if (load < bestLoad) {
        bestLoad = load
        best = b
      }
    }
    return best
  }

  private pickCostOptimal(list: Backend[]): Backend {
    return list.reduce((a, b) =>
      a.costPerToken <= b.costPerToken ? a : b,
    )
  }

  private pickLatencyOptimal(list: Backend[]): Backend {
    let best = list[0] as Backend
    let bestLat = Number.POSITIVE_INFINITY
    for (const b of list) {
      const m = this.metrics.get(b.id)
      const lat = m?.p95LatencyMs ?? 0
      if (lat < bestLat) {
        bestLat = lat
        best = b
      }
    }
    return best
  }

  /**
   * FR-R119.6: 성공 메트릭 갱신.
   */
  recordSuccess(id: string, latencyMs: number): void {
    const m = this.metrics.get(id)
    if (!m) return
    m.inFlight = Math.max(0, m.inFlight - 1)
    m.successCount++
    m.lastLatencies.push(latencyMs)
    if (m.lastLatencies.length > this.latencyWindow) {
      m.lastLatencies.shift()
    }
    m.p95LatencyMs = this.computeP95(m.lastLatencies)
    m.recentOutcomes.push(true)
    if (m.recentOutcomes.length > this.outcomeWindow) {
      m.recentOutcomes.shift()
    }
    this.updateHealth(id)
    this.audit('recordSuccess', { id, latencyMs })
  }

  /**
   * FR-R119.5 / FR-R119.6: 실패 메트릭 + 헬스 자동 조정.
   */
  recordFailure(id: string): void {
    const m = this.metrics.get(id)
    if (!m) return
    m.inFlight = Math.max(0, m.inFlight - 1)
    m.failureCount++
    m.recentOutcomes.push(false)
    if (m.recentOutcomes.length > this.outcomeWindow) {
      m.recentOutcomes.shift()
    }
    this.updateHealth(id)
    this.audit('recordFailure', { id })
  }

  private updateHealth(id: string): void {
    const m = this.metrics.get(id)
    if (!m) return
    if (m.recentOutcomes.length < 5) return
    const failures = m.recentOutcomes.filter((o) => !o).length
    const ratio = failures / m.recentOutcomes.length
    if (ratio >= 0.5 && m.health === 'healthy') {
      m.health = 'degraded'
      this.audit('setHealth', { id, health: 'degraded', reason: 'failureRate' })
    } else if (ratio < 0.2 && m.health === 'degraded') {
      m.health = 'healthy'
      this.audit('setHealth', { id, health: 'healthy', reason: 'recovered' })
    }
  }

  private computeP95(values: number[]): number {
    if (values.length === 0) return 0
    const sorted = [...values].sort((a, b) => a - b)
    const idx = Math.floor(sorted.length * 0.95)
    return sorted[Math.min(idx, sorted.length - 1)] ?? 0
  }
}
