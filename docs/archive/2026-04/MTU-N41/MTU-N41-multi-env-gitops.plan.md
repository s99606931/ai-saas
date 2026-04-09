# Plan: MTU-N41 멀티환경 GitOps 분리

> **버전**: 1.0.0 | **작성일**: 2026-04-09

## 기능 요구사항

| FR ID | 요구사항 | 우선순위 |
|-------|---------|---------|
| FR-N41.1 | 환경별 디렉토리 구조 (deploy/envs/{dev,stg,prod}/) | P0 |
| FR-N41.2 | 환경별 Kustomization overlay | P0 |
| FR-N41.3 | 환경별 values override | P0 |
| FR-N41.4 | Flux Kustomization 3개 (dev/stg/prod) | P1 |
| FR-N41.5 | 환경 승격 절차 (dev→stg→prod) | P1 |
| FR-N41.6 | N2SF 등급별 환경 매핑 | P1 |

## 산출물

| 번호 | 산출물 | 경로 |
|------|--------|------|
| 1 | dev overlay | `deploy/envs/dev/` |
| 2 | stg overlay | `deploy/envs/stg/` |
| 3 | prod overlay | `deploy/envs/prod/` |
| 4 | base 공통 | `deploy/base/` |
| 5 | Flux Kustomizations | `infra/flux/environments/` |
| 6 | 운영 가이드 | `docs/framework/08-infra/multi-env-gitops-guide.md` |
