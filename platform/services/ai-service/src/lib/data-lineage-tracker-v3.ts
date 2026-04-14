// Design Ref: §설계 결정 — 인접리스트 양방향 그래프, BFS 계보
// Plan SC: SVC-AI-ADV-R613
import { createHash } from 'crypto'

export type DataGrade = 'O' | 'C' | 'S'

export interface DatasetNode {
  id: string
  name: string
  ownerMasked: string
}

export interface AuditEntry {
  timestamp: string
  action: string
  details?: Record<string, unknown>
}

function maskPII(value: string): string {
  return createHash('sha256').update(value).digest('hex').substring(0, 16)
}

export class DataLineageTrackerV3 {
  private nodes = new Map<string, DatasetNode>()
  private downstream = new Map<string, Set<string>>()
  private upstream = new Map<string, Set<string>>()
  private auditLog: AuditEntry[] = []

  addNode(id: string, name: string, owner: string): void {
    if (!id || !name) throw new Error('id와 name은 필수')
    this.nodes.set(id, { id, name, ownerMasked: maskPII(owner) })
    if (!this.downstream.has(id)) this.downstream.set(id, new Set())
    if (!this.upstream.has(id)) this.upstream.set(id, new Set())
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'node.add',
      details: { id },
    })
  }

  addEdge(fromId: string, toId: string, grade: DataGrade = 'O'): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 AI API 전송 금지 (N2SF N-05)`)
    }
    if (!this.nodes.has(fromId) || !this.nodes.has(toId)) {
      throw new Error(`노드 없음: ${fromId} 또는 ${toId}`)
    }
    this.downstream.get(fromId)!.add(toId)
    this.upstream.get(toId)!.add(fromId)
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'edge.add',
      details: { fromId, toId },
    })
  }

  getUpstream(id: string): string[] {
    return this.bfs(id, this.upstream)
  }

  getDownstream(id: string): string[] {
    return this.bfs(id, this.downstream)
  }

  private bfs(start: string, graph: Map<string, Set<string>>): string[] {
    if (!this.nodes.has(start)) throw new Error(`노드 없음: ${start}`)
    const visited = new Set<string>()
    const queue: string[] = [start]
    const result: string[] = []
    while (queue.length > 0) {
      const cur = queue.shift()!
      for (const next of graph.get(cur) || []) {
        if (!visited.has(next)) {
          visited.add(next)
          result.push(next)
          queue.push(next)
        }
      }
    }
    return result
  }

  hasCycle(): boolean {
    const WHITE = 0
    const GRAY = 1
    const BLACK = 2
    const color = new Map<string, number>()
    for (const id of this.nodes.keys()) color.set(id, WHITE)

    const dfs = (u: string): boolean => {
      color.set(u, GRAY)
      for (const v of this.downstream.get(u) || []) {
        const c = color.get(v) ?? WHITE
        if (c === GRAY) return true
        if (c === WHITE && dfs(v)) return true
      }
      color.set(u, BLACK)
      return false
    }

    for (const id of this.nodes.keys()) {
      if ((color.get(id) ?? WHITE) === WHITE && dfs(id)) return true
    }
    return false
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
