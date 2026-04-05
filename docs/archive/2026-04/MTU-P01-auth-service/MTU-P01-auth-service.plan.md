# MTU-P01: 인증 서비스 — Plan 문서

> **문서 ID**: PLAN-MTU-P01
> **MTU ID**: MTU-P01
> **버전**: 1.0.0
> **작성일**: 2026-04-05
> **복잡도**: HIGH
> **상태**: Draft
> **작성자**: PM Agent

---

## Executive Summary (4관점 테이블)

| 관점 | 내용 |
|------|------|
| **비즈니스** | 플랫폼 전체의 인증/인가 기반. 멀티테넌트 환경에서 안전한 JWT 기반 세션 관리 |
| **기술** | Fastify 5 + JWT RS256 + bcrypt + RBAC + OAuth2/OIDC 지원 |
| **보안** | CSAP D-08 접근 통제 12항목 전수 준수. 15분 토큰 만료, MFA, 계정 잠금, 세션 제한 |
| **감리** | T01 사업계획서 인증 요건, T02 요구사항 접근 통제, T05 시험계획 보안 테스트 |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| **WHY** | 모든 마이크로서비스와 포털이 공통 인증 체계를 사용해야 CSAP D-08 준수와 멀티테넌트 격리가 가능 |
| **WHO** | 모든 사용자 (슈퍼 어드민, 테넌트 관리자, 일반 사용자, 감리관) |
| **RISK** | R1: JWT 키 관리 실패 → RS256 비대칭 키 (환경변수 관리), R2: 세션 하이재킹 → HttpOnly 쿠키 + IP 검증, R3: 무차별 대입 → 계정 잠금 정책 |
| **SUCCESS** | JWT 발급/검증/갱신/블랙리스트 전체 흐름 동작, CSAP D-08 12항목 100% 준수, 단위 테스트 80%+ |
| **SCOPE** | JWT 발급/검증, RBAC 미들웨어, 멀티테넌트 세션, OAuth2/OIDC 기본 흐름, 계정 잠금/MFA 스켈레톤 |

---

## 1. 기능 요구사항 (FR)

| FR ID | 요구사항 | 우선순위 | CSAP 매핑 |
|-------|---------|---------|-----------|
| FR-P01.1 | JWT RS256 토큰 발급 (접근 15분, 갱신 7일) | MUST | D-08-01 |
| FR-P01.2 | JWT 토큰 검증 미들웨어 (Fastify 플러그인) | MUST | D-08-01 |
| FR-P01.3 | 토큰 갱신 (Refresh Token Rotation) | MUST | D-08-02 |
| FR-P01.4 | 토큰 블랙리스트 (로그아웃/강제 만료) | MUST | D-08-03 |
| FR-P01.5 | RBAC 권한 검사 (resource:action 체계) | MUST | D-08-05 |
| FR-P01.6 | 멀티테넌트 세션 격리 (tenantId 바인딩) | MUST | N2SF N-03 |
| FR-P01.7 | 동시 세션 제한 (최대 3개) | MUST | D-08-04 |
| FR-P01.8 | 로그인 실패 잠금 (5회 실패 → 30분 잠금) | MUST | D-08-06 |
| FR-P01.9 | 비밀번호 정책 (대소문자+숫자+특수, 8자 이상) | MUST | D-08-07 |
| FR-P01.10 | MFA TOTP 스켈레톤 (등록, 검증) | SHOULD | D-08-08 |
| FR-P01.11 | OAuth2/OIDC 기본 흐름 (외부 IdP 연동 준비) | SHOULD | D-08-09 |
| FR-P01.12 | 인증 이벤트 감사 로그 (audit-sdk 연동) | MUST | D-06-01 |

---

## 2. 비기능 요구사항 (NFR)

| NFR ID | 요구사항 | 기준 |
|--------|---------|------|
| NFR-P01.1 | 토큰 발급 응답 시간 100ms 이내 | 성능 |
| NFR-P01.2 | 토큰 검증 응답 시간 10ms 이내 | 성능 |
| NFR-P01.3 | 모든 비밀번호 bcrypt cost=12 해시 | 보안 |
| NFR-P01.4 | 모든 시크릿 환경변수 관리 (하드코딩 금지) | 보안 |
| NFR-P01.5 | 단위 테스트 커버리지 80% 이상 | 품질 |

---

## 3. 산출물 목록

| 번호 | 산출물 | 경로 |
|------|--------|------|
| 1 | 인증 서비스 핸들러 | platform/services/auth-service/src/handlers/ |
| 2 | RBAC 미들웨어 | platform/services/auth-service/src/middleware/ |
| 3 | JWT 유틸리티 | platform/services/auth-service/src/lib/jwt.ts |
| 4 | 감사 로그 연동 | platform/services/auth-service/src/lib/audit.ts |
| 5 | 서비스 진입점 | platform/services/auth-service/src/index.ts |
| 6 | 단위 테스트 | platform/services/auth-service/tests/unit/ |
| 7 | CSAP 보안 테스트 | platform/services/auth-service/tests/csap/ |
| 8 | Dockerfile | platform/services/auth-service/Dockerfile |

---

## 4. 의존성

| 항목 | 내용 |
|------|------|
| 선행 MTU | MTU-P00 (공통 기반) |
| 후속 MTU | MTU-P02, P03, P04, P05~P15 (전체 서비스가 인증 의존) |
| 패키지 의존 | @public-saas/types, @public-saas/auth-sdk, @public-saas/audit-sdk |
| 외부 라이브러리 | jose (JWT RS256), bcrypt, @fastify/auth, zod |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 초안 작성 | PM Agent |
