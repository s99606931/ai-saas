# SVC-AI-ADV-R572 Design — AI기반 멀티클라우드 네트워크 최적화 v2

## 인터페이스

```typescript
interface NetworkLink {
  from: string;
  to: string;
  latencyMs: number;
  costPerGB: number;
  bandwidthMbps: number;
}

type LinkStatus = 'OPTIMAL' | 'ACCEPTABLE' | 'BOTTLENECK';

interface NetworkOptResult {
  networkId: string;
  links: { from: string; to: string; score: number; status: LinkStatus }[];
  bestLink: { from: string; to: string };
  bottlenecks: { from: string; to: string }[];
}
```

## 핵심 알고리즘

- 링크 점수 = (1-min(latencyMs/1000,1))×0.5 + (1-min(costPerGB/10,1))×0.3 + min(bandwidthMbps/1000,1)×0.2
- 상태: >=0.7→OPTIMAL / >=0.4→ACCEPTABLE / else BOTTLENECK
- bestLink: 점수 최고 링크 / bottlenecks: BOTTLENECK 목록
- 감사 로그: optimize 호출 시 전수 기록

## CSAP 참조
- D-06: 감사 로그 전수 기록
