# SVC-AI-ADV-R429 Design — AI Policy Impact Simulator v3

Plan Ref: SVC-AI-ADV-R429.plan.md

## 인터페이스
```ts
export interface PolicyScenario {
  readonly scenarioId: string;
  readonly baseRevenue: number;
  readonly baseBeneficiaries: number;
  readonly deltaTax: number;
  readonly deltaBenefit: number;
  readonly elasticityTax: number;
  readonly elasticityBenefit: number;
}
export type SimRec = 'PROCEED' | 'REVIEW' | 'REJECT';
export interface SimResult {
  readonly scenarioId: string;
  readonly projectedRevenue: number;
  readonly projectedBeneficiaries: number;
  readonly sideEffectScore: number;
  readonly recommendation: SimRec;
}
```

## 알고리즘
- revenue = base*(1 + elasticityTax*deltaTax)
- beneficiaries = base*(1 + elasticityBenefit*deltaBenefit)
- sideEffect = clip(|deltaTax|*50 + |deltaBenefit|*30, 0, 100)
- rec: <40 PROCEED, <70 REVIEW, ≥70 REJECT
