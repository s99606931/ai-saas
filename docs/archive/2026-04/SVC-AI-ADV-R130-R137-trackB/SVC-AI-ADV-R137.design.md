# SVC-AI-ADV-R137 — CSAP 갱신 관리 (Design)

> 작성일: 2026-04-12 | Plan: SVC-AI-ADV-R137.plan.md

## 1. 아키텍처

```
registerRenewal → generateChecklist
      ↓
CsapRenewalManager
  ├─ updateCheckItem() — 항목 완료 처리
  ├─ getProgress() — 완료율 + D-day
  ├─ getDueAlerts() — 임박 갱신 목록
  └─ getAuditLog() — append-only
```

## 2. 타입 정의

```typescript
export interface Renewal { renewalId: string; systemName: string; expiryDate: string; grade: 'BASIC'|'STANDARD'|'HIGH' }
export interface CheckItem { itemId: string; renewalId: string; description: string; category: string; done: boolean }
export interface RenewalProgress { renewalId: string; totalItems: number; doneItems: number
  completionRate: number; daysUntilExpiry: number }
```

## 3. 알고리즘

### §3.1 체크리스트 자동 생성: grade별 표준 항목 목록 (BASIC 10개, STANDARD 20개, HIGH 30개)
### §3.2 D-day: `(expiryDate - now) / 86400000` 일 단위
### §3.3 임박 알림: daysUntilExpiry ≤ withinDays

## 4. Design Anchor

- CSAP D-06: 관리 이력 감사 로그
