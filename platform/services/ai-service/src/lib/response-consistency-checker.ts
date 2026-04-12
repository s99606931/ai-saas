/**
 * Response Consistency Checker — SVC-AI-ADV-R156
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R156.design.md
 * Plan SC: FR-R156.1 ~ FR-R156.8
 *
 * 동일 질문에 대한 AI 응답 일관성(pairwise Jaccard)을 측정한다.
 */

export type DataGrade = 'O' | 'C' | 'S'

export interface ConsistencyResult {
  question: string
  sampleCount: number
  score: number
  passed: boolean
}

export interface ConsistencyReport {
  questions: number
  passedCount: number
  failedCount: number
  averageScore: number
  details: ConsistencyResult[]
}

export interface AuditEntry {
  event: string
  detail: Record<string, unknown>
  at: number
}

export interface CheckerOptions {
  maxSamples?: number
  now?: () => number
}

export class ResponseConsistencyChecker {
  private readonly samples = new Map<string, string[]>()
  private readonly auditLog: AuditEntry[] = []
  private readonly maxSamples: number
  private readonly now: () => number

  constructor(opts: CheckerOptions = {}) {
    this.maxSamples = opts.maxSamples ?? 10
    this.now = opts.now ?? (() => Date.now())
  }

  /** FR-R156.1: 응답 샘플 기록 */
  record(question: string, answer: string, grade: DataGrade = 'O'): void {
    this.assertGrade(grade)
    if (!question || !answer || question.trim().length === 0 || answer.trim().length === 0) {
      throw new Error('invalid_input')
    }
    const key = this.normalize(question)
    const existing = this.samples.get(key) ?? []
    existing.push(answer)
    // FR-R156.8: FIFO 초과 제거
    while (existing.length > this.maxSamples) {
      existing.shift()
    }
    this.samples.set(key, existing)
    this.audit('recorded', { key, count: existing.length })
  }

  /** FR-R156.2~FR-R156.4: 특정 질문 일관성 검사 */
  check(question: string, threshold = 0.6): ConsistencyResult {
    if (threshold < 0 || threshold > 1) {
      throw new Error('invalid_threshold')
    }
    if (!question || question.trim().length === 0) {
      throw new Error('invalid_input')
    }
    const key = this.normalize(question)
    const answers = this.samples.get(key)
    if (!answers || answers.length === 0) {
      throw new Error('not_found')
    }
    const score = this.computeScore(answers)
    const result: ConsistencyResult = {
      question: key,
      sampleCount: answers.length,
      score: Math.round(score * 1e6) / 1e6,
      passed: score >= threshold,
    }
    this.audit('checked', { key, score: result.score, passed: result.passed })
    return result
  }

  /** FR-R156.5: 전체 리포트 */
  generateReport(threshold = 0.6): ConsistencyReport {
    if (threshold < 0 || threshold > 1) {
      throw new Error('invalid_threshold')
    }
    const details: ConsistencyResult[] = []
    for (const [key, answers] of this.samples.entries()) {
      const score = this.computeScore(answers)
      details.push({
        question: key,
        sampleCount: answers.length,
        score: Math.round(score * 1e6) / 1e6,
        passed: score >= threshold,
      })
    }
    details.sort((a, b) => a.question.localeCompare(b.question))
    const passedCount = details.filter((d) => d.passed).length
    const failedCount = details.length - passedCount
    const averageScore =
      details.length === 0
        ? 0
        : Math.round((details.reduce((s, d) => s + d.score, 0) / details.length) * 1e6) / 1e6
    const report: ConsistencyReport = {
      questions: details.length,
      passedCount,
      failedCount,
      averageScore,
      details,
    }
    this.audit('report_generated', {
      questions: report.questions,
      passedCount,
      failedCount,
    })
    return report
  }

  /** FR-R156.6: 리셋 */
  reset(): void {
    this.samples.clear()
    this.audit('reset', {})
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  // === 내부 ===

  private normalize(question: string): string {
    return question.trim().toLowerCase()
  }

  private computeScore(answers: string[]): number {
    if (answers.length <= 1) return 1
    const tokenized = answers.map((a) => this.tokenize(a))
    let sum = 0
    let pairs = 0
    for (let i = 0; i < tokenized.length; i += 1) {
      for (let j = i + 1; j < tokenized.length; j += 1) {
        const a = tokenized[i]
        const b = tokenized[j]
        if (!a || !b) continue
        sum += this.jaccard(a, b)
        pairs += 1
      }
    }
    return pairs === 0 ? 1 : sum / pairs
  }

  private tokenize(text: string): Set<string> {
    const matches = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []
    return new Set(matches)
  }

  private jaccard(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 && b.size === 0) return 1
    if (a.size === 0 || b.size === 0) return 0
    let inter = 0
    for (const t of a) {
      if (b.has(t)) inter += 1
    }
    const union = a.size + b.size - inter
    return union === 0 ? 0 : inter / union
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
