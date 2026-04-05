# 공공 SaaS 플랫폼 데모 테스트 가이드

> 대상: 비개발자 포함 전체 이해관계자
> 목적: 공공기관 SaaS 플랫폼 포털(port 4000) 기능 시연 및 품질 확인
> 작성일: 2026-04-06 | MTU-E2E1

---

## 빠른 시작 (5분)

### 1단계: 사전 요건 확인

다음 소프트웨어가 설치되어 있어야 합니다.

- Docker Desktop 실행 중 (postgres 컨테이너 구동용)
- Node.js 20 이상 (`node --version` 으로 확인)
- pnpm 설치: `npm i -g pnpm`

### 2단계: 환경 설정

```bash
# 프로젝트 루트에서 실행
cp .env.example .env

# Docker 컨테이너 시작 (postgres, redis 등)
docker compose up -d

# 패키지 설치
pnpm install
```

### 3단계: DB 초기화 + 시드 실행

```bash
# 마이그레이션 적용
pnpm prisma migrate deploy

# 데모 데이터 시드 (테넌트, 사용자, 서비스 등록)
pnpm prisma db seed
```

### 4단계: 포털 실행

```bash
# 포털 개발 서버 시작 (port 4000)
pnpm --filter @public-saas/portal dev
```

### 5단계: 브라우저에서 테스트

브라우저에서 http://localhost:4000 접속

---

## 데모 계정

> 주의: 아래 계정은 데모 전용입니다. 프로덕션 환경에서 사용하지 마십시오.

| 역할 | 이메일 | 비밀번호 | 접근 가능 화면 |
|------|--------|---------|--------------|
| 슈퍼 관리자 | superadmin@platform.go.kr | Demo2026! | 전체 관리자 메뉴 |
| 테넌트 관리자(행안부) | admin@mois-demo.go.kr | Demo2026! | 행안부 테넌트 관리 |
| 테넌트 관리자(국토부) | admin@molit-demo.go.kr | Demo2026! | 국토부 테넌트 관리 |
| 일반 사용자 | user1@mois-demo.go.kr | Demo2026! | 테넌트 포털 서비스 |
| 감사관 | auditor@mois-demo.go.kr | Demo2026! | 감사 로그 조회 |

---

## 포털 화면 구성

### 관리자 포털 (SUPER_ADMIN 전용)

| 경로 | 화면명 | 주요 기능 |
|------|--------|---------|
| /admin/dashboard | 관리자 대시보드 | 테넌트 수, 사용자 수, CSAP 준수 현황 |
| /admin/tenants | 테넌트 관리 | 등록 기관 목록, 상태, 요금제 확인 |
| /admin/users | 사용자 관리 | 전체 사용자 역할, 상태 확인 |
| /admin/compliance | 규제 준수 현황 | CSAP 79항목 + N2SF 6영역 100% 확인 |
| /admin/audit | 감사 로그 | 시스템 작업 이력 조회 |
| /admin/security | 보안 모니터링 | 보안 이벤트 모니터링 |

### 테넌트 포털 (TENANT_ADMIN / USER 전용)

| 경로 | 화면명 | 주요 기능 |
|------|--------|---------|
| /tenant/dashboard | 테넌트 대시보드 | 활성 서비스, 사용자 수, AI 사용량 |
| /tenant/services | 구독 서비스 | 전자결재, 인사관리, AI 업무지원 현황 |
| /tenant/marketplace | 서비스 마켓플레이스 | 공공 SaaS 서비스 카탈로그, 구독 신청 |
| /tenant/settings | 설정 | 테넌트 설정 관리 |

---

## 테스트 시나리오

### 시나리오 1: 관리자 대시보드 확인

1. 브라우저에서 http://localhost:4000/admin/dashboard 접속
2. 대시보드에서 다음 정보를 확인합니다:
   - 활성 테넌트 수
   - 전체 사용자 수
   - 활성 구독 수
   - 월간 수익
3. 하단의 CSAP 79항목 준수 현황 섹션 확인 (D-01 ~ D-12 전체 100%)

### 시나리오 2: 테넌트 관리

1. http://localhost:4000/admin/tenants 접속
2. 다음 테넌트가 등록되어 있는지 확인합니다:
   - 서울시청 (Enterprise, ACTIVE)
   - 부산시청 (Standard, ACTIVE)
   - 국세청 (Enterprise, ACTIVE)
   - 환경부 (Trial, TRIAL)
3. 각 테넌트의 사용자 수, 등록일 확인

### 시나리오 3: 사용자 관리

1. http://localhost:4000/admin/users 접속
2. 사용자 목록에서 다음 역할이 표시되는지 확인합니다:
   - SUPER_ADMIN (플랫폼 관리자)
   - TENANT_ADMIN (테넌트 관리자)
   - USER (일반 사용자)

### 시나리오 4: CSAP/N2SF 준수 현황

1. http://localhost:4000/admin/compliance 접속
2. CSAP 79항목 섹션에서 12개 분야 확인 (D-01 ~ D-12)
3. N2SF 6영역 섹션 확인 (N-01 ~ N-06)
4. 모든 항목 준수율 100% 확인

### 시나리오 5: 테넌트 포털

1. http://localhost:4000/tenant/dashboard 접속
2. 활성 서비스(3), 사용자 수(42), AI 사용량(1,234건) 확인
3. http://localhost:4000/tenant/services 접속
   - 전자결재(사용량 85%), 인사관리(72%), AI 업무지원(45%) 확인
4. http://localhost:4000/tenant/marketplace 접속
   - 서비스 카탈로그 5개 확인
   - 카테고리 필터(전체/업무/인사/재정/민원/AI) 동작 확인
   - 구독 중 / 구독하기 버튼 상태 확인

### 시나리오 6: 감사 로그 확인

1. http://localhost:4000/admin/audit 접속
2. 다음 감사 항목 확인:
   - LOGIN_SUCCESS
   - TENANT_CREATED
   - USER_CREATED
3. IP 주소, 수행자, 일시 컬럼 확인

---

## E2E 자동 테스트 실행

### 설치

```bash
# Playwright 설치 (프로젝트 루트에서)
pnpm add -D @playwright/test

# Chromium 브라우저 설치
pnpm playwright install chromium
```

### 테스트 실행

```bash
# 전체 E2E 테스트 실행
pnpm playwright test

# UI 모드 (브라우저에서 시각적으로 테스트 확인)
pnpm playwright test --ui

# 관리자 포털 테스트만 실행
pnpm playwright test e2e/admin-portal/

# 테넌트 포털 테스트만 실행
pnpm playwright test e2e/tenant-portal/

# 특정 파일만 실행
pnpm playwright test e2e/admin-portal/02-dashboard.spec.ts

# 디버그 모드 (브라우저 창 표시)
pnpm playwright test --debug
```

### 결과 확인

```bash
# HTML 리포트 열기 (테스트 후 자동 생성)
pnpm playwright show-report

# 리포트 파일 위치
# e2e-report/index.html
```

### 테스트 파일 구성

```
e2e/
├── fixtures/
│   └── demo-users.ts              # 데모 계정 공통 상수
├── admin-portal/
│   ├── 01-login.spec.ts           # 로그인 시나리오 (6개 테스트)
│   ├── 02-dashboard.spec.ts       # 관리자 대시보드 (7개 테스트)
│   ├── 03-tenants.spec.ts         # 테넌트 관리 (9개 테스트)
│   ├── 04-users.spec.ts           # 사용자 관리 (8개 테스트)
│   └── 05-compliance.spec.ts      # CSAP/N2SF 준수 현황 (9개 테스트)
└── tenant-portal/
    ├── 01-tenant-dashboard.spec.ts # 테넌트 대시보드 (9개 테스트)
    ├── 02-services.spec.ts         # 서비스 목록 (9개 테스트)
    └── 03-marketplace.spec.ts      # 마켓플레이스 (12개 테스트)
```

---

## API 직접 테스트

포털 서버가 실행 중인 상태에서 아래 명령어로 API를 직접 테스트할 수 있습니다.

```bash
# 대시보드 통계
curl http://localhost:4000/api/dashboard/stats

# 테넌트 목록
curl http://localhost:4000/api/tenants

# 사용자 목록
curl http://localhost:4000/api/users

# CSAP 준수 현황
curl http://localhost:4000/api/compliance/csap

# 구독 목록
curl http://localhost:4000/api/subscriptions

# 감사 로그
curl http://localhost:4000/api/audit-logs
```

> 참고: 현재 포털은 Next.js Static 렌더링 기반으로, 일부 API 엔드포인트는
> 별도 백엔드 연동 후 응답합니다.

---

## 문제 해결

### DB 연결 실패

```bash
# postgres 컨테이너 상태 확인
docker compose ps

# postgres 로그 확인
docker compose logs postgres

# 컨테이너 재시작
docker compose restart postgres
```

### 포털 빌드/실행 실패

```bash
# 포털 빌드 테스트
pnpm --filter @public-saas/portal build

# 의존성 재설치 후 재시도
pnpm install
pnpm --filter @public-saas/portal dev
```

### 시드 데이터 초기화 (전체 리셋)

```bash
# 주의: 모든 데이터가 삭제됩니다
pnpm prisma migrate reset --force

# 시드 재실행
pnpm prisma db seed
```

### Playwright 테스트 실패 시

```bash
# 트레이스 파일로 실패 원인 확인
pnpm playwright show-report

# 스크린샷 확인 (e2e-report/ 폴더)
ls e2e-report/

# 단일 테스트 디버그
pnpm playwright test e2e/admin-portal/02-dashboard.spec.ts --debug
```

### 포트 충돌 (4000번 포트 사용 중)

```bash
# 포트 사용 프로세스 확인 (Linux/Mac)
lsof -i :4000

# 포트 사용 프로세스 확인 (Windows)
netstat -ano | findstr :4000
```

---

## CSAP 준수 확인 항목

이 데모를 통해 다음 CSAP 항목의 구현을 확인할 수 있습니다.

| CSAP 분야 | 항목 수 | 데모 확인 방법 |
|----------|--------|--------------|
| D-01 정보보호 정책 | 5 | /admin/compliance 준수율 100% |
| D-06 침해사고 관리 | 5 | /admin/audit 감사 로그 |
| D-08 접근 통제 | 12 | 역할별 접근 (SUPER_ADMIN/TENANT_ADMIN/USER) |
| D-09 암호화 | 4 | 비밀번호 해시, HTTPS 전송 |
| D-12 시스템 개발 보안 | 10 | 입력 검증, 매개변수화 쿼리 |

---

*이 가이드는 MTU-E2E1 구현 완료 후 자동 생성된 테스트 문서입니다.*
*문의: 공공 SaaS 플랫폼 개발팀*
