# SVC-AI-ADV-R445 Design — AI 기반 법원 판례 요약기

Plan Ref: SVC-AI-ADV-R445.plan.md

```ts
export interface CaseSummary {
  readonly issues: string;
  readonly rulings: string;
  readonly conclusion: string;
  readonly found: readonly ('issues' | 'rulings' | 'conclusion')[];
}
```

키워드: 쟁점, 판시사항, 결론
