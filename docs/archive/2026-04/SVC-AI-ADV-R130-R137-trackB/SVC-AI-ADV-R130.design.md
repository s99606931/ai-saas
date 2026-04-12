# SVC-AI-ADV-R130 — 공공서비스 수요 예측기 (Design)

> 작성일: 2026-04-12 | Plan: SVC-AI-ADV-R130.plan.md

## 1. 아키텍처

```
recordDemand / addEvent
      ↓
PublicServiceDemandForecaster
  ├─ decompose() — 이동평균 트렌드 + 계절성 지수
  ├─ forecast()  — 트렌드 외삽 + 계절성 × 이벤트 가중치
  └─ getAuditLog() — append-only
```

## 2. 타입 정의

```typescript
export interface DemandPoint { serviceId: string; timestamp: number; value: number }
export interface Decomposition { trend: number[]; seasonal: number[]; residual: number[] }
export interface ForecastPoint { date: string; predicted: number; lower: number; upper: number }
export interface EventWeight { serviceId: string; date: string; multiplier: number }
```

## 3. 알고리즘

### §3.1 트렌드: 이동평균 (window=7)
### §3.2 계절성: 주간 패턴 (dayOfWeek 평균 / 전체 평균)
### §3.3 예측: `trend_last * seasonal_factor * event_multiplier`
### §3.4 신뢰구간: `±1.5 * residual_std`

## 4. Design Anchor

- CSAP D-06: 예측 호출 감사 로그
- 순수 계산, 외부 API 없음
