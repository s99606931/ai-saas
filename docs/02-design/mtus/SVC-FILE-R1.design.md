# Design: SVC-FILE-R1 -- 파일 관리 서비스 고도화

> 작성일: 2026-04-10 | 버전: 1.0

## 변경 파일
- `src/handlers/file.handler.ts` -- 검색/필터, 다운로드 감사 로그
- `src/handlers/file-stats.handler.ts` (NEW) -- 저장 용량, 통계
- `src/middleware/rate-limit.middleware.ts` (NEW)
- `src/routes.ts` -- 신규 라우트 + Rate Limiting

## FR-FILE.1: Rate Limiting 설계
- createRateLimiter(max, window, prefix) 팩토리
- Redis INCR + EXPIRE 고정 윈도우
- Redis 미연결 시 가용성 우선 통과
- 응답 헤더: X-RateLimit-Limit, Remaining, Reset

## FR-FILE.2: 파일 검색/필터 설계
- listFilesHandler 쿼리 파라미터 확장
- Prisma where 조건 동적 빌더: name contains, mimeType equals, size gte/lte, createdAt gte/lte
- 정렬: sortBy + sortOrder

## FR-FILE.3: 다운로드 감사 로그 설계
- downloadFileHandler 성공 시 logFileEvent('FILE_DOWNLOADED', ...) 호출
- 접근 거부 시 logFileEvent('FILE_ACCESS_DENIED', ...) 호출

## FR-FILE.4: 저장 용량 조회 설계
- GET /file/storage-usage
- Prisma aggregate: _count, _sum(size), where tenantId
- 용량 한도: 환경변수 TENANT_STORAGE_LIMIT_MB (기본 1024MB)

## FR-FILE.5: 파일 통계 설계
- GET /file/stats
- Prisma groupBy mimeType + _count
- 최근 7일 일별 업로드 카운트
