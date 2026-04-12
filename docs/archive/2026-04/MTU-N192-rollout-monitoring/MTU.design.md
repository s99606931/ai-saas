# MTU-N192: Deployment/StatefulSet 롤아웃 모니터링 — Design

> 버전: 1.0.0 | 작성일: 2026-04-10 | 작성자: PM Lead

## Design Anchor

| 항목 | 결정 |
|------|------|
| 아키텍처 | kube-state-metrics deployment/statefulset 메트릭 |
| 대시보드 | Grafana JSON Provisioning |

## DS-N192.1: Deployment 롤아웃 Recording Rules

```promql
# 롤아웃 진행률
kube_deployment_status_replicas_updated / kube_deployment_spec_replicas
# Generation 불일치 (롤아웃 미완료)
kube_deployment_metadata_generation != kube_deployment_status_observed_generation
```

## DS-N192.2: 알림 규칙

| 알림 | 조건 | 심각도 |
|------|------|--------|
| DeploymentRolloutStuck | updated != replicas 15분+ | critical |
| DeploymentGenerationMismatch | generation 불일치 10분+ | warning |
| StatefulSetRolloutStuck | updatedReplicas != replicas 15분+ | critical |
| DeploymentReplicasMismatch | available < desired 10분+ | warning |

## DS-N192.3: 대시보드 패널

| 행 | 패널 | 타입 |
|----|------|------|
| 0 | 롤아웃 상태 개요 | stat |
| 1 | Deployment 롤아웃 진행률 | timeseries |
| 2 | StatefulSet 롤아웃 진행률 | timeseries |
| 3 | 롤아웃 중인 워크로드 | table |
| 4 | Available vs Desired 레플리카 | timeseries |
| 5 | 배포 세대 불일치 목록 | table |
| 6 | 롤아웃 이력 타임라인 | timeseries |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초안 작성 | PM Lead |
