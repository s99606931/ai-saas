/**
 * Document Intent Classifier — SVC-AI-ADV-R145
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R145.design.md
 * Plan SC: FR-R145.1 ~ FR-R145.6
 *
 * 공공기관 서류 인텐트 분류(제로샷 키워드 가중치 방식).
 */

export type DataGrade = 'O' | 'C' | 'S'

export interface IntentKeyword {
  term: string
  weight: number
}

export interface IntentDefinition {
  label: string
  keywords: IntentKeyword[]
}

export interface IntentScore {
  label: string
  score: number
  matches: string[]
}

export interface ClassifyResult {
  top: IntentScore
  all: IntentScore[]
}

export interface ClassifyOptions {
  threshold?: number
  topK?: number
}

export interface AuditEntry {
  event: string
  detail: Record<string, unknown>
  at: number
}

export interface ClassifierOptions {
  now?: () => number
}

const UNKNOWN_LABEL = 'unknown'

export class DocumentIntentClassifier {
  private readonly intents = new Map<string, IntentDefinition>()
  private readonly auditLog: AuditEntry[] = []
  private readonly now: () => number

  constructor(opts: ClassifierOptions = {}) {
    this.now = opts.now ?? (() => Date.now())
  }

  /** FR-R145.1: 인텐트 정의 등록 */
  register(intent: IntentDefinition): void {
    if (!intent.label) {
      throw new Error('invalid_intent')
    }
    if (this.intents.has(intent.label)) {
      throw new Error('duplicate_intent')
    }
    if (!Array.isArray(intent.keywords) || intent.keywords.length === 0) {
      throw new Error('invalid_intent')
    }
    for (const kw of intent.keywords) {
      if (!kw.term || kw.weight <= 0) {
        throw new Error('invalid_keyword')
      }
    }
    this.intents.set(intent.label, {
      label: intent.label,
      keywords: intent.keywords.map((k) => ({
        term: k.term.toLowerCase(),
        weight: k.weight,
      })),
    })
    this.audit('intent_registered', {
      label: intent.label,
      kwCount: intent.keywords.length,
    })
  }

  /** FR-R145.2 ~ FR-R145.4: 분류 */
  classify(
    text: string,
    grade: DataGrade = 'O',
    options: ClassifyOptions = {},
  ): ClassifyResult {
    this.assertGrade(grade)
    if (!text || text.trim().length === 0) {
      throw new Error('invalid_text')
    }
    const threshold = options.threshold ?? 1
    const topK = options.topK ?? 3
    const normalized = text.toLowerCase()
    const scores: IntentScore[] = []
    for (const intent of this.intents.values()) {
      let score = 0
      const matches: string[] = []
      for (const kw of intent.keywords) {
        if (normalized.includes(kw.term)) {
          score += kw.weight
          matches.push(kw.term)
        }
      }
      if (score > 0) {
        scores.push({ label: intent.label, score, matches })
      }
    }
    scores.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return a.label.localeCompare(b.label)
    })
    const sliced = scores.slice(0, topK)
    const topCandidate = sliced[0]
    const top: IntentScore =
      topCandidate && topCandidate.score >= threshold
        ? topCandidate
        : { label: UNKNOWN_LABEL, score: 0, matches: [] }
    this.audit('classified', {
      top: top.label,
      score: top.score,
      candidates: sliced.length,
    })
    return { top, all: sliced }
  }

  /** FR-R145.5: 감사 로그 */
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  /** FR-R145.6: C/S등급 차단 */
  private assertGrade(grade: DataGrade): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error('grade_blocked')
    }
  }

  private audit(event: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ event, detail, at: this.now() })
  }
}
