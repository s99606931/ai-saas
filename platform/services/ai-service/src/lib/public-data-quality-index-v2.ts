// Design Ref: §R463 — AI기반 공공 데이터 품질 지수 산출 v2
// Plan SC: SVC-AI-ADV-R463-SC01

export type QualityDimension = 'COMPLETENESS' | 'ACCURACY' | 'CONSISTENCY' | 'TIMELINESS' | 'UNIQUENESS'
export type QualityGrade = 'A' | 'B' | 'C' | 'D' | 'F'
export type DataGrade = 'C' | 'S' | 'O'

export interface DataQualityProfile {
  datasetId: string
  name: string
  grade: DataGrade
  totalRecords: number
  missingValueRate: number     // 0..1
  duplicateRate: number        // 0..1
  formatErrorRate: number      // 0..1
  lastUpdatedDaysAgo: number
  consistencyScore: number     // 0..1 (외부 검증 기준)
}

export interface DataQualityIndexResult {
  datasetId: string
  overallScore: number    // 0..100
  qualityGrade: QualityGrade
  dimensionScores: Record<QualityDimension, number>
  issues: string[]
  recommendations: string[]
}

interface AuditEntry {
  timestamp: string
  action: string
  datasetId: string
  detail: Record<string, unknown>
}

// 차원별 가중치 합 = 1.0
const DIMENSION_WEIGHTS: Record<QualityDimension, number> = {
  COMPLETENESS: 0.3,
  ACCURACY: 0.25,
  CONSISTENCY: 0.2,
  TIMELINESS: 0.15,
  UNIQUENESS: 0.1,
}

export class PublicDataQualityIndexV2 {
  private profiles = new Map<string, DataQualityProfile>()
  private auditLog: AuditEntry[] = []

  registerProfile(profile: DataQualityProfile): void {
    // N2SF C/S 등급 차단
    if (profile.grade === 'C' || profile.grade === 'S') {
      throw new Error(`BLOCKED: ${profile.grade}등급 데이터는 AI 품질 분석 금지 (N2SF N-05)`)
    }
    this.profiles.set(profile.datasetId, profile)
    this.appendAudit('profile.register', profile.datasetId, { name: profile.name, records: profile.totalRecords })
  }

  calculate(datasetId: string): DataQualityIndexResult {
    const profile = this.profiles.get(datasetId)
    if (!profile) throw new Error(`Unknown dataset: ${datasetId}`)

    this.appendAudit('quality.calculate', datasetId, { records: profile.totalRecords })

    const issues: string[] = []
    const recommendations: string[] = []

    // 차원별 점수 계산
    const completeness = Math.round((1 - profile.missingValueRate) * 100)
    const uniqueness = Math.round((1 - profile.duplicateRate) * 100)
    const accuracy = Math.round((1 - profile.formatErrorRate) * 100)
    const consistency = Math.round(profile.consistencyScore * 100)

    // 적시성: 30일 이내 → 100, 90일 이내 → 70, 180일 이내 → 40, 초과 → 10
    const timeliness =
      profile.lastUpdatedDaysAgo <= 30 ? 100
        : profile.lastUpdatedDaysAgo <= 90 ? 70
        : profile.lastUpdatedDaysAgo <= 180 ? 40
        : 10

    const dimensionScores: Record<QualityDimension, number> = {
      COMPLETENESS: completeness,
      ACCURACY: accuracy,
      CONSISTENCY: consistency,
      TIMELINESS: timeliness,
      UNIQUENESS: uniqueness,
    }

    // 가중 합산 점수
    const overallScore = Math.round(
      Object.entries(dimensionScores).reduce((sum, [dim, score]) => {
        return sum + score * (DIMENSION_WEIGHTS[dim as QualityDimension] ?? 0)
      }, 0),
    )

    // 이슈 탐지
    if (profile.missingValueRate > 0.1) {
      issues.push(`결측값 비율 ${(profile.missingValueRate * 100).toFixed(0)}% 높음`)
      recommendations.push('결측값 보완 정책 수립 — 필수 필드 입력 강제화')
    }
    if (profile.duplicateRate > 0.05) {
      issues.push(`중복 레코드 ${(profile.duplicateRate * 100).toFixed(0)}% 탐지`)
      recommendations.push('중복 제거 파이프라인 구축')
    }
    if (profile.formatErrorRate > 0.05) {
      issues.push(`형식 오류율 ${(profile.formatErrorRate * 100).toFixed(0)}% 높음`)
      recommendations.push('입력 데이터 형식 검증 강화')
    }
    if (timeliness < 70) {
      issues.push(`최종 업데이트 ${profile.lastUpdatedDaysAgo}일 경과 — 적시성 저하`)
      recommendations.push('데이터 갱신 주기 단축 — 자동화 파이프라인 도입')
    }

    const qualityGrade: QualityGrade =
      overallScore >= 90 ? 'A'
        : overallScore >= 75 ? 'B'
        : overallScore >= 60 ? 'C'
        : overallScore >= 40 ? 'D'
        : 'F'

    return { datasetId, overallScore, qualityGrade, dimensionScores, issues, recommendations }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, datasetId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, datasetId, detail })
  }
}
