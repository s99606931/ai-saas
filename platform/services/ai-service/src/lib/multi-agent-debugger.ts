/**
 * 멀티에이전트 디버거 — SVC-AI-ADV-R158
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R158/SVC-AI-ADV-R158.design.md
 * Plan SC: FR-R158.1 ~ FR-R158.6
 *
 * 에이전트 간 통신 추적 + 데드락/무한루프 자동 탐지 + 타임라인 분석.
 * CSAP D-06, N2SF N-05 등급 차단.
 */

export enum DataGrade {
  C = 'C',
  S = 'S',
  O = 'O',
}

export interface AgentMessage {
  id: string
  from: string
  to: string
  topic: string
  timestamp: number
  waitingForReply?: boolean
}

export interface DeadlockReport {
  detected: boolean
  cycle: string[]
  description: string
}

export interface LoopReport {
  detected: boolean
  from: string
  to: string
  count: number
}

export interface DebugReport {
  totalMessages: number
  agents: string[]
  deadlock: DeadlockReport
  loops: LoopReport[]
  bottleneck: string | null
  timelineMs: number
  analysisAt: number
}

export interface DebuggerAuditEntry {
  action: 'messageRecorded' | 'analyzed'
  timestamp: number
  details: Record<string, unknown>
}

export class MultiAgentDebugger {
  private readonly messages: AgentMessage[] = []
  private readonly loopThreshold: number
  private readonly auditLog: DebuggerAuditEntry[] = []

  constructor(grade: DataGrade, options: { loopThreshold?: number } = {}) {
    if (grade !== DataGrade.O) {
      throw new Error(
        `BLOCKED: ${grade}등급 데이터는 멀티에이전트 디버거 사용 금지 (N2SF N-05)`,
      )
    }
    this.loopThreshold = options.loopThreshold ?? 5
  }

  /** FR-R158.1 */
  recordMessage(msg: AgentMessage): void {
    if (!msg.id.trim()) throw new Error('message id must not be empty')
    if (!msg.from.trim()) throw new Error('message.from must not be empty')
    if (!msg.to.trim()) throw new Error('message.to must not be empty')
    this.messages.push({ ...msg })
    this.audit('messageRecorded', { id: msg.id, from: msg.from, to: msg.to })
  }

  /** FR-R158.2 ~ FR-R158.5 */
  analyze(): DebugReport {
    const agents = new Set<string>()
    const graph = new Map<string, Set<string>>()
    const edgeCounts = new Map<string, number>()
    const inDegree = new Map<string, number>()

    for (const msg of this.messages) {
      agents.add(msg.from)
      agents.add(msg.to)

      if (!graph.has(msg.from)) graph.set(msg.from, new Set())
      graph.get(msg.from)!.add(msg.to)

      const edgeKey = `${msg.from}→${msg.to}`
      edgeCounts.set(edgeKey, (edgeCounts.get(edgeKey) ?? 0) + 1)

      inDegree.set(msg.to, (inDegree.get(msg.to) ?? 0) + 1)
    }

    const deadlock = this.detectDeadlock(graph)
    const loops = this.detectLoops(edgeCounts)
    const bottleneck = this.findBottleneck(inDegree)
    const timelineMs = this.calcTimeline()

    const report: DebugReport = {
      totalMessages: this.messages.length,
      agents: [...agents],
      deadlock,
      loops,
      bottleneck,
      timelineMs,
      analysisAt: Date.now(),
    }

    this.audit('analyzed', {
      agents: agents.size,
      deadlock: deadlock.detected,
      loops: loops.length,
    })

    return report
  }

  /** FR-R158.6 */
  getAuditLog(): readonly DebuggerAuditEntry[] {
    return [...this.auditLog]
  }

  // ---------- private ----------

  private detectDeadlock(graph: Map<string, Set<string>>): DeadlockReport {
    const visited = new Set<string>()
    const recStack = new Set<string>()
    const cyclePath: string[] = []

    const dfs = (node: string, path: string[]): boolean => {
      visited.add(node)
      recStack.add(node)
      path.push(node)

      for (const neighbor of graph.get(node) ?? []) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor, path)) return true
        } else if (recStack.has(neighbor)) {
          const cycleStart = path.indexOf(neighbor)
          cyclePath.push(...path.slice(cycleStart), neighbor)
          return true
        }
      }

      recStack.delete(node)
      path.pop()
      return false
    }

    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        if (dfs(node, [])) {
          return {
            detected: true,
            cycle: cyclePath,
            description: `순환 의존성 탐지: ${cyclePath.join(' → ')}`,
          }
        }
      }
    }

    return { detected: false, cycle: [], description: '데드락 없음' }
  }

  private detectLoops(edgeCounts: Map<string, number>): LoopReport[] {
    const loops: LoopReport[] = []
    for (const [edge, count] of edgeCounts.entries()) {
      if (count >= this.loopThreshold) {
        const [from, to] = edge.split('→')
        loops.push({ detected: true, from: from ?? '', to: to ?? '', count })
      }
    }
    return loops
  }

  private findBottleneck(inDegree: Map<string, number>): string | null {
    if (inDegree.size === 0) return null
    let maxAgent = ''
    let maxDegree = 0
    for (const [agent, degree] of inDegree.entries()) {
      if (degree > maxDegree) {
        maxDegree = degree
        maxAgent = agent
      }
    }
    return maxDegree > 0 ? maxAgent : null
  }

  private calcTimeline(): number {
    if (this.messages.length === 0) return 0
    const timestamps = this.messages.map((m) => m.timestamp)
    return Math.max(...timestamps) - Math.min(...timestamps)
  }

  private audit(action: DebuggerAuditEntry['action'], details: Record<string, unknown>): void {
    this.auditLog.push({ action, timestamp: Date.now(), details })
  }
}
