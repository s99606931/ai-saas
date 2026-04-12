# MTU-N199: Pod Disruption Budget 준수 모니터링 -- Plan

> 버전: 1.0.0 | 작성일: 2026-04-10 | 작성자: PM Lead

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | PDB를 통한 서비스 가용성 보장, 유지보수 중 최소 가용 Pod 수 확인 |
| 기술 | kube_poddisruptionbudget 메트릭 기반 PDB 현황 및 위반 추적 |
| 보안 | CSAP D-10 서비스 가용성, D-08 접근 통제 |
| 운영 | PDB 미설정 Deployment 감지, disruptionsAllowed 0 알림 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 | CSAP |
|----|---------|---------|------|
| FR-N199.1 | PDB 현황 recording rule (desired/current/available) | P0 | D-10 |
| FR-N199.2 | PDB disruptionsAllowed 0 알림 (더 이상 중단 불가) | P0 | D-10 |
| FR-N199.3 | PDB 미설정 주요 Deployment 감지 | P0 | D-10 |
| FR-N199.4 | PDB 위반 상태 추적 | P1 | D-10 |
| FR-N199.5 | PDB 준수 통합 대시보드 | P0 | D-10 |
| FR-N199.6 | E2E 검증 테스트 | P0 | D-12 |

## 산출물 목록

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | Recording rules | infra/monitoring/pdb-compliance-rules.yaml |
| 2 | Alerting rules | infra/monitoring/pdb-compliance-alerts.yaml |
| 3 | Grafana 대시보드 | infra/monitoring/dashboards/pdb-compliance-dashboard.json |
| 4 | E2E 테스트 | tests/monitoring/test-mtu-n199-pdb-compliance.sh |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초안 작성 | PM Lead |
