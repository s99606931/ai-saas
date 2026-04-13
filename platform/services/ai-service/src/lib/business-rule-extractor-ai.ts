// Design Ref: §핵심 알고리즘 — IF-THEN 규칙 실행, 충돌 탐지
// Plan SC: SVC-AI-ADV-R325
export type DataGrade = 'O' | 'C' | 'S'

export interface BusinessRule {
  id: string
  name: string
  conditionKey: string
  conditionValue: unknown
  action: string
}

export interface RuleEvaluationResult {
  ruleId: string
  ruleName: string
  matched: boolean
  action: string
}

export interface ConflictReport {
  conditionKey: string
  conditionValue: unknown
  conflictingActions: string[]
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class BusinessRuleExtractorAI {
  private rules = new Map<string, BusinessRule>()
  private auditLog: AuditEntry[] = []

  registerRule(
    id: string,
    name: string,
    conditionKey: string,
    conditionValue: unknown,
    action: string,
    grade: DataGrade = 'O'
  ): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 규칙 데이터 등록 금지 (N2SF N-05)`)
    }
    if (!id || !name || !conditionKey || !action) throw new Error('id, name, conditionKey, action은 필수')
    this.rules.set(id, { id, name, conditionKey, conditionValue, action })
    this.auditLog.push({ action: 'rule.register', timestamp: new Date().toISOString(), detail: id })
  }

  evaluate(context: Record<string, unknown>): RuleEvaluationResult[] {
    const results: RuleEvaluationResult[] = []
    for (const rule of this.rules.values()) {
      const matched = context[rule.conditionKey] === rule.conditionValue
      results.push({ ruleId: rule.id, ruleName: rule.name, matched, action: matched ? rule.action : '' })
    }
    this.auditLog.push({ action: 'rules.evaluate', timestamp: new Date().toISOString(), detail: `matched=${results.filter((r) => r.matched).length}` })
    return results
  }

  detectConflicts(): ConflictReport[] {
    // conditionKey+conditionValue가 동일한데 action이 다른 규칙 탐지
    const groups = new Map<string, BusinessRule[]>()
    for (const rule of this.rules.values()) {
      const key = `${rule.conditionKey}:${JSON.stringify(rule.conditionValue)}`
      const group = groups.get(key) ?? []
      group.push(rule)
      groups.set(key, group)
    }
    const conflicts: ConflictReport[] = []
    for (const [, group] of groups) {
      const actions = [...new Set(group.map((r) => r.action))]
      if (actions.length > 1) {
        conflicts.push({
          conditionKey: group[0]!.conditionKey,
          conditionValue: group[0]!.conditionValue,
          conflictingActions: actions,
        })
      }
    }
    return conflicts
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
