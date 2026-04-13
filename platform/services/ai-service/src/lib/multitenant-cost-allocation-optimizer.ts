// Plan SC: SVC-AI-ADV-R441
// Design Ref: §비용배분공식 — 사용량 비례로 totalCost 배분
type DataGrade = 'O' | 'C' | 'S'

interface UsageRecord {
  tenantId: string
  resourceType: string
  usageAmount: number
}

interface CostBreakdown {
  tenantId: string
  usageAmount: number
  allocatedCost: number
  ratio: number
}

interface AuditEntry {
  action: string
  detail: string
  timestamp: string
}

export class MultitenantCostAllocationOptimizer {
  private usageRecords: UsageRecord[] = []
  private auditLog: AuditEntry[] = []

  private checkGrade(grade?: DataGrade): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
  }

  private log(action: string, detail: string): void {
    this.auditLog.push({ action, detail, timestamp: new Date().toISOString() })
  }

  addUsage(
    tenantId: string,
    resourceType: string,
    usageAmount: number,
    dataGrade?: DataGrade,
  ): void {
    this.checkGrade(dataGrade)
    this.usageRecords.push({ tenantId, resourceType, usageAmount })
    this.log('usage.add', `tenantId=${tenantId} resourceType=${resourceType} amount=${usageAmount}`)
  }

  getCostBreakdown(totalCost: number): CostBreakdown[] {
    const tenantUsage = new Map<string, number>()
    for (const r of this.usageRecords) {
      tenantUsage.set(r.tenantId, (tenantUsage.get(r.tenantId) ?? 0) + r.usageAmount)
    }
    const totalUsage = Array.from(tenantUsage.values()).reduce((s, v) => s + v, 0)
    if (totalUsage === 0) return []
    return Array.from(tenantUsage.entries()).map(([tenantId, usage]) => ({
      tenantId,
      usageAmount: usage,
      allocatedCost: (usage / totalUsage) * totalCost,
      ratio: (usage / totalUsage) * 100,
    }))
  }

  getOverBudgetTenants(totalCost: number, threshold: number): CostBreakdown[] {
    return this.getCostBreakdown(totalCost).filter((b) => b.allocatedCost > threshold)
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
