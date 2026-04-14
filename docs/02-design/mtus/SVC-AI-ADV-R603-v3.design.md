# SVC-AI-ADV-R603 (v3) Design — AI기반 서비스 의존성 매핑 v3

## 인터페이스
```typescript
interface DepInput {
  services: string[];
  edges: { from: string; to: string }[];
}

interface DepAnalysis {
  totalServices: number;
  totalEdges: number;
  hasCycles: boolean;
  cycles: string[][];
}

class ServiceDependencyMapperV3 {
  build(input: DepInput): DepAnalysis;
  impactedBy(service: string): string[];
  getAuditLog(): AuditEntry[];
}
```

## 알고리즘
1. build: edges에서 from===to 제거. adjacency 맵 구성.
2. impactedBy(service): BFS로 service에서 도달 가능한 모든 노드 (자신 제외).
3. cycle detection: white-grey-black DFS, grey 재방문 시 cycle 경로 기록.
