# SVC-AI-ADV-R95 — Data Lineage Tracker Design

## 인터페이스

```typescript
export type DataGrade = 'O' | 'C' | 'S';

export interface DatasetNode {
  id: string;
  grade: DataGrade;
  owner: string;
  type: 'SOURCE' | 'TRANSFORM' | 'SINK';
  tags: string[];
  createdAt: string;
}

export interface FlowEdge {
  from: string;
  to: string;
  operation: 'COPY' | 'TRANSFORM' | 'JOIN' | 'EXPORT';
  purpose: string;
  timestamp: string;
}

export interface LineageTrace {
  nodeId: string;
  upstream: DatasetNode[];
  downstream: DatasetNode[];
  paths: Array<{ nodes: string[]; maxGrade: DataGrade }>;
}

export interface Violation {
  type: 'EXTERNAL_SENSITIVE' | 'UNGRADED_SINK' | 'GRADE_DOWNGRADE';
  nodeId: string;
  edge?: FlowEdge;
  description: string;
}
```

## 핵심 로직

1. 등급 순위: S > C > O
2. Flow 등록 시 자동 등급 전파: to.grade = max(from.grade, to.grade)
3. Violation: C/S 등급 노드가 SINK(type=SINK && tags.includes('external'))로 흐르면 위반
4. BFS로 상/하류 탐색

## 테스트

1. 노드 + edge 등록
2. traceLineage upstream/downstream
3. 등급 자동 전파
4. 위반 탐지 (C → external sink)
5. 순환 방지
