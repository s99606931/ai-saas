# MTU-P02: 사용자 관리 서비스 — Plan 문서

> **문서 ID**: PLAN-MTU-P02
> **MTU ID**: MTU-P02
> **버전**: 1.0.0
> **작성일**: 2026-04-05
> **복잡도**: HIGH
> **상태**: Draft
> **작성자**: PM Agent

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| **비즈니스** | 멀티테넌트 환경의 사용자 CRUD, 역할 할당, 비밀번호 정책, MFA 관리 |
| **기술** | Fastify 5 + Prisma 6 + Zod 검증 + bcrypt 해시 |
| **보안** | CSAP D-08 비밀번호 정책, MFA 지원, 개인정보 암호화 (D-09), 접근 통제 |
| **감리** | 사용자 관리 CRUD 전체 감사 추적, RBAC 역할 변경 이력 |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| **WHY** | 테넌트별 사용자 관리와 역할 할당이 플랫폼 접근 통제의 핵심 |
| **WHO** | 슈퍼 어드민 (전체 사용자), 테넌트 관리자 (테넌트 내 사용자) |
| **RISK** | R1: 테넌트 간 사용자 데이터 유출 → tenantId 필터 강제, R2: 비밀번호 유출 → bcrypt + AES-256 |
| **SUCCESS** | 사용자 CRUD + 역할 할당 + MFA 등록/해제 전체 흐름 동작, 테넌트 격리 검증 통과 |
| **SCOPE** | 사용자 CRUD, 역할 관리 (5종), 비밀번호 정책, MFA TOTP, 프로필 관리 |

---

## 1. 기능 요구사항 (FR)

| FR ID | 요구사항 | 우선순위 | CSAP 매핑 |
|-------|---------|---------|-----------|
| FR-P02.1 | 사용자 생성 (이메일+비밀번호, Zod 검증) | MUST | D-08-01 |
| FR-P02.2 | 사용자 조회 (목록, 상세, 테넌트 격리) | MUST | D-08-05, N-03 |
| FR-P02.3 | 사용자 수정 (프로필, 상태 변경) | MUST | D-08-05 |
| FR-P02.4 | 사용자 삭제/비활성화 (소프트 삭제) | MUST | D-08-10 |
| FR-P02.5 | 역할 할당/변경 (5종 역할) | MUST | D-08-05 |
| FR-P02.6 | 비밀번호 변경 (현재 비밀번호 확인 필수) | MUST | D-08-07 |
| FR-P02.7 | 비밀번호 재설정 (토큰 기반) | MUST | D-08-07 |
| FR-P02.8 | MFA TOTP 등록/해제 | SHOULD | D-08-08 |
| FR-P02.9 | 테넌트별 사용자 수 제한 (maxUsers) | MUST | N-03 |
| FR-P02.10 | 사용자 변경 감사 로그 | MUST | D-06-01 |

---

## 2. 산출물 목록

| 번호 | 산출물 | 경로 |
|------|--------|------|
| 1 | 사용자 CRUD 핸들러 | platform/services/user-service/src/handlers/ |
| 2 | 비밀번호 정책 | platform/services/user-service/src/lib/password-policy.ts |
| 3 | 입력 검증 스키마 | platform/services/user-service/src/schemas/ |
| 4 | 단위 테스트 | platform/services/user-service/tests/ |
| 5 | Dockerfile | platform/services/user-service/Dockerfile |

---

## 3. 의존성

| 항목 | 내용 |
|------|------|
| 선행 MTU | MTU-P00, MTU-P01 |
| 후속 MTU | MTU-P03, P05, P09, P11 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 초안 작성 | PM Agent |
