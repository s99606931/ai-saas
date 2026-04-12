/**
 * Agent Memory Consolidator — SVC-AI-ADV-R114
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R114.design.md
 * Plan SC: FR-R114.1 ~ FR-R114.7
 *
 * 복수 에이전트 메모리 중복 제거 + 통합.
 * CSAP D-06 감사, N2SF 등급 상승 차단.
 */

export enum DataGrade {
  C = 'C',
  S = 'S',
  O = 'O',
}

const GRADE_RANK: Record<DataGrade, number> = {
  [DataGrade.O]: 0,
  [DataGrade.C]: 1,
  [DataGrade.S]: 2,
}

export interface MemoryEntry {
  id: string
  agentId: string
  content: string
  keywords: string[]
  confidence: number
  timestamp: number
  grade: DataGrade
  sources?: string[]
}

export interface ConsolidatedMemory {
  id: string
  content: string
  sourceIds: string[]
  agents: string[]
  mergedConfidence: number
  latestTimestamp: number
  grade: DataGrade
  conflictResolved: boolean
}

export interface ConsolidationStats {
  input: number
  clusters: number
  output: number
  duplicatesRemoved: number
  conflicts: number
  blocked: number
}

export interface ConsolidatorOptions {
  similarityThreshold?: number
  callerGrade?: DataGrade
}

export interface ConsolidatorAuditEntry {
  timestamp: string
  action: 'consolidate' | 'gradeBlocked' | 'conflict' | 'merge'
  detail?: Record<string, unknown>
}

const DEFAULT_THRESHOLD = 0.85

function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1
  const sa = new Set(a.map((x) => x.toLowerCase()))
  const sb = new Set(b.map((x) => x.toLowerCase()))
  let inter = 0
  for (const x of sa) if (sb.has(x)) inter++
  const union = sa.size + sb.size - inter
  return union === 0 ? 0 : inter / union
}

export class AgentMemoryConsolidator {
  private readonly threshold: number
  private readonly callerGrade: DataGrade
  private readonly auditLog: ConsolidatorAuditEntry[] = []

  constructor(options: ConsolidatorOptions = {}) {
    this.threshold = options.similarityThreshold ?? DEFAULT_THRESHOLD
    this.callerGrade = options.callerGrade ?? DataGrade.O
  }

  getAuditLog(): readonly ConsolidatorAuditEntry[] {
    return this.auditLog
  }

  private audit(
    action: ConsolidatorAuditEntry['action'],
    detail?: Record<string, unknown>,
  ): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      ...(detail !== undefined ? { detail } : {}),
    })
  }

  /**
   * FR-R114.6: 등급 guard — 호출자 등급이 메모리 등급보다 낮으면 제외.
   */
  private filterByGrade(entries: MemoryEntry[]): {
    allowed: MemoryEntry[]
    blocked: number
  } {
    const allowed: MemoryEntry[] = []
    let blocked = 0
    for (const entry of entries) {
      if (GRADE_RANK[entry.grade] > GRADE_RANK[this.callerGrade]) {
        blocked++
        this.audit('gradeBlocked', {
          entryId: entry.id,
          entryGrade: entry.grade,
          callerGrade: this.callerGrade,
        })
        continue
      }
      allowed.push(entry)
    }
    return { allowed, blocked }
  }

  /**
   * FR-R114.1~5: 통합 실행.
   */
  consolidate(entries: MemoryEntry[]): {
    results: ConsolidatedMemory[]
    stats: ConsolidationStats
  } {
    const { allowed, blocked } = this.filterByGrade(entries)
    const clusters = this.cluster(allowed)
    const results: ConsolidatedMemory[] = []
    let conflicts = 0

    for (const cluster of clusters) {
      const merged = this.merge(cluster)
      if (merged.conflictResolved) conflicts++
      results.push(merged)
    }

    const stats: ConsolidationStats = {
      input: entries.length,
      clusters: clusters.length,
      output: results.length,
      duplicatesRemoved: allowed.length - clusters.length,
      conflicts,
      blocked,
    }

    this.audit('consolidate', {
      input: stats.input,
      output: stats.output,
      blocked,
    })

    return { results, stats }
  }

  private cluster(entries: MemoryEntry[]): MemoryEntry[][] {
    const n = entries.length
    const parent = Array.from({ length: n }, (_, i) => i)

    const find = (x: number): number => {
      let cur = x
      while (parent[cur] !== cur) {
        const p = parent[cur] ?? cur
        cur = p
      }
      parent[x] = cur
      return cur
    }

    const union = (a: number, b: number): void => {
      const ra = find(a)
      const rb = find(b)
      if (ra !== rb) parent[ra] = rb
    }

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const ei = entries[i]
        const ej = entries[j]
        if (!ei || !ej) continue
        if (jaccard(ei.keywords, ej.keywords) >= this.threshold) {
          union(i, j)
        }
      }
    }

    const groups = new Map<number, MemoryEntry[]>()
    for (let i = 0; i < n; i++) {
      const root = find(i)
      const entry = entries[i]
      if (!entry) continue
      const bucket = groups.get(root) ?? []
      bucket.push(entry)
      groups.set(root, bucket)
    }
    return Array.from(groups.values())
  }

  private merge(cluster: MemoryEntry[]): ConsolidatedMemory {
    if (cluster.length === 0) {
      throw new Error('Cannot merge empty cluster')
    }
    const head = cluster[0]
    if (!head) {
      throw new Error('Cluster head missing')
    }
    if (cluster.length === 1) {
      return {
        id: head.id,
        content: head.content,
        sourceIds: [head.id],
        agents: [head.agentId],
        mergedConfidence: head.confidence,
        latestTimestamp: head.timestamp,
        grade: head.grade,
        conflictResolved: false,
      }
    }

    // 정렬: 신뢰도 내림차순, 타임스탬프 내림차순
    const sorted = [...cluster].sort((a, b) => {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence
      return b.timestamp - a.timestamp
    })

    const top = sorted[0]
    if (!top) {
      throw new Error('Sorted cluster top missing')
    }

    let totalWeight = 0
    let weightedSum = 0
    let latest = 0
    let maxGrade: DataGrade = DataGrade.O
    const sourceIds: string[] = []
    const agents = new Set<string>()
    let conflict = false

    for (const entry of sorted) {
      totalWeight += entry.confidence
      weightedSum += entry.confidence * entry.confidence
      if (entry.timestamp > latest) latest = entry.timestamp
      if (GRADE_RANK[entry.grade] > GRADE_RANK[maxGrade]) {
        maxGrade = entry.grade
      }
      sourceIds.push(entry.id)
      agents.add(entry.agentId)
      if (entry.content !== top.content) conflict = true
    }

    if (conflict) {
      this.audit('conflict', {
        clusterSize: cluster.length,
        resolvedTo: top.id,
      })
    }

    const mergedConfidence = totalWeight > 0 ? weightedSum / totalWeight : 0

    this.audit('merge', {
      clusterSize: cluster.length,
      outputId: top.id,
    })

    return {
      id: top.id,
      content: top.content,
      sourceIds,
      agents: Array.from(agents),
      mergedConfidence,
      latestTimestamp: latest,
      grade: maxGrade,
      conflictResolved: conflict,
    }
  }
}
