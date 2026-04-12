# MTU-N118: E2E 릴리스 파이프라인 v2 (SLO 기반 롤백)

> 버전: 1.0.0 | 작성일: 2026-04-10

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 완전 자동 릴리스 파이프라인, SLO 위반 시 자동 롤백, 프로덕션 체크리스트 100% 자동화 |
| 기술 | Gitea Actions + Argo Rollouts + Flagger + Prometheus SLO 연동 |
| 보안 | Cosign 서명 검증, SBOM 생성, 보안 스캔 게이트 |
| 운영 | 롤백 MTTR 5분 이내, 릴리스 노트 자동 생성 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-N118.1 | 릴리스 파이프라인 워크플로우 (빌드→테스트→서명→배포→검증) | HIGH |
| FR-N118.2 | SLO 기반 자동 롤백 트리거 (에러율, 지연시간) | HIGH |
| FR-N118.3 | 프로덕션 준비 체크리스트 자동 검증 | HIGH |
| FR-N118.4 | 릴리스 노트 자동 생성 (Conventional Commits 파싱) | MED |
| FR-N118.5 | 마이그레이션 가이드 자동 생성 (Breaking Changes 탐지) | MED |
| FR-N118.6 | E2E 테스트 | HIGH |
