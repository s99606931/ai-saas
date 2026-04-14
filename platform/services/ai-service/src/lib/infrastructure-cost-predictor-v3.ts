// Design Ref: §설계 결정 — 선형회귀 예측, 예산 경보
// Plan SC: SVC-AI-ADV-R612
export type DataGrade = 'O' | 'C' | 'S'

export interface ResourceBudget {
  id: string
  name: string
  monthlyBudget: number
  history: number[]
}

export type BudgetStatus = 'OK' | 'WARNING' | 'OVER_BUDGET'

export interface CostForecast {
  resourceId: string
  predictedNextMonth: number
  monthlyBudget: number
  status: BudgetStatus
  slope: number
}

export interface AuditEntry {
  timestamp: string
  action: string
  details?: Record<string, unknown>
}

export class InfrastructureCostPredictorV3 {
  private resources = new Map<string, ResourceBudget>()
  private auditLog: AuditEntry[] = []

  register(id: string, name: string, monthlyBudget: number): void {
    if (!id || !name) throw new Error('id와 name은 필수')
    if (monthlyBudget <= 0) throw new Error('monthlyBudget는 양수여야 합니다')
    this.resources.set(id, { id, name, monthlyBudget, history: [] })
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'resource.register',
      details: { id },
    })
  }

  record(id: string, monthCost: number, grade: DataGrade = 'O'): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 AI API 전송 금지 (N2SF N-05)`)
    }
    const r = this.resources.get(id)
    if (!r) throw new Error(`id 없음: ${id}`)
    if (monthCost < 0) throw new Error('monthCost는 음수일 수 없습니다')
    r.history.push(monthCost)
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'cost.record',
      details: { id, monthCost },
    })
  }

  forecast(id: string): CostForecast {
    const r = this.resources.get(id)
    if (!r) throw new Error(`id 없음: ${id}`)
    const h = r.history
    if (h.length === 0) {
      return { resourceId: id, predictedNextMonth: 0, monthlyBudget: r.monthlyBudget, status: 'OK', slope: 0 }
    }
    if (h.length === 1) {
      return this.buildForecast(r, h[0]!, 0)
    }
    const n = h.length
    const xs = Array.from({ length: n }, (_, i) => i)
    const meanX = xs.reduce((s, v) => s + v, 0) / n
    const meanY = h.reduce((s, v) => s + v, 0) / n
    let num = 0
    let den = 0
    for (let i = 0; i < n; i++) {
      num += (xs[i]! - meanX) * (h[i]! - meanY)
      den += (xs[i]! - meanX) ** 2
    }
    const slope = den === 0 ? 0 : num / den
    const intercept = meanY - slope * meanX
    const predicted = Math.max(0, slope * n + intercept)
    return this.buildForecast(r, predicted, slope)
  }

  private buildForecast(r: ResourceBudget, predicted: number, slope: number): CostForecast {
    const rounded = Math.round(predicted * 100) / 100
    let status: BudgetStatus = 'OK'
    if (rounded > r.monthlyBudget * 1.1) status = 'OVER_BUDGET'
    else if (rounded > r.monthlyBudget * 0.9) status = 'WARNING'
    return {
      resourceId: r.id,
      predictedNextMonth: rounded,
      monthlyBudget: r.monthlyBudget,
      status,
      slope: Math.round(slope * 100) / 100,
    }
  }

  getAlerts(): CostForecast[] {
    const alerts: CostForecast[] = []
    for (const r of this.resources.values()) {
      const f = this.forecast(r.id)
      if (f.status !== 'OK') alerts.push(f)
    }
    return alerts
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
