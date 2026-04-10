# MTU-N220: Flux/GitOps 동기화 상세 모니터링

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-10 | 초안 작성 | PM Lead |

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | GitOps 동기화 지연/실패 상세 분석으로 배포 안정성 강화 |
| 기술 | Flux 소스/리콘실 상세 메트릭, 의존성 체인, 버전 드리프트 |
| 품질 | 동기화 지연 < 60초, 실패 즉시 알림, 소스 가용성 99.9% |
| 규제 | CSAP D-12 시스템 개발 보안, D-06 변경 추적 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 기존 Flux 모니터링(MTU-N172) 대비 소스별 상세 메트릭 필요 |
| WHO | DevOps 팀, 릴리스 관리자 |
| RISK | 소스 리포지토리 장애 시 배포 중단 미탐지 |
| SUCCESS | 소스별 상세 대시보드 + 의존성 체인 시각화 + 상세 알림 |
| SCOPE | Flux Source/Kustomization/HelmRelease 상세 메트릭 확장 |

## 기능 요구사항

| ID | 요구사항 | 검증 기준 |
|----|---------|----------|
| FR-N220.1 | 소스 상세 Recording Rules | GitRepository/OCIRepository/HelmRepository 상태 |
| FR-N220.2 | 상세 동기화 대시보드 | 소스별/네임스페이스별 동기화 현황 + 의존성 체인 |
| FR-N220.3 | 상세 알림 규칙 | 소스 가용성, 리콘실 지연, 버전 드리프트 |

## 산출물

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | 상세 Recording Rules | `infra/monitoring/flux-detailed-rules.yaml` |
| 2 | 상세 대시보드 | `infra/monitoring/dashboards/flux-detailed-dashboard.json` |
| 3 | 상세 알림 규칙 | `infra/monitoring/flux-detailed-alerts.yaml` |
