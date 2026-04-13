// Design Ref: §핵심 알고리즘 — 이동평균 비용 예측, 예산 경보
// Plan SC: SVC-AI-ADV-R346
export type DataGrade = 'O' | 'C' | 'S'

export interface CostService {
  id: string
  name: string
  budgetLimit: number
  costHistory: Array<{ cost: number; period: string }>
}

export interface CostPrediction {
  serviceId: string
  predictedCost: number
  budgetLimit: number
  overBudget: boolean
  samplesUsed: number
}

export interface BudgetAlert {
  serviceId: string
  serviceName: string
  predictedCost: number
  budgetLimit: number
  overagePercent: number
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class CloudCostPredictorV2 {
  private services = new Map<string, CostService>()
  private auditLog: AuditEntry[] = []

  registerService(id: string, name: string, budgetLimit: number): void {
    if (!id || !name) throw new Error('id와 name은 필수')
    if (budgetLimit <= 0) throw new Error('budgetLimit는 양수여야 합니다')
    this.services.set(id, { id, name, budgetLimit, costHistory: [] })
    this.auditLog.push({ action: 'service.register', timestamp: new Date().toISOString(), detail: id })
  }

  recordCost(serviceId: string, cost: number, period: string, grade: DataGrade = 'O'): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 비용 데이터 전송 금지 (N2SF N-05)`)
    }
    const svc = this.services.get(serviceId)
    if (!svc) throw new Error(`serviceId 없음: ${serviceId}`)
    svc.costHistory.push({ cost, period })
    this.auditLog.push({ action: 'cost.record', timestamp: new Date().toISOString(), detail: `${serviceId}:${cost}` })
  }

  predictCost(serviceId: string, windowSize = 3): CostPrediction {
    const svc = this.services.get(serviceId)
    if (!svc) throw new Error(`serviceId 없음: ${serviceId}`)
    const recent = svc.costHistory.slice(-windowSize)
    if (recent.length === 0) {
      return { serviceId, predictedCost: 0, budgetLimit: svc.budgetLimit, overBudget: false, samplesUsed: 0 }
    }
    const predictedCost = Math.round(recent.reduce((s, r) => s + r.cost, 0) / recent.length * 100) / 100
    return {
      serviceId,
      predictedCost,
      budgetLimit: svc.budgetLimit,
      overBudget: predictedCost > svc.budgetLimit,
      samplesUsed: recent.length,
    }
  }

  getBudgetAlerts(): BudgetAlert[] {
    const alerts: BudgetAlert[] = []
    for (const svc of this.services.values()) {
      const pred = this.predictCost(svc.id)
      if (pred.overBudget && pred.samplesUsed > 0) {
        alerts.push({
          serviceId: svc.id,
          serviceName: svc.name,
          predictedCost: pred.predictedCost,
          budgetLimit: svc.budgetLimit,
          overagePercent: Math.round((pred.predictedCost / svc.budgetLimit - 1) * 10000) / 100,
        })
      }
    }
    return alerts
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
