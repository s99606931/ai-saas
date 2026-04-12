/**
 * AI 기반 공공 데이터 품질 인증 — SVC-AI-ADV-R140
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R140/SVC-AI-ADV-R140.plan.md
 * Plan SC: FR-R140.1 ~ FR-R140.6
 *
 * 공공데이터 품질 기준 자동 검사 + 인증 등급 산출.
 * CSAP D-06 감사 로그, N2SF N-05 등급 guard 적용.
 */

export enum DataGrade { C = 'C', S = 'S', O = 'O' }

export type QualityDimension =
  | 'completeness'    // 완전성: 필수 필드 채움률
  | 'accuracy'        // 정확성: 형식/범위 오류율
  | 'consistency'     // 일관성: 중복/모순 비율
  | 'timeliness'      // 적시성: 최신 업데이트 기준
  | 'uniqueness'      // 유일성: 중복 키 비율

export interface DatasetProfile {
  id: string
  name: string
  totalRows: number
  grade: DataGrade
  dimensions: Record<QualityDimension, number>  // 0~100 score
  lastUpdatedDays: number  // days since last update
}

export interface QualityCheckResult {
  dimension: QualityDimension
  score: number
  passed: boolean
  issue?: string
}

export interface CertificationResult {
  datasetId: string
  datasetName: string
  certGrade: 'GOLD' | 'SILVER' | 'BRONZE' | 'FAIL'
  overallScore: number
  checks: QualityCheckResult[]
  certifiedAt: string
  validUntil: string   // 1 year from certifiedAt
  issues: string[]
}

export interface AuditEntry {
  timestamp: string
  action: string
  detail?: Record<string, unknown>
}

// Plan SC: FR-R140.2 — minimum thresholds per dimension (행안부 공공데이터 품질관리 기준)
const THRESHOLDS: Record<QualityDimension, number> = {
  completeness: 95,
  accuracy: 95,
  consistency: 90,
  timeliness: 80,
  uniqueness: 99,
}

const WEIGHTS: Record<QualityDimension, number> = {
  completeness: 0.25,
  accuracy: 0.30,
  consistency: 0.20,
  timeliness: 0.10,
  uniqueness: 0.15,
}

export class PublicDataQualityCertifier {
  private readonly datasets = new Map<string, DatasetProfile>()
  private readonly auditLog: AuditEntry[] = []

  getAuditLog(): readonly AuditEntry[] { return this.auditLog }

  private audit(action: string, detail?: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, ...(detail !== undefined ? { detail } : {}) })
  }

  // Plan SC: FR-R140.1
  registerDataset(profile: DatasetProfile): void {
    if (profile.grade === DataGrade.C || profile.grade === DataGrade.S) {
      throw new Error(`BLOCKED: ${profile.grade}등급 데이터셋 인증 금지 (N2SF N-05)`)
    }
    this.datasets.set(profile.id, profile)
    this.audit('registerDataset', { id: profile.id, name: profile.name })
  }

  // Plan SC: FR-R140.3
  private runChecks(profile: DatasetProfile): QualityCheckResult[] {
    const dimensions: QualityDimension[] = ['completeness', 'accuracy', 'consistency', 'timeliness', 'uniqueness']
    return dimensions.map(dim => {
      const score = profile.dimensions[dim]
      const threshold = THRESHOLDS[dim]
      const passed = score >= threshold
      let issue: string | undefined
      if (!passed) {
        issue = `${dim} 점수 ${score} < 임계값 ${threshold}`
      }
      // Special timeliness check
      if (dim === 'timeliness' && profile.lastUpdatedDays > 365) {
        return { dimension: dim, score: Math.min(score, 50), passed: false, issue: `최종 업데이트 ${profile.lastUpdatedDays}일 경과 (1년 초과)` }
      }
      return { dimension: dim, score, passed, ...(issue ? { issue } : {}) }
    })
  }

  // Plan SC: FR-R140.4 — weighted overall score
  private overallScore(checks: QualityCheckResult[]): number {
    return Math.round(
      checks.reduce((s, c) => s + c.score * WEIGHTS[c.dimension], 0)
    )
  }

  // Plan SC: FR-R140.5 — cert grade
  private certGrade(score: number, failedCount: number): CertificationResult['certGrade'] {
    if (failedCount > 0 && failedCount >= 2) return 'FAIL'
    if (score >= 95) return 'GOLD'
    if (score >= 85) return 'SILVER'
    if (score >= 70) return 'BRONZE'
    return 'FAIL'
  }

  // Plan SC: FR-R140.6
  certify(datasetId: string, now: Date = new Date()): CertificationResult {
    const profile = this.datasets.get(datasetId)
    if (!profile) throw new Error(`dataset not registered: ${datasetId}`)

    const checks = this.runChecks(profile)
    const overall = this.overallScore(checks)
    const failedChecks = checks.filter(c => !c.passed)
    const grade = this.certGrade(overall, failedChecks.length)
    const issues = failedChecks.map(c => c.issue!).filter(Boolean)

    const certifiedAt = now.toISOString()
    const validUntil = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()).toISOString()

    this.audit('certify', { datasetId, grade, score: overall })
    return {
      datasetId,
      datasetName: profile.name,
      certGrade: grade,
      overallScore: overall,
      checks,
      certifiedAt,
      validUntil,
      issues,
    }
  }
}
