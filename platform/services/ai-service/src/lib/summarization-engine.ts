// SVC-AI-ADV-R45: 단일 문서 계층적 요약 엔진
// Design Ref: §계층 구조, §인터페이스
// Plan SC: FR-R45.1

export type SummaryLevel = 'core' | 'section' | 'full'

export interface HierarchicalSummary {
  level: SummaryLevel
  core: string[]               // 핵심 5문장
  sections: Array<{ title: string; summary: string }>
  full: string
  keywords: string[]
  sourceLength: number
  compressionRatio: number
}

/**
 * 단일 문서 계층 요약 엔진.
 * TextRank 기반 추출 요약 + 섹션 감지.
 */
export class SummarizationEngine {
  /**
   * 문서를 지정 레벨로 요약한다.
   */
  summarize(doc: string, level: SummaryLevel = 'full'): HierarchicalSummary {
    if (!doc || doc.trim().length === 0) {
      throw new Error('document required')
    }

    const sentences = this.splitSentences(doc)
    const keywords = this.extractKeywords(doc, 10)
    const sections = this.detectSections(doc)

    const core = this.rankSentences(sentences, 5)
    const sectionSummaries = sections.map((s) => ({
      title: s.title,
      summary: this.rankSentences(this.splitSentences(s.body), 2).join(' '),
    }))

    const fullLen = Math.min(5, Math.ceil(sentences.length * 0.15))
    const full = this.rankSentences(sentences, Math.max(3, fullLen)).join(' ')

    const compressionRatio = full.length === 0 ? 0 : doc.length / Math.max(1, full.length)

    return {
      level,
      core,
      sections: sectionSummaries,
      full,
      keywords,
      sourceLength: doc.length,
      compressionRatio,
    }
  }

  /**
   * 간단 문장 분할 (한국어/영어 공통).
   */
  splitSentences(text: string): string[] {
    return text
      .replace(/\r/g, '')
      .split(/(?<=[.!?。])\s+|\n{2,}/)
      .map((s) => s.trim())
      .filter((s) => s.length > 5)
  }

  /**
   * 간이 키워드 추출 (빈도 상위 N).
   */
  extractKeywords(text: string, k: number): string[] {
    const stopwords = new Set([
      'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'is', 'it', 'for', 'on', 'with', 'as', 'by',
      '은', '는', '이', '가', '을', '를', '의', '에', '와', '과', '로', '으로', '도', '만', '에서',
    ])
    const counts = new Map<string, number>()
    const tokens = text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 2 && !stopwords.has(t))
    for (const t of tokens) {
      counts.set(t, (counts.get(t) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, k)
      .map(([w]) => w)
  }

  /**
   * 섹션 감지 (# / 제N장 / 제N절 패턴).
   */
  detectSections(doc: string): Array<{ title: string; body: string }> {
    const sections: Array<{ title: string; body: string }> = []
    const pattern = /(?:^|\n)(#+\s+[^\n]+|제\s*\d+\s*(?:장|절|조)[^\n]*)/g
    const marks: Array<{ index: number; title: string }> = []
    let m: RegExpExecArray | null
    while ((m = pattern.exec(doc)) !== null) {
      marks.push({ index: m.index, title: m[1] ?? '' })
    }
    if (marks.length === 0) {
      return [{ title: '본문', body: doc }]
    }
    for (let i = 0; i < marks.length; i += 1) {
      const cur = marks[i]
      const next = marks[i + 1]
      if (!cur) continue
      const end = next ? next.index : doc.length
      const body = doc.substring(cur.index + cur.title.length, end).trim()
      sections.push({ title: cur.title.trim(), body })
    }
    return sections
  }

  /**
   * TextRank 유사 방식 — 문장 간 중복 단어 수로 점수 매김.
   */
  private rankSentences(sentences: string[], k: number): string[] {
    if (sentences.length === 0) return []
    if (sentences.length <= k) return sentences

    const tokenized = sentences.map((s) =>
      new Set(
        s
          .toLowerCase()
          .replace(/[^\p{L}\p{N}\s]/gu, ' ')
          .split(/\s+/)
          .filter((t) => t.length >= 2),
      ),
    )

    const scores = new Array(sentences.length).fill(0)
    for (let i = 0; i < sentences.length; i += 1) {
      for (let j = 0; j < sentences.length; j += 1) {
        if (i === j) continue
        const a = tokenized[i]
        const b = tokenized[j]
        if (!a || !b) continue
        const shared = Array.from(a).filter((t) => b.has(t)).length
        const denom = Math.log(a.size + 1) + Math.log(b.size + 1)
        if (denom > 0) scores[i] += shared / denom
      }
    }

    return scores
      .map((score, idx) => ({ score, idx, text: sentences[idx] ?? '' }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
      .sort((a, b) => a.idx - b.idx)
      .map((x) => x.text)
  }
}

export function createSummarizationEngine(): SummarizationEngine {
  return new SummarizationEngine()
}
