# SVC-AI-ADV-R447 Design — 시민 권리 침해 감지 AI

Plan Ref: SVC-AI-ADV-R447.plan.md

```ts
export type RightType = 'PRIVACY' | 'DISCRIMINATION' | 'LABOR' | 'FREEDOM' | 'NONE';
export type Severity = 'HIGH' | 'MED' | 'NONE';
export interface ViolationReport {
  readonly primaryType: RightType;
  readonly severity: Severity;
  readonly hits: Record<RightType, number>;
  readonly matched: readonly string[];
}
```
