# Design: SVC-NOTIF-R1 -- 알림 서비스 고도화 라운드 1

> 작성일: 2026-04-09 | 버전: 1.0

---

## Section 1: FR-NOTIF.1 Rate Limiting
- user-service rate-limit.middleware.ts 복사 및 재사용
- 발송: 20 req/60s, 템플릿: 30 req/60s, 읽기: 100 req/60s

## Section 2: FR-NOTIF.2 읽지 않은 알림 카운트
- notification.handler.ts에 unreadCountHandler 추가
- Prisma count: `{ userId, status: { not: 'read' } }`
- 본인 확인 + SUPER_ADMIN/TENANT_ADMIN 예외

## Section 3: FR-NOTIF.3 일괄 읽음 처리
- notification.handler.ts에 markAllReadHandler 추가
- Prisma updateMany: `{ userId, status: { not: 'read' } }` -> `{ status: 'read' }`
- 감사 로그 기록

## Section 4: FR-NOTIF.4 발송 이력 테넌트 격리
- listHistoryHandler의 where 조건에 tenantId 강제 추가
- SUPER_ADMIN만 tenantId 미지정 허용

## Section 5: FR-NOTIF.5 알림 통계
- stats.handler.ts 신규 생성
- Prisma groupBy: channel, status 집계
- 테넌트 격리

## Session Guide
1. Rate Limiting 미들웨어 추가
2. unreadCountHandler + markAllReadHandler 구현
3. listHistoryHandler 테넌트 격리 강화
4. 통계 핸들러 구현
5. routes.ts 업데이트
6. 테스트 작성 + 빌드 확인
