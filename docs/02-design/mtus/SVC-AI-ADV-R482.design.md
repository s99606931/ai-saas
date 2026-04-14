# SVC-AI-ADV-R482 Design — public-data-linkage-automator-v3.ts

Plan Ref: SVC-AI-ADV-R482.plan.md

```ts
export type DataGrade = 'O' | 'C' | 'S';
export interface DataSource {
  readonly sourceId: string;
  readonly fields: readonly string[];
  readonly grade: DataGrade;
}
export interface LinkageMapping {
  readonly sourceA: string;
  readonly sourceB: string;
  readonly mappableFields: readonly string[];    // intersection
  readonly missingInA: readonly string[];        // in B but not A
  readonly missingInB: readonly string[];        // in A but not B
  readonly compatibilityScore: number;           // intersection/union * 100
}
```

C/S 등급: throw `BLOCKED: ${grade}등급 데이터 소스 연계 금지`
compatibilityScore = round(intersection.length / union.length * 100)
