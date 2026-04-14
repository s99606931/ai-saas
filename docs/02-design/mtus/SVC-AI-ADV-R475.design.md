# SVC-AI-ADV-R475 Design — public-safety-threat-detector-ai.ts

Plan Ref: SVC-AI-ADV-R475.plan.md

```ts
export type DataGrade = 'O' | 'C' | 'S';
export interface ThreatEvent {
  readonly eventId: string;
  readonly type: string;
  readonly severity: number; // 0~1
  readonly location: string;
  readonly timestamp: string;
  readonly grade: DataGrade;
}
export type ThreatLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export interface ThreatResult {
  readonly eventId: string;
  readonly level: ThreatLevel;
  readonly maskedLocation: string;
}
```

severity>=0.8: CRITICAL, >=0.6: HIGH, >=0.4: MEDIUM, else LOW
C/S 등급: throw `BLOCKED: ${grade}등급 데이터는 처리 금지`
location 마스킹: 첫 3자 + '***'
