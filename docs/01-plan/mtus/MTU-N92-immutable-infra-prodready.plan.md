# MTU-N92: 불변 인프라 + 프로덕션 준비 체크리스트 자동화 — Plan

> **MTU ID**: MTU-N92
> **Phase**: 7라운드 CI/CD·DevOps 고도화
> **작성일**: 2026-04-10

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 프로덕션 배포 안전성 100% 보장, 감리 심사 즉시 대응 |
| 기술 | Immutable Infrastructure 원칙 + 100항목 프로덕션 체크리스트 자동 검증 |
| 보안 | 런타임 변경 금지, 이미지 불변성 보장, CSAP D-11 가상화 보안 |
| 운영 | 프로덕션 배포 전 자동 게이트, 수동 실수 원천 차단 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-N92.1 | 프로덕션 준비 체크리스트 100항목 자동 검증 스크립트 | HIGH |
| FR-N92.2 | 불변 인프라 정책 (readOnlyRootFilesystem + Kyverno) | HIGH |
| FR-N92.3 | 배포 전 자동 게이트 워크플로우 | HIGH |
| FR-N92.4 | E2E 테스트 | HIGH |

## 산출물 목록

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | 프로덕션 체크리스트 스크립트 | scripts/prod-readiness-check.sh |
| 2 | 불변 인프라 정책 | infra/security/immutable-infra/policy.yaml |
| 3 | 배포 게이트 워크플로우 | .gitea/workflows/prod-gate.yaml |
| 4 | E2E 테스트 | tests/e2e/test-prod-readiness.sh |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초기 작성 | PM Agent |
