# SVC-AI-ADV-R438 Design — Disaster Pre-Alert Auto Issuer AI

Plan Ref: SVC-AI-ADV-R438.plan.md

## 인터페이스
```ts
export type DisasterKind = 'RAINFALL' | 'SEISMIC' | 'FLOOD';
export type AlertLevel = 'NONE' | 'CAUTION' | 'WARNING' | 'SEVERE';
export interface Reading {
  readonly kind: DisasterKind;
  readonly metric: number;
}
export interface Alert {
  readonly kind: DisasterKind;
  readonly level: AlertLevel;
  readonly metric: number;
  readonly threshold: number;
  readonly issuedAt: string;
}
```

## 임계값 테이블
- RAINFALL: 30 → CAUTION, 60 → WARNING, 100 → SEVERE
- SEISMIC:   3.5 → CAUTION, 5.0 → WARNING, 6.5 → SEVERE
- FLOOD:     2 → CAUTION, 4 → WARNING, 6 → SEVERE
