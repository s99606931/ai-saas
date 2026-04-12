# SVC-AI-ADV-R71 — 설계

## 모듈
- `multi-agent-protocol.ts`
  - `MultiAgentProtocol` 클래스

## 핵심 타입
```typescript
type DataGrade = 'C' | 'S' | 'O';

interface AgentContract {
  agentId: string;
  capabilities: string[];      // 처리 가능 태스크 종류
  maxDepth: number;            // 위임 최대 깊이
  allowedGrades: DataGrade[];  // 처리 가능 등급
}

type MessageKind = 'propose' | 'accept' | 'reject' | 'result' | 'aggregate';

interface ProtocolMessage {
  id: string;
  kind: MessageKind;
  fromAgent: string;
  toAgent: string;
  taskId: string;
  parentTaskId?: string;
  capability: string;
  payload: string;
  grade: DataGrade;
  createdAt: number;
  depth: number;
}

interface TaskRecord {
  taskId: string;
  parentTaskId?: string;
  rootTaskId: string;
  capability: string;
  assignedAgent?: string;
  status: 'proposed' | 'accepted' | 'rejected' | 'running' | 'done' | 'failed' | 'timeout';
  payload: string;
  result?: string;
  depth: number;
  path: string[];              // 위임 경로 (순환 감지)
  createdAt: number;
  updatedAt: number;
}

interface AggregationResult {
  rootTaskId: string;
  strategy: 'concat' | 'vote' | 'first';
  result: string;
  subtaskCount: number;
}
```

## 알고리즘
```
1. registerAgent(contract)
2. propose(fromAgent, toAgent, capability, payload, grade, parentTaskId?)
   - grade 검증 (C/S 차단)
   - toAgent contract의 capability·grade 확인
   - path 구성 + 순환 감지 (path.includes(toAgent))
   - depth +1, maxDepth 초과 시 reject 자동
   - TaskRecord 저장 (proposed)
3. respond(taskId, accept|reject, agent)
   - accept → 상태 accepted/running
   - reject → 상태 rejected
4. complete(taskId, agent, result)
   - running → done
5. aggregate(rootTaskId, strategy)
   - 루트 하위 done 태스크 reduce
   - concat: join('\n'), vote: 최빈값, first: 첫 결과
6. tick(now) — 타임아웃 처리 (기본 60s)
```

## 보안
- C/S 등급 payload → throw `PROTOCOL_GRADE_BLOCKED`
- 감사: REGISTER / PROPOSE / ACCEPT / REJECT / RESULT / AGGREGATE / TIMEOUT / CYCLE_BLOCK / GRADE_BLOCK

## API
- `register(contract)`
- `propose(...)` → ProtocolMessage
- `respond(taskId, kind, agent)`
- `complete(taskId, agent, result)`
- `aggregate(rootTaskId, strategy)` → AggregationResult
- `tick(now)`
- `getTask(taskId)`
- `getAuditLog()`
