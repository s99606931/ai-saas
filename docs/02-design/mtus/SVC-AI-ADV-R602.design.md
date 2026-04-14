# SVC-AI-ADV-R602 Design — AI기반 자동 서비스 메시 정책 최적화 v2

## 인터페이스

```typescript
interface MeshPolicy {
  policyId: string;
  type: 'RETRY' | 'TIMEOUT' | 'CIRCUIT_BREAKER' | 'RATE_LIMIT';
  currentValue: number;
  recommendedValue: number;
  impactScore: number;  // 0~10
}

type PolicyRisk = 'HIGH' | 'MEDIUM' | 'LOW';

interface PolicyOptResult {
  meshId: string;
  optimizationScore: number;
  policies: { policyId: string; needsChange: boolean; risk: PolicyRisk }[];
  changesRequired: number;
}
```

## 핵심 알고리즘

- 변경 필요: currentValue !== recommendedValue
- 위험도: impactScore>=8→HIGH / >=5→MEDIUM / else LOW
- 최적화 점수 = 변경불필요수/전체수×100 (빈 배열→100)
- 감사 로그: optimize 호출 시 전수 기록

## CSAP 참조
- D-06: 감사 로그 전수 기록
