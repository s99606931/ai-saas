// SVC-AI-ADV-R44: 코드 컨텍스트 검색
// Design Ref: §모듈, §흐름
// Plan SC: FR-R44.1

export interface CodeFile {
  path: string
  content: string
  language?: string
}

export interface CodeSnippet {
  path: string
  content: string
  score: number
  language: string
  lineStart?: number
  lineEnd?: number
}

interface IndexedDoc {
  path: string
  content: string
  language: string
  tokens: string[]
  tf: Map<string, number>
}

/**
 * 코드 컨텍스트 검색기 — BM25 기반 간이 검색.
 * 프로덕션에서는 임베딩(code-search-ada 등)과 결합 권장.
 */
export class CodeContextRetriever {
  private readonly docs: IndexedDoc[] = []
  private readonly df: Map<string, number> = new Map()
  private avgdl = 0
  private readonly k1 = 1.5
  private readonly b = 0.75

  /**
   * 파일들을 인덱스에 추가한다.
   */
  index(files: CodeFile[]): void {
    for (const f of files) {
      if (!f.path || !f.content) continue
      const tokens = this.tokenize(f.content)
      if (tokens.length === 0) continue

      const tf = new Map<string, number>()
      const seen = new Set<string>()
      for (const t of tokens) {
        tf.set(t, (tf.get(t) ?? 0) + 1)
        seen.add(t)
      }
      for (const t of seen) {
        this.df.set(t, (this.df.get(t) ?? 0) + 1)
      }
      this.docs.push({
        path: f.path,
        content: f.content,
        language: f.language ?? this.detectLanguage(f.path),
        tokens,
        tf,
      })
    }
    const total = this.docs.reduce((sum, d) => sum + d.tokens.length, 0)
    this.avgdl = this.docs.length === 0 ? 0 : total / this.docs.length
  }

  /**
   * 쿼리 검색 — BM25 점수 기준 top-k.
   */
  search(query: string, k = 5): CodeSnippet[] {
    const qTokens = this.tokenize(query)
    if (qTokens.length === 0 || this.docs.length === 0) return []

    const scores = this.docs.map((doc) => ({
      doc,
      score: this.bm25(qTokens, doc),
    }))

    return scores
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
      .map((s) => ({
        path: s.doc.path,
        content: this.truncateSnippet(s.doc.content, 40),
        score: s.score,
        language: s.doc.language,
      }))
  }

  /**
   * 인덱스 크기.
   */
  size(): number {
    return this.docs.length
  }

  private bm25(qTokens: string[], doc: IndexedDoc): number {
    let score = 0
    const dl = doc.tokens.length
    const N = this.docs.length
    for (const t of qTokens) {
      const tf = doc.tf.get(t) ?? 0
      if (tf === 0) continue
      const df = this.df.get(t) ?? 0
      const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1)
      const norm = tf * (this.k1 + 1) / (tf + this.k1 * (1 - this.b + (this.b * dl) / this.avgdl))
      score += idf * norm
    }
    return score
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}_]/gu, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 2 && t.length <= 40)
  }

  private detectLanguage(path: string): string {
    if (path.endsWith('.ts') || path.endsWith('.tsx')) return 'typescript'
    if (path.endsWith('.js') || path.endsWith('.jsx')) return 'javascript'
    if (path.endsWith('.py')) return 'python'
    if (path.endsWith('.go')) return 'go'
    if (path.endsWith('.java')) return 'java'
    return 'text'
  }

  private truncateSnippet(content: string, maxLines: number): string {
    const lines = content.split('\n')
    if (lines.length <= maxLines) return content
    return lines.slice(0, maxLines).join('\n') + '\n// ... (truncated)'
  }
}

export function createCodeContextRetriever(): CodeContextRetriever {
  return new CodeContextRetriever()
}
