// Design Ref: §R227 — AI기반 데이터 거버넌스 자동화
// Plan SC: SVC-AI-ADV-R227-SC01

export type DataClassification = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'SECRET'
export type RetentionPolicy = '1Y' | '3Y' | '5Y' | '10Y' | 'PERMANENT'
export type ComplianceStatus = 'COMPLIANT' | 'NON_COMPLIANT' | 'NEEDS_REVIEW'

export interface DataAsset {
  assetId: string
  name: string
  owner: string
  classification: DataClassification
  retentionPolicy: RetentionPolicy
  containsPII: boolean
  lastAccessedAt: string
  createdAt: string
}

export interface GovernanceAssessment {
  assetId: string
  complianceStatus: ComplianceStatus
  violations: string[]
  recommendations: string[]
  retentionExpiry?: string
  assessedAt: string
}

interface AuditEntry {
  timestamp: string
  action: string
  assetId: string
  detail: Record<string, unknown>
}

const RETENTION_YEARS: Record<RetentionPolicy, number> = {
  '1Y': 1, '3Y': 3, '5Y': 5, '10Y': 10, PERMANENT: 9999,
}

export class DataGovernanceAutomatorAI {
  private assets = new Map<string, DataAsset>()
  private auditLog: AuditEntry[] = []

  registerAsset(asset: DataAsset): void {
    this.assets.set(asset.assetId, asset)
    this.appendAudit('asset.register', asset.assetId, { classification: asset.classification })
  }

  assess(assetId: string): GovernanceAssessment {
    const asset = this.assets.get(assetId)
    if (!asset) throw new Error(`Unknown asset: ${assetId}`)

    const violations: string[] = []
    const recommendations: string[] = []

    // PII 포함 데이터 분류 검사
    if (asset.containsPII && asset.classification === 'PUBLIC') {
      violations.push('PII 포함 데이터가 PUBLIC으로 분류됨 — 개인정보보호법 위반 위험')
      recommendations.push('데이터 분류를 CONFIDENTIAL 이상으로 변경 필요')
    }

    // 보존 기간 계산
    const createdDate = new Date(asset.createdAt)
    const retentionYears = RETENTION_YEARS[asset.retentionPolicy]
    const expiryDate = new Date(createdDate)
    expiryDate.setFullYear(expiryDate.getFullYear() + retentionYears)
    const retentionExpiry = retentionYears < 9999 ? expiryDate.toISOString().split('T')[0] : undefined

    // 만료 여부 확인 — grace period(2년) 초과 시 위반으로 처리
    const now = new Date()
    if (retentionExpiry) {
      const expiryMs = new Date(retentionExpiry).getTime()
      const graceMs = 2 * 365 * 24 * 60 * 60 * 1000  // 2년 grace period
      if (expiryMs < now.getTime() - graceMs) {
        violations.push(`보존 기간 만료 (${retentionExpiry}) — 삭제 또는 보존 연장 필요`)
        recommendations.push('법적 보존 요건 검토 후 데이터 삭제 또는 보존 정책 갱신')
      } else if (expiryMs < now.getTime()) {
        recommendations.push(`보존 기간 만료 (${retentionExpiry}) — 삭제 또는 보존 정책 갱신 검토 필요`)
      }
    }

    // 미접근 데이터 확인 (1년 이상)
    const lastAccessed = new Date(asset.lastAccessedAt)
    const daysSinceAccess = (now.getTime() - lastAccessed.getTime()) / (1000 * 60 * 60 * 24)
    if (daysSinceAccess > 365) {
      recommendations.push(`장기 미접근 데이터 (${Math.floor(daysSinceAccess)}일) — 데이터 가치 재평가 권장`)
    }

    const complianceStatus: ComplianceStatus =
      violations.length === 0 ? 'COMPLIANT'
        : violations.some((v) => v.includes('개인정보보호법') || v.includes('만료')) ? 'NON_COMPLIANT'
        : 'NEEDS_REVIEW'

    this.appendAudit('asset.assess', assetId, { complianceStatus, violations: violations.length })

    return { assetId, complianceStatus, violations, recommendations, retentionExpiry, assessedAt: new Date().toISOString() }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, assetId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, assetId, detail })
  }
}
