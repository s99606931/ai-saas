/**
 * Output Regression Detector — SVC-AI-ADV-R152
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R152.design.md
 * Plan SC: FR-R152.1 ~ FR-R152.8
 *
 * AI 출력 골든셋 회귀 감지로 배포 전 품질 검증.
 */

export type DataGrade = 'O' | 'C' | 'S'

export interface GoldenCase {
  id: string
  input: string
  expectedOutput: string
}

export interface CaseResult {
  id: string
  similarity: number
  regressed: boolean
  reason?: 'missing' | 'low_similarity'
}

export interface EvaluationReport {
  total: number
  passCount: number
  regressionCount: number
  regressionRate: number
  shouldBlock: boolean
  cases: CaseResult[]
}

export interface AuditEntry {
  event: string
  detail: Record<string, unknown>
  at: number
}

export interface DetectorOptions {
  now?: () => number
}

export class OutputRegressionDetector {
  private readonly goldens = new Map<string, GoldenCase>()
  private readonly candidates = new Map<string, string>()
  private readonly auditLog: AuditEntry[] = []
  private readonly now: () => number

  constructor(opts: DetectorOptions = {}) {
    this.now = opts.now ?? (() => Date.now())
  }

  /** FR-R152.1: 골든 케이스 등록 */
  addGolden(id: string, input: string, expected: string, grade: DataGrade = 'O'): void {
    this.assertGrade(grade)
    if (!id || !input || !expected) {
      throw new Error('invalid_input')
    }
    if (this.goldens.has(id)) {
      throw new Error('duplicate_golden')
    }
    this.goldens.set(id, { id, input, expectedOutput: expected })
    this.audit('golden_added', { id })
  }

  /** FR-R152.2: 후보 출력 제출 */
  submitCandidate(id: string, output: string): void {
    if (!id || !output) {
      throw new Error('invalid_input')
    }
    if (!this.goldens.has(id)) {
      throw new Error('golden_not_found')
    }
    this.candidates.set(id, output)
    this.audit('candidate_submitted', { id })
  }

  /** FR-R152.3~FR-R152.6: 평가 */
  evaluate(threshold = 0.7, blockThreshold = 0.1): EvaluationReport {
    if (threshold < 0 || threshold > 1) {
      throw new Error('invalid_threshold')
    }
    if (blockThreshold < 0 || blockThreshold > 1) {
      throw new Error('invalid_threshold')
    }
    const cases: CaseResult[] = []
    for (const golden of this.goldens.values()) {
      const candidate = this.candidates.get(golden.id)
      if (candidate === undefined) {
        cases.push({
          id: golden.id,
          similarity: 0,
          regressed: true,
          reason: 'missing',
        })
        continue
      }
      const sim = this.jaccard(golden.expectedOutput, candidate)
      const regressed = sim < threshold
      cases.push({
        id: golden.id,
        similarity: Math.round(sim * 1e6) / 1e6,
        regressed,
        reason: regressed ? 'low_similarity' : undefined,
      })
    }
    cases.sort((a, b) => a.id.localeCompare(b.id))
    const total = cases.length
    const regressionCount = cases.filter((c) => c.regressed).length
    const passCount = total - regressionCount
    const regressionRate = total === 0 ? 0 : regressionCount / total
    const shouldBlock = regressionRate > blockThreshold

    const report: EvaluationReport = {
      total,
      passCount,
      regressionCount,
      regressionRate: Math.round(regressionRate * 1e6) / 1e6,
      shouldBlock,
      cases,
    }
    this.audit('evaluated', {
      total,
      regressionCount,
      regressionRate: report.regressionRate,
      shouldBlock,
    })
    return report
  }

  /** FR-R152.7: 리셋 */
  reset(): void {
    this.goldens.clear()
    this.candidates.clear()
    this.audit('reset', {})
  }

  /** FR-R152.8: 감사 로그 */
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  // === 내부 ===

  private jaccard(a: string, b: string): number {
    const aTokens = this.tokenize(a)
    const bTokens = this.tokenize(b)
    if (aTokens.size === 0 && bTokens.size === 0) return 1
    if (aTokens.size === 0 || bTokens.size === 0) return 0
    let inter = 0
    for (const t of aTokens) {
      if (bTokens.has(t)) inter += 1
    }
    const union = aTokens.size + bTokens.size - inter
    return union === 0 ? 0 : inter / union
  }

  private tokenize(text: string): Set<string> {
    const matches = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []
    return new Set(matches)
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
