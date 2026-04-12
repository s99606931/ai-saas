/**
 * Zero-Shot Classifier (공공 도메인) — SVC-AI-ADV-R92
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R92.design.md
 * Plan SC: FR-R92.1 ~ FR-R92.5
 *
 * 학습 데이터 없이 임베딩 유사도 기반으로 공공문서를 분류한다.
 * PII 마스킹 후 처리하여 N2SF 규정을 준수한다.
 */

export interface CategoryLabel {
  id: string
  name: string
  description: string
  keywords?: string[]
}

export interface ClassificationResult {
  documentId: string
  topK: Array<{ categoryId: string; score: number; name: string }>
  confidence: number
  requiresManualReview: boolean
  maskedText: string
  classifiedAt: string
}

export interface EmbeddingClient {
  embed(text: string): Promise<number[]>
}

export interface AuditSink {
  log(event: string, detail: Record<string, unknown>): Promise<void>
}

export interface ZeroShotOptions {
  embedder: EmbeddingClient
  audit?: AuditSink
  lowConfidenceMargin?: number // top1-top2 격차 기준
}

export class ZeroShotClassifier {
  private readonly embedder: EmbeddingClient
  private readonly audit?: AuditSink
  private readonly lowConfidenceMargin: number
  private readonly categoryCache = new Map<string, number[]>()

  constructor(opts: ZeroShotOptions) {
    this.embedder = opts.embedder
    this.audit = opts.audit
    this.lowConfidenceMargin = opts.lowConfidenceMargin ?? 0.05
  }

  /**
   * 문서를 카테고리 리스트로 분류.
   * FR-R92.1~4
   */
  async classify(
    documentId: string,
    text: string,
    categories: CategoryLabel[],
    options: { topK?: number } = {},
  ): Promise<ClassificationResult> {
    if (categories.length === 0) {
      throw new Error('categories must not be empty')
    }
    const topK = options.topK ?? 3

    // FR-R92.5: PII 마스킹
    const maskedText = this.maskPii(text)

    // 문서 임베딩
    const docVec = await this.embedder.embed(maskedText)

    // 카테고리 임베딩 (캐시)
    const catVecs: Array<{ cat: CategoryLabel; vec: number[] }> = []
    for (const cat of categories) {
      const cacheKey = `${cat.id}:${cat.name}`
      let vec = this.categoryCache.get(cacheKey)
      if (!vec) {
        const catPrompt = this.buildCategoryPrompt(cat)
        vec = await this.embedder.embed(catPrompt)
        this.categoryCache.set(cacheKey, vec)
      }
      catVecs.push({ cat, vec })
    }

    // 유사도 계산
    const scored = catVecs.map(({ cat, vec }) => ({
      categoryId: cat.id,
      name: cat.name,
      score: this.cosine(docVec, vec),
    }))
    scored.sort((a, b) => b.score - a.score)

    const top = scored.slice(0, topK)
    const confidence = top[0]?.score ?? 0
    const margin = (top[0]?.score ?? 0) - (top[1]?.score ?? 0)
    const requiresManualReview =
      top.length >= 2 ? margin < this.lowConfidenceMargin : true

    const result: ClassificationResult = {
      documentId,
      topK: top,
      confidence,
      requiresManualReview,
      maskedText,
      classifiedAt: new Date().toISOString(),
    }

    if (this.audit) {
      await this.audit.log('zeroshot.classify', {
        documentId,
        top1: top[0]?.categoryId,
        confidence,
        manualReview: requiresManualReview,
      })
    }

    return result
  }

  /**
   * FR-R92.5: PII 마스킹 (주민번호/전화/이메일)
   */
  maskPii(text: string): string {
    return text
      .replace(/\b\d{6}-[1-4]\d{6}\b/g, '***-******')
      .replace(/\b01\d-\d{3,4}-\d{4}\b/g, '***-****-****')
      .replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, '***@***')
  }

  private buildCategoryPrompt(cat: CategoryLabel): string {
    const parts = [cat.name, cat.description]
    if (cat.keywords && cat.keywords.length > 0) {
      parts.push(`키워드: ${cat.keywords.join(', ')}`)
    }
    return parts.join(' | ')
  }

  private cosine(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0
    let dot = 0
    let na = 0
    let nb = 0
    for (let i = 0; i < a.length; i++) {
      dot += a[i]! * b[i]!
      na += a[i]! * a[i]!
      nb += b[i]! * b[i]!
    }
    const denom = Math.sqrt(na) * Math.sqrt(nb)
    return denom === 0 ? 0 : dot / denom
  }
}
