# SVC-AI-ADV-R460 Design — 기관 간 데이터 교환 AI

Plan Ref: SVC-AI-ADV-R460.plan.md

```ts
export type FieldType = 'string' | 'number' | 'date';
export interface Mapping {
  readonly sourceField: string;
  readonly targetField: string;
  readonly type: FieldType;
}
export interface ExchangeResult {
  readonly transformed: Record<string, string | number>;
  readonly lostFields: readonly string[];
}
```
