# SVC-AI-ADV-R194 — 회의록 구조화기 (Design)

> 작성일: 2026-04-12 | 버전: 1.0.0

## 타입

```typescript
export type DataGrade = 'C' | 'S' | 'O'
export interface MeetingMinutes { meetingId: string; title: string; rawText: string; date: string; grade?: DataGrade }
export interface ActionItem { assignee: string; task: string; dueDate?: string }
export interface StructuredMeeting { meetingId: string; title: string; date: string; attendees: string[]; agendaItems: string[]; decisions: string[]; actionItems: ActionItem[]; summary: string }
class MeetingMinutesStructurer {
  structure(minutes: MeetingMinutes): StructuredMeeting
  getAuditLog(): AuditEntry[]
}
```

## 알고리즘
- 참석자: `참석자?[:：]` 라인 파싱, 쉼표/공백 분리
- 의제: `의제|안건` 키워드 포함 라인
- 결정사항: `결정|의결|승인|합의` 키워드 포함 라인
- 액션아이템: `담당|조치|완료|처리` 키워드 포함 라인에서 추출
