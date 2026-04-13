// Design Ref: §R333 — AI기반 실시간 서비스 가격 최적화
// Plan SC: SC-R333

export interface ServicePricingConfig {
  serviceId: string
  name: string
  basePricePerUnit: number
  minPrice: number
  maxPrice: number
  dataGrade: 'O' | 'S' | 'C'
}

export interface DemandMetric {
  serviceId: string
  timestamp: number
  currentLoad: number
  maxCapacity: number
  queueDepth: number
  competitorPrice?: number
}

export interface PricingDecision {
  serviceId: string
  currentPrice: number
  recommendedPrice: number
  adjustmentPercent: number
  reason: string
  strategy: 'SURGE' | 'DISCOUNT' | 'STABLE'
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class RealtimePricingOptimizerAi {
  private configs = new Map<string, ServicePricingConfig>()
  private currentPrices = new Map<string, number>()
  private auditLog: AuditEntry[] = []

  registerService(config: ServicePricingConfig): void {
    // N2SF: C/S 등급 가격 데이터는 외부 AI 분석 불가
    if (config.dataGrade === 'C' || config.dataGrade === 'S') {
      throw new Error(`BLOCKED: ${config.dataGrade}등급 서비스 외부 가격 분석 금지 (N2SF N-05)`)
    }
    this.configs.set(config.serviceId, config)
    this.currentPrices.set(config.serviceId, config.basePricePerUnit)
    this.auditLog.push({ action: 'service.register', timestamp: new Date().toISOString(), detail: config.serviceId })
  }

  optimize(metric: DemandMetric): PricingDecision {
    const config = this.configs.get(metric.serviceId)
    if (!config) throw new Error(`Service not found: ${metric.serviceId}`)

    const currentPrice = this.currentPrices.get(metric.serviceId) ?? config.basePricePerUnit
    const loadRatio = metric.currentLoad / Math.max(metric.maxCapacity, 1)

    let recommendedPrice = currentPrice
    let strategy: PricingDecision['strategy'] = 'STABLE'
    let reason = '수요 안정 — 가격 유지'

    if (loadRatio >= 0.9 || metric.queueDepth > 100) {
      // 급등 가격
      recommendedPrice = currentPrice * 1.2
      strategy = 'SURGE'
      reason = `부하율 ${(loadRatio * 100).toFixed(0)}% 초과 — 급등 가격 적용`
    } else if (loadRatio < 0.3 && metric.queueDepth === 0) {
      // 할인 가격
      recommendedPrice = currentPrice * 0.85
      strategy = 'DISCOUNT'
      reason = `부하율 ${(loadRatio * 100).toFixed(0)}% 저조 — 수요 유도 할인`
    } else if (metric.competitorPrice !== undefined && metric.competitorPrice < currentPrice * 0.9) {
      recommendedPrice = metric.competitorPrice * 0.98
      strategy = 'DISCOUNT'
      reason = `경쟁사 가격(${metric.competitorPrice}) 대비 인하`
    }

    // 범위 제한
    recommendedPrice = Math.max(config.minPrice, Math.min(config.maxPrice, recommendedPrice))
    recommendedPrice = Math.round(recommendedPrice * 100) / 100
    const adjustmentPercent = Math.round(((recommendedPrice - currentPrice) / currentPrice) * 100)

    this.currentPrices.set(metric.serviceId, recommendedPrice)
    this.auditLog.push({ action: 'pricing.optimize', timestamp: new Date().toISOString(), detail: `${metric.serviceId}:${strategy}` })
    return { serviceId: metric.serviceId, currentPrice, recommendedPrice, adjustmentPercent, reason, strategy }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
