# PM 세션 보고서 -- 2026-04-07 (Deep Exploration 2)

## 세션 개요

| 항목 | 내용 |
|------|------|
| 유형 | 미탐색 영역 심층 분석 및 개선 |
| 모드 | 완전 자율 |
| 프로젝트 상태 | 46/46 MTU archived (100%), production-ready |

## 탐색 영역 및 발견 사항

### 영역 1: E2E 테스트 (Playwright)

**현황**: 9개 스펙 파일, 관리자 5개 + 테넌트 3개 + 워크스루 1개
- `playwright.config.ts`: baseURL localhost:4000, chromium only
- `e2e/fixtures/demo-users.ts`: 5개 데모 계정 (역할별)
- 관리자: 로그인, 대시보드, 테넌트, 사용자, 준수 현황
- 테넌트: 대시보드, 서비스, 마켓플레이스

**개선**: E2E 4개 추가
- `06-audit-logs.spec.ts` -- 감사 로그 페이지 (CSAP D-06)
- `07-ai-management.spec.ts` -- AI 관리 페이지 (N2SF N-05)
- `08-security.spec.ts` -- 보안 모니터링 페이지
- `04-settings.spec.ts` (테넌트) -- 테넌트 설정 페이지

### 영역 2: 플러그인 완전성

**현황**: 2개 플러그인, 각각 스키마 테스트만 존재
- electronic-approval: Hono 기반, Zod 스키마, approval-engine + document-status 비즈니스 로직
- public-data-integration: data.go.kr API 클라이언트, 캐시, CSV/XML 변환기

**개선**:
- `approval-engine.test.ts` (29개 테스트) -- 결재 엔진 전수 테스트
- `document-status.test.ts` (25개 테스트) -- 상태 머신 전수 테스트
- `transformer.test.ts` (15개 테스트) -- 데이터 변환 전수 테스트
- `cache.test.ts` (9개 테스트) -- 캐시 TTL/무효화 테스트

**버그 수정**:
- `approval-engine.ts` 생성자: 얕은 복사(`[...approvers]`) -> 깊은 복사(`approvers.map(a => ({...a}))`)
  - 원인: 외부에서 전달된 approver 객체가 엔진 내부 상태 변경에 의해 변경됨
  - 영향: 동일 결재자 배열을 재사용하는 경우 상태 오염 발생 가능

### 영역 3: 포털 앱 구현 상태

**현황**: 단일 Next.js 앱으로 통합 (`platform/apps/portal/`)
- admin-portal, tenant-portal, docs-portal 디렉토리: E2E 테스트 용도로만 존재 (앱 자체는 미생성)
- 포털 라우트: admin 11개 + tenant 4개 + API 6개 + layout/page
- 컴포넌트: 44개 (admin, tenant, layout, common, mobile, templates, ai)
- 유틸리티: auth-guard.ts, prisma.ts, audit.ts

**평가**: 포털 단일 앱 구조는 합리적. docs-portal은 Docusaurus 별도 배포 예정.

### 영역 4: 데이터베이스 & ORM

**현황**: schema.prisma 411줄, 17개 모델, CSAP 주석 완비
- 마이그레이션 디렉토리 부재 (prisma migrate dev 미실행 상태)
- 시드: 8단계 (플랜/서비스/테넌트/사용자/구독/메뉴/감사로그/AI모델)

**개선**: Prisma 초기 마이그레이션 SQL 생성
- `prisma/migrations/0001_initial/migration.sql` -- 전체 스키마 SQL
- `prisma/migrations/migration_lock.toml` -- PostgreSQL 잠금

### 영역 5: CI/CD & 환경 설정

**현황**: Gitea Actions 3개 워크플로우
- `ci.yml`: Build + Test (pnpm, Node 22, PostgreSQL 16, Redis 7)
- `deploy.yml`: Docker 매트릭스 빌드 + Harbor 푸시 (15개 서비스)
- `security.yml`: 의존성 감사 + Gitleaks + 하드코딩 시크릿 검사

**발견된 문제 및 수정**:
1. `deploy.yml` -- security-service 누락: 매트릭스에 추가됨 (16개로 증가)
2. `docker-compose.yml` -- 두 가지 문제 수정:
   - security-service 컨테이너 누락: 포트 3014로 추가
   - security-monitor-service 포트: 3014 -> 3015 수정 (코드 기준 3015)
3. `.env.example` -- .gitignore에 허용되어 있으나 파일 미존재
   - 보안 정책으로 직접 생성 불가 (별도 수동 생성 필요)
4. `catalog-service` vs `saas-catalog-service` 중복:
   - saas-catalog-service/index.ts에 "초기 스캐폴딩 잔재" 명시
   - docker-compose.yml에서 saas-catalog-service 참조 중 (향후 정리 필요)

### 영역 6: API 문서

**현황**: API Gateway에 Swagger 플러그인 구현 완료
- `platform/services/api-gateway/src/plugins/swagger.ts`
- OpenAPI 3.0.3, 12개 태그, JWT Bearer Auth
- 개발: 자동 활성화, 운영: ENABLE_SWAGGER=true 필요
- Swagger UI: `/api/docs`

**평가**: 별도 OpenAPI 스펙 파일 없이 런타임 생성 방식. 정적 스펙 export는 향후 과제.

## 이번 세션 산출물 (신규 생성)

| 파일 | 유형 | 테스트 수 |
|------|------|---------|
| `e2e/admin-portal/06-audit-logs.spec.ts` | E2E | 5 |
| `e2e/admin-portal/07-ai-management.spec.ts` | E2E | 3 |
| `e2e/admin-portal/08-security.spec.ts` | E2E | 3 |
| `e2e/tenant-portal/04-settings.spec.ts` | E2E | 3 |
| `plugins/electronic-approval/tests/unit/approval-engine.test.ts` | Unit | 29 |
| `plugins/electronic-approval/tests/unit/document-status.test.ts` | Unit | 25 |
| `plugins/public-data-integration/tests/unit/transformer.test.ts` | Unit | 15 |
| `plugins/public-data-integration/tests/unit/cache.test.ts` | Unit | 9 |
| `prisma/migrations/0001_initial/migration.sql` | DB | - |
| `prisma/migrations/migration_lock.toml` | DB | - |

## 코드 수정

| 파일 | 변경 | 이유 |
|------|------|------|
| `plugins/electronic-approval/src/lib/approval-engine.ts` | 얕은 복사 -> 깊은 복사 | 외부 상태 오염 방지 버그 수정 |
| `docker-compose.yml` | security-service 추가, 포트 수정 | 배포 누락 + 포트 충돌 해결 |
| `.gitea/workflows/deploy.yml` | security-service 매트릭스 추가 | CI/CD 빌드 대상 누락 |

## 테스트 결과

| 모듈 | 결과 | 비고 |
|------|------|------|
| electronic-approval 플러그인 | 69/69 PASS | +40 신규 (기존 29) |
| public-data-integration 플러그인 | 48/48 PASS | +24 신규 (기존 24) |
| auth-service | 49/49 PASS | 기존 유지 |
| api-gateway | 28/28 PASS | 기존 유지 |
| tenant-service | 29/29 PASS | 기존 유지 |

## 미해결 사항 (향후 세션)

1. `.env.example` 수동 생성 필요 (보안 정책으로 자동 생성 불가)
2. `saas-catalog-service` vs `catalog-service` 정리 (docker-compose.yml 참조 변경)
3. Prisma migrations: `npx prisma migrate dev` 실행으로 공식 마이그레이션 히스토리 생성
4. OpenAPI 정적 스펙 파일 export (`npx swagger-jsdoc` 또는 `prisma/openapi-generator`)
5. E2E 테스트 CI 연동: Playwright 설치 + 포털 서버 시작 스크립트 추가
