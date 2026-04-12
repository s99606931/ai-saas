// Design Ref: §R272 — 예산 집행 이상 탐지 v2
// Plan SC: SVC-AI-ADV-R272-SC01

export type DataGrade = 'C' | 'S' | 'O'
export type AnomalyType = 'STATISTICAL' | 'DUPLICATE' | 'OVER_BUDGET'
export type AnomalySeverity = 'LOW' | 'MED' | 'HIGH'

export interface Execution {
  executionId: string
  agencyId: string
  account: string
  amount: number
  supplierId: string
  date: string
}

export interface Anomaly {
  type: AnomalyType
  severity: AnomalySeverity
  executionId: string
  detail: string
}

interface AuditEntry {
  timestamp: string
  action: string
  callerMasked: string
  detail: Record<string, unknown>
}

export class BudgetExecutionAnomaly {
  private executions = new Map<string, Execution>()
  private budgets = new Map<string, number>() // key: agencyId:account
  private auditLog: AuditEntry[] = []

  setBudget(agencyId: string, account: string, limit: number, caller: string): void {
    if (limit <= 0) throw new Error('limit는 양수여야 합니다')
    const key = `${agencyId}:${account}`
    this.budgets.set(key, limit)
    this.appendAudit('budget.set', this.mask(caller), { agencyId, account, limit })
  }

  recordExecution(ex: Execution, grade: DataGrade, caller: string): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 집행 내역 등록 금지 (N2SF N-05)`)
    }
    if (ex.amount <= 0) throw new Error('amount는 양수여야 합니다')
    if (!ex.executionId) throw new Error('executionId 필수')
    if (this.executions.has(ex.executionId)) {
      throw new Error(`중복 executionId: ${ex.executionId}`)
    }
    this.executions.set(ex.executionId, { ...ex })
    this.appendAudit('execution.record', this.mask(caller), {
      executionId: ex.executionId,
      agencyId: ex.agencyId,
      amount: ex.amount,
    })
  }

  detectAnomalies(): Anomaly[] {
    const anomalies: Anomaly[] = []
    const all = [...this.executions.values()]

    // 1. 통계적 이상치 (전체 amount Z-score)
    if (all.length >= 3) {
      const amounts = all.map((e) => e.amount)
      const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length
      const variance =
        amounts.reduce((acc, v) => acc + (v - mean) ** 2, 0) / amounts.length
      const stddev = Math.sqrt(variance)
      if (stddev > 0) {
        for (const ex of all) {
          const z = Math.abs(ex.amount - mean) / stddev
          if (z >= 2.0) {
            anomalies.push({
              type: 'STATISTICAL',
              severity: z >= 3 ? 'HIGH' : 'MED',
              executionId: ex.executionId,
              detail: `Z-score=${z.toFixed(2)}, amount=${ex.amount}, mean=${Math.round(mean)}`,
            })
          }
        }
      }
    }

    // 2. 중복 거래 (동일 supplier + 동일 금액 + 7일 이내)
    const bySupplier = new Map<string, Execution[]>()
    for (const ex of all) {
      const list = bySupplier.get(ex.supplierId) ?? []
      list.push(ex)
      bySupplier.set(ex.supplierId, list)
    }
    for (const exs of bySupplier.values()) {
      exs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      for (let i = 0; i < exs.length; i++) {
        for (let j = i + 1; j < exs.length; j++) {
          const a = exs[i]
          const b = exs[j]
          if (!a || !b) continue
          if (a.amount !== b.amount) continue
          const daysDiff =
            (new Date(b.date).getTime() - new Date(a.date).getTime()) / 86400000
          if (daysDiff > 7) break
          anomalies.push({
            type: 'DUPLICATE',
            severity: 'HIGH',
            executionId: b.executionId,
            detail: `동일 supplier ${a.supplierId}, 동일 금액 ${a.amount}, ${daysDiff.toFixed(1)}일 간격`,
          })
        }
      }
    }

    // 3. 예산 초과
    const sums = new Map<string, number>()
    for (const ex of all) {
      const key = `${ex.agencyId}:${ex.account}`
      sums.set(key, (sums.get(key) ?? 0) + ex.amount)
    }
    for (const [key, total] of sums.entries()) {
      const limit = this.budgets.get(key)
      if (limit !== undefined && total > limit) {
        // 어떤 집행이 초과했는지 기록 (마지막 집행을 예시)
        const related = all.filter((e) => `${e.agencyId}:${e.account}` === key)
        const lastExec = related[related.length - 1]
        if (lastExec) {
          anomalies.push({
            type: 'OVER_BUDGET',
            severity: 'HIGH',
            executionId: lastExec.executionId,
            detail: `계정 ${key} 합계 ${total} > 한도 ${limit}`,
          })
        }
      }
    }

    this.appendAudit('anomaly.detect', 'SYSTEM', {
      anomalyCount: anomalies.length,
    })
    return anomalies
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
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
