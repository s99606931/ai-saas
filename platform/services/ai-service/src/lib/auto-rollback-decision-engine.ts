/**
 * AI 기반 자동 롤백 결정 엔진 — SVC-AI-ADV-R141
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R141/SVC-AI-ADV-R141.plan.md
 * Plan SC: FR-R141.1 ~ FR-R141.6
 *
 * 배포 후 지표 실시간 분석 → 롤백 필요성 자동 판단.
 * CSAP D-06 감사 로그, N2SF N-05 등급 guard 적용.
 */

export enum DataGrade { C = 'C', S = 'S', O = 'O' }

export interface DeploymentBaseline {
  service: string
  baselineErrorRate: number    // 0~1
  baselineLatencyP99Ms: number
  baselineCpuPercent: number
  baselineMemPercent: number
  grade: DataGrade
}

export interface DeploymentMetric {
  service: string
  timestamp: string
  errorRate: number
  latencyP99Ms: number
  cpuPercent: number
  memPercent: number
  grade: DataGrade
}

export type RollbackDecision = 'ROLLBACK' | 'WATCH' | 'OK'

export interface RollbackAnalysis {
  service: string
  decision: RollbackDecision
  confidence: number     // 0~1
  triggers: string[]     // which thresholds exceeded
  recommendation: string
  analyzedAt: string
}

export interface AuditEntry {
  timestamp: string
  action: string
  detail?: Record<string, unknown>
}

// Plan SC: FR-R141.2 — multiplier thresholds vs baseline
const THRESHOLDS = {
  errorRate: { watch: 1.5, rollback: 3.0 },      // 1.5x, 3x baseline
  latencyP99: { watch: 1.3, rollback: 2.0 },
  cpu: { watch: 1.4, rollback: 2.0 },
  mem: { watch: 1.3, rollback: 1.8 },
}

export class AutoRollbackDecisionEngine {
  private readonly baselines = new Map<string, DeploymentBaseline>()
  private readonly metrics = new Map<string, DeploymentMetric[]>()
  private readonly auditLog: AuditEntry[] = []

  getAuditLog(): readonly AuditEntry[] { return this.auditLog }

  private audit(action: string, detail?: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, ...(detail !== undefined ? { detail } : {}) })
  }

  // Plan SC: FR-R141.1
  setBaseline(baseline: DeploymentBaseline): void {
    if (baseline.grade === DataGrade.C || baseline.grade === DataGrade.S) {
      throw new Error(`BLOCKED: ${baseline.grade}등급 기준선 설정 금지 (N2SF N-05)`)
    }
    this.baselines.set(baseline.service, baseline)
    this.audit('setBaseline', { service: baseline.service })
  }

  // Plan SC: FR-R141.3
  recordMetric(metric: DeploymentMetric): void {
    if (metric.grade === DataGrade.C || metric.grade === DataGrade.S) {
      throw new Error(`BLOCKED: ${metric.grade}등급 지표 수집 금지 (N2SF N-05)`)
    }
    if (!this.metrics.has(metric.service)) this.metrics.set(metric.service, [])
    this.metrics.get(metric.service)!.push(metric)
    this.audit('recordMetric', { service: metric.service })
  }

  // Plan SC: FR-R141.4 — score each metric against baseline
  private scoreMetrics(
    recent: DeploymentMetric[],
    baseline: DeploymentBaseline,
  ): { triggers: string[]; maxSeverity: 'OK' | 'WATCH' | 'ROLLBACK' } {
    const triggers: string[] = []
    let maxSeverity: 'OK' | 'WATCH' | 'ROLLBACK' = 'OK'

    const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length

    const avgError = avg(recent.map(m => m.errorRate))
    const avgLatency = avg(recent.map(m => m.latencyP99Ms))
    const avgCpu = avg(recent.map(m => m.cpuPercent))
    const avgMem = avg(recent.map(m => m.memPercent))

    const check = (
      metric: string,
      current: number,
      base: number,
      thresholds: { watch: number; rollback: number },
    ) => {
      if (base === 0) return
      const ratio = current / base
      if (ratio >= thresholds.rollback) {
        triggers.push(`${metric}=${current.toFixed(2)} (기준 ${base} 대비 ${ratio.toFixed(1)}x — ROLLBACK 임계값 초과)`)
        maxSeverity = 'ROLLBACK'
      } else if (ratio >= thresholds.watch && maxSeverity !== 'ROLLBACK') {
        triggers.push(`${metric}=${current.toFixed(2)} (기준 ${base} 대비 ${ratio.toFixed(1)}x — WATCH 임계값 초과)`)
        maxSeverity = 'WATCH'
      }
    }

    check('errorRate', avgError, baseline.baselineErrorRate, THRESHOLDS.errorRate)
    check('latencyP99', avgLatency, baseline.baselineLatencyP99Ms, THRESHOLDS.latencyP99)
    check('cpu', avgCpu, baseline.baselineCpuPercent, THRESHOLDS.cpu)
    check('mem', avgMem, baseline.baselineMemPercent, THRESHOLDS.mem)

    return { triggers, maxSeverity }
  }

  // Plan SC: FR-R141.5, FR-R141.6
  analyze(service: string): RollbackAnalysis {
    const baseline = this.baselines.get(service)
    if (!baseline) throw new Error(`no baseline for service: ${service}`)
    const allMetrics = this.metrics.get(service) ?? []
    if (allMetrics.length === 0) throw new Error(`no metrics for service: ${service}`)

    // Use most recent 5 samples
    const recent = allMetrics.slice(-5)
    const { triggers, maxSeverity } = this.scoreMetrics(recent, baseline)

    const decision: RollbackDecision = maxSeverity === 'ROLLBACK' ? 'ROLLBACK'
      : maxSeverity === 'WATCH' ? 'WATCH' : 'OK'

    const confidence = decision === 'ROLLBACK' ? Math.min(0.95, 0.6 + triggers.length * 0.1)
      : decision === 'WATCH' ? 0.5 : 0.9

    const recommendation = decision === 'ROLLBACK'
      ? '즉시 이전 버전으로 롤백 권고'
      : decision === 'WATCH'
        ? '5분간 추가 모니터링 후 재판단'
        : '배포 상태 정상 — 계속 운영'

    this.audit('analyze', { service, decision, triggers: triggers.length })
    return {
      service,
      decision,
      confidence: Math.round(confidence * 100) / 100,
      triggers,
      recommendation,
      analyzedAt: new Date().toISOString(),
    }
  }
}
