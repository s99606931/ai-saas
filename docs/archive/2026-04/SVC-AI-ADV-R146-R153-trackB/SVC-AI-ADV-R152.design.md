# SVC-AI-ADV-R152 — API 사용량 예측기 (Design)

> 작성일: 2026-04-12 | Plan: SVC-AI-ADV-R152.plan.md

## 1. 아키텍처

```
recordCall → forecast / detectPeaks / recommendCapacity
      ↓
ApiUsagePredictor
  ├─ 시간별 버킷 집계
  ├─ 이동평균 예측 (window=6h)
  ├─ Z-score 기반 피크 탐지
  └─ getAuditLog() — append-only
```

## 2. 타입 정의

```typescript
export interface CallRecord { apiId: string; timestamp: number; count: number }
export interface ForecastPoint { hour: string; predicted: number; upper: number }
export interface PeakEvent { hour: string; count: number; zScore: number }
export interface CapacityRecommendation {
  apiId: string; currentPeak: number; recommendedRps: number
  scaleBy: number; reason: string }
```

## 3. 알고리즘

### §3.1 버킷: timestamp → `Math.floor(ts / 3600000)` 시간 단위
### §3.2 이동평균: window=6 버킷 평균
### §3.3 피크: z = (x - mean) / std > 2.0 인 버킷
### §3.4 용량 권고: peak * 1.5 (안전 여유) + 올림

## 4. Design Anchor
- CSAP D-06: 예측 감사 로그
