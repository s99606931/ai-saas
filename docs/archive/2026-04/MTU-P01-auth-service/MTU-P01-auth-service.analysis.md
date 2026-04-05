# MTU-P01: 인증 서비스 — 갭 분석 보고서

> **문서 ID**: ANALYSIS-MTU-P01
> **Plan 참조**: PLAN-MTU-P01
> **Design 참조**: DESIGN-MTU-P01
> **분석일**: 2026-04-05
> **분석자**: PM Agent (Q-Gate Check)

---

## 1. FR 전수 매칭 결과

| FR ID | 요구사항 | 구현 파일 | 상태 | 비고 |
|-------|---------|---------|------|------|
| FR-P01.1 | JWT RS256 토큰 발급 (15분/7일) | `lib/jwt.ts:49-85` | PASS | signAccessToken, signRefreshToken 구현 완료 |
| FR-P01.2 | JWT 검증 미들웨어 | `middleware/auth.middleware.ts` | PASS | fastify-plugin 등록, 블랙리스트 확인 포함. index.ts 미등록 → 수정 완료 |
| FR-P01.3 | 토큰 갱신 (Refresh Token Rotation) | `handlers/refresh.handler.ts` | PASS | 기존 토큰 무효화 + 새 토큰 발급 |
| FR-P01.4 | 토큰 블랙리스트 | `lib/session.ts:85-92` | PASS | Redis SET + TTL |
| FR-P01.5 | RBAC 권한 검사 | `middleware/rbac.middleware.ts` | PASS | requirePermission, requireAnyPermission |
| FR-P01.6 | 멀티테넌트 세션 격리 | `lib/jwt.ts:54-58` | PASS | tenantId 클레임 바인딩 |
| FR-P01.7 | 동시 세션 제한 (최대 3개) | `lib/session.ts:29-51` | PASS | FIFO 세션 만료 |
| FR-P01.8 | 로그인 실패 잠금 (5회/30분) | `handlers/login.handler.ts:96-122` | PASS | failedLogins 카운터 + lockedUntil |
| FR-P01.9 | 비밀번호 정책 (8자+, 복합) | `lib/password.ts:41-51` | PASS | validatePasswordPolicy 구현 |
| FR-P01.10 | MFA TOTP 스켈레톤 | 미구현 (mfa.handler.ts 없음) | PARTIAL | SHOULD 등급. loginSchema에 mfaCode 필드 존재 |
| FR-P01.11 | OAuth2/OIDC 기본 흐름 | 미구현 | PARTIAL | SHOULD 등급. Phase P5에서 외부 IdP 연동 시 구현 예정 |
| FR-P01.12 | 인증 이벤트 감사 로그 | `lib/audit.ts` | PASS | audit-sdk 연동, logAuthEvent 함수 |

---

## 2. 매칭률

- **MUST 요구사항**: 10/10 (100%)
- **SHOULD 요구사항**: 0/2 (MFA, OAuth2 미구현)
- **전체 매칭률**: 10/12 = **83.3%** (MUST 기준 100%)

> MFA와 OAuth2/OIDC는 SHOULD 등급이며, Plan 문서에 "스켈레톤" 수준으로 명시.
> loginSchema에 mfaCode 필드가 이미 존재하여 향후 구현 준비 완료.

---

## 3. Q-Gate 검증 결과

| Gate | 항목 | 결과 | 근거 |
|------|------|------|------|
| G1 | FR ID 전수 | PASS | 12개 FR 중 MUST 10개 전수 구현 |
| G2 | 설계 완전성 | PASS | Design 6.9KB, API 설계/JWT/세션/RBAC 전체 설계 포함 |
| G3 | 코드 품질 | PASS | Zod 입력 검증, bcrypt 해시, RS256, 하드코딩 시크릿 없음 |
| G4 | 테스트 커버리지 | PARTIAL | 테스트 파일 미존재 (tests/ 디렉터리 미생성) |
| G5 | OWASP Top10 | PASS | SQL 인젝션(Prisma), XSS(API 서버), 인증 우회(JWT+블랙리스트) |
| G6 | CSAP D-08 준수 | PASS | D-08-01~D-08-08 전수 매핑 구현 |
| G7 | audit.jsonl | PASS | logAuthEvent 로 감사 로그 기록 |

---

## 4. 발견 이슈 및 조치

| 이슈 | 심각도 | 조치 |
|------|--------|------|
| auth.middleware.ts가 index.ts에 미등록 | HIGH | 수정 완료: `await app.register(authMiddleware)` 추가 |
| MFA 핸들러 미구현 | LOW | SHOULD 등급, Phase P5에서 구현 예정 |
| OAuth2/OIDC 미구현 | LOW | SHOULD 등급, Phase P5에서 구현 예정 |
| 단위 테스트 미작성 | MEDIUM | Phase P21 통합 테스트 MTU에서 일괄 작성 예정 |
| PrismaClient 인스턴스 핸들러별 중복 생성 | LOW | 리팩토링 시 공통 인스턴스로 통합 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 초안 작성 | PM Agent |
