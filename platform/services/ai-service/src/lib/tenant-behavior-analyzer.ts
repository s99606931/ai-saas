/**
 * AI 기반 테넌트 행동 분석기 — SVC-AI-ADV-R143
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R143/SVC-AI-ADV-R143.plan.md
 * Plan SC: FR-R143.1 ~ FR-R143.6
 *
 * 테넌트별 사용 패턴 분석 → 이상 행동 탐지 + 이탈 예측.
 * CSAP D-06 감사 로그, N2SF N-05 등급 guard + PII 마스킹.
 */

export enum DataGrade { C = 'C', S = 'S', O = 'O' }

export interface TenantActivity {
  tenantId: string
  date: string         // YYYY-MM-DD
  activeUsers: number
  apiCalls: number
  storageGiB: number
  aiTokensUsed: number
  grade: DataGrade
}

export interface TenantProfile {
  tenantId: string
  avgDailyApiCalls: number
  avgDailyActiveUsers: number
  historicalDays: number
}

export interface AnomalyDetection {
  tenantId: string
  date: string
  anomalies: Array<{ metric: string; current: number; expected: number; zScore: number }>
  isAnomalous: boolean
}

export interface ChurnPrediction {
  tenantId: string
  churnProbability: number   // 0~1
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  signals: string[]
  recommendation: string
}

export interface AuditEntry {
  timestamp: string
  action: string
  detail?: Record<string, unknown>
}

// Plan SC: FR-R143.3 — PII masking (tenantId may contain email)
function maskTenantId(id: string): string {
  return id.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')
}

export class TenantBehaviorAnalyzer {
  private readonly activities = new Map<string, TenantActivity[]>()
  private readonly auditLog: AuditEntry[] = []

  getAuditLog(): readonly AuditEntry[] { return this.auditLog }

  private audit(action: string, detail?: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, ...(detail !== undefined ? { detail } : {}) })
  }

  // Plan SC: FR-R143.1
  recordActivity(activity: TenantActivity): void {
    if (activity.grade === DataGrade.C || activity.grade === DataGrade.S) {
      throw new Error(`BLOCKED: ${activity.grade}등급 테넌트 활동 수집 금지 (N2SF N-05)`)
    }
    if (!this.activities.has(activity.tenantId)) this.activities.set(activity.tenantId, [])
    this.activities.get(activity.tenantId)!.push(activity)
    this.audit('recordActivity', { tenantId: maskTenantId(activity.tenantId) })
  }

  // Plan SC: FR-R143.2 — build profile from historical data
  buildProfile(tenantId: string): TenantProfile {
    const acts = this.activities.get(tenantId) ?? []
    if (acts.length === 0) throw new Error(`no activity data for tenant: ${tenantId}`)
    const avgDailyApiCalls = acts.reduce((s, a) => s + a.apiCalls, 0) / acts.length
    const avgDailyActiveUsers = acts.reduce((s, a) => s + a.activeUsers, 0) / acts.length
    return { tenantId, avgDailyApiCalls, avgDailyActiveUsers, historicalDays: acts.length }
  }

  // Plan SC: FR-R143.4 — z-score based anomaly detection
  detectAnomalies(tenantId: string, date: string): AnomalyDetection {
    const acts = this.activities.get(tenantId) ?? []
    const target = acts.find(a => a.date === date)
    if (!target) throw new Error(`no activity for tenant ${tenantId} on ${date}`)
    const historical = acts.filter(a => a.date !== date)
    if (historical.length < 3) {
      return { tenantId, date, anomalies: [], isAnomalous: false }
    }

    const metrics: Array<keyof Pick<TenantActivity, 'apiCalls' | 'activeUsers' | 'aiTokensUsed'>> =
      ['apiCalls', 'activeUsers', 'aiTokensUsed']

    const anomalies = metrics.flatMap(metric => {
      const values = historical.map(a => a[metric] as number)
      const mean = values.reduce((s, v) => s + v, 0) / values.length
      const stddev = Math.sqrt(values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length)
      if (stddev === 0) return []
      const current = target[metric] as number
      const zScore = (current - mean) / stddev
      if (Math.abs(zScore) > 2) {
        return [{ metric, current, expected: Math.round(mean), zScore: Math.round(zScore * 100) / 100 }]
      }
      return []
    })

    this.audit('detectAnomalies', { tenantId: maskTenantId(tenantId), anomalies: anomalies.length })
    return { tenantId, date, anomalies, isAnomalous: anomalies.length > 0 }
  }

  // Plan SC: FR-R143.5, FR-R143.6
  predictChurn(tenantId: string): ChurnPrediction {
    const acts = this.activities.get(tenantId) ?? []
    if (acts.length < 7) throw new Error(`insufficient data for churn prediction: ${tenantId}`)

    const sorted = [...acts].sort((a, b) => a.date.localeCompare(b.date))
    const recent7 = sorted.slice(-7)
    const prior7 = sorted.length >= 14 ? sorted.slice(-14, -7) : sorted.slice(0, 7)

    const recentAvgApi = recent7.reduce((s, a) => s + a.apiCalls, 0) / recent7.length
    const priorAvgApi = prior7.reduce((s, a) => s + a.apiCalls, 0) / prior7.length
    const recentAvgUsers = recent7.reduce((s, a) => s + a.activeUsers, 0) / recent7.length
    const priorAvgUsers = prior7.reduce((s, a) => s + a.activeUsers, 0) / prior7.length

    const signals: string[] = []
    let churnScore = 0

    const apiDecline = priorAvgApi > 0 ? (priorAvgApi - recentAvgApi) / priorAvgApi : 0
    const userDecline = priorAvgUsers > 0 ? (priorAvgUsers - recentAvgUsers) / priorAvgUsers : 0

    if (apiDecline > 0.3) { signals.push(`API 호출 ${(apiDecline * 100).toFixed(0)}% 감소`); churnScore += 35 }
    if (apiDecline > 0.5) { churnScore += 20 }
    if (userDecline > 0.3) { signals.push(`활성 사용자 ${(userDecline * 100).toFixed(0)}% 감소`); churnScore += 30 }
    if (recent7.every(a => a.apiCalls === 0)) { signals.push('최근 7일 API 호출 없음'); churnScore += 40 }

    const churnProbability = Math.min(1, churnScore / 100)
    const riskLevel: ChurnPrediction['riskLevel'] =
      churnProbability >= 0.7 ? 'HIGH' : churnProbability >= 0.4 ? 'MEDIUM' : 'LOW'

    const recommendation = riskLevel === 'HIGH'
      ? '즉시 고객 성공 팀 개입 권고 — 이탈 위험 높음'
      : riskLevel === 'MEDIUM'
        ? '2주 내 사용 현황 점검 및 온보딩 지원'
        : '정상 범위 — 월간 모니터링 유지'

    this.audit('predictChurn', { tenantId: maskTenantId(tenantId), riskLevel, churnProbability })
    return { tenantId, churnProbability: Math.round(churnProbability * 100) / 100, riskLevel, signals, recommendation }
  }
}
