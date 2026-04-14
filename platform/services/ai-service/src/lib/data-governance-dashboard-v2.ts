// Design Ref: §고위험 자산 — DataGovernanceDashboardV2
// Plan SC: SVC-AI-ADV-R499

import { createHash } from 'crypto'

type IssueSeverity = 'high' | 'medium' | 'low'
type DataGradeClass = 'C' | 'S' | 'O'

interface DataAsset {
  assetId: string
  name: string
  owner: string
  dataGrade: DataGradeClass
}

interface GovernanceIssue {
  assetId: string
  issueType: string
  severity: IssueSeverity
}

interface AuditEntry {
  timestamp: string
  action: string
  assetId: string
  maskedAssetId?: string
  details?: Record<string, unknown>
}

export class DataGovernanceDashboardV2 {
  private assets = new Map<string, DataAsset>()
  private issues: GovernanceIssue[] = []
  private auditLog: AuditEntry[] = []

  registerAsset(
    assetId: string,
    name: string,
    owner: string,
    dataGrade: DataGradeClass
  ): DataAsset {
    const asset: DataAsset = { assetId, name, owner, dataGrade }
    this.assets.set(assetId, asset)
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_ASSET',
      assetId,
      details: { name, owner, dataGrade },
    })
    return asset
  }

  recordIssue(
    assetId: string,
    issueType: string,
    severity: IssueSeverity,
    dataGrade?: string
  ): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
    if (!this.assets.has(assetId)) throw new Error(`자산을 찾을 수 없습니다: ${assetId}`)
    this.issues.push({ assetId, issueType, severity })
    const maskedAssetId = createHash('sha256').update(assetId).digest('hex').substring(0, 16)
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'RECORD_ISSUE',
      assetId,
      maskedAssetId,
      details: { issueType, severity },
    })
  }

  getIssueCount(assetId: string): number {
    return this.issues.filter((i) => i.assetId === assetId).length
  }

  getHighRiskAssets(): DataAsset[] {
    return Array.from(this.assets.values()).filter((asset) =>
      this.issues.some((i) => i.assetId === asset.assetId && i.severity === 'high')
    )
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
