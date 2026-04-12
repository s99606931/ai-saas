# SVC-AI-ADV-R101 — Graph Anomaly Propagator Design

## 인터페이스

```typescript
export interface GraphNode { id: string; }
export interface GraphEdge { from: string; to: string; weight?: number; }

export interface PropagationResult {
  iterations: number;
  converged: boolean;
  scores: Record<string, number>;
  topK: Array<{ nodeId: string; score: number }>;
}

export class GraphAnomalyPropagator {
  addNode(id: string): void;
  addEdge(from: string, to: string, weight?: number): void;
  setScore(id: string, score: number): void;
  propagate(opts?: { maxIterations?: number; alpha?: number; epsilon?: number; topK?: number }): PropagationResult;
}
```

## 알고리즘 (PageRank 변형)

score_t+1[i] = (1 - alpha) * score_0[i] + alpha * sum_j(score_t[j] * w_ji / outDegree_j)

- alpha = 0.85 기본
- 수렴: max(abs(score_t+1 - score_t)) < epsilon

## 테스트

1. 노드/에지 등록
2. 이상 점수 전파 → 이웃 증가
3. 수렴 탐지
4. top-k 정렬
5. 고립 노드 처리
