# SVC-AI-ADV-R512 Design — public-data-quality-improver-v3.ts

Plan Ref: SVC-AI-ADV-R512.plan.md

```ts
export type DataGrade = 'O' | 'C' | 'S';
export type ErrorType = 'MISSING_FIELD' | 'FORMAT_ERROR' | 'DUPLICATE';
export interface DataRecord {
  readonly recordId: string;
  readonly fields: Readonly<Record<string, string>>;
  readonly grade: DataGrade;
}
export interface QualityIssue {
  readonly field: string;
  readonly errorType: ErrorType;
}
export interface QualityResult {
  readonly recordId: string;
  readonly issues: readonly QualityIssue[];
  readonly qualityScore: number; // 0~100
}
```

C/S → throw `BLOCKED: ${grade}등급 데이터 처리 금지`
MISSING_FIELD: value==='' || value==null
FORMAT_ERROR: /^\d{4}\.\d{2}\.\d{2}$/ 매치 시 (점 구분 날짜)
qualityScore = (정상필드수/전체필드수)*100, round to 1 decimal
DUPLICATE: 같은 recordId 재등장 시 전체 레코드에 DUPLICATE 표시
