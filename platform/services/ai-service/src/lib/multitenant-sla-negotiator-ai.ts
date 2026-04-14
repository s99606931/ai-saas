// Design Ref: §R615 — AI기반 멀티테넌트 SLA 자동 협상
// Plan SC: SVC-AI-ADV-R615-SC01

export type SupportTier = 'BASIC' | 'STANDARD' | 'PREMIUM' | 'ENTERPRISE'
export type NegotiationStatus = 'PROPOSED' | 'COUNTER_PROPOSED' | 'AGREED' | 'REJECTED'

export interface TenantRequirement {
  tenantId: string
  name: string
  requestedAvailabilityPct: number  // e.g. 99.9
  requestedResponseTimeMs: number
  requestedSupportTier: SupportTier
  budget: number  // KRW/month
}

export interface SlaTerm {
  availabilityPct: number
  responseTimeMs: number
  supportTier: SupportTier
  monthlyFeeKrw: number
}

export interface NegotiationResult {
  tenantId: string
  name: string
  status: NegotiationStatus
  proposedTerm: SlaTerm
  counterTerm?: SlaTerm
  agreedTerm?: SlaTerm
  reason: string
}

export interface SlaContract {
  contractId: string
  tenantId: string
  name: string
  term: SlaTerm
  effectiveDate: string
  expiryDate: string
  createdAt: string
}

interface AuditEntry {
  timestamp: string
  action: string
  tenantId: string
  detail: Record<string, unknown>
}

const TIER_COST: Record<SupportTier, number> = {
  BASIC: 500_000,
  STANDARD: 1_500_000,
  PREMIUM: 3_000_000,
  ENTERPRISE: 8_000_000,
}

export class MultitenantSlaNegotiatorAI {
  private tenants = new Map<string, TenantRequirement>()
  private negotiations = new Map<string, NegotiationResult>()
  private auditLog: AuditEntry[] = []

  registerTenant(tenant: TenantRequirement): void {
    this.tenants.set(tenant.tenantId, tenant)
    this.appendAudit('tenant.register', tenant.tenantId, { name: tenant.name, budget: tenant.budget })
  }

  negotiate(tenantId: string): NegotiationResult {
    const tenant = this.tenants.get(tenantId)
    if (!tenant) throw new Error(`Unknown tenant: ${tenantId}`)

    const baseCost = TIER_COST[tenant.requestedSupportTier]
    const availabilityAdder = tenant.requestedAvailabilityPct >= 99.9 ? 1_000_000 : tenant.requestedAvailabilityPct >= 99.5 ? 500_000 : 0
    const proposedFee = baseCost + availabilityAdder

    const proposedTerm: SlaTerm = {
      availabilityPct: tenant.requestedAvailabilityPct,
      responseTimeMs: tenant.requestedResponseTimeMs,
      supportTier: tenant.requestedSupportTier,
      monthlyFeeKrw: proposedFee,
    }

    let result: NegotiationResult

    if (tenant.budget >= proposedFee) {
      result = {
        tenantId,
        name: tenant.name,
        status: 'AGREED',
        proposedTerm,
        agreedTerm: proposedTerm,
        reason: '예산 범위 내 SLA 조건 합의 완료',
      }
    } else {
      const reducedTier: SupportTier = tenant.requestedSupportTier === 'ENTERPRISE'
        ? 'PREMIUM'
        : tenant.requestedSupportTier === 'PREMIUM'
        ? 'STANDARD'
        : 'BASIC'

      const counterFee = TIER_COST[reducedTier] + (availabilityAdder * 0.5)
      const counterTerm: SlaTerm = {
        availabilityPct: Math.min(tenant.requestedAvailabilityPct, 99.5),
        responseTimeMs: tenant.requestedResponseTimeMs + 200,
        supportTier: reducedTier,
        monthlyFeeKrw: Math.round(counterFee),
      }

      if (tenant.budget >= counterTerm.monthlyFeeKrw) {
        result = {
          tenantId,
          name: tenant.name,
          status: 'COUNTER_PROPOSED',
          proposedTerm,
          counterTerm,
          agreedTerm: counterTerm,
          reason: `예산 초과 — ${reducedTier} 등급으로 역제안 합의`,
        }
      } else {
        result = {
          tenantId,
          name: tenant.name,
          status: 'REJECTED',
          proposedTerm,
          counterTerm,
          reason: '예산 부족으로 협상 결렬 — 예산 증액 후 재협상 필요',
        }
      }
    }

    this.negotiations.set(tenantId, result)
    this.appendAudit('sla.negotiate', tenantId, { status: result.status })
    return result
  }

  generateContract(tenantId: string): SlaContract {
    const result = this.negotiations.get(tenantId) ?? this.negotiate(tenantId)
    const agreedTerm = result.agreedTerm
    if (!agreedTerm || result.status === 'REJECTED') {
      throw new Error(`Tenant ${tenantId} SLA 협상 미합의 — 계약 생성 불가`)
    }

    const now = new Date()
    const expiry = new Date(now)
    expiry.setFullYear(expiry.getFullYear() + 1)

    const contract: SlaContract = {
      contractId: `CONTRACT-${tenantId}-${now.getTime()}`,
      tenantId,
      name: result.name,
      term: agreedTerm,
      effectiveDate: now.toISOString().split('T')[0] ?? now.toISOString(),
      expiryDate: expiry.toISOString().split('T')[0] ?? expiry.toISOString(),
      createdAt: now.toISOString(),
    }

    this.appendAudit('contract.generate', tenantId, { contractId: contract.contractId, supportTier: agreedTerm.supportTier })
    return contract
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }

  private appendAudit(action: string, tenantId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, tenantId, detail })
  }
}
