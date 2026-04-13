# SVC-AI-ADV-R415 Design — AI기반 실시간 서비스 토폴로지 분석

## §R415 설계 결정
- SPOF: 인입 엣지 0개 AND 아웃 엣지 ≥ 2개 → SPOF 마킹
- 경로 깊이: BFS/DFS로 루트 노드부터 최대 깊이 산출
- 크리티컬 경로: 아웃 엣지 가장 많은 노드 → 최대 연결 경로
- 감사 로그: topology.analyze 액션

## 인터페이스
```typescript
interface TopologyNode { nodeId, serviceName, tier }
interface TopologyEdge { fromNodeId, toNodeId, latencyMs }
interface TopologyReport { totalNodes, totalEdges, spofNodes: string[], maxDepth, criticalPath: string[], recommendations }
```
