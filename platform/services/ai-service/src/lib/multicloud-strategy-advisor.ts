/**
 * 멀티클라우드 전략 추천 AI — SVC-AI-ADV-R129
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R129/SVC-AI-ADV-R129.design.md
 * Plan SC: FR-R129.1 ~ FR-R129.6
 *
 * 워크로드 특성 분석 → 최적 클라우드/온프레미스 배치 추천.
 * CSAP D-06 감사 로그, N2SF N-05 등급 guard 적용.
 */

export enum DataGrade { C = 'C', S = 'S', O = 'O' }

export type CloudProvider = 'on-premise' | 'ncp' | 'ktncloud' | 'aws' | 'gcp' | 'azure'
export type WorkloadType = 'stateless' | 'stateful' | 'batch' | 'streaming' | 'ml-training' | 'web-frontend'

export interface WorkloadProfile {
  id: string
  name: string
  type: WorkloadType
  grade: DataGrade
  cpuCores: number
  memoryGiB: number
  storageGiB: number
  networkGbpsEgress: number
  availabilityRequirement: 'best-effort' | '99.9' | '99.99' | '99.999'
  dataResidencyRequired: boolean   // 공공기관 국내 데이터 보관 의무
  csapComplianceRequired: boolean
  monthlyCostBudgetKrw: number
}

export interface CloudOption {
  provider: CloudProvider
  region: string
  estimatedMonthlyCostKrw: number
  availabilitySla: string
  dataResidencyCompliant: boolean
  csapCertified: boolean
  pros: string[]
  cons: string[]
}

export interface PlacementRecommendation {
  workloadId: string
  recommendedProvider: CloudProvider
  alternativeProviders: CloudProvider[]
  reasoning: string
  estimatedMonthlyCostKrw: number
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  options: CloudOption[]
}

export interface StrategyReport {
  generatedAt: string
  workloadCount: number
  recommendations: PlacementRecommendation[]
  totalEstimatedMonthlyCostKrw: number
  hybridRatio: number  // % of workloads using cloud (vs on-premise)
}

export interface AuditEntry {
  timestamp: string
  action: string
  detail?: Record<string, unknown>
}

// Plan SC: FR-R129.2 — cost model (simplified KRW/month)
function estimateCost(provider: CloudProvider, profile: WorkloadProfile): number {
  const base: Record<CloudProvider, number> = {
    'on-premise': 0,
    'ncp': 150_000,
    'ktncloud': 140_000,
    'aws': 200_000,
    'gcp': 190_000,
    'azure': 195_000,
  }
  const cpuCost = profile.cpuCores * 20_000
  const memCost = profile.memoryGiB * 8_000
  const storageCost = profile.storageGiB * 200
  const netCost = profile.networkGbpsEgress * 50_000
  return base[provider] + cpuCost + memCost + storageCost + netCost
}

const CLOUD_META: Record<CloudProvider, { dataResidency: boolean; csap: boolean; sla: string }> = {
  'on-premise': { dataResidency: true, csap: true, sla: '99.9' },
  'ncp': { dataResidency: true, csap: true, sla: '99.9' },
  'ktncloud': { dataResidency: true, csap: true, sla: '99.9' },
  'aws': { dataResidency: false, csap: false, sla: '99.99' },
  'gcp': { dataResidency: false, csap: false, sla: '99.99' },
  'azure': { dataResidency: false, csap: false, sla: '99.99' },
}

export class MulticloudStrategyAdvisor {
  private readonly workloads = new Map<string, WorkloadProfile>()
  private readonly auditLog: AuditEntry[] = []

  getAuditLog(): readonly AuditEntry[] {
    return this.auditLog
  }

  private audit(action: string, detail?: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, ...(detail !== undefined ? { detail } : {}) })
  }

  // Plan SC: FR-R129.1
  registerWorkload(profile: WorkloadProfile): void {
    if (profile.grade === DataGrade.C || profile.grade === DataGrade.S) {
      throw new Error(`BLOCKED: ${profile.grade}등급 워크로드 분석 금지 (N2SF N-05)`)
    }
    this.workloads.set(profile.id, profile)
    this.audit('registerWorkload', { id: profile.id, type: profile.type })
  }

  // Plan SC: FR-R129.3 — filter and rank eligible providers
  private eligibleProviders(profile: WorkloadProfile): CloudProvider[] {
    const all: CloudProvider[] = ['on-premise', 'ncp', 'ktncloud', 'aws', 'gcp', 'azure']
    return all.filter(p => {
      const meta = CLOUD_META[p]
      if (profile.dataResidencyRequired && !meta.dataResidency) return false
      if (profile.csapComplianceRequired && !meta.csap) return false
      const cost = estimateCost(p, profile)
      if (cost > profile.monthlyCostBudgetKrw * 1.2) return false
      return true
    })
  }

  private buildOption(provider: CloudProvider, profile: WorkloadProfile): CloudOption {
    const meta = CLOUD_META[provider]
    const cost = estimateCost(provider, profile)
    const pros: string[] = []
    const cons: string[] = []

    if (provider === 'on-premise') {
      pros.push('최대 보안 통제', '데이터 주권 완전 확보')
      cons.push('초기 투자 비용', '확장성 제한')
    } else if (provider === 'ncp' || provider === 'ktncloud') {
      pros.push('국내 데이터 센터', 'CSAP 인증', '공공기관 레퍼런스')
      cons.push('글로벌 리전 제한')
    } else {
      pros.push('글로벌 인프라', '높은 가용성', '다양한 관리형 서비스')
      cons.push('국내 데이터 상주 미보장', 'CSAP 미인증')
    }

    return {
      provider,
      region: provider === 'on-premise' ? 'local' : 'kr-1',
      estimatedMonthlyCostKrw: cost,
      availabilitySla: meta.sla,
      dataResidencyCompliant: meta.dataResidency,
      csapCertified: meta.csap,
      pros,
      cons,
    }
  }

  // Plan SC: FR-R129.4
  recommend(workloadId: string): PlacementRecommendation {
    const profile = this.workloads.get(workloadId)
    if (!profile) throw new Error(`workload not found: ${workloadId}`)

    const eligible = this.eligibleProviders(profile)
    if (eligible.length === 0) {
      throw new Error(`no eligible provider for workload: ${workloadId}`)
    }

    const options = eligible.map(p => this.buildOption(p, profile))
    options.sort((a, b) => a.estimatedMonthlyCostKrw - b.estimatedMonthlyCostKrw)

    const best = options[0]!
    const alternatives = options.slice(1).map(o => o.provider)

    const reasoning = `워크로드 유형=${profile.type}, CSAP필요=${profile.csapComplianceRequired}, 국내상주=${profile.dataResidencyRequired}. ${best.provider} 선정: 비용${best.estimatedMonthlyCostKrw.toLocaleString()}원/월`
    const riskLevel: PlacementRecommendation['riskLevel'] =
      profile.availabilityRequirement === '99.999' ? 'HIGH'
      : profile.availabilityRequirement === '99.99' ? 'MEDIUM'
      : 'LOW'

    this.audit('recommend', { workloadId, recommended: best.provider, cost: best.estimatedMonthlyCostKrw })
    return {
      workloadId,
      recommendedProvider: best.provider,
      alternativeProviders: alternatives,
      reasoning,
      estimatedMonthlyCostKrw: best.estimatedMonthlyCostKrw,
      riskLevel,
      options,
    }
  }

  // Plan SC: FR-R129.5, FR-R129.6
  generateStrategy(): StrategyReport {
    const recommendations = [...this.workloads.keys()].map(id => this.recommend(id))
    const totalEstimatedMonthlyCostKrw = recommendations.reduce((s, r) => s + r.estimatedMonthlyCostKrw, 0)
    const cloudCount = recommendations.filter(r => r.recommendedProvider !== 'on-premise').length
    const hybridRatio = recommendations.length > 0
      ? Math.round((cloudCount / recommendations.length) * 100)
      : 0
    this.audit('generateStrategy', { workloadCount: recommendations.length, totalEstimatedMonthlyCostKrw })
    return {
      generatedAt: new Date().toISOString(),
      workloadCount: recommendations.length,
      recommendations,
      totalEstimatedMonthlyCostKrw,
      hybridRatio,
    }
  }
}
