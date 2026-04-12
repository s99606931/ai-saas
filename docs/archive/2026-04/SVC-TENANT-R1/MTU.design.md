# Design: tenant-service 라운드 1 고도화

> MTU ID: SVC-TENANT-R1 | 작성일: 2026-04-09

## 1. FR-TENANT.1: 리소스 사용량 API
- 신규 핸들러: `src/handlers/tenant-usage.handler.ts`
- Prisma 집계 쿼리: `_count.users`, `_sum.files.size`, `_count.subscriptions`

## 2. FR-TENANT.2: 세션 무효화 연동
- `updateTenantStatusHandler`에서 SUSPENDED 시 auth-service HTTP 호출
- HMAC 서비스 토큰 생성 (INTERNAL_SERVICE_KEY 사용)

## 3. FR-TENANT.3: 소프트 삭제
- DELETE /tenants/:id → `status: 'ARCHIVED'`, `archivedAt: now()`
- 하드 삭제는 스케줄러에서 처리 (향후)

## 4. FR-TENANT.4: 설정 관리
- GET /tenants/:id/config, PUT /tenants/:id/config
- JSON 컬럼 활용

## 파일 변경 목록
| 작업 | 파일 | FR |
|------|------|-----|
| 신규 | src/handlers/tenant-usage.handler.ts | FR-TENANT.1 |
| 수정 | src/handlers/tenant.handler.ts | FR-TENANT.2, 3, 4 |
| 수정 | src/routes.ts | 전체 |
| 신규 | tests/integration/tenant-flow.test.ts | FR-TENANT.5 |
