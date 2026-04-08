# MTU-Q3: 사용자 관리 서비스 품질 보완 -- Plan 문서

> **문서 ID**: PLAN-MTU-Q3
> **참조 MTU**: MTU-P02 (사용자 관리 서비스)
> **버전**: 1.0.0
> **작성일**: 2026-04-06
> **목표**: 매치율 88.9% -> 95%+ (미구현 FR 2건 보완)
> **작성자**: PM Agent

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| **비즈니스** | 소프트 삭제 완성 + 비밀번호 재설정으로 사용자 관리 완결 |
| **기술** | isActive 필드 기반 소프트 삭제, 토큰 기반 비밀번호 재설정 |
| **보안** | CSAP D-08-10 계정 비활성화, D-08-07 비밀번호 재설정 정책 |
| **감리** | FR-P02.4 완성, FR-P02.7 구현으로 MUST FR 전수 달성 |

---

## 보완 대상 FR

| FR ID | 요구사항 | 현재 상태 | 보완 내용 |
|-------|---------|----------|---------|
| FR-P02.4 | 사용자 삭제/비활성화 (소프트 삭제) | PARTIAL (role 변경만) | isActive 필드 기반 소프트 삭제 + 복원 |
| FR-P02.7 | 비밀번호 재설정 (토큰 기반) | DEFER | 재설정 토큰 생성 + 검증 + 비밀번호 변경 |

---

## 산출물

| 번호 | 산출물 | 경로 |
|------|--------|------|
| 1 | user.handler.ts 업데이트 | platform/services/user-service/src/handlers/user.handler.ts |
| 2 | 비밀번호 재설정 핸들러 | platform/services/user-service/src/handlers/password-reset.handler.ts |
| 3 | routes.ts 업데이트 | platform/services/user-service/src/routes.ts |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-06 | 품질 보완 Plan 작성 | PM Agent |
