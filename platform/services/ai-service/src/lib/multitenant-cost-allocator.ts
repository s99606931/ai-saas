/**
 * Multitenant Cost Allocator — SVC-AI-ADV-R149 (트랙 B 3차)
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R146-R153-trackB/SVC-AI-ADV-R149.design.md
 * Plan SC: FR-R149.1 ~ FR-R149.5
 *
 * 테넌트별 실제 자원 사용량 추적 → 공정 비용 배분 계산.
 * 순수 계산 — 외부 API 없음.
 */

// Design Ref: §2 — 타입 정의

export type ResourceType = 'cpu' | 'memory' | 'storage' | 'api_call'
export type TenantTier = 'basic' | 'standard' | 'premium'

export interface Tenant {
  tenantId: string
  name: string
  tier: TenantTier
}

export interface UsageRecord {
  tenantId: string
  resource: ResourceType
  amount: number
  timestamp: number
}

export interface LineItem {
  resource: ResourceType
  amount: number
  unitPrice: number
  cost: number
}

export interface Invoice {
  tenantId: string
  period: string
  lineItems: LineItem[]
  subtotal: number
  minimumFee: number
  total: number
  generatedAt: string
}

export interface AuditEntry {
  timestamp: string
  action: string
  tenantId: string
  detail: Record<string, unknown>
}

// Design Ref: §3.1 단가 (원/단위)
const UNIT_PRICES: Record<ResourceType, number> = {
  cpu: 50,         // 원/core-hour
  memory: 10,      // 원/GB-hour
  storage: 1,      // 원/GB-day
  api_call: 0.1,   // 원/call
}

// Design Ref: §3.2 tier 할인율
const TIER_DISCOUNTS: Record<TenantTier, number> = {
  basic: 0,
  standard: 0.1,
  premium: 0.2,
}

// Design Ref: §3.3 최소 요금
const MINIMUM_FEES: Record<TenantTier, number> = {
  basic: 10000,
  standard: 50000,
  premium: 200000,
}

export class MultitenantCostAllocator {
  private readonly tenants = new Map<string, Tenant>()
  private readonly usageRecords: UsageRecord[] = []
  private readonly auditLog: AuditEntry[] = []

  // Plan SC: FR-R149.1
  registerTenant(tenant: Tenant): void {
    this.tenants.set(tenant.tenantId, { ...tenant })
  }

  // Plan SC: FR-R149.2
  recordUsage(tenantId: string, resource: ResourceType, amount: number, timestamp: number): void {
    if (!this.tenants.has(tenantId)) throw new Error(`Unknown tenant: ${tenantId}`)
    if (amount < 0) throw new Error('amount must be non-negative')
    this.usageRecords.push({ tenantId, resource, amount, timestamp })
  }

  // Plan SC: FR-R149.3 — Design Ref: §3.1~§3.3
  calculateCost(tenantId: string, period: { from: number; to: number }): Invoice {
    const tenant = this.tenants.get(tenantId)
    if (!tenant) throw new Error(`Unknown tenant: ${tenantId}`)

    const records = this.usageRecords.filter(
      (r) => r.tenantId === tenantId && r.timestamp >= period.from && r.timestamp <= period.to,
    )

    const byResource = new Map<ResourceType, number>()
    for (const r of records) {
      byResource.set(r.resource, (byResource.get(r.resource) ?? 0) + r.amount)
    }

    const discount = TIER_DISCOUNTS[tenant.tier]
    const lineItems: LineItem[] = []
    for (const [resource, amount] of byResource.entries()) {
      const unitPrice = UNIT_PRICES[resource] * (1 - discount)
      lineItems.push({ resource, amount, unitPrice, cost: amount * unitPrice })
    }

    const subtotal = lineItems.reduce((sum, l) => sum + l.cost, 0)
    const minimumFee = MINIMUM_FEES[tenant.tier]
    const total = Math.max(subtotal, minimumFee)

    const periodStr = `${new Date(period.from).toISOString().slice(0, 10)}~${new Date(period.to).toISOString().slice(0, 10)}`
    this.appendAudit('cost.calculate', tenantId, { subtotal, total })

    return {
      tenantId,
      period: periodStr,
      lineItems,
      subtotal,
      minimumFee,
      total,
      generatedAt: new Date().toISOString(),
    }
  }

  // Plan SC: FR-R149.4
  generateInvoice(tenantId: string, period: { from: number; to: number }): Invoice {
    const invoice = this.calculateCost(tenantId, period)
    this.appendAudit('invoice.generate', tenantId, { total: invoice.total })
    return invoice
  }

  // Plan SC: FR-R149.5 — CSAP D-06
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, tenantId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, tenantId, detail })
  }
}
