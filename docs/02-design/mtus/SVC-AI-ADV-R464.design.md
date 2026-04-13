# SVC-AI-ADV-R464 Design — 정부 챗봇 응답 품질 평가기

Plan Ref: SVC-AI-ADV-R464.plan.md

```ts
export interface ChatPair {
  readonly question: string;
  readonly answer: string;
  readonly keywords: readonly string[];
}
export type QualityGrade = 'A'|'B'|'C'|'D';
export interface QualityReport {
  readonly relevance: number;
  readonly clarity: number;
  readonly completeness: number;
  readonly totalScore: number;
  readonly grade: QualityGrade;
}
```
