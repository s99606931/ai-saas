# Plan: SVC-SUB-R1 -- 구독 관리 서비스 고도화

> 작성일: 2026-04-10 | 버전: 1.0

## 기능 요구사항

### FR-SUB.1: Rate Limiting
- 읽기 100/60s, 쓰기 20/60s, 취소 5/300s

### FR-SUB.2: 플랜 CRUD 감사 로그
- createPlanHandler: PLAN_CREATED
- updatePlanHandler: PLAN_UPDATED

### FR-SUB.3: 구독 만료 임박 조회
- GET /subscription/expiring?days=7

### FR-SUB.4: 구독 통계
- GET /subscription/stats: 상태별 분포, 플랜별 구독 수

## 변경 파일
- `src/middleware/rate-limit.middleware.ts` (신규)
- `src/handlers/subscription.handler.ts` (수정)
- `src/handlers/subscription-stats.handler.ts` (신규)
- `src/routes.ts` (수정)
- `tests/integration/subscription-enhancements.test.ts` (신규)
