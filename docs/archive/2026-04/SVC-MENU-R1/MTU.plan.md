# Plan: SVC-MENU-R1 -- 메뉴 관리 서비스 고도화

> 작성일: 2026-04-10 | 버전: 1.0

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 메뉴 관리 보안·운영 고도화 |
| 기술 | Rate Limiting + 검색 + 감사 완전성 |
| 보안 | CSAP D-06, D-08, D-10 위반 해소 |
| 품질 | 통합 테스트 30+ 항목 추가 |

## 기능 요구사항

### FR-MENU.1: Rate Limiting
- 읽기: 100 req/60s, 쓰기: 30 req/60s, 삭제: 10 req/300s

### FR-MENU.2: 메뉴 검색
- GET /menu/search?q={keyword}: label, path 부분 일치 검색

### FR-MENU.3: 삭제 감사 로그
- deleteMenuHandler에 MENU_DELETED 감사 이벤트 추가

### FR-MENU.4: 순서변경 보강
- reorderMenuHandler에 테넌트 격리 + MENU_REORDERED 감사 이벤트 추가

### FR-MENU.5: 메뉴 통계
- GET /menu/stats: 총 메뉴 수, 최상위 수, 최대 깊이

## 변경 파일
- `src/middleware/rate-limit.middleware.ts` (신규)
- `src/handlers/menu.handler.ts` (수정)
- `src/handlers/menu-stats.handler.ts` (신규)
- `src/routes.ts` (수정)
- `tests/integration/menu-enhancements.test.ts` (신규)
