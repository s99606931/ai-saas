# MTU-N140: 의존성 보안 감사 — Plan

> 버전: 1.0 | 작성일: 2026-04-10 | 작성자: PM Lead

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | npm/OCI 의존성의 보안 취약점 자동 감사로 공급망 보안 강화 |
| 기술 | npm audit + 의존성 라이선스 검증 + 업데이트 권고 |
| 보안 | CSAP D-12 시스템 개발 보안 -- 오픈소스 관리 |
| 운영 | 주간 자동 스캔 + 취약점 보고서 자동 발행 |

## 기능 요구사항

| FR ID | 요구사항 | 검증 기준 |
|-------|---------|----------|
| FR-N140.1 | npm 의존성 취약점 스캔 | critical/high/medium/low 분류 |
| FR-N140.2 | 라이선스 호환성 검증 | 금지 라이선스 탐지 |
| FR-N140.3 | 업데이트 가능 패키지 목록 | outdated 패키지 보고 |
| FR-N140.4 | 공급망 보안 점수 | S2C2F 기반 성숙도 평가 |
| FR-N140.5 | 검증 테스트 | 스크립트 실행 검증 |

## 산출물

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | Plan 문서 | docs/01-plan/mtus/MTU-N140.plan.md |
| 2 | Design 문서 | docs/02-design/mtus/MTU-N140.design.md |
| 3 | 의존성 감사 스크립트 | scripts/dependency-security-audit.sh |
| 4 | 검증 테스트 | scripts/test-dependency-audit.sh |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-10 | 초기 작성 | PM Lead |
