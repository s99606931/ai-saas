# Plan: auth-service 라운드 1 고도화

> MTU ID: SVC-AUTH-R1
> 버전: 1.0.0 | 작성일: 2026-04-09
> PRD 참조: docs/00-pm/SVC-AUTH-R1.prd.md

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | CSAP D-08 접근 통제 완전 준수, MFA 우회 취약점 제거 |
| 기술 | MFA 로그인 검증, Rate Limiting, 비밀번호 변경, 서비스 간 인증, JWT kid |
| 보안 | 무차별 대입 방어, 내부 서비스 인증 강화, 키 회전 지원 |
| 운영 | OpenTelemetry 분산 추적, 통합 테스트 80%+ 커버리지 |

## Context Anchor

- **WHY**: MFA 활성 사용자 로그인 시 TOTP 검증 누락 — CSAP D-08-08 위반 가능
- **WHO**: 보안 감리관, 테넌트 관리자, 일반 사용자
- **RISK**: MFA 우회, 무차별 대입 공격, 내부 API 위장 호출
- **SUCCESS**: SC-1~SC-7 전체 충족 (matchRate >= 90%)
- **SCOPE**: 로그인 MFA, Rate Limiting, 비밀번호 변경, 서비스 인증, JWT kid, OTel, 통합 테스트

---

## 기능 요구사항 (FR)

### FR-AUTH.1: 로그인 MFA 검증 통합

| 항목 | 내용 |
|------|------|
| ID | FR-AUTH.1 |
| 우선순위 | P0 (필수) |
| 설명 | MFA 활성 사용자 로그인 시 TOTP 코드 필수 검증 |
| 수락 기준 | MFA 활성 사용자가 mfaCode 없이 로그인 시도 시 MFA_REQUIRED 응답 |
| CSAP 매핑 | D-08-08 다중 인증 |

**구현 위치**: `src/handlers/login.handler.ts`
**변경 내용**:
- 비밀번호 검증 성공 후, `user.mfaEnabled` 확인
- MFA 활성 + `mfaCode` 없음 → 403 `MFA_REQUIRED` 응답
- MFA 활성 + `mfaCode` 있음 → DB에서 `mfaSecret` 복호화 후 TOTP 검증
- TOTP 검증 실패 → 401 `MFA_INVALID_CODE` 응답

### FR-AUTH.2: 비밀번호 변경 API

| 항목 | 내용 |
|------|------|
| ID | FR-AUTH.2 |
| 우선순위 | P0 (필수) |
| 설명 | 인증된 사용자의 비밀번호 변경 엔드포인트 |
| 수락 기준 | 현재 비밀번호 검증 + 새 비밀번호 정책 검증 + 기존 세션 무효화 |
| CSAP 매핑 | D-08-07 비밀번호 정책 |

**구현 위치**: 신규 `src/handlers/password-change.handler.ts`
**엔드포인트**: `POST /auth/password/change`
**요청 본문**: `{ currentPassword, newPassword }`
**흐름**:
1. 인증 확인 (request.user)
2. 현재 비밀번호 검증
3. 새 비밀번호 정책 검증 (validatePasswordPolicy)
4. 비밀번호 해시 업데이트
5. 모든 기존 세션 무효화 (CSAP D-08-03)
6. 감사 로그 기록

### FR-AUTH.3: Rate Limiting (로그인 보호)

| 항목 | 내용 |
|------|------|
| ID | FR-AUTH.3 |
| 우선순위 | P0 (필수) |
| 설명 | IP 기반 로그인 Rate Limiting |
| 수락 기준 | 동일 IP에서 60초 내 10회 초과 시 429 응답 |
| CSAP 매핑 | D-08-06 계정 잠금 보완 |

**구현 위치**: 신규 `src/middleware/rate-limit.middleware.ts`
**전략**: Redis 기반 슬라이딩 윈도우
**적용 대상**: `/auth/login`, `/auth/refresh` 엔드포인트
**설정**: 환경 변수로 조정 가능 (`RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_SECONDS`)

### FR-AUTH.4: 서비스 간 인증

| 항목 | 내용 |
|------|------|
| ID | FR-AUTH.4 |
| 우선순위 | P1 (높음) |
| 설명 | 내부 서비스 API에 서비스 토큰 인증 적용 |
| 수락 기준 | X-Service-Token 헤더 없이 /auth/sessions/invalidate 호출 시 403 |
| CSAP 매핑 | D-08-01 인증 관리 |

**구현 위치**: 신규 `src/middleware/service-auth.middleware.ts`
**메커니즘**: 사전 공유 키 (PSK) 기반 HMAC 검증
**적용 대상**: `/auth/sessions/invalidate` 엔드포인트

### FR-AUTH.5: JWT kid 헤더 + 키 회전 지원

| 항목 | 내용 |
|------|------|
| ID | FR-AUTH.5 |
| 우선순위 | P1 (높음) |
| 설명 | JWT 헤더에 kid (Key ID) 포함, 복수 키 지원 |
| 수락 기준 | 발급된 JWT에 kid 헤더 포함, 검증 시 kid로 공개 키 선택 |
| CSAP 매핑 | D-09 암호화 |

**구현 위치**: `src/lib/jwt.ts` 수정
**변경 내용**:
- 환경 변수에서 `JWT_KEY_ID` 로드
- `signAccessToken`, `signRefreshToken`에 kid 헤더 추가
- `verifyToken`에서 kid 기반 키 선택 로직 (현재는 단일 키)

### FR-AUTH.6: OpenTelemetry 계측

| 항목 | 내용 |
|------|------|
| ID | FR-AUTH.6 |
| 우선순위 | P2 (보통) |
| 설명 | HTTP 요청 및 주요 작업에 대한 분산 추적 계측 |
| 수락 기준 | 로그인/토큰 갱신/MFA 설정 시 트레이스 스팬 생성 |
| CSAP 매핑 | D-06 침해사고 관리 보완 |

**구현 위치**: 신규 `src/lib/telemetry.ts` + `src/index.ts` 수정
**의존성**: `@opentelemetry/api`, `@opentelemetry/sdk-node`, `@opentelemetry/instrumentation-fastify`

### FR-AUTH.7: 통합 테스트 추가

| 항목 | 내용 |
|------|------|
| ID | FR-AUTH.7 |
| 우선순위 | P1 (높음) |
| 설명 | HTTP 수준 통합 테스트 (Fastify inject) |
| 수락 기준 | 로그인/로그아웃/MFA/비밀번호 변경/Rate Limiting 시나리오 커버 |
| CSAP 매핑 | D-12 시스템 개발 보안 |

**구현 위치**: 신규 `tests/integration/auth-flow.test.ts`
**테스트 시나리오**:
1. 정상 로그인 → 200 + JWT 발급
2. 잘못된 비밀번호 → 401
3. 계정 잠금 후 로그인 → 423
4. MFA 활성 + 코드 없음 → 403 MFA_REQUIRED
5. MFA 활성 + 올바른 코드 → 200
6. 비밀번호 변경 → 200 + 기존 세션 무효화
7. Rate Limiting 초과 → 429
8. 서비스 토큰 없이 세션 무효화 → 403

---

## 비기능 요구사항 (NFR)

| ID | 항목 | 기준 |
|----|------|------|
| NFR-1 | Rate Limiting 정확도 | 슬라이딩 윈도우 오차 <=1회 |
| NFR-2 | MFA 검증 응답시간 | < 100ms (TOTP 연산) |
| NFR-3 | 테스트 커버리지 | >= 80% (vitest --coverage) |
| NFR-4 | 파일 크기 | 모든 소스 파일 800줄 이하 |

---

## 추적성 매트릭스

| FR ID | 산출물 | 테스트 | CSAP |
|-------|--------|--------|------|
| FR-AUTH.1 | login.handler.ts 수정 | auth-flow.test.ts #4,#5 | D-08-08 |
| FR-AUTH.2 | password-change.handler.ts 신규 | auth-flow.test.ts #6 | D-08-07 |
| FR-AUTH.3 | rate-limit.middleware.ts 신규 | auth-flow.test.ts #7 | D-08-06 |
| FR-AUTH.4 | service-auth.middleware.ts 신규 | auth-flow.test.ts #8 | D-08-01 |
| FR-AUTH.5 | jwt.ts 수정 | jwt-kid.test.ts | D-09 |
| FR-AUTH.6 | telemetry.ts 신규 | 로그 확인 | D-06 |
| FR-AUTH.7 | auth-flow.test.ts 신규 | 자체 | D-12 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-09 | 초안 작성 | PM (Claude Opus) |
