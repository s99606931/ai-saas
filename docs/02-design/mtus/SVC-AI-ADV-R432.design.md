# SVC-AI-ADV-R432 Design — Passport/Visa AI Processor

Plan Ref: SVC-AI-ADV-R432.plan.md

## 인터페이스
```ts
export type Urgency = 'URGENT' | 'HIGH' | 'NORMAL';
export interface PassportApp {
  readonly applicantId: string;
  readonly documents: readonly string[];
  readonly departureDate: string;
}
export interface Processed {
  readonly applicantId: string;
  readonly urgency: Urgency;
  readonly completeness: number;
  readonly status: 'INCOMPLETE' | 'READY';
  readonly missing: readonly string[];
}
```

## 알고리즘
1. required = ['photo','idCopy','application','fee']
2. missing = required - documents
3. status = missing.length===0 ? READY : INCOMPLETE
4. daysToDep = (departureDate - now) / day
5. urgency 판정
6. sort: urgency rank desc → completeness desc
