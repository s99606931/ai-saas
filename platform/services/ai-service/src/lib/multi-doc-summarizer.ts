// SVC-AI-ADV-R45: 다중 문서 교차 요약
// Design Ref: §다중 문서 흐름, §인터페이스
// Plan SC: FR-R45.2, FR-R45.3

import { SummarizationEngine, type HierarchicalSummary } from './summarization-engine'

export interface Document {
  id: string
  title: string
  content: string
  source?: string
  publishedAt?: Date
}

export interface DocCluster {
  topic: string
  keywords: string[]
  docIds: string[]
  summary: string
  citations: Citation[]
}

export interface Citation {
  docId: string
  docTitle: string
  excerpt: string
}

export interface CrossDocSummary {
  totalDocs: number
  clusters: DocCluster[]
  globalSummary: string
  allKeywords: string[]
  generatedAt: Date
}

/**
 * 다중 문서 교차 요약기.
 */
export class MultiDocSummarizer {
  private readonly engine: SummarizationEngine

  constructor(engine?: SummarizationEngine) {
    this.engine = engine ?? new SummarizationEngine()
  }

  /**
   * 여러 문서를 클러스터링한 후 주제별 통합 요약 생성.
   */
  summarizeMany(docs: Document[]): CrossDocSummary {
    if (docs.length === 0) {
      throw new Error('at least one document required')
    }

    // 1) 각 문서 개별 요약
    const perDocSummaries = new Map<string, HierarchicalSummary>()
    for (const doc of docs) {
      perDocSummaries.set(doc.id, this.engine.summarize(doc.content, 'core'))
    }

    // 2) 주제 클러스터링 (키워드 자카드 유사도)
    const clusters = this.clusterByKeywords(docs, perDocSummaries)

    // 3) 클러스터별 통합 요약 + 인용
    for (const cluster of clusters) {
      cluster.summary = this.buildClusterSummary(cluster, docs, perDocSummaries)
      cluster.citations = this.buildCitations(cluster, docs, perDocSummaries)
    }

    // 4) 전역 요약
    const globalSummary = clusters
      .map((c, i) => `주제 ${i + 1}: ${c.topic}. ${c.summary}`)
      .join(' ')

    const allKeywords = Array.from(
      new Set(clusters.flatMap((c) => c.keywords)),
    ).slice(0, 20)

    return {
      totalDocs: docs.length,
      clusters,
      globalSummary,
      allKeywords,
      generatedAt: new Date(),
    }
  }

  private clusterByKeywords(
    docs: Document[],
    summaries: Map<string, HierarchicalSummary>,
  ): DocCluster[] {
    const docKeywords = new Map<string, Set<string>>()
    for (const doc of docs) {
      const summary = summaries.get(doc.id)
      if (!summary) continue
      docKeywords.set(doc.id, new Set(summary.keywords))
    }

    const clusters: DocCluster[] = []
    const assigned = new Set<string>()

    for (const doc of docs) {
      if (assigned.has(doc.id)) continue
      const keywords = docKeywords.get(doc.id)
      if (!keywords) continue

      const cluster: DocCluster = {
        topic: Array.from(keywords).slice(0, 2).join(' / ') || doc.title,
        keywords: Array.from(keywords).slice(0, 8),
        docIds: [doc.id],
        summary: '',
        citations: [],
      }
      assigned.add(doc.id)

      // 유사한 문서 병합
      for (const other of docs) {
        if (assigned.has(other.id)) continue
        const otherKeywords = docKeywords.get(other.id)
        if (!otherKeywords) continue
        const jaccard = this.jaccard(keywords, otherKeywords)
        if (jaccard > 0.25) {
          cluster.docIds.push(other.id)
          assigned.add(other.id)
          for (const k of otherKeywords) cluster.keywords.push(k)
        }
      }

      cluster.keywords = Array.from(new Set(cluster.keywords)).slice(0, 10)
      clusters.push(cluster)
    }

    return clusters
  }

  private jaccard(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 && b.size === 0) return 0
    const intersection = Array.from(a).filter((x) => b.has(x)).length
    const union = new Set([...a, ...b]).size
    return union === 0 ? 0 : intersection / union
  }

  private buildClusterSummary(
    cluster: DocCluster,
    docs: Document[],
    summaries: Map<string, HierarchicalSummary>,
  ): string {
    const docsInCluster = docs.filter((d) => cluster.docIds.includes(d.id))
    const coreSentences: string[] = []
    for (const doc of docsInCluster) {
      const summary = summaries.get(doc.id)
      if (!summary) continue
      const top = summary.core[0]
      if (top) coreSentences.push(`${top} [${doc.title}]`)
    }
    return coreSentences.join(' ')
  }

  private buildCitations(
    cluster: DocCluster,
    docs: Document[],
    summaries: Map<string, HierarchicalSummary>,
  ): Citation[] {
    const citations: Citation[] = []
    for (const docId of cluster.docIds) {
      const doc = docs.find((d) => d.id === docId)
      const summary = summaries.get(docId)
      if (!doc || !summary) continue
      const excerpt = summary.core[0] ?? ''
      citations.push({
        docId: doc.id,
        docTitle: doc.title,
        excerpt: excerpt.substring(0, 200),
      })
    }
    return citations
  }
}

export function createMultiDocSummarizer(): MultiDocSummarizer {
  return new MultiDocSummarizer()
}
