# SVC-AI-ADV-R421 Design — AI-Powered Grant Reviewer

## Context Anchor
Plan Ref: SVC-AI-ADV-R421.plan.md

## 인터페이스
```ts
export type DataGrade = 'O' | 'C' | 'S';
export interface GrantApplication {
  readonly applicantId: string;
  readonly income: number;
  readonly age: number;
  readonly familySize: number;
  readonly fraudHistory: boolean;
}
export interface GrantRule {
  readonly incomeCap: number;
  readonly minAge: number;
  readonly baseAmount: number;
}
export interface ReviewResult {
  readonly applicantId: string;
  readonly eligible: boolean;
  readonly recommendedAmount: number;
  readonly riskLevel: 'LOW' | 'HIGH';
  readonly reasonCode: string;
}
```

## 알고리즘
1. N2SF 차단 (C/S 에러)
2. 소득 > incomeCap → INCOME_OVER / eligible=false
3. age < minAge → AGE_UNDER / eligible=false
4. fraudHistory=true → riskLevel='HIGH' (적격이어도)
5. recommendedAmount = base × clip(1 - income/cap, 0, 1)
6. 감사 로그 기록

## Session Guide
- `grant-reviewer-ai.ts` 구현 → `__tests__/grant-reviewer-ai.test.ts` 6개 이상
