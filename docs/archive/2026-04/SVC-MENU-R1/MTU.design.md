# Design: SVC-MENU-R1 -- 메뉴 관리 서비스 고도화

> 작성일: 2026-04-10 | 버전: 1.0

## 변경 파일
- `src/handlers/menu.handler.ts` -- 삭제 감사, 순서변경 보강, 검색
- `src/handlers/menu-stats.handler.ts` (NEW) -- 메뉴 통계
- `src/middleware/rate-limit.middleware.ts` (NEW)
- `src/routes.ts` -- 신규 라우트 + Rate Limiting
