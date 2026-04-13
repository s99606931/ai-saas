// Design Ref: §R313 — AI기반 디지털 전환 평가
// Plan SC: SC-R313

export interface DtDimension {
  dimensionId: string
  name: string
  weight: number
}

export interface DtAssessmentInput {
  orgId: string
  orgName: string
  scores: { dimensionId: string; score: number }[]
}

export type DtMaturityLevel = 'INITIAL' | 'DEVELOPING' | 'DEFINED' | 'MANAGED' | 'OPTIMIZING'

export interface DtAssessmentResult {
  orgId: string
  overallScore: number
  maturityLevel: DtMaturityLevel
  dimensionResults: { dimensionId: string; name: string; score: number; status: 'STRONG' | 'ADEQUATE' | 'WEAK' }[]
  gaps: string[]
  recommendations: string[]
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class DigitalTransformationAssessorAi {
  private dimensions = new Map<string, DtDimension>()
  private auditLog: AuditEntry[] = []

  registerDimension(dimension: DtDimension): void {
    this.dimensions.set(dimension.dimensionId, dimension)
    this.auditLog.push({ action: 'dimension.register', timestamp: new Date().toISOString(), detail: dimension.dimensionId })
  }

  assess(input: DtAssessmentInput): DtAssessmentResult {
    const scoreMap = new Map(input.scores.map((s) => [s.dimensionId, s.score]))
    const dimensionResults: DtAssessmentResult['dimensionResults'] = []
    const gaps: string[] = []
    const recommendations: string[] = []
    let totalWeight = 0
    let weightedSum = 0

    for (const dim of this.dimensions.values()) {
      const score = scoreMap.get(dim.dimensionId) ?? 0
      const status: 'STRONG' | 'ADEQUATE' | 'WEAK' = score >= 80 ? 'STRONG' : score >= 60 ? 'ADEQUATE' : 'WEAK'
      dimensionResults.push({ dimensionId: dim.dimensionId, name: dim.name, score, status })
      totalWeight += dim.weight
      weightedSum += score * dim.weight
      if (status === 'WEAK') {
        gaps.push(dim.name)
        recommendations.push(`${dim.name} 역량 강화 필요 (현재 ${score}점)`)
      }
    }

    const overallScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0
    let maturityLevel: DtMaturityLevel
    if (overallScore >= 90) maturityLevel = 'OPTIMIZING'
    else if (overallScore >= 75) maturityLevel = 'MANAGED'
    else if (overallScore >= 60) maturityLevel = 'DEFINED'
    else if (overallScore >= 40) maturityLevel = 'DEVELOPING'
    else maturityLevel = 'INITIAL'

    this.auditLog.push({ action: 'dt.assess', timestamp: new Date().toISOString(), detail: `${input.orgId}:${maturityLevel}` })
    return { orgId: input.orgId, overallScore, maturityLevel, dimensionResults, gaps, recommendations }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
