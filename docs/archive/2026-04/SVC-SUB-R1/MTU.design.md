# Design: SVC-SUB-R1 -- 구독 관리 서비스 고도화

> 작성일: 2026-04-10 | 버전: 1.0

## 변경 파일
- `src/handlers/subscription.handler.ts` -- 감사 로그 추가
- `src/handlers/subscription-stats.handler.ts` (NEW)
- `src/middleware/rate-limit.middleware.ts` (NEW)
- `src/routes.ts` -- 신규 라우트 + Rate Limiting
