# SVC-AI-ADV-R604 Design — AI기반 실시간 자원 부하 분산 최적화

## 인터페이스

```typescript
interface NodeLoad {
  nodeId: string;
  cpuUsage: number;
  memUsage: number;
  requestCount: number;
}

type NodeStatus = 'OVERLOADED' | 'HEAVY' | 'NORMAL';

interface LoadDistributionResult {
  clusterId: string;
  nodes: { nodeId: string; loadScore: number; status: NodeStatus }[];
  avgLoad: number;
  isImbalanced: boolean;
}
```

## 핵심 알고리즘

- 부하 점수 = cpu×0.5 + mem×0.3 + min(requestCount/1000,1)×100×0.2
- 상태: >=80→OVERLOADED / >=60→HEAVY / else NORMAL
- 평균 = 전체 점수 합계/노드수
- 불균형: max점수 - min점수 > 30
- 감사 로그: analyze 호출 시 전수 기록

## CSAP 참조
- D-06: 감사 로그 전수 기록
