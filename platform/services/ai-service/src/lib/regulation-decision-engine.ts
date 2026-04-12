// Design Ref: §R263 — 규정 의사결정 엔진
// Plan SC: SVC-AI-ADV-R263-SC01

export type DataGrade = 'C' | 'S' | 'O'
export type Op = 'EQ' | 'NEQ' | 'GT' | 'LT' | 'GTE' | 'LTE' | 'IN' | 'CONTAINS'
export type Effect = 'APPROVE' | 'DENY' | 'REVIEW'

export interface Condition {
  field: string
  op: Op
  value: unknown
}

export interface Rule {
  ruleId: string
  title: string
  category: string
  conditions: Condition[]
  effect: Effect
  priority: number
  source: string
}

export interface CaseInput {
  caseId: string
  fields: Record<string, unknown>
}

export interface Decision {
  caseId: string
  decision: Effect
  appliedRules: string[]
  rationale: string[]
  conflicts: string[]
}

interface AuditEntry {
  timestamp: string
  action: string
  callerMasked: string
  detail: Record<string, unknown>
}

export class RegulationDecisionEngine {
  private rules = new Map<string, Rule>()
  private auditLog: AuditEntry[] = []

  addRule(rule: Rule): void {
    if (rule.conditions.length === 0) {
      throw new Error('conditions 1개 이상 필요')
    }
    if (!['APPROVE', 'DENY', 'REVIEW'].includes(rule.effect)) {
      throw new Error(`유효하지 않은 effect: ${rule.effect}`)
    }
    if (rule.priority < 0) {
      throw new Error('priority는 0 이상')
    }
    if (this.rules.has(rule.ruleId)) {
      throw new Error(`중복 rule: ${rule.ruleId}`)
    }
    this.rules.set(rule.ruleId, {
      ...rule,
      conditions: rule.conditions.map((c) => ({ ...c })),
    })
    this.appendAudit('rule.add', 'SYSTEM', {
      ruleId: rule.ruleId,
      category: rule.category,
      effect: rule.effect,
    })
  }

  listRules(category?: string): Rule[] {
    const all = [...this.rules.values()]
    return category ? all.filter((r) => r.category === category) : all
  }

  evaluate(input: CaseInput, caller: string, grade: DataGrade): Decision {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 케이스 평가 금지 (N2SF N-05)`)
    }

    const matched: Rule[] = []
    for (const rule of this.rules.values()) {
      if (this.matches(rule, input.fields)) {
        matched.push(rule)
      }
    }
    matched.sort((a, b) => b.priority - a.priority)

    const conflicts: string[] = []
    const effects = new Set(matched.map((r) => r.effect))
    if (effects.has('APPROVE') && effects.has('DENY')) {
      conflicts.push('APPROVE/DENY 충돌 — REVIEW 필요')
    }

    let decision: Effect
    if (matched.length === 0) {
      decision = 'REVIEW'
    } else if (conflicts.length > 0) {
      decision = 'REVIEW'
    } else {
      // 최고 priority 규정의 effect
      const top = matched[0]
      if (!top) {
        decision = 'REVIEW'
      } else {
        // 동점 + 서로 다른 effect → REVIEW
        const topPriority = top.priority
        const topTier = matched.filter((r) => r.priority === topPriority)
        const tierEffects = new Set(topTier.map((r) => r.effect))
        decision = tierEffects.size === 1 ? top.effect : 'REVIEW'
      }
    }

    const rationale = matched.map(
      (r) => `[${r.ruleId}] ${r.title} — ${r.effect} (출처: ${r.source}, 우선순위: ${r.priority})`
    )

    const result: Decision = {
      caseId: input.caseId,
      decision,
      appliedRules: matched.map((r) => r.ruleId),
      rationale,
      conflicts,
    }

    this.appendAudit('case.evaluate', this.mask(caller), {
      caseIdMasked: this.mask(input.caseId),
      decision,
      matchedCount: matched.length,
      conflictCount: conflicts.length,
    })
    return result
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private matches(rule: Rule, fields: Record<string, unknown>): boolean {
    for (const cond of rule.conditions) {
      if (!this.evalCondition(cond, fields[cond.field])) {
        return false
      }
    }
    return true
  }

  private evalCondition(cond: Condition, actual: unknown): boolean {
    const expected = cond.value
    switch (cond.op) {
      case 'EQ':
        return actual === expected
      case 'NEQ':
        return actual !== expected
      case 'GT':
        return typeof actual === 'number' && typeof expected === 'number' && actual > expected
      case 'LT':
        return typeof actual === 'number' && typeof expected === 'number' && actual < expected
      case 'GTE':
        return typeof actual === 'number' && typeof expected === 'number' && actual >= expected
      case 'LTE':
        return typeof actual === 'number' && typeof expected === 'number' && actual <= expected
      case 'IN':
        return Array.isArray(expected) && expected.includes(actual)
      case 'CONTAINS':
        return typeof actual === 'string' && typeof expected === 'string' && actual.includes(expected)
      default:
        return false
    }
  }

  private mask(id: string): string {
    if (id.length <= 4) return '***'
    return `${id.slice(0, 2)}***${id.slice(-2)}`
  }

  private appendAudit(action: string, callerMasked: string, detail: Record<string, unknown>): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      callerMasked,
      detail,
    })
  }
}
