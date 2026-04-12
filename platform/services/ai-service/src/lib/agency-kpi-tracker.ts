// Design Ref: §R277 — 공공기관 KPI 자동 추적
// Plan SC: SVC-AI-ADV-R277-SC01

export type DataGrade = 'C' | 'S' | 'O'
export type Direction = 'UP' | 'DOWN'
export type KpiStatus = 'ON_TRACK' | 'AT_RISK' | 'OFF_TRACK'
export type TrendDirection = 'RISING' | 'FALLING' | 'FLAT'

export interface KpiDefinition {
  kpiId: string
  name: string
  target: number
  direction: Direction
}

export interface Measurement {
  period: string
  value: number
}

export interface KpiEvaluation {
  kpiId: string
  name: string
  latestValue: number
  target: number
  achievementPct: number
  status: KpiStatus
  trend: TrendDirection
  measurementCount: number
}

interface AuditEntry {
  timestamp: string
  action: string
  callerMasked: string
  detail: Record<string, unknown>
}

export class AgencyKpiTracker {
  private kpis = new Map<string, KpiDefinition>()
  private measurements = new Map<string, Measurement[]>()
  private auditLog: AuditEntry[] = []

  defineKpi(def: KpiDefinition, caller: string): void {
    if (!def.kpiId) throw new Error('kpiId 필수')
    if (!def.name) throw new Error('name 필수')
    if (def.target <= 0) throw new Error('target은 양수여야 합니다')
    if (this.kpis.has(def.kpiId)) {
      throw new Error(`중복 kpiId: ${def.kpiId}`)
    }
    this.kpis.set(def.kpiId, { ...def })
    this.measurements.set(def.kpiId, [])
    this.appendAudit('kpi.define', this.mask(caller), {
      kpiId: def.kpiId,
      target: def.target,
      direction: def.direction,
    })
  }

  recordMeasurement(
    kpiId: string,
    period: string,
    value: number,
    grade: DataGrade,
    caller: string
  ): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 KPI 측정 금지 (N2SF N-05)`)
    }
    if (!this.kpis.has(kpiId)) throw new Error(`kpiId 없음: ${kpiId}`)
    if (!period) throw new Error('period 필수')
    if (value < 0) throw new Error('value는 0 이상이어야 합니다')

    const list = this.measurements.get(kpiId) ?? []
    if (list.some((m) => m.period === period)) {
      throw new Error(`중복 period: ${period}`)
    }
    list.push({ period, value })
    list.sort((a, b) => a.period.localeCompare(b.period))
    this.measurements.set(kpiId, list)

    this.appendAudit('measurement.record', this.mask(caller), {
      kpiId,
      period,
      value,
    })
  }

  evaluate(kpiId: string): KpiEvaluation {
    const kpi = this.kpis.get(kpiId)
    if (!kpi) throw new Error(`kpiId 없음: ${kpiId}`)
    const list = this.measurements.get(kpiId) ?? []
    if (list.length === 0) {
      throw new Error(`측정값 없음: ${kpiId}`)
    }

    const latest = list[list.length - 1]?.value ?? 0

    // 달성률 계산
    let achievementPct: number
    if (kpi.direction === 'UP') {
      achievementPct = Math.round((latest / kpi.target) * 100)
    } else {
      // DOWN: target 이하가 좋음
      if (latest === 0) {
        achievementPct = 200
      } else {
        achievementPct = Math.round((kpi.target / latest) * 100)
      }
    }

    // 상태 판정
    const status = this.determineStatus(kpi.direction, latest, kpi.target)

    // 트렌드 (최근 3개 선형)
    const trend = this.computeTrend(list.slice(-3).map((m) => m.value))

    this.appendAudit('kpi.evaluate', 'SYSTEM', {
      kpiId,
      status,
      achievementPct,
    })

    return {
      kpiId,
      name: kpi.name,
      latestValue: latest,
      target: kpi.target,
      achievementPct,
      status,
      trend,
      measurementCount: list.length,
    }
  }

  listKpis(): string[] {
    return [...this.kpis.keys()]
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private determineStatus(direction: Direction, value: number, target: number): KpiStatus {
    if (direction === 'UP') {
      if (value >= target) return 'ON_TRACK'
      if (value >= target * 0.8) return 'AT_RISK'
      return 'OFF_TRACK'
    }
    // DOWN
    if (value <= target) return 'ON_TRACK'
    if (value <= target * 1.2) return 'AT_RISK'
    return 'OFF_TRACK'
  }

  private computeTrend(values: number[]): TrendDirection {
    if (values.length < 2) return 'FLAT'
    const first = values[0] ?? 0
    const last = values[values.length - 1] ?? 0
    const diff = last - first
    const threshold = Math.max(1, Math.abs(first) * 0.05)
    if (diff > threshold) return 'RISING'
    if (diff < -threshold) return 'FALLING'
    return 'FLAT'
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
