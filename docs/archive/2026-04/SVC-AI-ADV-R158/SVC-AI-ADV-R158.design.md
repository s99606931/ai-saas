# SVC-AI-ADV-R158 — 멀티에이전트 디버거 (Design)

> 작성일: 2026-04-12 | 버전: 1.0.0

## 타입

```typescript
export enum DataGrade { C = 'C', S = 'S', O = 'O' }

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
  cycle: string[]       // 순환 에이전트 목록
  description: string
}

export interface LoopReport {
  detected: boolean
  agent: string
  path: string[]
  count: number
}

export interface DebugReport {
  totalMessages: number
  agents: string[]
  deadlock: DeadlockReport
  loops: LoopReport[]
  bottleneck: string | null
  timelineMs: number
}

class MultiAgentDebugger {
  constructor(grade: DataGrade, options?: { loopThreshold?: number })
  recordMessage(msg: AgentMessage): void
  analyze(): DebugReport
  getAuditLog(): readonly AuditEntry[]
}
```

## 알고리즘

- 통신 그래프: Map<from, Set<to>> 인접 리스트
- 데드락: DFS 순환 탐지 (visited + recursion stack)
- 무한루프: 동일 from→to 경로가 loopThreshold(기본 5)회 이상
- 병목: 수신 메시지 수 최다 에이전트
- 타임라인: max(timestamp) - min(timestamp)
