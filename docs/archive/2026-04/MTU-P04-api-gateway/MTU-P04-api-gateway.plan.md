# MTU-P04: API 게이트웨이 — Plan 문서

> **문서 ID**: PLAN-MTU-P04
> **MTU ID**: MTU-P04
> **버전**: 1.0.0
> **작성일**: 2026-04-05
> **복잡도**: HIGH
> **상태**: Draft
> **작성자**: PM Agent

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| **비즈니스** | 모든 마이크로서비스와 비즈니스 플러그인의 단일 진입점. 라우팅/인증/제한/모니터링 통합 |
| **기술** | Fastify 5 + @fastify/auth + @fastify/rate-limit + Zod + 서비스 레지스트리 |
| **보안** | CSAP D-08 인증 미들웨어, D-10 Rate Limiting, N2SF 데이터 등급 검증 |
| **감리** | API 게이트웨이 아키텍처 증적, 트래픽 제한 정책, 라우팅 규칙 |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| **WHY** | 마이크로서비스 아키텍처에서 클라이언트 요청의 단일 진입점이 필요. 인증, Rate Limiting, 로깅을 중앙 집중 |
| **WHO** | 프론트엔드 포털 (admin-portal, tenant-portal), 외부 API 클라이언트 |
| **RISK** | R1: 단일 장애점 → 헬스체크 + 서비스 디스커버리, R2: DDoS → Rate Limiting + IP 차단 |
| **SUCCESS** | 서비스 라우팅 + 인증 미들웨어 + Rate Limiting + 비즈니스 서비스 동적 등록 동작 |
| **SCOPE** | 프록시 라우팅, 인증 미들웨어, Rate Limiting, 서비스 레지스트리, 헬스체크, CORS |

---

## 1. 기능 요구사항 (FR)

| FR ID | 요구사항 | 우선순위 | CSAP 매핑 |
|-------|---------|---------|-----------|
| FR-P04.1 | 서비스별 프록시 라우팅 (/api/v1/{service}/*) | MUST | - |
| FR-P04.2 | JWT 인증 미들웨어 (auth-sdk 연동) | MUST | D-08-01 |
| FR-P04.3 | RBAC 권한 검사 (라우트별 권한 설정) | MUST | D-08-05 |
| FR-P04.4 | Rate Limiting (IP 기반, 테넌트 기반) | MUST | D-10 |
| FR-P04.5 | 서비스 레지스트리 (플랫폼 + 비즈니스 서비스) | MUST | - |
| FR-P04.6 | N2SF 데이터 등급 검증 미들웨어 | MUST | N-05 |
| FR-P04.7 | 요청/응답 감사 로그 | MUST | D-06-01 |
| FR-P04.8 | CORS 설정 (허용 Origin 관리) | MUST | D-10 |
| FR-P04.9 | 헬스체크 엔드포인트 (/health, /ready) | MUST | - |
| FR-P04.10 | OpenAPI 문서 자동 생성 (@fastify/swagger) | SHOULD | D-12 |
| FR-P04.11 | 비즈니스 서비스 동적 등록 (SDK 연동) | SHOULD | - |

---

## 2. 의존성

| 항목 | 내용 |
|------|------|
| 선행 MTU | MTU-P01 |
| 후속 MTU | MTU-P18 (비즈니스 플러그인 SDK), MTU-U1-P (포털 UI) |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 초안 작성 | PM Agent |
