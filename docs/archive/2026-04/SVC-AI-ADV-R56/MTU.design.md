# SVC-AI-ADV-R56 — Cross-Document Reasoning Design

> 2026-04-12 | v1.0.0

## 1. 개요
참조 그래프(nodes=Documents, edges=Reference)를 BFS로 탐색하여 추론 체인을 생성합니다.

## 2. 자료구조
```typescript
export interface Document {
  id: string;
  title: string;
  entities: string[];   // 고유명사/조항 ID
  grade: 'O' | 'C' | 'S';
}
export interface Reference {
  from: string;
  to: string;
  kind: 'cite' | 'derive' | 'amend';
  weight?: number;
}
export interface ReasoningChain {
  path: string[];       // doc id list
  hops: number;
  evidence: Document[];
}
```

## 3. BFS 알고리즘
```
seeds = findSeeds(query)   // 엔티티 매칭
queue = [(seed, [seed], 0)]
visited = {}
while queue not empty and chains.length < maxChains:
  (node, path, depth) = pop()
  if depth > maxDepth: continue
  if visited[node]: continue
  visited[node] = true
  chains.push(path)
  for edge in outgoing(node):
    if not visited[edge.to]:
      queue.push((edge.to, [...path, edge.to], depth+1))
```

## 4. 순환 방지
- 방문 집합 `visited`
- 경로 내부 재방문 금지

## 5. 근거 반환
- 각 체인에 대해 path의 Document 객체 배열 제공

## 6. 변경 이력
| 1.0.0 | 2026-04-12 | 초안 |
