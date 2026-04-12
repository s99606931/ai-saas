# MTU Design — SVC-AI-ADV-R146 Bid Award Predictor

> Plan Ref: docs/01-plan/mtus/SVC-AI-ADV-R146.plan.md

## 아키텍처: 가중 피쳐 스코어링

외부 ML 없이 결정론적 선형 모델. 감리 시 재현성 보장.

## 타입

```ts
export interface BidFeatures {
  bidId: string
  price: number              // 제안가
  techScore: number          // 0..100 기술평가 점수
  priorWins: number          // 과거 낙찰 건수
  experienceYears: number    // 경력
}

export interface PredictConfig {
  budget: number             // 예산가 (필수, >0)
  weights?: {
    price?: number
    tech?: number
    wins?: number
    experience?: number
  }
}

export interface BidPrediction {
  bidId: string
  rawScore: number
  probability: number        // 0..1
  rank?: number
}
```

## API

```ts
class BidAwardPredictor {
  submit(bid: BidFeatures, grade?: DataGrade): void
  predict(config: PredictConfig): BidPrediction[]
  getAuditLog(): AuditEntry[]
}
```

## 스코어링

- priceScore = clamp(1 - (price - 0.8*budget) / (0.4*budget), 0, 1)
  (예산 80%가 최적, 120% 이상은 0)
- techNorm = techScore / 100
- winsNorm = min(priorWins / 10, 1)
- expNorm = min(experienceYears / 20, 1)
- raw = 0.4*priceScore + 0.3*techNorm + 0.15*winsNorm + 0.15*expNorm (기본 가중치)
- probability = 1 / (1 + exp(-6*(raw - 0.5)))
- 랭킹: probability 내림차순

## 예외

- 음수 price: `invalid_price`
- techScore 범위 밖: `invalid_tech`
- budget <= 0: `invalid_budget`
- 중복 bidId: `duplicate_bid`
- C/S등급: `grade_blocked`
