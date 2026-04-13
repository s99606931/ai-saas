// Design Ref: §R356 — AI기반 자동 SaaS 구독 최적화
// Plan SC: SC-R356

export interface SaasSubscription {
  subscriptionId: string
  orgId: string
  serviceName: string
  tier: 'FREE' | 'BASIC' | 'STANDARD' | 'PREMIUM'
  monthlyFee: number
  contractedUsers: number
  features: string[]
}

export interface SubscriptionUsage {
  subscriptionId: string
  month: string
  activeUsers: number
  featuresUsed: string[]
  storageUsedGb: number
  apiCallCount: number
}

export type OptimizationAction = 'DOWNGRADE' | 'UPGRADE' | 'MAINTAIN' | 'CONSOLIDATE'

export interface SubscriptionOptimizationReport {
  subscriptionId: string
  orgId: string
  currentTier: SaasSubscription['tier']
  recommendedAction: OptimizationAction
  estimatedMonthlySaving: number
  utilizationRate: number
  reasoning: string
  recommendations: string[]
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class SaasSubscriptionOptimizerAi {
  private subscriptions = new Map<string, SaasSubscription>()
  private usages = new Map<string, SubscriptionUsage[]>()
  private auditLog: AuditEntry[] = []

  registerSubscription(subscription: SaasSubscription): void {
    this.subscriptions.set(subscription.subscriptionId, subscription)
    this.usages.set(subscription.subscriptionId, [])
    this.auditLog.push({ action: 'subscription.register', timestamp: new Date().toISOString(), detail: subscription.subscriptionId })
  }

  recordUsage(usage: SubscriptionUsage): void {
    if (!this.subscriptions.has(usage.subscriptionId)) throw new Error(`Subscription not found: ${usage.subscriptionId}`)
    this.usages.get(usage.subscriptionId)!.push(usage)
    this.auditLog.push({ action: 'usage.record', timestamp: new Date().toISOString(), detail: usage.subscriptionId })
  }

  optimize(subscriptionId: string): SubscriptionOptimizationReport {
    const sub = this.subscriptions.get(subscriptionId)
    if (!sub) throw new Error(`Subscription not found: ${subscriptionId}`)

    const recs = this.usages.get(subscriptionId) ?? []
    const latest = recs[recs.length - 1]

    const activeUsers = latest?.activeUsers ?? 0
    const utilizationRate = sub.contractedUsers > 0 ? activeUsers / sub.contractedUsers : 0

    let recommendedAction: OptimizationAction
    let estimatedMonthlySaving = 0
    let reasoning: string
    const recommendations: string[] = []

    if (utilizationRate < 0.5 && sub.tier !== 'FREE') {
      recommendedAction = 'DOWNGRADE'
      estimatedMonthlySaving = Math.round(sub.monthlyFee * 0.3)
      reasoning = `사용률 ${Math.round(utilizationRate * 100)}% — 계약 사용자 50% 미만`
      recommendations.push(`현재 ${sub.tier} → 하위 티어 다운그레이드로 월 ${estimatedMonthlySaving}원 절감 가능`)
    } else if (utilizationRate >= 0.9) {
      recommendedAction = 'UPGRADE'
      estimatedMonthlySaving = 0
      reasoning = `사용률 ${Math.round(utilizationRate * 100)}% — 추가 용량 필요`
      recommendations.push('사용자 한도 근접 — 상위 티어 업그레이드 또는 좌석 추가 검토')
    } else {
      recommendedAction = 'MAINTAIN'
      reasoning = `사용률 ${Math.round(utilizationRate * 100)}% — 현재 구독 적정`
    }

    this.auditLog.push({ action: 'subscription.optimize', timestamp: new Date().toISOString(), detail: `${subscriptionId}:${recommendedAction}` })
    return { subscriptionId, orgId: sub.orgId, currentTier: sub.tier, recommendedAction, estimatedMonthlySaving, utilizationRate: Math.round(utilizationRate * 100) / 100, reasoning, recommendations }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
