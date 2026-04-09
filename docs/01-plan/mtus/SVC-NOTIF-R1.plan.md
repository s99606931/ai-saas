# Plan: SVC-NOTIF-R1 -- 알림 서비스 고도화 라운드 1

> 작성일: 2026-04-09 | 버전: 1.0

---

## 기능 요구사항

### FR-NOTIF.1: Rate Limiting
- 알림 발송: 20 req/60s, 템플릿 CRUD: 30 req/60s
- Redis 기반 고정 윈도우 (user-service 패턴 재사용)

### FR-NOTIF.2: 읽지 않은 알림 카운트
- `GET /notification/user/:userId/unread-count`
- 테넌트 격리 + 본인 확인 (CSAP D-08-05)

### FR-NOTIF.3: 일괄 읽음 처리
- `PUT /notification/user/:userId/read-all`
- 해당 사용자의 모든 미읽 알림을 'read'로 변경

### FR-NOTIF.4: 발송 이력 테넌트 격리
- listHistoryHandler에 tenantId 필터 강제 적용
- SUPER_ADMIN만 전체 이력 조회 가능

### FR-NOTIF.5: 알림 통계 API
- `GET /notification/stats` -- 채널별/상태별 발송 수 집계
- 테넌트별 격리

---

## 추적성 매트릭스

| FR ID | CSAP | 산출물 | 테스트 |
|-------|------|--------|--------|
| FR-NOTIF.1 | D-10 | rate-limit.middleware.ts | TC-NOTIF-01~04 |
| FR-NOTIF.2 | D-08-05 | notification.handler.ts | TC-NOTIF-05~08 |
| FR-NOTIF.3 | D-08-05 | notification.handler.ts | TC-NOTIF-09~12 |
| FR-NOTIF.4 | D-08-05 | notification.handler.ts | TC-NOTIF-13~16 |
| FR-NOTIF.5 | D-06 | stats.handler.ts | TC-NOTIF-17~20 |
