# SVC-AI-ADV-R427 Design — Public Asset Manager AI

Plan Ref: SVC-AI-ADV-R427.plan.md

## 인터페이스
```ts
export type Condition = 'GOOD' | 'FAIR' | 'BAD';
export interface Asset {
  readonly assetId: string;
  readonly elapsedYears: number;
  readonly usefulLifeYears: number;
  readonly condition: Condition;
}
export type Recommendation = 'KEEP' | 'REVIEW' | 'DISPOSE';
export interface AssetAdvice {
  readonly assetId: string;
  readonly ageRatio: number;
  readonly recommendation: Recommendation;
  readonly reasonCode: string;
}
```

## 규칙
- BAD → DISPOSE (BAD_CONDITION)
- ageRatio<0.7 → KEEP
- <1.0 → REVIEW
- ≥1.0 → DISPOSE (EOL)
