# MTU-P04: API 게이트웨이 -- Design 문서

> **문서 ID**: DESIGN-MTU-P04
> **Plan 참조**: PLAN-MTU-P04
> **버전**: 1.1.0
> **작성일**: 2026-04-05
> **복잡도**: HIGH
> **아키텍처**: Option B -- Pragmatic Balance
> **작성자**: PM Agent + CTO Review

---

## Design Anchor

| Plan FR | 설계 결정 | 근거 |
|---------|---------|------|
| FR-P04.1 | @fastify/http-proxy | 고성능, TypeScript 네이티브, Fastify 생태계 |
| FR-P04.4 | @fastify/rate-limit | IP + 테넌트 기반 동적 제한 |
| FR-P04.5 | 정적 + 동적 레지스트리 | 플랫폼 서비스(정적) + 비즈니스 플러그인(동적) |
| FR-P04.6 | X-Data-Grade 헤더 | N2SF N-05 데이터 등급 게이트웨이 수준 검증 |

---

## 1. 서비스 아키텍처

```
api-gateway/ (Fastify 5, 포트: 3000)
├── src/
│   ├── index.ts                          # 서비스 진입점 (CORS, Rate Limit, 플러그인)
│   ├── routes/
│   │   └── proxy.ts                      # 프록시 라우트 등록 (정적 + 동적)
│   ├── registry/
│   │   └── service-registry.ts           # 서비스 레지스트리 (14개 플랫폼 + 동적)
│   └── middleware/
│       └── data-grade.middleware.ts       # N2SF 데이터 등급 검증
├── Dockerfile
├── package.json
└── tsconfig.json
```

---

## 2. 라우팅 설계

```
클라이언트 -> API 게이트웨이 (:3000)
  /api/v1/auth/*           -> auth-service (:3001)     [인증 불요]
  /api/v1/users/*          -> user-service (:3002)     [인증 필요]
  /api/v1/tenants/*        -> tenant-service (:3003)   [인증 필요]
  /api/v1/menus/*          -> menu-service (:3004)     [인증 필요]
  /api/v1/services/*       -> catalog-service (:3005)  [인증 필요]
  /api/v1/subscriptions/*  -> subscription (:3006)     [인증 필요]
  /api/v1/billing/*        -> billing (:3007)          [인증 필요]
  /api/v1/crm/*            -> crm (:3008)              [인증 필요]
  /api/v1/ai/*             -> ai-service (:3009)       [인증 필요, 등급 검증]
  /api/v1/notifications/*  -> notification (:3010)     [인증 필요]
  /api/v1/files/*          -> file (:3011)             [인증 필요]
  /api/v1/audit/*          -> audit (:3012)            [인증+audit:read]
  /api/v1/compliance/*     -> compliance (:3013)       [인증 필요]
  /api/v1/security/*       -> security (:3014)         [인증+security:read]
  /api/v1/plugins/{id}/*   -> 비즈니스 서비스 (동적)     [인증 필요]
```

---

## 3. Rate Limiting 설계

| 대상 | 제한 | 윈도우 | 근거 |
|------|------|--------|------|
| IP 기반 (기본) | 100 req/min | 1분 슬라이딩 | CSAP D-10 |
| 테넌트 기반 | X-Tenant-Id 헤더 | 1분 슬라이딩 | 테넌트 공정 사용 |
| 인증 엔드포인트 | 10 req/min | 1분 고정 | 브루트포스 방지 |

---

## 4. 서비스 레지스트리

- 정적 레지스트리: 14개 플랫폼 서비스 (환경변수 기반 URL)
- 동적 레지스트리: Map 기반 비즈니스 서비스 등록 (registerBusinessService)
- 각 서비스: url, requireAuth, requiredPermissions, rateLimit 설정

---

## 5. 보안 요건 매핑

| 규제 ID | 항목 | 구현 방법 |
|---------|------|---------|
| CSAP D-08 | 인증 미들웨어 | 서비스별 requireAuth 플래그 |
| CSAP D-10 | Rate Limiting | @fastify/rate-limit, IP+테넌트 키 |
| N2SF N-05 | 데이터 등급 | data-grade.middleware.ts, X-Data-Grade 헤더 |
| CSAP D-06 | 감사 로그 | 요청/응답 로깅 (MTU-P13 연동 예정) |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 초안 작성 | PM Agent |
| 1.1.0 | 2026-04-05 | 아키텍처, Rate Limiting, 레지스트리, 보안 매핑 보완 | PM Agent |
