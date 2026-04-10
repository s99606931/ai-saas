# Design: SVC-BILL-R1 -- 빌링 서비스 고도화

> 작성일: 2026-04-10 | 버전: 1.0

## 변경 파일
- `src/handlers/billing.handler.ts` -- 감사 로그, 테넌트 격리 보강
- `src/handlers/billing-stats.handler.ts` (NEW) -- 연체 조회, 수익 추이
- `src/middleware/rate-limit.middleware.ts` (NEW)
- `src/routes.ts` -- 신규 라우트 + Rate Limiting
