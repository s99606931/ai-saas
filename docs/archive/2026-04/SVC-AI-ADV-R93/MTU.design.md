# SVC-AI-ADV-R93 — FinOps AI Cost Engine Design

> Plan Ref: docs/01-plan/mtus/SVC-AI-ADV-R93.plan.md

## Design Anchor

- 선택: SMA + z-score (투명성, 설명가능성)
- 대안: ARIMA(복잡), LLM(비용)

## 인터페이스

```typescript
export interface CostDataPoint {
  date: string; // YYYY-MM-DD
  amount: number;
  category: 'LLM' | 'INFRA' | 'SAAS' | 'OTHER';
}

export interface BudgetPolicy {
  category: CostDataPoint['category'] | 'TOTAL';
  monthlyBudget: number;
  warnRatio: number;  // 기본 0.8
}

export type RiskLevel = 'SAFE' | 'WARN' | 'DANGER';

export interface CostForecast {
  category: string;
  observedMtd: number;
  projectedMonthly: number;
  monthlyBudget: number;
  utilizationRatio: number;
  risk: RiskLevel;
  anomalies: Array<{ date: string; amount: number; zScore: number }>;
}

export class FinopsAiEngine {
  forecast(series: CostDataPoint[], policy: BudgetPolicy, now?: Date): CostForecast;
  detectAnomalies(series: CostDataPoint[], threshold?: number): CostForecast['anomalies'];
}
```

## 알고리즘

1. MTD (Month-To-Date) 합계
2. 일평균 = MTD / 경과일
3. 월말 예측 = MTD + 일평균 * 잔여일
4. utilizationRatio = 예측 / 예산
5. SAFE < warnRatio; WARN < 1.0; DANGER ≥ 1.0
6. z-score = (x - mean) / stddev, |z| > threshold → anomaly

## 테스트

1. 정상 월초 → forecast 정상
2. 초과 예측 → DANGER
3. z-score 이상치 탐지
4. 빈 시계열 예외
5. 카테고리 필터 작동
