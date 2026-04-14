# SVC-AI-ADV-R566 Design — AI기반 서비스 API 사용량 예측 v3

## 인터페이스

```typescript
interface ForecastInput {
  apiId: string;
  dailyUsage: number[];   // 최소 3개
  forecastDays: number;
}

interface ForecastResult {
  apiId: string;
  avgDailyGrowthRate: number;   // 소수점 4자리
  forecastedUsage: number;      // ceil
  recommendedCapacity: number;  // ceil(forecast*1.3)
}
```

## 핵심 알고리즘

- 평균 일일 증가율 = (last - first) / (length - 1) / first
- 예측 사용량 = last × (1 + growthRate)^forecastDays → ceil
- 용량 권고 = ceil(예측 × 1.3)
- dailyUsage.length < 3 → throw Error('insufficient data')
- 감사 로그: forecast 호출 시 전수 기록

## CSAP 참조
- D-06: 감사 로그 전수 기록
