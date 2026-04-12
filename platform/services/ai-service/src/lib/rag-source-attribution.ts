/**
 * RAG Source Attribution — SVC-AI-ADV-R125
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R125.design.md
 * Plan SC: FR-R125.1 ~ FR-R125.9
 *
 * RAG 응답 문장에 출처(인용) 자동 부착 + 신뢰도 채점.
 * 토큰 Jaccard 매칭 기반 결정적 알고리즘.
 * CSAP D-12, N2SF N-05 등급 차단.
 */

export enum DataGrade {
  C = 'C',
  S = 'S',
  O = 'O',
}

export interface RAGChunk {
  id: string
  source: string
  content: string
  grade: DataGrade
}

export interface SentenceAttribution {
  index: number
  text: string
  citations: string[]
  confidence: number
  marked: string
}

export interface CitationMapEntry {
  citation: string
  chunkId: string
  source: string
  snippet: string
}

export interface AttributedAnswer {
  sentences: SentenceAttribution[]
  citationMap: CitationMapEntry[]
  avgConfidence: number
  lowConfidence: boolean
}

export interface RSAAuditEntry {
  timestamp: string
  action: 'registerChunk' | 'attribute' | 'gradeBlocked' | 'lowConfidence'
  detail?: Record<string, unknown>
}

export interface RSAOptions {
  minOverlap?: number
  lowConfidenceThreshold?: number
  maxCitationsPerSentence?: number
}

export class RAGSourceAttribution {
  private readonly chunks: Map<string, RAGChunk> = new Map()
  private readonly chunkTokens: Map<string, Set<string>> = new Map()
  private readonly auditLog: RSAAuditEntry[] = []
  private readonly minOverlap: number
  private readonly lowConfidenceThreshold: number
  private readonly maxCitationsPerSentence: number

  constructor(options: RSAOptions = {}) {
    this.minOverlap = options.minOverlap ?? 0.15
    this.lowConfidenceThreshold = options.lowConfidenceThreshold ?? 0.3
    this.maxCitationsPerSentence = options.maxCitationsPerSentence ?? 3
  }

  getAuditLog(): readonly RSAAuditEntry[] {
    return this.auditLog
  }

  private audit(
    action: RSAAuditEntry['action'],
    detail?: Record<string, unknown>,
  ): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      ...(detail !== undefined ? { detail } : {}),
    })
  }

  /**
   * FR-R125.1: 청크 등록 + 등급 guard.
   */
  registerChunk(chunk: RAGChunk): void {
    if (chunk.grade === DataGrade.C || chunk.grade === DataGrade.S) {
      this.audit('gradeBlocked', { chunkId: chunk.id, grade: chunk.grade })
      throw new Error(
        `BLOCKED: ${chunk.grade}등급 청크는 RAG 인용 등록 금지 (N2SF N-05)`,
      )
    }
    if (!chunk.id || !chunk.content) {
      throw new Error('chunk id and content required')
    }
    this.chunks.set(chunk.id, chunk)
    this.chunkTokens.set(chunk.id, this.tokenize(chunk.content))
    this.audit('registerChunk', { id: chunk.id, source: chunk.source })
  }

  /**
   * FR-R125.2: 문장 분할.
   */
  private splitSentences(answer: string): string[] {
    const parts = answer
      .split(/(?<=[.!?。?!])\s+|\n+/u)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
    return parts
  }

  /**
   * 토큰화: 영어 단어(소문자) + 한글 2-gram.
   */
  private tokenize(text: string): Set<string> {
    const tokens = new Set<string>()
    const lower = text.toLowerCase()

    // 영어/숫자 단어
    const words = lower.match(/[a-z0-9]{2,}/gu) ?? []
    for (const w of words) {
      tokens.add(w)
    }

    // 한글 2-gram
    const hangul = text.match(/[\uAC00-\uD7AF]+/gu) ?? []
    for (const seg of hangul) {
      if (seg.length === 1) {
        tokens.add(seg)
        continue
      }
      for (let i = 0; i < seg.length - 1; i++) {
        tokens.add(seg.slice(i, i + 2))
      }
    }
    return tokens
  }

  private jaccard(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 || b.size === 0) return 0
    let intersection = 0
    for (const t of a) {
      if (b.has(t)) intersection++
    }
    const union = a.size + b.size - intersection
    if (union === 0) return 0
    return intersection / union
  }

  private maskSnippet(text: string): string {
    let masked = text
      .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/gu, '***@***')
      .replace(/\d{3}-\d{4}-\d{4}/gu, '***-****-****')
      .replace(/\d{6}-\d{7}/gu, '******-*******')
    if (masked.length > 80) {
      masked = masked.slice(0, 80) + '…'
    }
    return masked
  }

  /**
   * FR-R125.2~7: 응답 인용 부착.
   */
  attribute(answer: string): AttributedAnswer {
    const sentences = this.splitSentences(answer)
    const chunkArray = Array.from(this.chunks.values())
    const usedCitationByChunk = new Map<string, string>() // chunkId -> [n]
    const citationMap: CitationMapEntry[] = []
    let citationCounter = 0

    const attributions: SentenceAttribution[] = []

    for (let i = 0; i < sentences.length; i++) {
      const sentText = sentences[i] ?? ''
      const sentTokens = this.tokenize(sentText)

      // 청크별 overlap 계산
      const scored: Array<{ chunkId: string; score: number }> = []
      for (const chunk of chunkArray) {
        const chunkSet = this.chunkTokens.get(chunk.id)
        if (!chunkSet) continue
        const score = this.jaccard(sentTokens, chunkSet)
        if (score >= this.minOverlap) {
          scored.push({ chunkId: chunk.id, score })
        }
      }
      scored.sort((a, b) => b.score - a.score)
      const top = scored.slice(0, this.maxCitationsPerSentence)

      const citationLabels: string[] = []
      for (const s of top) {
        let label = usedCitationByChunk.get(s.chunkId)
        if (!label) {
          citationCounter++
          label = `[${citationCounter}]`
          usedCitationByChunk.set(s.chunkId, label)
          const chunk = this.chunks.get(s.chunkId)
          if (chunk) {
            citationMap.push({
              citation: label,
              chunkId: chunk.id,
              source: chunk.source,
              snippet: this.maskSnippet(chunk.content),
            })
          }
        }
        citationLabels.push(label)
      }

      const confidence = top.length > 0 ? (top[0]?.score ?? 0) : 0
      const marked =
        citationLabels.length > 0
          ? `${sentText} ${citationLabels.join('')}`
          : sentText

      attributions.push({
        index: i,
        text: sentText,
        citations: top.map((s) => s.chunkId),
        confidence,
        marked,
      })
    }

    const totalConf = attributions.reduce((a, s) => a + s.confidence, 0)
    const avgConfidence =
      attributions.length === 0 ? 0 : totalConf / attributions.length
    const lowConfidence = avgConfidence < this.lowConfidenceThreshold

    this.audit('attribute', {
      sentences: attributions.length,
      citations: citationMap.length,
      avgConfidence,
    })
    if (lowConfidence) {
      this.audit('lowConfidence', { avgConfidence })
    }

    return {
      sentences: attributions,
      citationMap,
      avgConfidence,
      lowConfidence,
    }
  }
}
