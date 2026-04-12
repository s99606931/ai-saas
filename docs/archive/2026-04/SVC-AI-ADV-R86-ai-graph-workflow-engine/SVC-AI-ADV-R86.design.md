# SVC-AI-ADV-R86 — AI Graph Workflow Engine (Design)

> v1.0.0 | 2026-04-12

## 차별화
- `custom-workflow-engine.ts`: 테넌트 승인 워크플로우 (사용자 중심, 정적)
- 본 모듈: **AI 체인 DAG 상태 기계** (자동 실행, 조건 분기, 체크포인트)

## 인터페이스
```ts
export type NodeFn<S> = (state: S) => Promise<Partial<S>>;
export type EdgeCondition<S> = (state: S) => string; // 다음 노드 id 반환 or 'END'

export interface GraphConfig {
  maxSteps: number; // 무한 루프 방지
}

export interface GraphRunResult<S> {
  finalState: S;
  steps: number;
  path: string[];
  completed: boolean;
  reason: 'END' | 'MAX_STEPS' | 'ERROR';
}
```

## 알고리즘
1. `addNode(id, fn)`, `addEdge(from, to)` (정적), `addConditionalEdge(from, condition)`
2. `setEntry(id)` 지정
3. `run(initialState)`:
   - 현재 노드 실행 → state 병합
   - 조건부 엣지가 있으면 condition(state) 호출하여 다음 노드 결정
   - 정적 엣지면 해당 노드로 이동
   - 'END' 반환 시 종료
   - steps > maxSteps → MAX_STEPS 반환
4. 체크포인트: path + state 복제본 저장

## Session Guide
- 구현: `ai-graph-workflow-engine.ts`
- 테스트: `__tests__/ai-graph-workflow-engine.test.ts`
- Plan SC: FR-R86.1~5
