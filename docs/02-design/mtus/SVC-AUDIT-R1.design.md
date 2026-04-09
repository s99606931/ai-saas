# Design: audit-service 라운드 1 고도화

> MTU ID: SVC-AUDIT-R1 | 작성일: 2026-04-09

## 1. FR-AUDIT.1: 감사 이벤트 집계
- 신규 핸들러: `src/handlers/analytics.handler.ts`
- Prisma groupBy + 날짜 트렁케이션

## 2. FR-AUDIT.2: Top-N 통계
- 동일 핸들러에서 groupBy + orderBy count DESC + take N

## 파일 변경 목록
| 작업 | 파일 | FR |
|------|------|-----|
| 신규 | src/handlers/analytics.handler.ts | FR-AUDIT.1, 2 |
| 수정 | src/routes.ts | 라우트 등록 |
| 신규 | tests/integration/audit-analytics.test.ts | FR-AUDIT.3 |
