# Plan: MTU-N08 보안 강화 심화

> 작성일: 2026-04-08 | 작성자: PM Lead | 버전: 1.0
> PRD: docs/00-pm/MTU-N08-security-hardening.prd.md

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | CSAP D-08/D-10/D-12 통제항목 100% 충족 달성 |
| 기술 | OWASP Top 10 기반 6개 범주 취약점 수정 |
| 보안 | 에러 정보 노출 차단, 테넌트 격리 강화, 보안 헤더 표준화 |
| 운영 | 기존 751개 테스트 ALL PASS 유지 |

## Context Anchor

- **WHY**: CSAP 인증 및 실제 운영 환경 보안 강화
- **WHO**: 보안 감사팀, 테넌트 사용자
- **RISK**: 에러 정보 노출(HIGH), 테넌트 격리 부재(HIGH)
- **SUCCESS**: 취약점 0건, 테스트 PASS
- **SCOPE**: 전체 17개 서비스 + 2개 플러그인 + Portal

## 기능 요구사항

| FR ID | 요구사항 | OWASP | CSAP | 우선순위 |
|-------|---------|-------|------|---------|
| FR-N08.1 | AI 서비스 에러 응답 안전화 (error.code/message 직접 노출 제거) | A01 | D-12 | P0 |
| FR-N08.2 | API 게이트웨이 프록시 에러 메시지 안전화 | A01 | D-12 | P0 |
| FR-N08.3 | CRM 서비스 테넌트 격리 추가 | A01 | D-08 | P0 |
| FR-N08.4 | Billing 서비스 테넌트 격리 추가 | A01 | D-08 | P0 |
| FR-N08.5 | Subscription 서비스 테넌트 격리 강화 | A01 | D-08 | P0 |
| FR-N08.6 | Menu 서비스 테넌트 격리 확인/강화 | A01 | D-08 | P1 |
| FR-N08.7 | Catalog 서비스 관리자 권한 검사 강화 | A01 | D-08 | P1 |
| FR-N08.8 | Compliance 서비스 접근 통제 강화 | A01 | D-08 | P1 |

## 비기능 요구사항

| NFR ID | 요구사항 | 기준 |
|--------|---------|------|
| NFR-N08.1 | 기존 테스트 751개 전체 PASS | 회귀 없음 |
| NFR-N08.2 | 에러 응답에 스택 트레이스/DB 정보 노출 0건 | 전수 검사 |
| NFR-N08.3 | 모든 서비스 보안 헤더 적용 | 필수 5개 헤더 |

## 추적성 매트릭스

| FR ID | 구현 파일 | 테스트 | CSAP |
|-------|----------|--------|------|
| FR-N08.1 | ai-service/src/handlers/ai.handler.ts | CSAP D-12 테스트 | D-12 |
| FR-N08.2 | api-gateway/src/routes/proxy.ts | 통합 테스트 | D-12 |
| FR-N08.3 | crm-service/src/handlers/crm.handler.ts | 단위 테스트 | D-08 |
| FR-N08.4 | billing-service/src/handlers/billing.handler.ts | 단위 테스트 | D-08 |
| FR-N08.5 | subscription-service/src/handlers/subscription.handler.ts | 단위 테스트 | D-08 |
| FR-N08.6 | menu-service/src/handlers/menu.handler.ts | 단위 테스트 | D-08 |
| FR-N08.7 | catalog-service/src/handlers/catalog.handler.ts | 단위 테스트 | D-08 |
| FR-N08.8 | compliance-service/src/handlers/compliance.handler.ts | 단위 테스트 | D-08 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-08 | 최초 작성 | PM Lead |
