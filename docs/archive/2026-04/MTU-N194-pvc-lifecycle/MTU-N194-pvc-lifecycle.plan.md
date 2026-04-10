# MTU-N194: Persistent Volume Claim 라이프사이클 모니터링 -- Plan

> 버전: 1.0.0 | 작성일: 2026-04-10 | 작성자: PM Lead

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | PVC 상태 이상(Pending 장기체류, Lost) 사전 감지로 서비스 중단 방지 |
| 기술 | kube_persistentvolumeclaim_status_phase 메트릭 기반 상태 전이 추적 |
| 보안 | CSAP D-10 서비스 가용성, D-09 스토리지 암호화 상태 검증 |
| 운영 | PVC Pending/Lost 자동 알림, 프로비저닝 지연 감지, 미사용 PVC 정리 권고 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | MTU-N173이 용량 관점 모니터링을 제공하나, PVC 상태 전이(Pending->Bound->Lost) 라이프사이클 추적이 부재 |
| WHO | SRE 팀, 인프라 운영자 |
| RISK | PVC Pending 장기체류 시 Pod 스케줄링 실패, Lost PV 데이터 유실 |
| SUCCESS | 모든 PVC 상태 전이 실시간 추적, Pending 5분 초과 자동 알림 |
| SCOPE | PVC 상태 phase recording rule + 알림 + 미사용 PVC 탐지 + 대시보드 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 | CSAP |
|----|---------|---------|------|
| FR-N194.1 | PVC 상태(Pending/Bound/Lost) recording rule | P0 | D-10 |
| FR-N194.2 | Pending 상태 5분 초과 PVC 경고 알림 | P0 | D-10 |
| FR-N194.3 | Lost 상태 PVC 즉시 긴급 알림 | P0 | D-09 |
| FR-N194.4 | 미사용(Bound이나 Pod 미연결) PVC 탐지 recording rule | P1 | D-10 |
| FR-N194.5 | PVC 프로비저닝 소요 시간 추적 | P1 | D-10 |
| FR-N194.6 | PVC 라이프사이클 통합 대시보드 | P0 | D-10 |
| FR-N194.7 | E2E 검증 테스트 | P0 | D-12 |

## 산출물 목록

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | PVC 라이프사이클 recording rules | infra/monitoring/pvc/pvc-lifecycle-rules.yaml |
| 2 | PVC 라이프사이클 alerting rules | infra/monitoring/pvc/pvc-lifecycle-alerts.yaml |
| 3 | Grafana 대시보드 | infra/monitoring/dashboards/pvc-lifecycle-dashboard.json |
| 4 | E2E 테스트 | tests/monitoring/test-mtu-n194-pvc-lifecycle.sh |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초안 작성 | PM Lead |
