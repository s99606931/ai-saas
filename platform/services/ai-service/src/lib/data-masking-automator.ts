/**
 * Data Masking Automator — SVC-AI-ADV-R168 (트랙 B 4차)
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R168/SVC-AI-ADV-R168.design.md
 * Plan SC: FR-R168.1 ~ FR-R168.5
 *
 * 마스킹 패턴 등록 → 텍스트/구조화 데이터 마스킹 → 통계.
 * CSAP D-12: PII/시크릿 마스킹 자동화.
 */

// Design Ref: §타입 정의

export interface MaskingPattern {
  patternId: string
  name: string
  regex: string
  replacement: string
  priority: number
}

export interface MaskingResult {
  original: string
  masked: string
  appliedPatterns: string[]
  maskCount: number
}

export interface MaskingStats {
  patternId: string
  name: string
  totalApplied: number
}

export interface AuditEntry {
  timestamp: string
  action: string
  detail: Record<string, unknown>
}

// Design Ref: §알고리즘 — 기본 패턴 (priority 순)
const DEFAULT_PATTERNS: MaskingPattern[] = [
  { patternId: 'P-RRN', name: '주민등록번호', regex: '\\d{6}-\\d{7}', replacement: '######-#######', priority: 1 },
  { patternId: 'P-PHONE', name: '전화번호', regex: '01[016-9]-\\d{3,4}-\\d{4}', replacement: '010-****-####', priority: 2 },
  { patternId: 'P-EMAIL', name: '이메일', regex: '[\\w.+\\-]+@[\\w\\-]+\\.\\w+', replacement: '****@***', priority: 3 },
  { patternId: 'P-CARD', name: '카드번호', regex: '\\d{4}-\\d{4}-\\d{4}-\\d{4}', replacement: '****-****-****-####', priority: 4 },
]

export class DataMaskingAutomator {
  private readonly patterns = new Map<string, MaskingPattern>()
  private readonly stats = new Map<string, number>()
  private readonly auditLog: AuditEntry[] = []

  constructor() {
    for (const p of DEFAULT_PATTERNS) {
      this.patterns.set(p.patternId, { ...p })
      this.stats.set(p.patternId, 0)
    }
  }

  // Plan SC: FR-R168.1
  registerPattern(pattern: MaskingPattern): void {
    this.patterns.set(pattern.patternId, { ...pattern })
    this.stats.set(pattern.patternId, 0)
    this.appendAudit('pattern.register', { patternId: pattern.patternId, name: pattern.name })
  }

  // Plan SC: FR-R168.2 — priority 순 적용
  maskText(text: string): MaskingResult {
    const sortedPatterns = [...this.patterns.values()].sort((a, b) => a.priority - b.priority)
    let masked = text
    let totalMaskCount = 0
    const appliedPatterns: string[] = []

    for (const p of sortedPatterns) {
      const regex = new RegExp(p.regex, 'g')
      const before = masked
      masked = masked.replace(regex, p.replacement)
      const count = (before.match(regex) ?? []).length
      if (count > 0) {
        this.stats.set(p.patternId, (this.stats.get(p.patternId) ?? 0) + count)
        totalMaskCount += count
        appliedPatterns.push(p.name)
      }
    }

    this.appendAudit('text.mask', { maskCount: totalMaskCount, patternsApplied: appliedPatterns.length })
    return { original: text, masked, appliedPatterns, maskCount: totalMaskCount }
  }

  // Plan SC: FR-R168.3 — 구조화 데이터 마스킹
  maskRecord(record: Record<string, string>, sensitiveFields: string[]): Record<string, string> {
    const result: Record<string, string> = { ...record }
    for (const field of sensitiveFields) {
      if (field in result) {
        result[field] = this.maskText(result[field]!).masked
      }
    }
    this.appendAudit('record.mask', { fieldsProcessed: sensitiveFields.length })
    return result
  }

  // Plan SC: FR-R168.4
  getStats(): MaskingStats[] {
    return [...this.patterns.values()].map((p) => ({
      patternId: p.patternId,
      name: p.name,
      totalApplied: this.stats.get(p.patternId) ?? 0,
    }))
  }

  // Plan SC: FR-R168.5 — CSAP D-06
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail })
  }
}
