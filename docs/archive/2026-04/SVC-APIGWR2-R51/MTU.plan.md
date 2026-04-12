# SVC-APIGWR2-R51 Plan — API Gateway R2 (Problem Details + 전역 에러 핸들러)

> **MTU ID**: SVC-APIGWR2-R51
> **라운드**: R51 (3회차 고도화 루프 #2)
> **작성일**: 2026-04-11
> **작성자**: PM Lead
> **상태**: Plan 완료

---

## Executive Summary

| 관점 | 핵심 내용 |
|------|---------|
| 비즈니스 | API 게이트웨이 에러 응답을 RFC 7807 표준으로 전환하여 하위 서비스와 일관된 에러 포맷 제공 |
| 기술 | `@public-saas/problem-details` 통합, Fastify 전역 `setErrorHandler` + `setNotFoundHandler` 구현 |
| 보안 | CSAP D-10(응답 헤더), D-06(상관관계), D-12-03(표준 에러) 강화 |
| 감리 | 게이트웨이 수준에서 모든 404/500/503 응답이 Problem Details로 일관됨 |

---

## Context Anchor

- **WHY**: 프록시 실패, 인증 실패, 플러그인 누락 등 다양한 에러 지점이 `{success:false, error:{code,message}}` 포맷을 반복함. 게이트웨이에서 표준화 필요.
- **WHO**: 프론트엔드/SDK/감리 자동화, 하위 서비스 개발자
- **RISK**: admin 엔드포인트 응답 포맷 변경으로 운영 스크립트 영향. 대응: admin 엔드포인트만 전환, 프록시 본체 응답은 유지(하위 서비스 응답 그대로 전달).
- **SUCCESS**: 전역 에러 핸들러 + 플러그인 404 + 서비스 미등록 등 5개 에러 지점이 Problem Details로 반환.
- **SCOPE**:
  - 전역 `setErrorHandler` (Fastify 내장 에러 + Circuit Open)
  - 전역 `setNotFoundHandler`
  - `/admin/circuits` 403 응답
  - `/admin/circuits/:serviceId/reset` 403 응답
  - `/api/v1/plugins/:pluginId/*` 404/503/502 응답
  - 범위 제외: 프록시 본체 응답 (하위 서비스 통과)

---

## 요구사항 (FR)

| ID | 설명 | 우선순위 |
|----|------|--------|
| FR-APIGWR2.1 | `app.setErrorHandler()` 등록 — 모든 uncaught 에러를 Problem Details로 변환 | P0 |
| FR-APIGWR2.2 | `app.setNotFoundHandler()` 등록 — 404를 Problem Details로 변환 | P0 |
| FR-APIGWR2.3 | `/admin/*` 엔드포인트 403을 Problem Details로 전환 | P0 |
| FR-APIGWR2.4 | 동적 플러그인 프록시의 404/502/503을 Problem Details로 전환 | P0 |
| FR-APIGWR2.5 | traceId(x-request-id)를 응답 본문에 자동 포함 | P0 |
| FR-APIGWR2.6 | 에러 로그에 traceId 필드 포함 (상관관계 강화) | P1 |
| NFR-APIGWR2.1 | 기존 프록시 본체 응답(2xx) 무변경 | P0 |
| NFR-APIGWR2.2 | 기존 인증/RBAC 로직 무변경 (별도 라운드 대상) | P0 |

---

## 추적성 매트릭스

| FR ID | 설계 섹션 | 구현 파일 | 테스트 파일 | CSAP |
|-------|---------|---------|----------|------|
| FR-APIGWR2.1 | §2.1 전역 에러 | `plugins/problem-error.ts`, `index.ts` | `tests/unit/problem-error.test.ts` | D-12-03 |
| FR-APIGWR2.2 | §2.2 404 핸들러 | `plugins/problem-error.ts`, `index.ts` | `tests/unit/problem-error.test.ts` | D-12-03 |
| FR-APIGWR2.3 | §2.3 admin 전환 | `index.ts` | `tests/unit/problem-error.test.ts` | D-08 |
| FR-APIGWR2.4 | §2.4 플러그인 에러 | `routes/proxy.ts` | `tests/unit/problem-error.test.ts` | D-07 |
| FR-APIGWR2.5 | §2.5 traceId | `plugins/problem-error.ts` | `tests/unit/problem-error.test.ts` | D-06-02 |
| FR-APIGWR2.6 | §2.6 로그 | `plugins/problem-error.ts` | 관찰 기반 | D-06-01 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|-------|
| 1.0.0 | 2026-04-11 | 최초 작성 | PM Lead |
