/**
 * Policy-Aware Response Filter — SVC-AI-ADV-R118
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R118.design.md
 * Plan SC: FR-R118.1 ~ FR-R118.7
 *
 * AI 응답 출력 전 공공기관 금칙어/PII/정책 위반 탐지 및 차단/마스킹.
 * CSAP D-06 감사, D-12 출력 검증, N2SF C/S 차단.
 */

export enum DataGrade {
  C = 'C',
  S = 'S',
  O = 'O',
}

export type Action = 'block' | 'mask' | 'flag'
export type Severity = 'low' | 'medium' | 'high' | 'critical'

export interface PolicyRule {
  id: string
  description: string
  pattern: RegExp | string
  action: Action
  severity: Severity
  replacement?: string
}

export interface FilterRequest {
  text: string
  grade: DataGrade
  policyVersion?: string
}

export interface FilterFinding {
  ruleId: string
  severity: Severity
  action: Action
  matches: number
}

export interface FilterResult {
  allowed: boolean
  text: string
  findings: FilterFinding[]
  blocked: boolean
  policyVersion: string
}

export interface FilterAuditEntry {
  timestamp: string
  action: 'filter' | 'gradeBlocked' | 'ruleMatched' | 'ruleBlocked' | 'maskApplied'
  detail?: Record<string, unknown>
}

export interface FilterOptions {
  rules?: PolicyRule[]
  policyVersion?: string
}

const DEFAULT_RULES: PolicyRule[] = [
  {
    id: 'PII-EMAIL',
    description: '이메일 주소 유출 차단',
    pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
    action: 'mask',
    severity: 'high',
    replacement: '[EMAIL]',
  },
  {
    id: 'PII-RRN',
    description: '주민등록번호 유출 차단',
    pattern: /\b\d{6}[-]?\d{7}\b/g,
    action: 'mask',
    severity: 'critical',
    replacement: '[RRN]',
  },
  {
    id: 'PII-PHONE',
    description: '휴대폰 번호 유출 차단',
    pattern: /\b01[0-9]-?\d{3,4}-?\d{4}\b/g,
    action: 'mask',
    severity: 'medium',
    replacement: '[PHONE]',
  },
  {
    id: 'SYS-PATH',
    description: '내부 시스템 경로 노출 차단',
    pattern: /(\/etc\/|\/root\/|C:\\Windows\\)/g,
    action: 'block',
    severity: 'high',
  },
  {
    id: 'FALSE-ADV',
    description: '허위 광고성 표현 차단',
    pattern: /(100%\s*무조건|절대\s*보장|영구\s*무료)/g,
    action: 'block',
    severity: 'high',
  },
  {
    id: 'PROFANITY',
    description: '비속어 마스킹',
    pattern: '씨발',
    action: 'mask',
    severity: 'medium',
    replacement: '***',
  },
  {
    id: 'BIAS-POLITICS',
    description: '정치 편향 표현 플래그',
    pattern: /(좌파\s*정권|우파\s*정권)/g,
    action: 'flag',
    severity: 'low',
  },
]

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function toRegex(pattern: RegExp | string): RegExp {
  if (pattern instanceof RegExp) {
    return pattern.global
      ? pattern
      : new RegExp(pattern.source, pattern.flags + 'g')
  }
  return new RegExp(escapeRegex(pattern), 'gi')
}

export class PolicyAwareResponseFilter {
  private readonly rules: PolicyRule[]
  private readonly policyVersion: string
  private readonly auditLog: FilterAuditEntry[] = []
  private readonly compiled: Map<string, RegExp> = new Map()

  constructor(options: FilterOptions = {}) {
    this.rules = options.rules ?? DEFAULT_RULES
    this.policyVersion = options.policyVersion ?? '2026.04.1'
    this.precompile()
  }

  private precompile(): void {
    for (const rule of this.rules) {
      this.compiled.set(rule.id, toRegex(rule.pattern))
    }
  }

  getAuditLog(): readonly FilterAuditEntry[] {
    return this.auditLog
  }

  getPolicyVersion(): string {
    return this.policyVersion
  }

  addRule(rule: PolicyRule): void {
    this.rules.push(rule)
    this.compiled.set(rule.id, toRegex(rule.pattern))
  }

  private audit(
    action: FilterAuditEntry['action'],
    detail?: Record<string, unknown>,
  ): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      ...(detail !== undefined ? { detail } : {}),
    })
  }

  /**
   * FR-R118.1~5: 응답 필터링.
   */
  filter(request: FilterRequest): FilterResult {
    // FR-R118.6: 등급 guard
    if (request.grade === DataGrade.C || request.grade === DataGrade.S) {
      this.audit('gradeBlocked', { grade: request.grade })
      throw new Error(
        `BLOCKED: ${request.grade}등급 데이터는 AI 응답 필터 전송 금지 (N2SF N-05)`,
      )
    }

    let text = request.text
    const findings: FilterFinding[] = []
    let blocked = false

    for (const rule of this.rules) {
      const regex = this.compiled.get(rule.id)
      if (!regex) continue
      regex.lastIndex = 0
      const matches = text.match(regex)
      if (!matches || matches.length === 0) continue

      const finding: FilterFinding = {
        ruleId: rule.id,
        severity: rule.severity,
        action: rule.action,
        matches: matches.length,
      }
      findings.push(finding)
      this.audit('ruleMatched', {
        ruleId: rule.id,
        severity: rule.severity,
        matches: matches.length,
      })

      if (rule.action === 'block') {
        blocked = true
        this.audit('ruleBlocked', { ruleId: rule.id })
        break
      }

      if (rule.action === 'mask') {
        const replacement = rule.replacement ?? '[REDACTED]'
        const freshRegex = toRegex(rule.pattern)
        text = text.replace(freshRegex, replacement)
        this.audit('maskApplied', { ruleId: rule.id, matches: matches.length })
      }
    }

    const result: FilterResult = {
      allowed: !blocked,
      text: blocked ? '' : text,
      findings,
      blocked,
      policyVersion: request.policyVersion ?? this.policyVersion,
    }

    this.audit('filter', {
      allowed: result.allowed,
      findingsCount: findings.length,
      blocked,
    })

    return result
  }
}
