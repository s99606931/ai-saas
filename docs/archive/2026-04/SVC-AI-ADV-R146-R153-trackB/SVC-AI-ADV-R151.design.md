# SVC-AI-ADV-R151 — 보안 인시던트 타임라인 AI (Design)

> 작성일: 2026-04-12 | Plan: SVC-AI-ADV-R151.plan.md

## 1. 아키텍처

```
ingestEvent → buildTimeline / buildAttackChain
      ↓
SecurityIncidentTimeline
  ├─ 시간 순 정렬 + 필터
  ├─ traceId 기반 인과 체인
  ├─ MITRE ATT&CK 전술 매핑
  └─ getAuditLog() — append-only (원본 불변)
```

## 2. 타입 정의

```typescript
export interface SecurityEvent {
  eventId: string; timestamp: number; actor: string; action: string
  resource: string; traceId?: string; incidentId?: string; severity: 'CRITICAL'|'HIGH'|'MEDIUM'|'LOW' }
export interface TimelineFilter {
  from?: number; to?: number; actor?: string; action?: string; incidentId?: string }
export interface AttackChain {
  traceId: string; events: SecurityEvent[]; mitreMapping: string[] }
```

## 3. 알고리즘

### §3.1 타임라인: 필터 적용 후 timestamp 오름차순 정렬
### §3.2 공격 체인: 동일 traceId 이벤트 + incidentId 이벤트 union → 시간 순
### §3.3 MITRE 매핑 (결정적):
- login_fail → T1110 (Brute Force)
- privilege_escalation → T1068 (Exploitation for Privilege Escalation)
- data_exfil → T1041 (Exfiltration Over C2 Channel)
- lateral_movement → T1021 (Remote Services)
- persistence → T1053 (Scheduled Task)

## 4. Design Anchor
- CSAP D-06: 이벤트 append-only, 분석 감사 로그
