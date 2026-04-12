/**
 * Content Policy Enforcer — SVC-AI-ADV-R158
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R158.design.md
 * Plan SC: FR-R158.1 ~ FR-R158.8
 *
 * 공공기관 언어 표준 + 금지 주제 차단을 위한 정책 집행기.
 * 규칙 기반 패턴 매칭으로 입력/출력 검열하고 위반 항목 리포트한다.
 */

export type DataGrade = 'O' | 'C' | 'S'
export type Severity = 'low' | 'medium' | 'high' | 'critical'
export type PolicyCategory =
  | 'politics'
  | 'religion'
  | 'discrimination'
  | 'violence'
  | 'adult'
  | 'gambling'
  | 'personal_info'
  | 'profanity'
  | 'custom'

export interface PolicyRule {
  id: string
  category: PolicyCategory
  pattern: RegExp
  severity: Severity
}

export interface PolicyViolation {
  ruleId: string
  category: PolicyCategory
  severity: Severity
  matched: string
}

export interface LanguageIssue {
  type: 'profanity' | 'excessive_foreign' | 'abbreviation'
  token: string
}

export interface EnforceResult {
  allowed: boolean
  violations: PolicyViolation[]
  languageIssues: LanguageIssue[]
}

export interface PolicyStats {
  totalChecks: number
  totalBlocked: number
  byCategory: Record<string, number>
}

export interface AuditEntry {
  event: string
  detail: Record<string, unknown>
  at: number
}

export interface EnforcerOptions {
  now?: () => number
  rules?: PolicyRule[]
}

const DEFAULT_RULES: PolicyRule[] = [
  { id: 'pol-1', category: 'politics', pattern: /선거|정당|정치적\s*성향/i, severity: 'high' },
  { id: 'rel-1', category: 'religion', pattern: /개종|종교\s*전파/i, severity: 'high' },
  {
    id: 'dis-1',
    category: 'discrimination',
    pattern: /차별|비하|혐오\s*발언/i,
    severity: 'critical',
  },
  { id: 'vio-1', category: 'violence', pattern: /폭력|살해|테러/i, severity: 'critical' },
  { id: 'adu-1', category: 'adult', pattern: /성인물|음란/i, severity: 'critical' },
  { id: 'gam-1', category: 'gambling', pattern: /도박|카지노|베팅/i, severity: 'high' },
  {
    id: 'pii-1',
    category: 'personal_info',
    pattern: /\b\d{6}-\d{7}\b|\b\d{3}-\d{4}-\d{4}\b/,
    severity: 'critical',
  },
  { id: 'prof-1', category: 'profanity', pattern: /바보|멍청이|씨발/i, severity: 'medium' },
]

const PROFANITY_TOKENS = ['바보', '멍청이', '씨발', '새끼']
const ABBREVIATIONS = ['ㅇㅇ', 'ㄱㄱ', 'ㄴㄴ', 'ㅋㅋ']

export class ContentPolicyEnforcer {
  private readonly auditLog: AuditEntry[] = []
  private readonly rules: Map<string, PolicyRule> = new Map()
  private readonly now: () => number
  private stats: PolicyStats = {
    totalChecks: 0,
    totalBlocked: 0,
    byCategory: {},
  }

  constructor(opts: EnforcerOptions = {}) {
    this.now = opts.now ?? (() => Date.now())
    const initial = opts.rules ?? DEFAULT_RULES
    for (const rule of initial) {
      this.rules.set(rule.id, rule)
    }
  }

  /** FR-R158.3: 텍스트 검열 */
  enforce(text: string, grade: DataGrade = 'O'): EnforceResult {
    this.assertGrade(grade)
    if (typeof text !== 'string') {
      throw new Error('invalid_text')
    }

    const violations: PolicyViolation[] = []
    for (const rule of this.rules.values()) {
      const match = rule.pattern.exec(text)
      if (match) {
        violations.push({
          ruleId: rule.id,
          category: rule.category,
          severity: rule.severity,
          matched: match[0],
        })
        this.stats.byCategory[rule.category] = (this.stats.byCategory[rule.category] ?? 0) + 1
      }
    }

    const languageIssues = this.checkLanguage(text)
    const allowed = this.computeAllowed(violations)

    this.stats.totalChecks += 1
    if (!allowed) {
      this.stats.totalBlocked += 1
    }

    this.audit('enforced', {
      allowed,
      violationCount: violations.length,
      languageIssueCount: languageIssues.length,
    })

    return { allowed, violations, languageIssues }
  }

  /** FR-R158.5: 규칙 추가 */
  addRule(rule: PolicyRule): void {
    if (!rule.id || !rule.pattern) {
      throw new Error('invalid_rule')
    }
    this.rules.set(rule.id, rule)
    this.audit('rule_added', { id: rule.id, category: rule.category })
  }

  /** FR-R158.5: 규칙 제거 */
  removeRule(id: string): boolean {
    const removed = this.rules.delete(id)
    if (removed) {
      this.audit('rule_removed', { id })
    }
    return removed
  }

  getStats(): PolicyStats {
    return {
      totalChecks: this.stats.totalChecks,
      totalBlocked: this.stats.totalBlocked,
      byCategory: { ...this.stats.byCategory },
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  // === 내부 ===

  private computeAllowed(violations: PolicyViolation[]): boolean {
    const critical = violations.filter((v) => v.severity === 'critical').length
    const high = violations.filter((v) => v.severity === 'high').length
    if (critical >= 1) return false
    if (high >= 2) return false
    return true
  }

  private checkLanguage(text: string): LanguageIssue[] {
    const issues: LanguageIssue[] = []
    for (const token of PROFANITY_TOKENS) {
      if (text.includes(token)) {
        issues.push({ type: 'profanity', token })
      }
    }
    for (const abbr of ABBREVIATIONS) {
      if (text.includes(abbr)) {
        issues.push({ type: 'abbreviation', token: abbr })
      }
    }
    const foreignMatches = text.match(/[A-Za-z]{4,}/g) ?? []
    const totalLen = text.length || 1
    const foreignRatio =
      foreignMatches.reduce((sum, m) => sum + m.length, 0) / totalLen
    if (foreignRatio > 0.4) {
      issues.push({
        type: 'excessive_foreign',
        token: foreignMatches[0] ?? '',
      })
    }
    return issues
  }

  private assertGrade(grade: DataGrade): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error('grade_blocked')
    }
  }

  private audit(event: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ event, detail, at: this.now() })
  }
}
