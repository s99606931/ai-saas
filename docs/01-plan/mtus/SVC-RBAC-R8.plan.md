# SVC-RBAC-R8 Plan -- RBAC 세분화 (자원별 권한 매트릭스)

> Plan SC: FR-RBAC.1~FR-RBAC.6
> CSAP: D-08 접근 통제 (12개 항목) 완전 준수
> Phase: Round 8

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-09 | 초기 작성 | PM (Claude) |

## Executive Summary

| 관점 | 내용 |
|------|------|
| 사업 | 단순 역할(admin/user/viewer) -> 자원별 세분화된 권한 매트릭스 |
| 기술 | @public-saas/rbac 공유 패키지, 권한 정의/검증/미들웨어 |
| 보안 | CSAP D-08 접근 통제 12개 항목 100% 커버리지 |
| 품질 | 권한 검증 자동화, E2E 포함 테스트 |

## Context Anchor

- **WHY**: 현재 단순 role 기반 접근 통제로 CSAP D-08 세분화 요건 미충족
- **WHO**: 감리관, 보안 담당자, 서비스 개발자
- **RISK**: 과도한 권한 부여로 인한 보안 취약점
- **SUCCESS**: @public-saas/rbac 생성 + 테스트 통과 + 서비스 적용 데모
- **SCOPE**: 공유 패키지 + tenant/user/billing/catalog 서비스 적용 예시

## 요구사항

| FR ID | 내용 | CSAP |
|-------|------|------|
| FR-RBAC.1 | @public-saas/rbac 공유 패키지 생성 | D-08-01 |
| FR-RBAC.2 | 자원별 권한 정의 (resource:action 패턴) | D-08-02 |
| FR-RBAC.3 | 역할-권한 매핑 테이블 | D-08-03 |
| FR-RBAC.4 | Fastify 미들웨어로 API 자동 검증 | D-08-04 |
| FR-RBAC.5 | 권한 부족 시 403 + 감사 로그 | D-08, D-06 |
| FR-RBAC.6 | 테넌트별 커스텀 역할 지원 구조 | D-08-05 |

## 권한 매트릭스

| 자원 | 액션 | SUPER_ADMIN | ADMIN | USER | VIEWER |
|------|------|:-----------:|:-----:|:----:|:------:|
| tenant | create | O | X | X | X |
| tenant | read | O | O | O | O |
| tenant | update | O | O | X | X |
| tenant | delete | O | X | X | X |
| user | create | O | O | X | X |
| user | read | O | O | O | O |
| user | update | O | O | self | X |
| user | delete | O | O | X | X |
| billing | read | O | O | O | O |
| billing | write | O | O | X | X |
| catalog | read | O | O | O | O |
| catalog | write | O | O | X | X |
| catalog | delete | O | X | X | X |
| security | read | O | O | X | X |
| security | write | O | X | X | X |
| audit | read | O | O | X | X |
| ai | chat | O | O | O | X |
| ai | manage | O | X | X | X |
