// Design Ref: §R303 — AI기반 공공 데이터 수명 주기 관리
// Plan SC: SC-R303

export interface PublicDataset {
  datasetId: string
  name: string
  dataGrade: 'O' | 'S' | 'C'
  createdAt: string
  lastAccessedAt: string
  retentionPolicyDays: number
  sizeGb: number
  accessCountLast90Days: number
  legalHold: boolean
}

export type LifecycleStage = 'ACTIVE' | 'DORMANT' | 'ARCHIVAL' | 'DELETION_PENDING' | 'DELETED'

export interface LifecycleDecision {
  datasetId: string
  currentStage: LifecycleStage
  recommendedAction: 'RETAIN' | 'ARCHIVE' | 'DELETE' | 'LEGAL_HOLD'
  retentionExpiryDate: string
  daysUntilExpiry: number
  recommendations: string[]
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

function daysBetween(dateStr: string, now: Date): number {
  const date = new Date(dateStr)
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
}

export class PublicDataLifecycleManagerAi {
  private datasets = new Map<string, PublicDataset>()
  private auditLog: AuditEntry[] = []

  registerDataset(dataset: PublicDataset): void {
    if (dataset.dataGrade === 'C' || dataset.dataGrade === 'S') {
      // C/S 등급은 등록 허용하나 AI 분석 시 외부 전송 금지 플래그
    }
    this.datasets.set(dataset.datasetId, dataset)
    this.auditLog.push({ action: 'dataset.register', timestamp: new Date().toISOString(), detail: dataset.datasetId })
  }

  evaluate(datasetId: string): LifecycleDecision {
    const dataset = this.datasets.get(datasetId)
    if (!dataset) throw new Error(`Dataset not found: ${datasetId}`)

    const now = new Date()
    const ageInDays = daysBetween(dataset.createdAt, now)
    const daysSinceAccess = daysBetween(dataset.lastAccessedAt, now)
    const daysUntilExpiry = dataset.retentionPolicyDays - ageInDays
    const retentionExpiryDate = new Date(new Date(dataset.createdAt).getTime() + dataset.retentionPolicyDays * 86400000)
      .toISOString()
      .split('T')[0] ?? ''

    const recommendations: string[] = []
    let currentStage: LifecycleStage
    let recommendedAction: LifecycleDecision['recommendedAction']

    // 법적 보존 우선
    if (dataset.legalHold) {
      currentStage = 'ACTIVE'
      recommendedAction = 'LEGAL_HOLD'
      recommendations.push('법적 보존 명령 적용 — 삭제 불가')
      this.auditLog.push({ action: 'lifecycle.evaluate', timestamp: now.toISOString(), detail: datasetId })
      return { datasetId, currentStage, recommendedAction, retentionExpiryDate, daysUntilExpiry, recommendations }
    }

    // 보존 기간 초과
    if (daysUntilExpiry <= 0) {
      currentStage = 'DELETION_PENDING'
      recommendedAction = 'DELETE'
      recommendations.push(`보존 기간 ${Math.abs(daysUntilExpiry)}일 초과 — 즉시 삭제 검토`)
    } else if (daysUntilExpiry <= 30) {
      currentStage = 'DELETION_PENDING'
      recommendedAction = 'DELETE'
      recommendations.push(`보존 기간 ${daysUntilExpiry}일 후 만료 — 삭제 준비`)
    } else if (daysSinceAccess >= 90 || dataset.accessCountLast90Days === 0) {
      currentStage = 'ARCHIVAL'
      recommendedAction = 'ARCHIVE'
      recommendations.push(`90일 이상 미접근 — 아카이브 티어로 이동 권고`)
    } else if (daysSinceAccess >= 30) {
      currentStage = 'DORMANT'
      recommendedAction = 'RETAIN'
      recommendations.push('30일 이상 저접근 — 접근 패턴 모니터링')
    } else {
      currentStage = 'ACTIVE'
      recommendedAction = 'RETAIN'
    }

    if (dataset.dataGrade === 'C') {
      recommendations.push('C등급 데이터 — 삭제 시 보안 삭제(Secure Wipe) 필수')
    }

    this.auditLog.push({ action: 'lifecycle.evaluate', timestamp: now.toISOString(), detail: datasetId })
    return { datasetId, currentStage, recommendedAction, retentionExpiryDate, daysUntilExpiry, recommendations }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
