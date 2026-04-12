# SVC-AI-ADV-R134 — 회의 효율화 엔진 (Design)

> 작성일: 2026-04-12 | Plan: SVC-AI-ADV-R134.plan.md

## 1. 아키텍처

```
parseMeetingMinutes → extractActionItems
      ↓
MeetingEfficiencyAi
  ├─ assignOwner() — 담당자 배정
  ├─ updateStatus() — 상태 변경
  ├─ getPendingActions() — 미완료 조회
  └─ getAuditLog() — append-only
```

## 2. 타입 정의

```typescript
export type ActionStatus = 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED'
export interface ActionItem {
  actionId: string; meetingId: string; description: string
  owner: string | null; dueDate: string | null; status: ActionStatus }
```

## 3. 알고리즘

### §3.1 액션 아이템 패턴:
- `(담당|조치|처리|완료|확인|검토|준비|제출|보고|수행)\s*[:：]?\s*(.+)` (Korean)
- `(action|todo|follow.?up|assign|complete|review|prepare|submit)\s*[:：]?\s*(.+)` (English, case-insensitive)

### §3.2 마감일 파싱: `(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}|\d{1,2}월\s*\d{1,2}일)` 패턴

## 4. Design Anchor

- CSAP D-06: 처리 감사 로그
