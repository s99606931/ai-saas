/**
 * AI 기반 공공 문서 분류 자동화 — SVC-AI-ADV-R185
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R185/SVC-AI-ADV-R185.design.md
 * Plan SC: FR-R185.1 ~ FR-R185.5
 *
 * 공공 문서 자동 분류 + PII 탐지 마스킹 + 수동 검토 목록 생성.
 * CSAP D-06, N2SF N-05 등급 차단.
 */

export enum DataGrade {
  C = 'C',
  S = 'S',
  O = 'O',
}

export interface ClassificationRule {
  id: string
  category: string
  keywords: string[]
  securityLevel: 'public' | 'internal' | 'confidential'
}

export interface DocumentInput {
  id: string
  title: string
  content: string
}

export interface ClassificationResult {
  documentId: string
  category: string
  securityLevel: ClassificationRule['securityLevel']
  confidence: number
  hasPII: boolean
  maskedContent: string
  manualReviewRequired: boolean
}

export interface PDCAuditEntry {
  action: 'ruleRegistered' | 'classified'
  timestamp: number
  details: Record<string, unknown>
}

export class PublicDocumentClassifierAI {
  private readonly rules = new Map<string, ClassificationRule>()
  private readonly classifiedResults: ClassificationResult[] = []
  private readonly auditLog: PDCAuditEntry[] = []
  private readonly confidenceThreshold: number

  constructor(grade: DataGrade, options: { confidenceThreshold?: number } = {}) {
    if (grade !== DataGrade.O) {
      throw new Error(
        `BLOCKED: ${grade}등급 데이터는 공공 문서 분류 AI 사용 금지 (N2SF N-05)`,
      )
    }
    this.confidenceThreshold = options.confidenceThreshold ?? 0.5
  }

  /** FR-R185.1 */
  registerRule(rule: ClassificationRule): void {
    if (!rule.id.trim()) throw new Error('rule id must not be empty')
    if (rule.keywords.length === 0) throw new Error('at least one keyword required')
    this.rules.set(rule.id, { ...rule, keywords: [...rule.keywords] })
    this.audit('ruleRegistered', { id: rule.id, category: rule.category })
  }

  /** FR-R185.2 ~ FR-R185.3 */
  classify(doc: DocumentInput): ClassificationResult {
    const maskedContent = this.maskPII(doc.content)
    const hasPII = maskedContent !== doc.content
    const text = `${doc.title} ${maskedContent}`.toLowerCase()
    const tokens = new Set(text.split(/[\s,.\-_/]+/).filter((t) => t.length >= 2))

    let bestCategory = '미분류'
    let bestSecurityLevel: ClassificationRule['securityLevel'] = 'public'
    let bestScore = 0

    for (const rule of this.rules.values()) {
      const kwSet = rule.keywords.map((k) => k.toLowerCase())
      const matched = kwSet.filter((k) => tokens.has(k)).length
      const score = kwSet.length > 0 ? matched / kwSet.length : 0

      if (score > bestScore) {
        bestScore = score
        bestCategory = rule.category
        bestSecurityLevel = rule.securityLevel
      }
    }

    const manualReviewRequired = bestScore < this.confidenceThreshold

    const result: ClassificationResult = {
      documentId: doc.id,
      category: bestCategory,
      securityLevel: bestSecurityLevel,
      confidence: bestScore,
      hasPII,
      maskedContent,
      manualReviewRequired,
    }

    this.classifiedResults.push(result)
    this.audit('classified', {
      documentId: doc.id,
      category: bestCategory,
      confidence: bestScore,
      manualReview: manualReviewRequired,
    })
    return result
  }

  /** FR-R185.4 */
  getManualReviewList(threshold?: number): ClassificationResult[] {
    const t = threshold ?? this.confidenceThreshold
    return this.classifiedResults.filter((r) => r.confidence < t)
  }

  /** FR-R185.5 */
  getAuditLog(): readonly PDCAuditEntry[] {
    return [...this.auditLog]
  }

  private maskPII(text: string): string {
    return text
      .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[EMAIL]')
      .replace(/\b\d{6}-\d{7}\b/g, '[RRN]')
      .replace(/\b010-\d{4}-\d{4}\b/g, '[PHONE]')
  }

  private audit(action: PDCAuditEntry['action'], details: Record<string, unknown>): void {
    this.auditLog.push({ action, timestamp: Date.now(), details })
  }
}
