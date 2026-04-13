# SVC-AI-ADV-R435 Design — Tax Audit Risk Assessor AI

Plan Ref: SVC-AI-ADV-R435.plan.md

## 인터페이스
```ts
export type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW';
export interface Taxpayer {
  readonly taxpayerId: string;
  readonly cashRatio: number;     // 0..1
  readonly reportGap: number;     // 0..1 (신고-추정 차이)
  readonly industryRisk: number;  // 0..1
}
export interface RiskAssessment {
  readonly taxpayerId: string;
  readonly score: number;
  readonly level: RiskLevel;
  readonly topFactors: readonly string[];
}
```

## 알고리즘
- score = 0.4*cashRatio + 0.3*reportGap + 0.3*industryRisk
- level 분류
- factors: 기여도 = weight * value, 상위 2개 반환
