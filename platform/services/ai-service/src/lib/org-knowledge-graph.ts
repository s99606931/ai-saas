/**
 * Org Knowledge Graph — SVC-AI-ADV-R133 (트랙 B 2차)
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R130-R137-trackB/SVC-AI-ADV-R133.design.md
 * Plan SC: FR-R133.1 ~ FR-R133.6
 *
 * 조직 내 암묵적 지식 자동 추출 → 공동 출현 기반 지식 그래프 구축.
 * N2SF N-05: C/S 등급 문서 차단. 외부 API 없음.
 */

// Design Ref: §2 — 타입 정의

export type DataGrade = 'C' | 'S' | 'O'

export interface KnowledgeDoc {
  docId: string
  title: string
  content: string
}

export interface GraphNode {
  concept: string
  frequency: number
}

export interface GraphEdge {
  from: string
  to: string
  weight: number
}

export interface KnowledgeCluster {
  clusterId: string
  concepts: string[]
  size: number
}

export interface KnowledgeGraphExport {
  nodes: GraphNode[]
  edges: GraphEdge[]
  clusters: KnowledgeCluster[]
  exportedAt: string
}

export interface AuditEntry {
  timestamp: string
  action: string
  detail: Record<string, unknown>
}

export class OrgKnowledgeGraph {
  private readonly docs = new Map<string, KnowledgeDoc>()
  private readonly conceptFreq = new Map<string, number>()
  private readonly coOccurrence = new Map<string, number>()
  private readonly auditLog: AuditEntry[] = []
  private readonly minConceptLen = 2

  // Plan SC: FR-R133.1 — N2SF N-05 C/S 차단
  addDocument(doc: KnowledgeDoc, dataGrade: DataGrade = 'O'): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 문서는 지식 그래프 처리 금지 (N2SF N-05)`)
    }
    this.docs.set(doc.docId, { ...doc })
    const concepts = this.extractConcepts(doc.content)
    // 빈도 업데이트
    for (const c of concepts) {
      this.conceptFreq.set(c, (this.conceptFreq.get(c) ?? 0) + 1)
    }
    // 공동 출현 업데이트 (중복 제거)
    const unique = [...new Set(concepts)]
    for (let i = 0; i < unique.length; i++) {
      for (let j = i + 1; j < unique.length; j++) {
        const key = this.edgeKey(unique[i]!, unique[j]!)
        this.coOccurrence.set(key, (this.coOccurrence.get(key) ?? 0) + 1)
      }
    }
    this.appendAudit('doc.add', { docId: doc.docId, concepts: concepts.length })
  }

  // Plan SC: FR-R133.2 — Design Ref: §3.1 개념 추출
  extractConcepts(text: string): string[] {
    const tokens = text
      .split(/[\s,.:;!?()[\]{}"'"""''·\-\/\\]+/)
      .filter((t) => t.length >= this.minConceptLen)
      .map((t) => t.toLowerCase())
    return tokens
  }

  // Plan SC: FR-R133.3 — Design Ref: §3.2 공동 출현 그래프
  buildGraph(): KnowledgeGraphExport {
    const nodes: GraphNode[] = [...this.conceptFreq.entries()].map(([concept, frequency]) => ({
      concept,
      frequency,
    }))
    const edges: GraphEdge[] = []
    for (const [key, weight] of this.coOccurrence.entries()) {
      const [from, to] = key.split('||')
      if (from && to) edges.push({ from, to, weight })
    }
    const clusters = this.getClusters()
    this.appendAudit('graph.build', { nodes: nodes.length, edges: edges.length })
    return {
      nodes,
      edges,
      clusters,
      exportedAt: new Date().toISOString(),
    }
  }

  // Plan SC: FR-R133.4
  findRelated(concept: string, topN = 10): Array<{ concept: string; weight: number }> {
    const lower = concept.toLowerCase()
    const related: Array<{ concept: string; weight: number }> = []
    for (const [key, weight] of this.coOccurrence.entries()) {
      const [from, to] = key.split('||')
      if (from === lower && to) related.push({ concept: to, weight })
      else if (to === lower && from) related.push({ concept: from, weight })
    }
    return related.sort((a, b) => b.weight - a.weight).slice(0, topN)
  }

  // Plan SC: FR-R133.5 — Design Ref: §3.3 Union-Find 클러스터
  getClusters(minWeight = 2): KnowledgeCluster[] {
    const parent = new Map<string, string>()
    const find = (x: string): string => {
      if (!parent.has(x)) parent.set(x, x)
      if (parent.get(x) !== x) parent.set(x, find(parent.get(x)!))
      return parent.get(x)!
    }
    const union = (a: string, b: string): void => {
      parent.set(find(a), find(b))
    }

    for (const [key, weight] of this.coOccurrence.entries()) {
      if (weight >= minWeight) {
        const [from, to] = key.split('||')
        if (from && to) union(from, to)
      }
    }

    const groups = new Map<string, string[]>()
    for (const concept of this.conceptFreq.keys()) {
      const root = find(concept)
      const group = groups.get(root) ?? []
      group.push(concept)
      groups.set(root, group)
    }

    return [...groups.entries()]
      .filter(([, members]) => members.length > 1)
      .map(([root, members], idx) => ({
        clusterId: `cluster-${idx + 1}-${root}`,
        concepts: members.sort(),
        size: members.length,
      }))
  }

  // Plan SC: FR-R133.6 — CSAP D-06
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private edgeKey(a: string, b: string): string {
    return [a, b].sort().join('||')
  }

  private appendAudit(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail })
  }
}
