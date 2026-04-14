# SVC-AI-ADV-R513 Design — realtime-threat-classifier-v2.ts

Plan Ref: SVC-AI-ADV-R513.plan.md

```ts
export type DataGrade = 'O' | 'C' | 'S';
export type ThreatType = 'SQL_INJECTION' | 'XSS' | 'BRUTE_FORCE' | 'DDOS' | 'UNKNOWN';
export type ThreatSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM';
export interface SecurityEvent {
  readonly eventId: string;
  readonly source: string;
  readonly eventType: string;
  readonly payload: string;
  readonly grade: DataGrade;
}
export interface ThreatClassification {
  readonly eventId: string;
  readonly threatType: ThreatType;
  readonly severity: ThreatSeverity;
  readonly response: string;
}
```

C/S → throw `BLOCKED: ${grade}등급 보안 이벤트 처리 금지`
payload 키워드 탐지:
  'SELECT'|'UNION'|'DROP'|"'"→SQL_INJECTION(CRITICAL)
  '<script'|'onerror'|'javascript:'→XSS(HIGH)
  'login'|'password'|'attempt'→BRUTE_FORCE(HIGH)
  'flood'|'ddos'|'amplification'→DDOS(CRITICAL)
  else UNKNOWN(MEDIUM)
response: CRITICAL→'BLOCK_AND_ALERT', HIGH→'BLOCK', MEDIUM→'LOG_AND_MONITOR'
