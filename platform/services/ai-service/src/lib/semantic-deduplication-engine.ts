/**
 * Semantic Deduplication Engine — SVC-AI-ADV-R140
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R140.design.md
 * Plan SC: FR-R140.1 ~ FR-R140.6
 *
 * N-gram + Jaccard 기반 의미적 중복 탐지·정규화 엔진.
 * 공공기관 민원/공지/문서 스토리지 정리.
 * N2SF O등급 메타데이터 텍스트만 허용.
 */

export type DataGrade = 'O' | 'C' | 'S'

export interface Document {
  id: string
  text: string
  createdAt: number
}

export interface DedupCluster {
  representativeId: string
  memberIds: string[]
  avgSimilarity: number
}

export interface DedupResult {
  clusters: DedupCluster[]
  totalDuplicates: number
  analyzedAt: number
}

export interface AuditEntry {
  event: string
  detail: Record<string, unknown>
  at: number
}

export interface DedupOptions {
  now?: () => number
  threshold?: number
  ngramSize?: number
}

export class SemanticDeduplicationEngine {
  private readonly now: () => number
  private readonly threshold: number
  private readonly ngramSize: number
  private readonly auditLog: AuditEntry[] = []

  constructor(opts: DedupOptions = {}) {
    this.now = opts.now ?? (() => Date.now())
    this.threshold = opts.threshold ?? 0.7
    this.ngramSize = opts.ngramSize ?? 3
  }

  /**
   * 전체 파이프라인: 토크나이즈 → 클러스터 → 대표 선택.
   * FR-R140.1 ~ FR-R140.4
   */
  deduplicate(docs: Document[], grade: DataGrade = 'O'): DedupResult {
    this.assertDataGrade(grade)

    if (docs.length === 0) {
      return { clusters: [], totalDuplicates: 0, analyzedAt: this.now() }
    }

    const ngramCache = new Map<string, Set<string>>()
    for (const d of docs) {
      ngramCache.set(d.id, this.ngrams(this.tokenize(d.text)))
    }

    const clusters: DedupCluster[] = []
    const assigned = new Set<string>()

    for (const doc of docs) {
      if (assigned.has(doc.id)) {
        continue
      }
      const members: { id: string; sim: number }[] = [{ id: doc.id, sim: 1.0 }]
      assigned.add(doc.id)

      for (const other of docs) {
        if (other.id === doc.id || assigned.has(other.id)) {
          continue
        }
        const sim = this.jaccard(
          ngramCache.get(doc.id)!,
          ngramCache.get(other.id)!,
        )
        if (sim >= this.threshold) {
          members.push({ id: other.id, sim })
          assigned.add(other.id)
        }
      }

      const memberDocs = members.map((m) => docs.find((d) => d.id === m.id)!)
      const representative = this.selectRepresentative(memberDocs)
      const avgSimilarity =
        members.reduce((acc, m) => acc + m.sim, 0) / members.length

      clusters.push({
        representativeId: representative.id,
        memberIds: members.map((m) => m.id),
        avgSimilarity,
      })
    }

    const totalDuplicates = clusters.reduce(
      (acc, c) => acc + Math.max(0, c.memberIds.length - 1),
      0,
    )

    const result: DedupResult = {
      clusters,
      totalDuplicates,
      analyzedAt: this.now(),
    }

    this.auditLog.push({
      event: 'dedup.completed',
      detail: { docCount: docs.length, clusters: clusters.length, totalDuplicates },
      at: this.now(),
    })

    return result
  }

  /**
   * 공백 분리 소문자 토큰화.
   * FR-R140.1
   */
  tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 0)
  }

  /**
   * N-gram Set 생성.
   * FR-R140.1
   */
  ngrams(tokens: string[]): Set<string> {
    const set = new Set<string>()
    const n = this.ngramSize
    if (tokens.length < n) {
      if (tokens.length > 0) {
        set.add(tokens.join(' '))
      }
      return set
    }
    for (let i = 0; i <= tokens.length - n; i++) {
      set.add(tokens.slice(i, i + n).join(' '))
    }
    return set
  }

  /**
   * Jaccard 유사도.
   * FR-R140.2
   */
  jaccard(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 && b.size === 0) {
      return 1
    }
    let intersect = 0
    for (const x of a) {
      if (b.has(x)) {
        intersect++
      }
    }
    const union = a.size + b.size - intersect
    return union === 0 ? 0 : intersect / union
  }

  /**
   * 대표 문서 선택: 최장 텍스트 → 동률 시 최신.
   * FR-R140.4
   */
  selectRepresentative(docs: Document[]): Document {
    if (docs.length === 0) {
      throw new Error('EMPTY_CLUSTER')
    }
    let best = docs[0]!
    for (const d of docs) {
      if (d.text.length > best.text.length) {
        best = d
      } else if (d.text.length === best.text.length && d.createdAt > best.createdAt) {
        best = d
      }
    }
    return best
  }

  /**
   * 감사 로그.
   * FR-R140.5
   */
  getAuditLog(): ReadonlyArray<AuditEntry> {
    return [...this.auditLog]
  }

  private assertDataGrade(grade: DataGrade): void {
    if (grade !== 'O') {
      throw new Error(
        `BLOCKED: ${grade}등급 데이터는 Semantic Deduplication 전송 금지 (N2SF N-05)`,
      )
    }
  }
}
