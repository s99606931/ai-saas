// Design Ref: §설계결정 — AI기반 실시간 장애 전파 분석
// Plan SC: FR-R577.1~5

interface ServiceNode { nodeId: string; name: string; dependencies: string[] }
interface FailureRecord { failureId: string; nodeId: string; timestamp: string }
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

export class FailurePropagationAnalyzerAi {
  private nodes = new Map<string, ServiceNode>()
  private failures = new Map<string, FailureRecord>()
  private auditLog: AuditEntry[] = []

  registerNode(nodeId: string, name: string, dependencies: string[]): void {
    this.nodes.set(nodeId, { nodeId, name, dependencies })
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'REGISTER_NODE', details: { nodeId, name } })
  }

  recordFailure(failureId: string, nodeId: string, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
    this.failures.set(failureId, { failureId, nodeId, timestamp: new Date().toISOString() })
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'RECORD_FAILURE', details: { failureId, nodeId } })
  }

  getAffectedNodeCount(failureId: string): number {
    const failure = this.failures.get(failureId)
    if (!failure) return 0
    // BFS: find all nodes that depend on the failed node
    const visited = new Set<string>()
    const queue = [failure.nodeId]
    while (queue.length > 0) {
      const current = queue.shift()!
      if (visited.has(current)) continue
      visited.add(current)
      // find nodes that have current in their dependencies
      for (const node of this.nodes.values()) {
        if (node.dependencies.includes(current) && !visited.has(node.nodeId)) {
          queue.push(node.nodeId)
        }
      }
    }
    return visited.size
  }

  getActiveFailures(): FailureRecord[] {
    return Array.from(this.failures.values())
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
