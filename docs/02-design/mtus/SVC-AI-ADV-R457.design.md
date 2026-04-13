# SVC-AI-ADV-R457 Design — 민원 자동 해결 제안 AI

Plan Ref: SVC-AI-ADV-R457.plan.md

```ts
export interface FAQ {
  readonly id: string;
  readonly keywords: readonly string[];
  readonly solution: string;
}
export interface ResolveResult {
  readonly matched: boolean;
  readonly faqId?: string;
  readonly score?: number;
  readonly recommendation: string;
}
```
