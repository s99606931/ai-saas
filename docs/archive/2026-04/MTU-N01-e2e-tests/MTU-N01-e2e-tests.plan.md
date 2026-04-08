# MTU-N01: E2E 통합 테스트 스위트 — Plan 문서

> **버전**: 1.0.0 | **작성일**: 2026-04-08 | **작성자**: PM Lead
> **CSAP 관련**: D-12 (시스템 개발 보안 - 통합시험), D-08 (접근 통제 검증)

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | CSAP D-12 통합시험 요건 충족, 프로덕션 배포 전 품질 보증 |
| 기술 | Vitest 기반 E2E 테스트 스위트 (서비스 간 통합 시나리오) |
| 보안 | 인증-인가 흐름 E2E 검증, 테넌트 격리 확인, RBAC 검증 |
| 운영 | 자동화된 E2E 테스트로 회귀 테스트 비용 절감 |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 546개 단위 테스트 ALL PASS이나 서비스 간 통합 E2E 테스트 부재. CSAP D-12 통합시험 확인 요건 미충족. |
| WHO | 개발팀, QA, CSAP 인증 심사원 |
| RISK | E2E 테스트 없이 프로덕션 배포 시 서비스 간 연동 장애 미감지 위험 |
| SUCCESS | E2E 테스트 스위트 구현 완료, 핵심 시나리오 10+ 커버, CSAP D-12 통합시험 충족 |
| SCOPE | 서비스 간 API 통합 테스트 (Mock 기반, 실제 서비스 기동 불필요) |

---

## 기능 요구사항 (FR)

| FR ID | 요구사항 | 우선순위 | CSAP |
|-------|---------|---------|------|
| FR-N01.1 | 인증 흐름 E2E 테스트 (로그인/토큰검증/로그아웃) | P1 | D-08 |
| FR-N01.2 | 테넌트 CRUD E2E 테스트 (생성/조회/수정/삭제) | P1 | D-08 |
| FR-N01.3 | 사용자 관리 E2E 테스트 (CRUD + RBAC) | P1 | D-08 |
| FR-N01.4 | API 게이트웨이 라우팅 E2E 테스트 | P1 | D-10 |
| FR-N01.5 | 감사 로그 기록/조회 E2E 테스트 | P1 | D-06 |
| FR-N01.6 | 구독/과금 워크플로 E2E 테스트 | P2 | - |
| FR-N01.7 | CSAP 준수 현황 조회 E2E 테스트 | P2 | D-12 |
| FR-N01.8 | 테넌트 격리 검증 E2E 테스트 (Cross-tenant 접근 차단) | P1 | D-08, N2SF N-03 |
| FR-N01.9 | 보안 이벤트 흐름 E2E 테스트 (로그인 실패 -> 감사 로그) | P1 | D-06, D-08 |
| FR-N01.10 | Rate Limiting E2E 테스트 | P2 | D-10 |
| FR-N01.11 | AI 서비스 데이터 등급 검증 E2E 테스트 | P1 | N2SF N-05 |
| FR-N01.12 | 플러그인 라우팅 E2E 테스트 (전자결재/공공데이터) | P2 | D-11 |

---

## 비기능 요구사항 (NFR)

| NFR ID | 요구사항 |
|--------|---------|
| NFR-N01.1 | E2E 테스트 전체 실행 시간 60초 이내 |
| NFR-N01.2 | Mock 기반 — 외부 DB/Redis 의존 없음 |
| NFR-N01.3 | vitest run으로 자동 실행 가능 |
| NFR-N01.4 | 기존 CI/CD 파이프라인에 통합 가능한 구조 |

---

## 추적성 매트릭스

| FR ID | 산출물 | 테스트 | CSAP |
|-------|--------|--------|------|
| FR-N01.1 | e2e/auth-flow.e2e.test.ts | 인증 흐름 시나리오 | D-08 |
| FR-N01.2 | e2e/tenant-lifecycle.e2e.test.ts | 테넌트 CRUD | D-08 |
| FR-N01.3 | e2e/user-management.e2e.test.ts | 사용자 관리 | D-08 |
| FR-N01.4 | e2e/gateway-routing.e2e.test.ts | 게이트웨이 라우팅 | D-10 |
| FR-N01.5 | e2e/audit-trail.e2e.test.ts | 감사 로그 | D-06 |
| FR-N01.8 | e2e/tenant-isolation.e2e.test.ts | 테넌트 격리 | D-08, N-03 |
| FR-N01.9 | e2e/security-events.e2e.test.ts | 보안 이벤트 | D-06, D-08 |
| FR-N01.11 | e2e/ai-data-grade.e2e.test.ts | AI 데이터 등급 | N-05 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-08 | 최초 작성 | PM Lead |
