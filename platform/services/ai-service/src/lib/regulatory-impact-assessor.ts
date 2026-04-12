/**
 * AI 기반 규제 변경 영향 평가 — SVC-AI-ADV-R181
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R181/SVC-AI-ADV-R181.design.md
 * Plan SC: FR-R181.1 ~ FR-R181.5
 *
 * 규제 변경 시 시스템 컴포넌트 영향 자동 평가 + 갭 분석.
 * CSAP D-12, N2SF N-05 등급 차단.
 */

export enum DataGrade {
  C = 'C',
  S = 'S',
  O = 'O',
}

export interface Regulation {
  id: string
  name: string
  keywords: string[]
  complianceRequirements: string[]
}

export interface SystemComponent {
  id: string
  name: string
  keywords: string[]
  currentCapabilities: string[]
}

export interface ImpactedComponent {
  componentId: string
  componentName: string
  impactScore: number
  gaps: string[]
}

export interface ImpactAssessment {
  regulationId: string
  impactedComponents: ImpactedComponent[]
  highImpactCount: number
  totalGaps: number
  assessedAt: number
}

export interface RIAAuditEntry {
  action: 'regulationRegistered' | 'componentRegistered' | 'assessed'
  timestamp: number
  details: Record<string, unknown>
}

export class RegulatoryImpactAssessor {
  private readonly regulations = new Map<string, Regulation>()
  private readonly components = new Map<string, SystemComponent>()
  private readonly auditLog: RIAAuditEntry[] = []

  constructor(grade: DataGrade) {
    if (grade !== DataGrade.O) {
      throw new Error(
        `BLOCKED: ${grade}등급 데이터는 규제 영향 평가 사용 금지 (N2SF N-05)`,
      )
    }
  }

  /** FR-R181.1 */
  registerRegulation(reg: Regulation): void {
    if (!reg.id.trim()) throw new Error('regulation id must not be empty')
    this.regulations.set(reg.id, { ...reg, keywords: [...reg.keywords], complianceRequirements: [...reg.complianceRequirements] })
    this.audit('regulationRegistered', { id: reg.id, name: reg.name })
  }

  /** FR-R181.2 */
  registerComponent(comp: SystemComponent): void {
    if (!comp.id.trim()) throw new Error('component id must not be empty')
    this.components.set(comp.id, { ...comp, keywords: [...comp.keywords], currentCapabilities: [...comp.currentCapabilities] })
    this.audit('componentRegistered', { id: comp.id, name: comp.name })
  }

  /** FR-R181.3 ~ FR-R181.4 */
  assess(regulationId: string): ImpactAssessment {
    const reg = this.regulations.get(regulationId)
    if (!reg) throw new Error(`unknown regulation: ${regulationId}`)

    const regKeywords = new Set(reg.keywords.map((k) => k.toLowerCase()))
    const impacted: ImpactedComponent[] = []

    for (const comp of this.components.values()) {
      const compKeywords = new Set(comp.keywords.map((k) => k.toLowerCase()))
      const score = this.jaccard(regKeywords, compKeywords)

      if (score >= 0.3) {
        const capSet = new Set(comp.currentCapabilities.map((c) => c.toLowerCase()))
        const gaps = reg.complianceRequirements
          .filter((req) => !capSet.has(req.toLowerCase()))

        impacted.push({
          componentId: comp.id,
          componentName: comp.name,
          impactScore: score,
          gaps,
        })
      }
    }

    impacted.sort((a, b) => b.impactScore - a.impactScore)

    const assessment: ImpactAssessment = {
      regulationId,
      impactedComponents: impacted,
      highImpactCount: impacted.filter((c) => c.impactScore >= 0.6).length,
      totalGaps: impacted.reduce((sum, c) => sum + c.gaps.length, 0),
      assessedAt: Date.now(),
    }

    this.audit('assessed', { regulationId, impacted: impacted.length, gaps: assessment.totalGaps })
    return assessment
  }

  /** FR-R181.5 */
  getAuditLog(): readonly RIAAuditEntry[] {
    return [...this.auditLog]
  }

  private jaccard(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 && b.size === 0) return 0
    let inter = 0
    for (const k of a) if (b.has(k)) inter++
    const union = a.size + b.size - inter
    return union === 0 ? 0 : inter / union
  }

  private audit(action: RIAAuditEntry['action'], details: Record<string, unknown>): void {
    this.auditLog.push({ action, timestamp: Date.now(), details })
  }
}
