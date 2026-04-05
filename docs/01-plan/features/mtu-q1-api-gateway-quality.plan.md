# MTU-Q1: API 게이트웨이 품질 보완 -- Plan 문서

> **문서 ID**: PLAN-MTU-Q1
> **참조 MTU**: MTU-P04 (API 게이트웨이)
> **버전**: 1.0.0
> **작성일**: 2026-04-06
> **목표**: 매치율 81.8% -> 95%+ (미구현 FR 2건 보완)
> **작성자**: PM Agent

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| **비즈니스** | API 게이트웨이 감사 로그 연동 및 OpenAPI 문서 자동 생성으로 운영 가시성 확보 |
| **기술** | audit-sdk 연동, @fastify/swagger + @fastify/swagger-ui 통합 |
| **보안** | CSAP D-06-01 감사 추적, D-12 API 문서화를 통한 보안 가시성 |
| **감리** | FR-P04.7, FR-P04.10 전수 구현으로 전체 FR 100% 달성 |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| **WHY** | API 게이트웨이 매치율 81.8%로 품질 기준 미달. 감사 로그와 OpenAPI 미구현 |
| **WHO** | 운영자 (감사 로그), 개발자 (API 문서) |
| **RISK** | R1: 감사 로그 미연동 -> CSAP D-06 감리 결함 가능 |
| **SUCCESS** | 11/11 FR PASS, 매치율 95%+ |
| **SCOPE** | FR-P04.7 감사 로그, FR-P04.10 OpenAPI 문서 |

---

## 보완 대상 FR

| FR ID | 요구사항 | 현재 상태 | 보완 내용 |
|-------|---------|----------|---------|
| FR-P04.7 | 요청/응답 감사 로그 | DEFER | audit-sdk 연동, 요청 로깅 미들웨어 추가 |
| FR-P04.10 | OpenAPI 문서 자동 생성 | DEFER | @fastify/swagger 플러그인 등록, /docs UI 제공 |

---

## 산출물

| 번호 | 산출물 | 경로 |
|------|--------|------|
| 1 | 감사 로그 미들웨어 | platform/services/api-gateway/src/plugins/audit-logger.ts |
| 2 | OpenAPI 설정 플러그인 | platform/services/api-gateway/src/plugins/swagger.ts |
| 3 | index.ts 업데이트 | platform/services/api-gateway/src/index.ts |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-06 | 품질 보완 Plan 작성 | PM Agent |
