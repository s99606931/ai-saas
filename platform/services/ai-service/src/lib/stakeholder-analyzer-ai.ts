// Design Ref: §R418 — AI기반 공공기관 이해관계자 분석
// Plan SC: SC-R418

export interface Stakeholder {
  stakeholderId: string
  name: string
  organization: string
  influenceLevel: number
  interestLevel: number
}

export type StakeholderQuadrant = 'MANAGE_CLOSELY' | 'KEEP_SATISFIED' | 'KEEP_INFORMED' | 'MONITOR'

export interface StakeholderAnalysis {
  stakeholderId: string
  maskedId: string
  name: string
  quadrant: StakeholderQuadrant
  managementStrategy: string
  communicationFrequency: string
}

export interface StakeholderReport {
  projectId: string
  totalStakeholders: number
  analyses: StakeholderAnalysis[]
  criticalStakeholders: string[]
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

function maskStakeholderId(id: string): string {
  if (id.length <= 3) return '*'.repeat(id.length)
  return id.slice(0, 2) + '*'.repeat(id.length - 4) + id.slice(-2)
}

const QUADRANT_STRATEGIES: Record<StakeholderQuadrant, { strategy: string; frequency: string }> = {
  MANAGE_CLOSELY: { strategy: '긴밀한 협력 및 적극적 참여 유도', frequency: '주 1회 이상' },
  KEEP_SATISFIED: { strategy: '주요 결정사항 사전 공유 및 만족도 관리', frequency: '월 2회' },
  KEEP_INFORMED: { strategy: '진행 상황 정기 공유', frequency: '월 1회' },
  MONITOR: { strategy: '변화 모니터링 및 최소한의 소통 유지', frequency: '분기 1회' },
}

export class StakeholderAnalyzerAi {
  private stakeholders = new Map<string, Stakeholder>()
  private auditLog: AuditEntry[] = []

  registerStakeholder(stakeholder: Stakeholder): void {
    this.stakeholders.set(stakeholder.stakeholderId, stakeholder)
    this.auditLog.push({ action: 'stakeholder.register', timestamp: new Date().toISOString(), detail: maskStakeholderId(stakeholder.stakeholderId) })
  }

  analyze(projectId: string): StakeholderReport {
    const analyses: StakeholderAnalysis[] = []
    const criticalStakeholders: string[] = []

    for (const stakeholder of this.stakeholders.values()) {
      const highInfluence = stakeholder.influenceLevel >= 5
      const highInterest = stakeholder.interestLevel >= 5

      let quadrant: StakeholderQuadrant
      if (highInfluence && highInterest) {
        quadrant = 'MANAGE_CLOSELY'
      } else if (highInfluence && !highInterest) {
        quadrant = 'KEEP_SATISFIED'
      } else if (!highInfluence && highInterest) {
        quadrant = 'KEEP_INFORMED'
      } else {
        quadrant = 'MONITOR'
      }

      const { strategy, frequency } = QUADRANT_STRATEGIES[quadrant]
      const maskedId = maskStakeholderId(stakeholder.stakeholderId)

      analyses.push({
        stakeholderId: stakeholder.stakeholderId,
        maskedId,
        name: stakeholder.name,
        quadrant,
        managementStrategy: strategy,
        communicationFrequency: frequency,
      })

      if (quadrant === 'MANAGE_CLOSELY') {
        criticalStakeholders.push(maskedId)
      }
    }

    this.auditLog.push({ action: 'stakeholder.analyze', timestamp: new Date().toISOString(), detail: `${projectId}:${analyses.length}명` })
    return { projectId, totalStakeholders: analyses.length, analyses, criticalStakeholders }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
