# PRD: MTU-N41 멀티환경 GitOps 분리 (dev/stg/prod)

> **버전**: 1.0.0 | **작성일**: 2026-04-09

## WHY
현재 Flux GitOps가 단일 환경 구성. dev/stg/prod 환경별 설정 분리와 승격(promotion) 절차가 필요.
CSAP D-12(개발 보안) 및 N2SF O/S/C 등급별 격리 요건 충족.

## SUCCESS
| ID | 기준 |
|----|------|
| SC-N41.1 | 3개 환경 Kustomization 분리 |
| SC-N41.2 | 환경별 values override 파일 |
| SC-N41.3 | 환경 승격(promotion) 절차 문서 |
| SC-N41.4 | Flux GitRepository + Kustomization 3개 |
| SC-N41.5 | N2SF 등급별 환경 매핑 |
