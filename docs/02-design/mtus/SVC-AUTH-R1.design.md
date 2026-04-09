# Design: auth-service 라운드 1 고도화

> MTU ID: SVC-AUTH-R1
> 버전: 1.0.0 | 작성일: 2026-04-09
> Plan 참조: docs/01-plan/mtus/SVC-AUTH-R1.plan.md

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | CSAP D-08 접근 통제 7개 하위 항목 완전 준수 달성 |
| 기술 | 7개 FR 구현: MFA 로그인, 비밀번호 변경, Rate Limiting, 서비스 인증, JWT kid, OTel, 통합 테스트 |
| 보안 | 무차별 대입 방어, MFA 우회 차단, 내부 API 인증 강화 |
| 운영 | 분산 추적 + 통합 테스트로 운영 신뢰성 향상 |

## Design Anchor

- **Plan**: docs/01-plan/mtus/SVC-AUTH-R1.plan.md
- **아키텍처 옵션**: Pragmatic Balance (실용적 균형) 선택
- **제약**: CLAUDE.md 절대 제약 준수, CSAP/N2SF 규정 준수

---

## 1. FR-AUTH.1: 로그인 MFA 검증 통합

### 1.1 설계

`login.handler.ts`의 비밀번호 검증 성공 후 MFA 검증 단계를 추가합니다.

**흐름 변경**:
```
기존: 비밀번호 검증 → JWT 발급
변경: 비밀번호 검증 → MFA 확인 → (MFA 활성 시 TOTP 검증) → JWT 발급
```

**응답 코드**:
- MFA 활성 + mfaCode 미제공: `403 { code: 'MFA_REQUIRED' }`
- MFA 활성 + mfaCode 오류: `401 { code: 'MFA_INVALID_CODE' }`
- MFA 비활성: 기존 흐름 유지

**구현 상세**:
- `user.mfaEnabled` 필드 확인 (Prisma select에 포함)
- `user.mfaSecret` 복호화 → `decryptMfaSecret()`
- TOTP 검증 → `verifyTotp(secret, code)` (기존 mfa.handler.ts 유틸리티 재사용)

### 1.2 TOTP 유틸리티 분리

현재 `mfa.handler.ts`에 인라인된 TOTP 유틸리티를 `src/lib/totp.ts`로 분리합니다.
- `base32Encode`, `base32Decode`, `verifyTotp`, `generateTotp` → `src/lib/totp.ts`
- `mfa.handler.ts`와 `login.handler.ts`에서 공통 import

---

## 2. FR-AUTH.2: 비밀번호 변경 API

### 2.1 엔드포인트 설계

```
POST /auth/password/change
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "currentPassword": "string",
  "newPassword": "string"
}
```

### 2.2 응답

| 상태 | 코드 | 설명 |
|------|------|------|
| 200 | PASSWORD_CHANGED | 비밀번호 변경 완료 |
| 400 | PASSWORD_POLICY_VIOLATION | 새 비밀번호 정책 위반 |
| 400 | PASSWORD_SAME | 현재와 동일한 비밀번호 |
| 401 | WRONG_PASSWORD | 현재 비밀번호 불일치 |
| 401 | AUTH_REQUIRED | 인증 필요 |

### 2.3 흐름

1. 인증 확인 (request.user 존재)
2. Zod 스키마 검증
3. DB에서 사용자 조회 (passwordHash)
4. 현재 비밀번호 검증 (bcrypt compare)
5. 새 비밀번호 정책 검증 (validatePasswordPolicy)
6. 새 비밀번호와 현재 비밀번호 동일 여부 확인
7. 새 비밀번호 해시 생성 (bcrypt hash)
8. DB 업데이트
9. 모든 기존 세션 무효화 (기존 invalidateAllSessions 로직 재사용)
10. 감사 로그 기록

### 2.4 스키마

```typescript
// src/schemas/password.schema.ts
export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});
```

---

## 3. FR-AUTH.3: Rate Limiting

### 3.1 설계

Redis 기반 슬라이딩 윈도우 알고리즘을 사용합니다.

**키**: `ratelimit:{ip}:{endpoint}`
**알고리즘**: Redis INCR + EXPIRE (고정 윈도우로 단순화, 실용적 선택)

```typescript
// src/middleware/rate-limit.middleware.ts
export function rateLimitMiddleware(options: {
  max: number;        // 기본 10
  windowSeconds: number;  // 기본 60
  keyPrefix?: string;
})
```

### 3.2 응답

Rate Limit 초과 시:
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "요청 횟수를 초과했습니다. 잠시 후 다시 시도하세요",
    "retryAfter": 45
  }
}
```

HTTP 헤더:
- `X-RateLimit-Limit`: 최대 허용 횟수
- `X-RateLimit-Remaining`: 남은 횟수
- `X-RateLimit-Reset`: 윈도우 초기화 시간 (Unix timestamp)
- `Retry-After`: 초과 시 대기 시간 (초)

### 3.3 적용 대상

| 엔드포인트 | 제한 | 윈도우 |
|-----------|------|--------|
| POST /auth/login | 10회 | 60초 |
| POST /auth/refresh | 30회 | 60초 |
| POST /auth/password/change | 5회 | 300초 |

---

## 4. FR-AUTH.4: 서비스 간 인증

### 4.1 설계

HMAC-SHA256 기반 서비스 토큰을 사용합니다.

**헤더**: `X-Service-Token: {serviceName}:{timestamp}:{hmac}`
**HMAC 입력**: `{serviceName}:{timestamp}:{requestPath}`
**공유 키**: 환경 변수 `INTERNAL_SERVICE_KEY`

### 4.2 미들웨어

```typescript
// src/middleware/service-auth.middleware.ts
export async function requireServiceAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void>
```

**검증**:
1. X-Service-Token 헤더 파싱
2. timestamp 유효성 (5분 이내)
3. HMAC 검증
4. 감사 로그 기록

### 4.3 적용

`/auth/sessions/invalidate` 엔드포인트에 preHandler로 적용합니다.

---

## 5. FR-AUTH.5: JWT kid 헤더

### 5.1 설계

JWT 헤더에 `kid` (Key ID)를 포함하여 키 회전 시 이전 키로 서명된 토큰도 검증 가능하게 합니다.

**환경 변수**: `JWT_KEY_ID` (기본값: 'key-1')

**변경 사항**:
- `signAccessToken`, `signRefreshToken`: `.setProtectedHeader({ alg, typ, kid })` 추가
- `verifyToken`: 현재는 단일 키이므로 kid 로깅만 추가 (향후 복수 키 지원 대비)

---

## 6. FR-AUTH.6: OpenTelemetry 계측

### 6.1 설계

Fastify 자동 계측 + 수동 스팬을 조합합니다.

**신규 파일**: `src/lib/telemetry.ts`

```typescript
// NodeSDK 초기화 (서비스 시작 전 실행)
// - FastifyInstrumentation (HTTP span 자동 생성)
// - OTLP exporter (환경 변수 OTEL_EXPORTER_OTLP_ENDPOINT)
// - 서비스명: auth-service
```

**수동 스팬** (주요 작업):
- `auth.login` (로그인 전체 흐름)
- `auth.mfa.verify` (MFA TOTP 검증)
- `auth.password.change` (비밀번호 변경)
- `auth.session.invalidate` (세션 무효화)

### 6.2 의존성

```json
{
  "@opentelemetry/api": "^1.9.0",
  "@opentelemetry/sdk-node": "^0.57.0",
  "@opentelemetry/auto-instrumentations-node": "^0.55.0",
  "@opentelemetry/exporter-trace-otlp-http": "^0.57.0"
}
```

---

## 7. FR-AUTH.7: 통합 테스트

### 7.1 설계

Fastify의 `inject()` 메서드를 사용하여 HTTP 수준 통합 테스트를 작성합니다.
Prisma와 Redis는 모킹하되, Fastify 라우팅/미들웨어/직렬화는 실제 동작합니다.

**테스트 파일**: `tests/integration/auth-flow.test.ts`

**시나리오**:
1. 로그인 성공 (MFA 비활성)
2. 로그인 실패 (잘못된 비밀번호)
3. 계정 잠금 후 로그인 시도
4. MFA 필수 응답 (MFA 활성 + 코드 없음)
5. MFA 검증 성공 로그인
6. 비밀번호 변경 성공 + 세션 무효화
7. Rate Limiting 동작 확인
8. 서비스 토큰 없이 내부 API 접근 차단

---

## 파일 변경 목록

| 작업 | 파일 경로 | FR |
|------|-----------|-----|
| 수정 | src/handlers/login.handler.ts | FR-AUTH.1 |
| 신규 | src/lib/totp.ts | FR-AUTH.1 |
| 수정 | src/handlers/mfa.handler.ts (import 변경) | FR-AUTH.1 |
| 신규 | src/handlers/password-change.handler.ts | FR-AUTH.2 |
| 신규 | src/schemas/password.schema.ts | FR-AUTH.2 |
| 신규 | src/middleware/rate-limit.middleware.ts | FR-AUTH.3 |
| 신규 | src/middleware/service-auth.middleware.ts | FR-AUTH.4 |
| 수정 | src/lib/jwt.ts | FR-AUTH.5 |
| 신규 | src/lib/telemetry.ts | FR-AUTH.6 |
| 수정 | src/index.ts | FR-AUTH.3, FR-AUTH.6 |
| 수정 | src/routes.ts | FR-AUTH.2, FR-AUTH.3, FR-AUTH.4 |
| 신규 | tests/integration/auth-flow.test.ts | FR-AUTH.7 |

---

## Session Guide

### 구현 순서 (의존성 기반)

1. `src/lib/totp.ts` 분리 (FR-AUTH.1 전제조건)
2. `src/handlers/mfa.handler.ts` import 변경
3. `src/handlers/login.handler.ts` MFA 검증 추가 (FR-AUTH.1)
4. `src/schemas/password.schema.ts` 생성 (FR-AUTH.2 전제조건)
5. `src/handlers/password-change.handler.ts` 생성 (FR-AUTH.2)
6. `src/middleware/rate-limit.middleware.ts` 생성 (FR-AUTH.3)
7. `src/middleware/service-auth.middleware.ts` 생성 (FR-AUTH.4)
8. `src/lib/jwt.ts` kid 추가 (FR-AUTH.5)
9. `src/lib/telemetry.ts` 생성 (FR-AUTH.6)
10. `src/routes.ts` 라우트 등록 업데이트
11. `src/index.ts` 미들웨어/OTel 통합
12. `tests/integration/auth-flow.test.ts` 작성 (FR-AUTH.7)

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-09 | 초안 작성 | PM (Claude Opus) |
