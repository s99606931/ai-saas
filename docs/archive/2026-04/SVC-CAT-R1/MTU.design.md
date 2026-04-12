# Design: SVC-CAT-R1 -- 서비스 카탈로그 고도화

> 작성일: 2026-04-10 | 버전: 1.0

## 변경 파일
- `src/handlers/catalog.handler.ts` -- 검색, Feature Flag 감사
- `src/handlers/catalog-stats.handler.ts` (NEW) -- 카테고리 목록, 통계
- `src/middleware/rate-limit.middleware.ts` (NEW)
- `src/routes.ts` -- 신규 라우트 + Rate Limiting
