# SVC-AI-ADV-R441 Design — 공공 서비스 자동화 워크플로우 빌더

Plan Ref: SVC-AI-ADV-R441.plan.md

## 인터페이스
```ts
export type Op = 'eq' | 'ne' | 'gt' | 'lt';
export interface Condition { readonly key: string; readonly op: Op; readonly value: unknown; }
export interface Step {
  readonly id: string;
  readonly when?: Condition;
  readonly action: string;
  readonly set?: Record<string, unknown>;
}
export interface RunResult {
  readonly executed: readonly string[];
  readonly skipped: readonly string[];
  readonly context: Record<string, unknown>;
}
```

## 표현식
- eq: ctx[key] === value
- ne: ctx[key] !== value
- gt/lt: 숫자 비교
