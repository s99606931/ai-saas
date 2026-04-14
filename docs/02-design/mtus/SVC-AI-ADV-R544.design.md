# SVC-AI-ADV-R544 Design — API 스로틀링 최적화 AI

## 인터페이스

```typescript
interface ThrottleInput {
  clientId: string;
  requestsLast1h: number;
  currentLimit: number;
  avgResponseMs: number;
  errorRate: number;
}

interface ThrottleResult {
  clientId: string;
  usageRate: number;         // requestsLast1h/currentLimit*100
  status: 'HIGH_USAGE' | 'NORMAL' | 'LOW_USAGE';
  recommendedLimit: number;  // 정수 (ceil)
}
```

## 핵심 알고리즘

- 사용률 = requestsLast1h / currentLimit × 100
- 상태: 사용률>90→HIGH_USAGE / 사용률<30→LOW_USAGE / else NORMAL
- 권고 한도 (ceil):
  - 사용률>90 && errorRate<0.01: currentLimit×1.5
  - 사용률>90 && errorRate>=0.01: currentLimit×0.8
  - 사용률<30: currentLimit×0.7
  - else: currentLimit
- 감사 로그: optimize 호출 시 전수 기록

## CSAP 참조
- D-06: 감사 로그 전수 기록
