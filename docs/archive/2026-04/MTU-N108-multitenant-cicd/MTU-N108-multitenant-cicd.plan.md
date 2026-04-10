# MTU-N108: 멀티테넌트 CI/CD 파이프라인 격리 — Plan

> **MTU ID**: MTU-N108
> **Phase**: 9라운드 CI/CD DevOps 고도화
> **작성일**: 2026-04-10
> **복잡도**: HIGH

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 테넌트별 독립 CI/CD 파이프라인으로 격리 보장, SaaS 제공 모델 완성 |
| 기술 | Flux + vCluster + NetworkPolicy 기반 테넌트별 파이프라인 격리 |
| 보안 | 테넌트 간 CI/CD 리소스 격리, RBAC 자동 주입 (CSAP D-08) |
| 운영 | 테넌트 온보딩 자동화, 리소스 쿼터 자동 적용 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 현재 CI/CD는 단일 테넌트. 멀티테넌트 SaaS에서 테넌트별 격리 필수 |
| WHO | 테넌트 관리자, 플랫폼 엔지니어, 보안 담당 |
| RISK | 테넌트 간 리소스 간섭, 보안 경계 위반 |
| SUCCESS | 테넌트별 독립 네임스페이스 + 파이프라인 + 쿼터 + 감사 로그 |
| SCOPE | 테넌트 CI/CD 템플릿, RBAC 자동 주입, 쿼터 설정, 감사 분리 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-N108.1 | 테넌트별 CI/CD 네임스페이스 템플릿 | HIGH |
| FR-N108.2 | 테넌트 RBAC 자동 주입 (Kyverno 정책) | HIGH |
| FR-N108.3 | 테넌트별 ResourceQuota 자동 적용 | HIGH |
| FR-N108.4 | 테넌트별 NetworkPolicy 격리 | HIGH |
| FR-N108.5 | 테넌트 온보딩 자동화 스크립트 | MED |
| FR-N108.6 | E2E 검증 테스트 | HIGH |

## 산출물 목록

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | 테넌트 네임스페이스 템플릿 | infra/multi-tenant-cicd/tenant-namespace-template.yaml |
| 2 | Kyverno RBAC 주입 정책 | infra/multi-tenant-cicd/kyverno-tenant-rbac.yaml |
| 3 | ResourceQuota 템플릿 | infra/multi-tenant-cicd/tenant-quota-template.yaml |
| 4 | NetworkPolicy 격리 | infra/multi-tenant-cicd/tenant-network-policy.yaml |
| 5 | 온보딩 스크립트 | scripts/tenant-cicd-onboarding.sh |
| 6 | E2E 테스트 | tests/e2e/multitenant-cicd.test.sh |
