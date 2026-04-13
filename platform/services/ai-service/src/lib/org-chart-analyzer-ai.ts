// Design Ref: §R272 — AI기반 공공기관 조직도 자동 분석
// Plan SC: SVC-AI-ADV-R272-SC01
// CSAP D-06: 감사 로그, D-08: 접근 통제

export type OrgLevel = 'MINISTRY' | 'DEPARTMENT' | 'DIVISION' | 'TEAM' | 'INDIVIDUAL'
export type AuthorityType = 'DECISION' | 'REVIEW' | 'EXECUTE' | 'INFORM'

export interface OrgUnit {
  unitId: string
  name: string
  level: OrgLevel
  parentId?: string
  headCount: number
  budget: number  // 만원
}

export interface OrgAnalysis {
  unitId: string
  name: string
  level: OrgLevel
  spanOfControl: number     // 직속 하위 조직 수
  hierarchyDepth: number    // 루트에서의 깊이
  budgetShare: number       // 전체 예산 대비 비율 (0~1)
  isOverspanned: boolean    // spanOfControl > 7
  recommendations: string[]
}

interface AuditEntry {
  timestamp: string
  action: string
  unitId: string
  detail: Record<string, unknown>
}

export class OrgChartAnalyzerAi {
  private units = new Map<string, OrgUnit>()
  private auditLog: AuditEntry[] = []

  registerUnit(unit: OrgUnit): void {
    if (unit.headCount < 0) throw new Error('headCount는 0 이상이어야 합니다')
    this.units.set(unit.unitId, unit)
    this.appendAudit('unit.register', unit.unitId, { name: unit.name, level: unit.level })
  }

  analyze(unitId: string): OrgAnalysis {
    const unit = this.units.get(unitId)
    if (!unit) throw new Error(`Unknown unit: ${unitId}`)

    // 직속 하위 조직 수
    const directChildren = [...this.units.values()].filter((u) => u.parentId === unitId)
    const spanOfControl = directChildren.length

    // 계층 깊이
    let depth = 0
    let current: OrgUnit | undefined = unit
    while (current?.parentId) {
      depth++
      current = this.units.get(current.parentId)
      if (depth > 20) break  // 순환 방지
    }

    // 전체 예산 대비 비율
    const totalBudget = [...this.units.values()].reduce((s, u) => s + u.budget, 0)
    const budgetShare = totalBudget > 0 ? unit.budget / totalBudget : 0

    const isOverspanned = spanOfControl > 7
    const recommendations: string[] = []

    if (isOverspanned) {
      recommendations.push(`통제 범위 ${spanOfControl}개 — 관리 효율성을 위해 중간 조직 계층 신설 권고`)
    }
    if (depth > 5) {
      recommendations.push(`계층 깊이 ${depth} — 의사결정 지연 위험, 조직 구조 단순화 검토`)
    }
    if (budgetShare > 0.4) {
      recommendations.push(`예산 집중도 ${Math.round(budgetShare * 100)}% — 예산 분산 검토 권고`)
    }

    this.appendAudit('unit.analyze', unitId, { spanOfControl, hierarchyDepth: depth, isOverspanned })

    return { unitId, name: unit.name, level: unit.level, spanOfControl, hierarchyDepth: depth, budgetShare: Math.round(budgetShare * 100) / 100, isOverspanned, recommendations }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, unitId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, unitId, detail })
  }
}
