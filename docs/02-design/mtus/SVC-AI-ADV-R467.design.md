# SVC-AI-ADV-R467 Design — AI 법원 일정 자동 배정

Plan Ref: SVC-AI-ADV-R467.plan.md

```ts
export type CaseType = 'civil'|'criminal'|'admin';
export interface CourtCase {
  readonly id: string;
  readonly type: CaseType;
  readonly priority: 1|2|3|4|5;
}
export interface Judge {
  readonly id: string;
  readonly specialties: readonly CaseType[];
  readonly dailyCapacity: number;
  currentLoad: number;
}
export interface Assignment {
  readonly caseId: string;
  readonly judgeId: string;
}
export interface ScheduleResult {
  readonly assignments: readonly Assignment[];
  readonly unscheduled: readonly string[];
}
```
