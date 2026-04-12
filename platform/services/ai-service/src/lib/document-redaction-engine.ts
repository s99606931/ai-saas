/**
 * Document Redaction Engine — SVC-AI-ADV-R151
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R151.design.md
 * Plan SC: FR-R151.1 ~ FR-R151.8
 *
 * 문서 PII/비밀등급 자동 마스킹 엔진.
 */

export type DataGrade = 'O' | 'C' | 'S'

export type PiiType =
  | 'rrn'
  | 'email'
  | 'phone'
  | 'account'
  | 'passport'
  | 'classified'

export interface RedactionHit {
  type: PiiType
  value: string
  index: number
}

export interface RedactResult {
  redacted: string
  hits: RedactionHit[]
  totalHits: number
}

export interface AuditEntry {
  event: string
  detail: Record<string, unknown>
  at: number
}

export interface EngineOptions {
  now?: () => number
}

interface RedactRule {
  type: PiiType
  regex: RegExp
}

// 순서 중요: phone → account (겹침 방지)
const RULES: ReadonlyArray<RedactRule> = [
  { type: 'rrn', regex: /\b\d{6}-\d{7}\b/g },
  { type: 'passport', regex: /\b[A-Z]\d{8}\b/g },
  { type: 'email', regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  { type: 'phone', regex: /\b0\d{1,2}-\d{3,4}-\d{4}\b/g },
  { type: 'account', regex: /\b\d{2,6}-\d{2,6}-\d{2,6}\b/g },
  { type: 'classified', regex: /(대외비|기밀|CONFIDENTIAL|SECRET)/gi },
]

export class DocumentRedactionEngine {
  private readonly auditLog: AuditEntry[] = []
  private readonly now: () => number

  constructor(opts: EngineOptions = {}) {
    this.now = opts.now ?? (() => Date.now())
  }

  /** FR-R151.1~FR-R151.7: 마스킹 실행 */
  redact(text: string, grade: DataGrade = 'O'): RedactResult {
    this.assertGrade(grade)
    if (!text || text.length === 0) {
      throw new Error('invalid_input')
    }

    const hits: RedactionHit[] = []
    let redacted = text

    for (const rule of RULES) {
      const matches = Array.from(redacted.matchAll(rule.regex))
      for (const m of matches) {
        if (m.index === undefined) continue
        hits.push({ type: rule.type, value: m[0], index: m.index })
      }
      redacted = redacted.replace(rule.regex, `[REDACTED:${rule.type}]`)
    }

    this.audit('redact_executed', {
      totalHits: hits.length,
      byType: this.byTypeCount(hits),
    })

    return {
      redacted,
      hits,
      totalHits: hits.length,
    }
  }

  /** FR-R151.8: 감사 로그 */
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  // === 내부 ===

  private byTypeCount(hits: RedactionHit[]): Record<string, number> {
    const out: Record<string, number> = {}
    for (const h of hits) {
      out[h.type] = (out[h.type] ?? 0) + 1
    }
    return out
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
