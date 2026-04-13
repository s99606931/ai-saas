# SVC-AI-ADV-R428 Design — Citizen Engagement Analyzer

Plan Ref: SVC-AI-ADV-R428.plan.md

## 인터페이스
```ts
export interface EngagementInput {
  readonly policyId: string;
  readonly participants: number;
  readonly targetPopulation: number;
  readonly satisfaction: number;
}
export type Grade = 'LOW' | 'MID' | 'HIGH';
export interface EngagementResult {
  readonly policyId: string;
  readonly participationRate: number;
  readonly responseScore: number;
  readonly engagementIndex: number;
  readonly grade: Grade;
}
```

## 알고리즘
- rate = participants/targetPopulation
- responseScore = clip(rate*100, 0, 100)
- engagementIndex = responseScore*0.5 + satisfaction*0.5
- grade LOW<40, MID<70, HIGH≥70
