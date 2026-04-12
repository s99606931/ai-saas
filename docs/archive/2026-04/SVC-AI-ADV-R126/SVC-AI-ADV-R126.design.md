# SVC-AI-ADV-R126 — AI Usage Forecaster (Design)

> 작성일: 2026-04-12 | 버전: 1.0.0

## Design Anchor

- **아키텍처**: Time Series Buffer + Holt Smoother + Grid Search Fitter
- **선정 이유**: Pragmatic Balance — 외부 통계 라이브러리 없이 결정적 구현. 단기 예측에 적합. 해석 가능
- **대안**:
  1. Prophet — 강력하지만 외부 의존
  2. ARIMA — 정확하지만 식별 단계 복잡
  3. Holt(선정) — 지수평활, 단순, 추세 모델링

## Holt 지수평활 공식

```
level_t = alpha * y_t + (1 - alpha) * (level_{t-1} + trend_{t-1})
trend_t = beta * (level_t - level_{t-1}) + (1 - beta) * trend_{t-1}
forecast(h) = level_T + h * trend_T
```

초기값:
- level_0 = y_0
- trend_0 = y_1 - y_0 (n>=2일 때)

## 인터페이스

```typescript
interface UsagePoint {
  timestamp: number
  value: number
  grade: DataGrade
}

interface ForecastPoint {
  step: number     // 1-based
  value: number
  lower: number    // 95% CI lower
  upper: number    // 95% CI upper
}

interface ForecastResult {
  points: ForecastPoint[]
  mape: number
  alpha: number
  beta: number
  trainSize: number
  residualStdDev: number
}

class AIUsageForecaster {
  constructor()
  addPoint(p: UsagePoint): void
  forecast(steps: number, options?: { alpha?: number; beta?: number }): ForecastResult
  fitParameters(): { alpha: number; beta: number; mape: number }
  reset(): void
  size(): number
  getAuditLog(): readonly ForecasterAuditEntry[]
}
```

## MAPE 계산

```
MAPE = (1/n) * Σ |actual - predicted| / max(|actual|, 1) * 100
```

학습 시 1-step ahead in-sample 예측 사용.

## 신뢰구간

```
residual_i = actual_i - predicted_i
stddev = sqrt(Σ residual^2 / (n-1))
upper/lower = forecast ± 1.96 * stddev * sqrt(step)  // 단순 누적 분산
```

## 격자 탐색

```
for alpha in [0.1, 0.2, ..., 0.9]:
  for beta in [0.1, 0.2, ..., 0.9]:
    compute MAPE
선택: 최소 MAPE
```

## Session Guide

1. addPoint()로 일별/시간별 사용량 입력
2. fitParameters() 호출 → 최적 alpha/beta
3. forecast(steps)로 예측 포인트 + 신뢰구간 획득
4. CI 폭이 너무 크면 데이터 부족 신호로 간주
