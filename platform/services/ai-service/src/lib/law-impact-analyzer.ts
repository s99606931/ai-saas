// Design Ref: §R276 — 법령 변경 영향 분석기
// Plan SC: SVC-AI-ADV-R276-SC01

export type DataGrade = 'C' | 'S' | 'O'
export type Relevance = 'CORE' | 'PARTIAL' | 'REFERENCE'
export type ChangeType = 'AMENDMENT' | 'REPEAL' | 'ENACTMENT'
export type ImpactLevel = 'LOW' | 'MED' | 'HIGH' | 'CRITICAL'

export interface Law {
  lawId: string
  title: string
  domain: string
}

export interface LawChange {
  changeId: string
  lawId: string
  changeType: ChangeType
  effectiveDate: string
}

export interface SystemLink {
  lawId: string
  systemId: string
  relevance: Relevance
}

export interface ImpactedSystem {
  systemId: string
  relevance: Relevance
  impactLevel: ImpactLevel
  reason: string
}

export interface ImpactAnalysis {
  changeId: string
  lawId: string
  lawTitle: string
  changeType: ChangeType
  overallImpact: ImpactLevel
  impactedSystems: ImpactedSystem[]
}

interface AuditEntry {
  timestamp: string
  action: string
  callerMasked: string
  detail: Record<string, unknown>
}

export class LawImpactAnalyzer {
  private laws = new Map<string, Law>()
  private links = new Map<string, SystemLink[]>() // by lawId
  private changes = new Map<string, LawChange>()
  private auditLog: AuditEntry[] = []

  registerLaw(law: Law, grade: DataGrade, caller: string): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 법령 등록 금지 (N2SF N-05)`)
    }
    if (!law.lawId) throw new Error('lawId 필수')
    if (this.laws.has(law.lawId)) throw new Error(`중복 lawId: ${law.lawId}`)
    this.laws.set(law.lawId, { ...law })
    this.appendAudit('law.register', this.mask(caller), { lawId: law.lawId })
  }

  linkSystem(lawId: string, systemId: string, relevance: Relevance, caller: string): void {
    if (!this.laws.has(lawId)) throw new Error(`lawId 없음: ${lawId}`)
    if (!systemId) throw new Error('systemId 필수')
    const list = this.links.get(lawId) ?? []
    // 중복 방지
    if (list.some((l) => l.systemId === systemId)) {
      throw new Error(`중복 매핑: ${lawId} → ${systemId}`)
    }
    list.push({ lawId, systemId, relevance })
    this.links.set(lawId, list)
    this.appendAudit('system.link', this.mask(caller), {
      lawId,
      systemId,
      relevance,
    })
  }

  registerChange(change: LawChange, caller: string): void {
    if (!this.laws.has(change.lawId)) throw new Error(`lawId 없음: ${change.lawId}`)
    if (!change.changeId) throw new Error('changeId 필수')
    if (this.changes.has(change.changeId)) {
      throw new Error(`중복 changeId: ${change.changeId}`)
    }
    this.changes.set(change.changeId, { ...change })
    this.appendAudit('change.register', this.mask(caller), {
      changeId: change.changeId,
      lawId: change.lawId,
      changeType: change.changeType,
    })
  }

  analyzeImpact(changeId: string): ImpactAnalysis {
    const change = this.changes.get(changeId)
    if (!change) throw new Error(`changeId 없음: ${changeId}`)
    const law = this.laws.get(change.lawId)
    if (!law) throw new Error(`lawId 없음: ${change.lawId}`)

    const systemLinks = this.links.get(change.lawId) ?? []
    const impactedSystems: ImpactedSystem[] = systemLinks.map((link) => {
      const level = this.calculateImpact(link.relevance, change.changeType)
      return {
        systemId: link.systemId,
        relevance: link.relevance,
        impactLevel: level,
        reason: `${link.relevance} 매핑 + ${change.changeType} = ${level}`,
      }
    })

    // overall = 최대 영향도
    let overall: ImpactLevel = 'LOW'
    for (const s of impactedSystems) {
      if (this.levelRank(s.impactLevel) > this.levelRank(overall)) {
        overall = s.impactLevel
      }
    }

    this.appendAudit('impact.analyze', 'SYSTEM', {
      changeId,
      systemCount: impactedSystems.length,
      overallImpact: overall,
    })

    return {
      changeId,
      lawId: change.lawId,
      lawTitle: law.title,
      changeType: change.changeType,
      overallImpact: overall,
      impactedSystems,
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private calculateImpact(relevance: Relevance, changeType: ChangeType): ImpactLevel {
    if (changeType === 'REPEAL') {
      if (relevance === 'CORE') return 'CRITICAL'
      if (relevance === 'PARTIAL') return 'HIGH'
      return 'MED'
    }
    if (changeType === 'AMENDMENT') {
      if (relevance === 'CORE') return 'HIGH'
      if (relevance === 'PARTIAL') return 'MED'
      return 'LOW'
    }
    // ENACTMENT
    if (relevance === 'CORE') return 'MED'
    if (relevance === 'PARTIAL') return 'LOW'
    return 'LOW'
  }

  private levelRank(level: ImpactLevel): number {
    switch (level) {
      case 'CRITICAL':
        return 4
      case 'HIGH':
        return 3
      case 'MED':
        return 2
      case 'LOW':
        return 1
    }
  }

  private mask(id: string): string {
    if (id.length <= 4) return '***'
    return `${id.slice(0, 2)}***${id.slice(-2)}`
  }

  private appendAudit(
    action: string,
    callerMasked: string,
    detail: Record<string, unknown>
  ): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      callerMasked,
      detail,
    })
  }
}
