# SVC-AI-ADV-R61 — Tool-Use Planner Design

## 아키텍처 옵션

| 옵션 | 장점 | 단점 |
|------|------|------|
| A. ReAct 1-step | 단순 | 복합목표 약함 |
| B. Tree search | 정밀 | 비용 높음 |
| **C. DAG 계획 + 백트래킹 (선택)** | 계획-실행 분리, 백트래킹 가능 | 상태 관리 필요 |

## 모듈 구조

```
ToolUsePlanner
 ├─ registerTool(tool)
 ├─ plan(goal) → PlanNode[]
 ├─ execute(plan, ctx) → PlanResult
 ├─ backtrack(state) → PlanNode[]
 ├─ checkToolPermission(user, tool)
 ├─ enforceLimits(depth, retries)
 └─ getAuditLog()
```

## 데이터 구조

```typescript
interface Tool { id: string; name: string; params: Record<string, unknown>; requiredRole: string; }
interface PlanNode { id: string; tool: string; args: Record<string, unknown>; deps: string[]; status: 'pending'|'success'|'failed'; }
interface PlanResult { success: boolean; steps: PlanNode[]; finalOutput?: unknown; }
```

## 실행 흐름

1. `plan(goal)` — 목표 분해
2. 의존성 순으로 노드 실행, 권한 검사
3. 실패 노드 → `backtrack`으로 대체 경로 탐색
4. 최대 depth 5, 재시도 3회 초과 시 종료

## Design Anchor

- Plan FR-R61.1~6 전 항목 반영
- CSAP D-06/D-08 매핑
