# SVC-AI-ADV-R439 Design — Open Data Quality Manager AI

Plan Ref: SVC-AI-ADV-R439.plan.md

## 인터페이스
```ts
export interface DatasetStats {
  readonly datasetId: string;
  readonly totalRows: number;
  readonly nullCount: number;
  readonly invalidCount: number;
  readonly schemaViolations: number;
  readonly lastUpdated: string;
}
export type Grade = 'A' | 'B' | 'C' | 'D';
export interface Scorecard {
  readonly datasetId: string;
  readonly completeness: number;
  readonly freshness: number;
  readonly accuracy: number;
  readonly consistency: number;
  readonly overall: number;
  readonly grade: Grade;
}
```
