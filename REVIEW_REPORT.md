# 코드 리뷰 리포트 — MTU 품질 보완 3개 구현

- 검사 일시: 2026-04-06
- 검사자: Reviewer Agent (claude-sonnet-4-6)
- 기준: OWASP Top10, CSAP D-06/D-08/D-12, AgentShield 102규칙
- 검사 범위: MTU-Q1(API 게이트웨이), MTU-Q2(알림 서비스), MTU-Q3(사용자 관리)

---

## MTU-Q1: API 게이트웨이

### `/data/ai-saas/platform/services/api-gateway/src/plugins/audit-logger.ts`

- PASS: CSAP D-06 — AuditLogEntry 구조체에 actor, action, target, ip, timestamp 5개 항목 완비
- PASS: N2SF — Authorization 헤더 마스킹(`Bearer ***`) 처리
- PASS: 헬스체크 경로 감사 로그 제외 (노이즈 방지)
- PASS: 함수 크기 80줄 이하 준수 (93줄 파일, 핵심 함수 ~45줄)
- PASS: fire-and-forget 패턴으로 응답 지연 없음
- 이슈 없음

---

### `/data/ai-saas/platform/services/api-gateway/src/plugins/swagger.ts`

- PASS: 운영 환경 비활성화 로직 (`NODE_ENV === 'production'` + `ENABLE_SWAGGER=true` 명시적 활성화)
- PASS: CSAP D-12 — OpenAPI 문서화 구현
- PASS: bearerAuth 보안 스키마 정의
- 이슈 없음

---

### `/data/ai-saas/platform/services/api-gateway/src/index.ts`

- PASS: CORS 허용 출처 환경 변수 기반 설정 (`CORS_ORIGIN`)
- PASS: Rate Limiting 등록 (100 req/min, 테넌트/IP 기반)
- PASS: 감사 로거 플러그인 등록
- 이슈 없음

---

### `/data/ai-saas/platform/services/api-gateway/src/routes/proxy.ts`

- PASS: CSAP D-08-01 — 인증 필요 서비스에 `authPreHandler` 적용
- PASS: N2SF N-05 — AI 서비스에 데이터 등급 검증 미들웨어 적용
- PASS: 에러 응답에 스택 트레이스 노출 없음
- 이슈 1: [HIGH] TypeScript 컴파일 오류 — `proxy.ts:74` `preHandler` 타입 불일치 (`ProxyPreHandlerHookHandler` 기대, 배열 전달)
  - `tsc --noEmit` 실행 결과 확인됨
  - `preHandler: preHandlers.length > 0 ? preHandlers : undefined` 구문이 `@fastify/http-proxy`의 타입 시그니처와 불일치
  - 수정 방법: `preHandlers`가 단일 함수를 받도록 래퍼 함수로 묶거나, Fastify 라우트 훅 방식으로 재구조화 필요
- 이슈 2: [HIGH] TypeScript 컴파일 오류 — `proxy.ts:135` `app.log.error()` 인자 타입 오류 (`unknown` 타입을 `undefined`에 할당 불가)
  - 수정 방법: `app.log.error({ err: error }, '동적 프록시 실패: ...')` 구조체 형식으로 변경 필요
- 이슈 3: [MEDIUM] RBAC 미적용 — `service-registry.ts`에 `requiredPermissions` 필드가 `audit`, `security` 서비스에 선언되어 있으나 `proxy.ts`의 `authPreHandler`가 이 권한 목록을 **검사하지 않음**
  - 인증(authentication)은 수행하나 권한(authorization) 검사가 누락됨
  - CSAP D-08 위반 소지
  - 수정 방법: `authPreHandler` 또는 별도 `rbacPreHandler`에서 `entry.requiredPermissions`를 JWT 클레임과 비교하는 로직 추가 필요

---

## MTU-Q2: 알림 서비스

### `/data/ai-saas/platform/services/notification-service/src/handlers/template.handler.ts`

- PASS: CSAP D-12 — `createTemplateSchema`, `updateTemplateSchema` Zod 검증 적용
- PASS: 이름 중복 검사 구현
- PASS: `renderTemplate` 함수 — `{{변수명}}` 패턴 regex 치환, XSS 위험 없음 (템플릿 변수는 서버 측 치환)
- PASS: 함수 크기 준수
- 이슈 1: [MEDIUM] RBAC 누락 — 템플릿 생성/수정/삭제 엔드포인트에 역할 검사 없음
  - `routes.ts`에서 `createTemplateHandler`, `updateTemplateHandler`, `deleteTemplateHandler`에 ADMIN 권한 검사 없이 등록
  - CSAP D-08 위반 소지 (관리자 기능이 비인가 사용자에게 노출)
  - 수정 방법: `preHandler`에 역할 기반 접근 제어 적용 필요

---

### `/data/ai-saas/platform/services/notification-service/src/handlers/notification.handler.ts`

- PASS: CSAP D-12 — `sendNotificationSchema`, `sendFromTemplateSchema` Zod 검증 적용
- PASS: CSAP D-06 — `logNotificationEvent` 호출로 감사 로그 기록
- PASS: 웹훅 채널 시 URL 필수 검증
- PASS: Prisma ORM 사용으로 SQL 주입 방지
- 이슈 1: [HIGH] CSAP D-06 감사 로그 actor 하드코딩 — `sendNotificationHandler`(81행), `sendFromTemplateHandler`(160행)에서 `actor`가 `'system'`으로 고정됨
  - 실제 요청자(JWT sub, 서비스 계정 ID 등)를 기록해야 CSAP D-06 요건 충족
  - 수정 방법: API 게이트웨이에서 전달한 사용자 정보 (예: `x-user-id` 헤더 또는 JWT 디코딩)를 `actor`로 사용
- 이슈 2: [MEDIUM] RBAC 누락 — `getUserNotificationsHandler`에서 요청자가 다른 사용자의 알림을 조회 가능
  - `where: { userId: request.params.userId }` 로 임의 userId 조회 가능, 자신의 알림만 조회 가능하도록 제한 없음
  - CSAP D-08 (접근 통제) 위반 소지
  - 수정 방법: JWT에서 추출한 `sub`와 `params.userId` 일치 여부 검증 또는 ADMIN 권한 예외 처리
- 이슈 3: [MEDIUM] listHistoryHandler 입력 검증 미흡 — `channel`, `status` 쿼리 파라미터를 Zod 검증 없이 `where` 조건에 직접 할당
  - Prisma는 파라미터화 쿼리를 사용하므로 SQL 주입 위험은 없으나, 허용되지 않은 enum 값으로 불필요한 DB 쿼리 발생 가능
  - 수정 방법: Zod로 `channel` 및 `status` enum 값 허용 목록 검증

---

### `/data/ai-saas/platform/services/notification-service/src/lib/webhook-sender.ts`

- PASS: OWASP A10 SSRF — `isInternalUrl()` 함수로 내부 IP 대역(127.x, 10.x, 172.16-31.x, 192.168.x) 및 localhost, ::1 차단
- PASS: 타임아웃 5초 + AbortController 구현
- PASS: 지수 백오프 재시도 (최대 3회)
- PASS: 파싱 실패 URL 차단 (`catch { return true }`)
- 이슈 1: [MEDIUM] SSRF 불완전 — 클라우드 메타데이터 엔드포인트 미차단
  - `169.254.169.254` (AWS/GCP/Azure 인스턴스 메타데이터), `100.64.0.0/10` (공유 주소 공간), `fd00::/8`, `fe80::/10` (링크-로컬 IPv6) 미차단
  - 클라우드 환경 배포 시 자격증명 탈취 위험
  - 수정 방법: `isInternalUrl()` 에 `169.254.` 대역 및 IPv6 링크-로컬 차단 규칙 추가
- 이슈 2: [MEDIUM] SSRF 불완전 — HTTP 리다이렉트 추적 가능성
  - `fetch()` 기본 동작은 리다이렉트를 자동 추적함. 외부 URL 검증 후 내부 IP로 리다이렉트되는 DNS rebinding 공격 가능
  - 수정 방법: `fetch(url, { redirect: 'error' })` 또는 리다이렉트 응답 수동 처리

---

### `/data/ai-saas/platform/services/notification-service/src/lib/event-bus.ts`

- PASS: 타입 안전 이벤트 맵 구조 (`NotificationEventMap`)
- PASS: 핸들러 오류 격리 (`try-catch` + `Promise.allSettled`)
- PASS: `setMaxListeners(50)` 설정
- 이슈 1: [LOW] `handlerCount` 카운터 부정확 — `on()` 호출 시에만 증가하고 `off()` / `removeListener()` 에 해당하는 감소 로직 없음
  - 모니터링 지표로 활용 시 오탐 가능
  - 수정 방법: `off()` 메서드 추가 및 `handlerCount--` 처리, 또는 `emitter.listenerCount()` 합산으로 대체

---

### `/data/ai-saas/platform/services/notification-service/src/routes.ts`

- PASS: 라우트 경로 명확히 정의
- PASS: 모든 핸들러 정상 연결
- 이슈 1: [HIGH] RBAC 누락 — 서비스 수준에서 인증 미들웨어 미적용
  - `registerRoutes()`에 `preHandler` 없이 모든 엔드포인트 노출
  - API 게이트웨이가 인증을 수행하나, 서비스 자체가 내부 네트워크에서 직접 호출되는 경우 무방비 상태
  - CSAP D-08 심층 방어 관점에서 서비스 자체 인증 검증 필요
  - 수정 방법: Fastify 플러그인 수준 `onRequest` 훅으로 JWT 검증 또는 `x-internal-token` 검증 추가

---

## MTU-Q3: 사용자 관리

### `/data/ai-saas/platform/services/user-service/src/handlers/password-reset.handler.ts`

- PASS: 토큰을 SHA-256 해시로 저장 (원문 미저장)
- PASS: 1회 사용 후 토큰 폐기 (`resetTokenStore.delete(hashedToken)`)
- PASS: 만료 시간 30분 설정
- PASS: 계정 열거 방지 (사용자 존재 여부와 무관하게 동일 응답)
- PASS: 비밀번호 정책 검증 (`AUTH_CONSTANTS.PASSWORD_REGEX`)
- PASS: bcrypt 해시 저장 (`AUTH_CONSTANTS.BCRYPT_SALT_ROUNDS`)
- PASS: CSAP D-06 — 요청/완료 감사 로그 기록
- PASS: Zod 입력 검증 적용
- 이슈 1: [MEDIUM] CSAP D-06 감사 로그 actor 불일치 — `confirmPasswordResetHandler`(195행) 의 `logUserEvent` 호출에서 두 번째 인자(actor)로 `entry.userId`를 전달하고 있어 target과 동일
  - 비밀번호 재설정 완료 시 actor는 '재설정을 요청한 주체(시스템 또는 본인)'가 명확해야 함
  - 수정 방법: actor를 `'system'` 또는 별도 식별자로 일관성 있게 정의
- 이슈 2: [LOW] 개발 환경 토큰 로그 노출 — `console.log()` 로 원문 토큰 출력 (119-121행)
  - 개발 편의 목적으로 조건부(`NODE_ENV !== 'production'`) 처리되어 있어 운영 환경 노출은 아님
  - 그러나 로그 집계 시스템에 토큰이 기록될 위험 존재
  - 수정 방법: 토큰 대신 만료 시각, 사용자 ID 등 비민감 정보만 로그 출력

---

### `/data/ai-saas/platform/services/user-service/src/handlers/user.handler.ts`

- PASS: CSAP D-12 — `createUserSchema`, `updateUserSchema` Zod 검증 적용
- PASS: CSAP D-08-07 — 비밀번호 정책 검증 + bcrypt 해시 저장
- PASS: 비밀번호 필드 `select` 에서 제외 (응답 노출 방지)
- PASS: 테넌트 사용자 수 제한 검사 (FR-P02.9)
- PASS: 소프트 삭제 구현 (`lockedUntil = 9999-12-31`)
- PASS: CSAP D-06 — USER_CREATED, USER_DEACTIVATED, USER_REACTIVATED 감사 로그 기록
- 이슈 1: [HIGH] RBAC 누락 — `listUsersHandler` (43행) 에서 `tenantId` 쿼리 파라미터 미전달 시 전체 사용자 목록 조회 가능
  - `const where = tenantId ? { tenantId } : {}` — tenantId 없이 호출 시 모든 테넌트의 사용자 반환
  - CSAP D-08 테넌트 격리 위반
  - 수정 방법: JWT의 `tenantId` 클레임을 강제 사용하거나, SUPER_ADMIN 역할이 아닌 경우 `tenantId` 필수 처리
- 이슈 2: [HIGH] CSAP D-06 감사 로그 actor 하드코딩 — `createUserHandler`(170행), `deleteUserHandler`(257행), `reactivateUserHandler`(301행) 모두 `actor: 'system'`으로 고정
  - 실제 작업 수행자(관리자 ID)가 감사 로그에 기록되지 않아 침해사고 추적 불가
  - 수정 방법: API 게이트웨이에서 전달된 `x-user-id` 헤더 또는 JWT sub를 actor로 사용
- 이슈 3: [MEDIUM] updateUserHandler 접근 통제 미흡 — 요청자가 다른 사용자의 프로필 수정 가능 (자기 자신만 수정 가능해야 하는지, 관리자도 가능한지 정책 미적용)
  - 수정 방법: JWT sub와 `params.id` 비교 또는 TENANT_ADMIN 역할 검사 추가

---

### `/data/ai-saas/platform/services/user-service/src/routes.ts`

- PASS: 모든 핸들러 연결 정상
- PASS: 비밀번호 재설정 라우트 경로 명확
- 이슈 1: [HIGH] RBAC 누락 — 서비스 수준에서 인증 미들웨어 미적용
  - 알림 서비스와 동일하게 `registerUserRoutes()` 에 `preHandler` 없음
  - 내부 호출 시 인증 우회 가능
  - 수정 방법: Fastify `addHook('onRequest', ...)` 또는 라우트 `preHandler`로 내부 토큰 또는 JWT 검증 추가

---

## 공통 이슈

| 파일 | 심각도 | 내용 |
|------|--------|------|
| `notification-service/src/lib/audit.ts` | MEDIUM | `console.log()`로 감사 로그 출력 — MTU-P13 구현 전 임시 방편이나 stdout 기반 로그는 append-only 보장 불가. CSAP D-06 `로그 보존 1년` 요건 미충족 위험 |
| `user-service/src/lib/audit.ts` | MEDIUM | 동일 — `console.log()` 기반 감사 로그 |
| `api-gateway/src/routes/proxy.ts` | HIGH | TypeScript strict 컴파일 오류 2건 — `proxy.ts:74`, `proxy.ts:135` |
| `notification-service/src/lib/webhook-sender.ts` | MEDIUM | `tsc` 오류 — `webhook-sender.ts:29,30` `string | undefined`를 `string`에 할당 불가 (hostname/parts 배열 원소 접근) |

---

## 이슈 요약

| 심각도 | 건수 | 대상 |
|--------|------|------|
| CRITICAL | 0 | - |
| HIGH | 6 | proxy.ts 타입 오류(2), notification/user routes RBAC 누락(2), listUsersHandler 테넌트 격리(1), user.handler actor 하드코딩(1) |
| MEDIUM | 8 | SSRF 미완성(2), listHistoryHandler 미검증(1), getUserNotifications 접근제어(1), updateUserHandler 접근제어(1), 감사 로그 actor 하드코딩(1), audit.ts console.log(2) |
| LOW | 2 | event-bus handlerCount(1), password-reset 토큰 로그(1) |

---

## 최종 결정: BLOCKED

HIGH 심각도 이슈 6건 발견으로 Implementer 재작업 필요.

### 필수 수정 항목 (HIGH)

1. **proxy.ts TypeScript 컴파일 오류 수정** (파일: `/data/ai-saas/platform/services/api-gateway/src/routes/proxy.ts`, 74행, 135행)
   - `preHandler` 타입 시그니처 불일치 해결
   - `app.log.error()` 인자 구조 수정

2. **알림 서비스 서비스 수준 RBAC 적용** (파일: `/data/ai-saas/platform/services/notification-service/src/routes.ts`)
   - 인증 미들웨어 또는 내부 토큰 검증 추가

3. **사용자 서비스 서비스 수준 RBAC 적용** (파일: `/data/ai-saas/platform/services/user-service/src/routes.ts`)
   - 인증 미들웨어 또는 내부 토큰 검증 추가

4. **listUsersHandler 테넌트 격리 강화** (파일: `/data/ai-saas/platform/services/user-service/src/handlers/user.handler.ts`, 43행)
   - tenantId 미지정 시 전체 조회 차단

5. **감사 로그 actor 실사용자 반영** (파일: user.handler.ts 170/257/301행, notification.handler.ts 81/160행)
   - 'system' 하드코딩 제거, 실제 요청자 ID 사용

6. **requiredPermissions RBAC 검사 구현** (파일: `/data/ai-saas/platform/services/api-gateway/src/routes/proxy.ts`)
   - service-registry에 선언된 권한 목록이 실제 JWT 클레임과 비교되지 않음

### BLOCKED 해제 조건

위 6건의 HIGH 이슈 수정 완료 후 Reviewer 재검토 요청.
재검토 통과 시 Auditor 에이전트 인계.

---

*리포트 작성: Reviewer Agent | 검사 완료: 2026-04-06*
