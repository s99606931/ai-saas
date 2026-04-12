# SVC-AI-ADV-R91 — SLA Violation Predictor Design

> Plan Ref: docs/01-plan/mtus/SVC-AI-ADV-R91.plan.md

## Design Anchor

- **선택 옵션**: Pragmatic Balance (선형 회귀 + 에러버짓 소진률)
- **대안**: ML 모델(복잡), 단순 임계값(정확도 낮음)

## 인터페이스

```typescript
export interface SliDataPoint {
  timestamp: number; // epoch ms
  value: number;     // 0.0 ~ 1.0 (가용성)
}

export interface SloTarget {
  serviceId: string;
  targetAvailability: number; // 예: 0.999
  windowMs: number;            // 예: 30d
}

export interface PredictionResult {
  serviceId: string;
  willViolate: boolean;
  predictedViolationAt: number | null;
  remainingBudgetRatio: number;
  burnRate: number;
  confidence: number;
  recommendation: 'NONE' | 'MONITOR' | 'SCALE_UP' | 'ESCALATE';
}

export class SlaViolationPredictor {
  predict(target: SloTarget, series: SliDataPoint[]): PredictionResult;
}
```

## 알고리즘

1. 에러버짓 = (1 - targetAvailability) * windowMs
2. 소진률(burn rate) = (실패분/윈도우분) / (버짓/윈도우분)
3. burn rate > 2x → SCALE_UP, > 10x → ESCALATE
4. 위반시점 = now + (remainingBudget / burnRate)
5. confidence = 샘플 수 기반 (min(1.0, n/30))

## 권장 조치 매트릭스

| burn rate | recommendation |
|-----------|----------------|
| < 1 | NONE |
| 1~2 | MONITOR |
| 2~10 | SCALE_UP |
| > 10 | ESCALATE |

## 테스트

1. 정상 가용성 → willViolate=false, NONE
2. 심각한 소진 → ESCALATE
3. 버짓 0 경계값
4. 빈 시계열 → confidence=0
5. 중간 소진 → SCALE_UP + predictedViolationAt 산출

## Session Guide

- 파일: `platform/services/ai-service/src/lib/sla-violation-predictor.ts`
- 테스트: `platform/services/ai-service/src/lib/__tests__/sla-violation-predictor.test.ts`
