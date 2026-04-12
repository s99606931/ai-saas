# SVC-AI-ADV-R146 — 스마트 알림 라우터 (Design)

> 작성일: 2026-04-12 | Plan: SVC-AI-ADV-R146.plan.md

## 1. 아키텍처

```
registerUser → route(notification)
      ↓
SmartNotificationRouter
  ├─ 채널 우선순위 선택 (email > sms > push > inapp)
  ├─ 방해금지 시간대 검사 (quietHours)
  ├─ suppressDuplicate() — TTL 기반 중복 억제
  ├─ getDeliveryHistory() — 배달 이력
  └─ getAuditLog() — append-only
```

## 2. 타입 정의

```typescript
export type Channel = 'email' | 'sms' | 'push' | 'inapp'
export type Priority = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW'
export interface UserPreferences {
  userId: string; channels: Channel[]; quietStart: number; quietEnd: number }
export interface Notification {
  notificationId: string; userId: string; title: string
  body: string; priority: Priority; dedupeKey?: string }
export interface DeliveryResult {
  notificationId: string; channel: Channel | null
  delivered: boolean; reason: string; routedAt: string }
```

## 3. 알고리즘

### §3.1 채널 선택: 사용자 등록 채널 우선순위 순서 + CRITICAL은 quiet 무시
### §3.2 방해금지: `quietStart ≤ currentHour < quietEnd` → inapp 폴백
### §3.3 중복 억제: Map<key, expiry> — TTL 내 동일 key 재발송 차단

## 4. Design Anchor
- CSAP D-06: 라우팅 감사 로그
