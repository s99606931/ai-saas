# Plan: MTU-N172 GitOps 환경 승격 게이트

> 버전: 1.0 | 작성일: 2026-04-10

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 환경별 배포 안전성 확보, 프로덕션 장애 최소화 |
| 기술 | Flux + 환경별 Kustomize 오버레이 + 승격 게이트 자동화 |
| 보안 | 프로덕션 승격 시 CSAP 검증 게이트 필수 |
| 운영 | dev 자동동기화, stg 자동승격(테스트 통과), prod 수동승인 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-PROMO.1 | 환경별 디렉토리 구조 (dev/stg/prod) | HIGH |
| FR-PROMO.2 | dev 환경 자동 동기화 (Flux GitSource) | HIGH |
| FR-PROMO.3 | dev→stg 자동 승격 게이트 (스모크 테스트 통과) | HIGH |
| FR-PROMO.4 | stg→prod 수동 승인 게이트 (PR 기반) | HIGH |
| FR-PROMO.5 | 승격 이력 추적 (Git 태그 + 감사 로그) | HIGH |
| FR-PROMO.6 | 환경별 시크릿/설정 분리 (Sealed Secrets) | MED |
| FR-PROMO.7 | 롤백 자동화 (Flux 이전 리비전 복원) | MED |
| FR-PROMO.8 | 승격 대시보드 (Grafana 환경 상태 패널) | MED |
