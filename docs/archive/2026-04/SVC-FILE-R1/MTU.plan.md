# Plan: SVC-FILE-R1 -- 파일 관리 서비스 고도화

> 작성일: 2026-04-10 | 버전: 1.0

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 파일 관리 서비스 보안·운영 고도화 |
| 기술 | Rate Limiting + 검색/필터 + 감사 로그 완전성 |
| 보안 | CSAP D-06, D-10 위반 항목 해소 |
| 품질 | 통합 테스트 30+ 항목 추가 |

## 기능 요구사항

### FR-FILE.1: Rate Limiting
- 읽기 엔드포인트: 100 req/60s
- 업로드 엔드포인트: 10 req/60s
- 삭제 엔드포인트: 5 req/300s
- Redis INCR+EXPIRE 고정 윈도우, Redis 미연결 시 통과

### FR-FILE.2: 파일 검색/필터
- 쿼리 파라미터: search (이름 부분 일치), mimeType, minSize, maxSize, startDate, endDate
- 정렬: sortBy (name, size, createdAt), sortOrder (asc, desc)

### FR-FILE.3: 다운로드 감사 로그
- downloadFileHandler에 FILE_DOWNLOADED 감사 이벤트 추가
- CSAP D-06 감사 추적 완전성 확보

### FR-FILE.4: 테넌트별 저장 용량 조회
- GET /file/storage-usage: 테넌트별 총 파일 수, 총 용량, 용량 한도 대비 사용률

### FR-FILE.5: 파일 통계
- GET /file/stats: 테넌트별 MIME 타입 분포, 일별/주별 업로드 추이

## 변경 파일
- `src/middleware/rate-limit.middleware.ts` (신규)
- `src/handlers/file.handler.ts` (수정)
- `src/handlers/file-stats.handler.ts` (신규)
- `src/routes.ts` (수정)
- `tests/integration/file-enhancements.test.ts` (신규)

## 추적성 매트릭스

| FR ID | 산출물 | 테스트 | CSAP |
|-------|--------|--------|------|
| FR-FILE.1 | rate-limit.middleware.ts | T-FILE.1.x | D-10 |
| FR-FILE.2 | file.handler.ts (listFilesHandler) | T-FILE.2.x | D-12 |
| FR-FILE.3 | file.handler.ts (downloadFileHandler) | T-FILE.3.x | D-06 |
| FR-FILE.4 | file-stats.handler.ts | T-FILE.4.x | D-08 |
| FR-FILE.5 | file-stats.handler.ts | T-FILE.5.x | D-06 |
