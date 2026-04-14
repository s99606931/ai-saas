# SVC-AI-ADV-R542 Design — 서비스 메시 가시성 강화 AI

## 인터페이스

```typescript
interface MeshEdge {
  from: string;
  to: string;
  latencyMs: number;
  errorRate: number;
  requestsPerMin: number;
}

interface MeshAnalysisResult {
  meshId: string;
  overallScore: number;  // 0~100
  edgeStatuses: { from: string; to: string; status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' }[];
  hotspots: { from: string; to: string }[];
}
```

## 핵심 알고리즘

- 엣지 상태: latencyMs>1000||errorRate>0.1→CRITICAL / latencyMs>500||errorRate>0.05→DEGRADED / else HEALTHY
- 전체 점수 = HEALTHY 엣지수 / 전체 엣지수 × 100
- 핫스팟: CRITICAL 엣지의 (from, to) 목록
- 감사 로그: analyze 호출 시 전수 기록

## CSAP 참조
- D-06: 감사 로그 전수 기록
