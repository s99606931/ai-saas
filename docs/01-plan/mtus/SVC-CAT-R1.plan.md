# Plan: SVC-CAT-R1 -- 서비스 카탈로그 고도화

> 작성일: 2026-04-10 | 버전: 1.0

## 기능 요구사항

### FR-CAT.1: Rate Limiting
- 읽기 100/60s, 쓰기 20/60s, 삭제 5/300s

### FR-CAT.2: 서비스 검색
- GET /catalog/services에 search 쿼리 파라미터 추가
- name, slug, description 부분 일치

### FR-CAT.3: 카테고리 목록
- GET /catalog/categories: 고유 카테고리 목록 + 각 카테고리별 서비스 수

### FR-CAT.4: Feature Flag 감사 로그
- toggleFlagHandler에 FLAG_TOGGLED 감사 이벤트 추가

### FR-CAT.5: 서비스 통계
- GET /catalog/stats: 총 서비스 수, 활성/비활성, 카테고리 분포

## 변경 파일
- `src/middleware/rate-limit.middleware.ts` (신규)
- `src/handlers/catalog.handler.ts` (수정)
- `src/handlers/catalog-stats.handler.ts` (신규)
- `src/routes.ts` (수정)
- `tests/integration/catalog-enhancements.test.ts` (신규)
