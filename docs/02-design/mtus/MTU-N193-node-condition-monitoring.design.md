# MTU-N193: 노드 상태 상세 모니터링 — Design

> 버전: 1.0.0 | 작성일: 2026-04-10 | 작성자: PM Lead

## Design Anchor

| 항목 | 결정 |
|------|------|
| 아키텍처 | kube-state-metrics node condition 메트릭 활용 |
| 데이터 소스 | kube_node_status_condition, kube_node_spec_unschedulable |
| 대시보드 | Grafana JSON Provisioning |

## DS-N193.1~6: 구현 내용

노드 5가지 Condition + Unschedulable + Allocatable 메트릭 추적.

알림: NotReady(3분), MemoryPressure/DiskPressure/PIDPressure(5분), Unschedulable(10분), 노드 수 감소.

대시보드 7개 패널: 상태 개요, Condition 히트맵, 노드별 상태, 알림 히스토리, Allocatable 리소스, Unschedulable 목록, 노드 수 추세.

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초안 작성 | PM Lead |
