# MTU-TECH-STACK-2026Q2 Design -- 2026Q2 기술 스택 표준화 및 패턴 설계

> **MTU ID**: MTU-TECH-STACK-2026Q2
> **버전**: 1.0.0 | **작성일**: 2026-04-11 | **작성자**: PM Lead (Opus)
> **Plan 참조**: docs/01-plan/mtus/MTU-TECH-STACK-2026Q2.plan.md

---

## 1. Design Anchor

### 설계 원칙

1. **실측 기반**: 현재 코드베이스에서 검증된 패턴만 표준으로 채택
2. **보안 내재화**: CSAP 79항목 + N2SF 6영역이 코딩 패턴에 자연 반영
3. **최소 변경**: 신기술 도입보다 현재 스택의 일관된 활용에 집중
4. **감리 최적화**: 모든 코드에 추적성 주석 (Design Ref, Plan SC, CSAP)

### 아키텍처 옵션 평가

| 옵션 | 설명 | 장점 | 단점 | 판정 |
|------|------|------|------|------|
| A. 현 스택 표준화 | 기존 기술을 문서화하고 일관성 확보 | 위험 최소, 즉시 적용 | 혁신 부족 | **채택** |
| B. 부분 마이그레이션 | Drizzle ORM, Bun 등 부분 도입 | 성능 개선 | 호환성 위험 | 기각 |
| C. 전면 재설계 | 최신 기술로 전면 교체 | 최신 기능 | 일정/비용 과다 | 기각 |

**선택 근거**: 17개 서비스와 22개 패키지가 안정적으로 운영 중이며, CSAP 인증 일정을 고려하면 현재 스택을 표준화하는 것이 최적이다.

---

## 2. 확정 기술 스택 버전 매트릭스

### 2.1 런타임 및 언어

| 기술 | 확정 버전 | 최소 허용 | 용도 | 비고 |
|------|----------|----------|------|------|
| Node.js | 22.x LTS | 22.0.0 | 서버 런타임 | LTS 채널 유지 |
| TypeScript | 5.9.x | 5.7.0 | 타입 시스템 | strict + noUncheckedIndexedAccess |
| pnpm | 9.x | 9.0.0 | 패키지 관리 | workspace 프로토콜 |

### 2.2 백엔드 프레임워크

| 기술 | 확정 버전 | 용도 | 패키지 범위 |
|------|----------|------|-----------|
| Fastify | 5.x | 마이크로서비스 | @public-saas/* 서비스 전체 |
| fastify-plugin | 5.x | 플러그인 래핑 | 공유 패키지 |
| @fastify/cors | 10.x | CORS 처리 | api-gateway, 각 서비스 |
| @fastify/rate-limit | 10.x | Rate Limiting | api-gateway |
| @fastify/http-proxy | 11.x | 리버스 프록시 | api-gateway |
| @fastify/swagger | 9.x | OpenAPI 문서 | api-gateway |

### 2.3 데이터 접근

| 기술 | 확정 버전 | 용도 | 비고 |
|------|----------|------|------|
| Prisma | 6.19.x | ORM (PostgreSQL) | 타입 안전 쿼리 |
| @prisma/client | 6.19.x | Prisma 클라이언트 | 자동 생성 타입 |
| ioredis | 5.4.x | Redis 클라이언트 | 세션, 캐시, Rate Limit |

### 2.4 보안 및 인증

| 기술 | 확정 버전 | 용도 | CSAP 관련 |
|------|----------|------|----------|
| jose | 5.9.x | JWT (RS256) | D-08 인증 |
| bcryptjs | 2.4.x | 비밀번호 해싱 | D-09 암호화 |
| zod | 3.23.x | 입력 검증 | D-12 개발보안 |

### 2.5 관측성 및 로깅

| 기술 | 확정 버전 | 용도 | 비고 |
|------|----------|------|------|
| Pino | 9.x | 구조화 로깅 | Fastify 내장 |
| pino-pretty | 최신 | 개발 로그 포맷 | dev 환경만 |
| @opentelemetry/* | 최신 | 분산 추적 | @public-saas/observability |

### 2.6 프론트엔드

| 기술 | 확정 버전 | 용도 | 비고 |
|------|----------|------|------|
| Next.js | 15.x | 프론트엔드 프레임워크 | App Router |
| React | 19.x | UI 라이브러리 | Server Components |
| Tailwind CSS | 4.x | CSS 유틸리티 | PostCSS 기반 |
| clsx | 2.1.x | 조건부 클래스 | 경량 유틸리티 |
| lucide-react | 0.400.x | 아이콘 | SVG 기반 |

### 2.7 테스트

| 기술 | 확정 버전 | 용도 | 비고 |
|------|----------|------|------|
| Vitest | 2.1.x | 단위/통합 테스트 | 서비스 레벨 |
| Playwright | 1.59.x | E2E 테스트 | 브라우저 자동화 |

### 2.8 린팅 및 코드 품질

| 기술 | 확정 버전 | 용도 | 비고 |
|------|----------|------|------|
| ESLint | 10.x | 정적 분석 | Flat Config |
| typescript-eslint | 8.58.x | TS 규칙 | strict 프리셋 |

---

## 3. 아키텍처 레이어별 설계

### 3.1 모노레포 구조 (확정)

```
/data/ai-saas/
  platform/
    apps/                     # 프론트엔드 애플리케이션
      portal/                 # 관리 포털 (Next.js 15)
    services/                 # 백엔드 마이크로서비스 (Fastify 5)
      auth-service/           # 인증 (CSAP D-08)
      api-gateway/            # API 게이트웨이
      tenant-service/         # 테넌트 관리
      user-service/           # 사용자 관리
      ai-service/             # AI 서비스 (N2SF)
      audit-service/          # 감사 (CSAP D-06)
      ... (17개 서비스)
    packages/                 # 공유 패키지
      types/                  # 공통 타입 (@public-saas/types)
      rbac/                   # RBAC 엔진 (@public-saas/rbac)
      health/                 # 헬스체크 (@public-saas/health)
      observability/          # 관측성 (@public-saas/observability)
      event-bus/              # 이벤트 버스 (@public-saas/event-bus)
      audit-sdk/              # 감사 로그 SDK
      auth-sdk/               # 인증 SDK
      config-vault/           # 설정 관리
      mesh-ready/             # 서비스 메시 호환
      tenant-isolation/       # 테넌트 격리
      cache/                  # 캐시 추상화
      ... (22개 패키지)
    tests/
      e2e/                    # E2E 테스트 (Playwright)
    plugins/                  # 비즈니스 플러그인
  prisma/
    schema.prisma             # DB 스키마 (단일)
    migrations/               # 마이그레이션
    seed/                     # 시드 데이터
  infra/                      # 인프라 (Helm, k3s)
  docs/                       # 문서 (PDCA)
```

### 3.2 서비스 내부 구조 (표준)

```
platform/services/{service-name}/
  src/
    index.ts                  # 진입점 (Fastify 초기화)
    routes.ts                 # 라우트 등록 (JSON Schema)
    handlers/                 # HTTP 핸들러 (얇은 레이어)
      {resource}.handler.ts
    lib/                      # 비즈니스 로직 + 유틸리티
      prisma.ts               # PrismaClient 싱글턴
      audit.ts                # 감사 로그 유틸리티
      {domain}.ts             # 도메인 로직
    middleware/                # 미들웨어 (인증, Rate Limit)
      auth.middleware.ts
    schemas/                  # Zod 검증 스키마
      {resource}.schema.ts
  tests/
    unit/
    integration/
  package.json
  tsconfig.json
```

### 3.3 공유 패키지 구조 (표준)

```
platform/packages/{package-name}/
  src/
    index.ts                  # 엔트리포인트 (re-export만)
    {feature}.ts              # 핵심 기능 구현
    {feature}-plugin.ts       # Fastify 플러그인 래핑
  package.json
  tsconfig.json
```

### 3.4 프론트엔드 구조 (표준)

```
platform/apps/portal/
  src/
    app/                      # App Router 라우트
      layout.tsx              # 루트 레이아웃 (CSP nonce)
      page.tsx                # 메인 페이지
      admin/                  # 관리자 라우트
      tenant/                 # 테넌트 라우트
      api/                    # API 라우트
    components/
      admin/                  # 관리자 전용 컴포넌트
      tenant/                 # 테넌트 전용 컴포넌트
      common/                 # 공통 컴포넌트
      layout/                 # 레이아웃 컴포넌트
      ai/                     # AI 관련 컴포넌트
      mobile/                 # 모바일 최적화
    lib/                      # 유틸리티
      prisma.ts               # PrismaClient (서버 측)
      auth-guard.ts           # 인증 가드
      audit.ts                # 감사 로그
    styles/
      globals.css             # Tailwind CSS
    middleware.ts             # Next.js 미들웨어 (CSP, 보안 헤더)
```

---

## 4. TypeScript 설정 (확정)

### 4.1 기본 설정 (tsconfig.base.json)

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true
  }
}
```

### 4.2 핵심 strict 옵션 설명

| 옵션 | 값 | 목적 |
|------|-----|------|
| strict | true | 모든 strict 계열 활성화 |
| noUnusedLocals | true | Dead code 즉시 감지 |
| noUnusedParameters | true | 미사용 매개변수 감지 |
| noUncheckedIndexedAccess | true | 인덱스 접근 시 undefined 체크 강제 |
| verbatimModuleSyntax | true | import type 명시적 사용 강제 |
| isolatedModules | true | 모듈 단위 컴파일 보장 |

---

## 5. 패키지 간 의존성 규칙

### 5.1 의존성 방향 (위에서 아래로만 허용)

```
services/ (최상위 -- 패키지 사용자)
  |
  +-- packages/ (중간 -- 공유 로직)
  |     |
  |     +-- types/ (최하위 -- 순수 타입)
  |
  +-- apps/ (최상위 -- 프론트엔드)
```

### 5.2 금지 의존성

| 출발 | 목적지 | 허용 여부 |
|------|-------|----------|
| packages/* | services/* | 금지 |
| types | packages/* | 금지 |
| services/* | services/* | 금지 (API Gateway 프록시만 허용) |
| packages/* | packages/* | 허용 (순환 금지) |

### 5.3 workspace 프로토콜

모든 내부 의존성은 `workspace:*` 프로토콜 사용:

```json
{
  "dependencies": {
    "@public-saas/types": "workspace:*",
    "@public-saas/rbac": "workspace:*"
  }
}
```

---

## 6. 산출물 매핑

| Plan 요구사항 | Design 섹션 | 산출물 |
|-------------|-----------|-------|
| CC-REQ-01 | 본 문서 §2 | 버전 매트릭스 테이블 |
| CC-REQ-02 | coding-standards.md §1~4 | TypeScript 코딩 표준 |
| CC-REQ-03 | coding-standards.md §5 | Fastify 서비스 패턴 |
| CC-REQ-04 | coding-standards.md §6 | 프론트엔드 패턴 |
| CC-REQ-05 | coding-standards.md §7 | 공유 패키지 패턴 |
| CC-REQ-06 | coding-standards.md §8 | 보안 코딩 패턴 |
| CC-REQ-07 | design-patterns.md | 디자인 패턴 지침서 |
| CC-REQ-08 | documentation-standards.md | 문서 작성 표준 |

---

## 7. Session Guide

### 구현 순서

1. 코딩 표준 지침서 (`docs/guidelines/coding-standards.md`)
2. 디자인 패턴 지침서 (`docs/guidelines/design-patterns.md`)
3. 문서 작성 표준 지침서 (`docs/guidelines/documentation-standards.md`)
4. 현재 코드베이스 패턴 일관성 분석

### 검증 기준

- 각 지침서의 코드 예시가 현재 프로젝트에서 실제 사용되는 패턴인지 확인
- CSAP/N2SF 준수 패턴이 모두 포함되었는지 확인
- Plan 요구사항(CC-REQ-01~08) 대 산출물 1:1 매핑 확인

---

## 8. 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|-------|
| 1.0.0 | 2026-04-11 | 초기 설계 | PM Lead (Opus) |
