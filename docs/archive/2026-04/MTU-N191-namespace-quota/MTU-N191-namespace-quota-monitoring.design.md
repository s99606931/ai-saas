# MTU-N191: Namespace 리소스 쿼터 모니터링 — Design

> 버전: 1.0.0 | 작성일: 2026-04-10 | 작성자: PM Lead
> Plan 참조: docs/01-plan/mtus/MTU-N191-namespace-quota-monitoring.plan.md

## Design Anchor

| 항목 | 결정 |
|------|------|
| 아키텍처 | kube-state-metrics ResourceQuota 메트릭 활용 |
| 데이터 소스 | kube_resourcequota (hard/used) |
| 대시보드 | Grafana JSON Provisioning |

## DS-N191.1: 쿼터 사용률 Recording Rules

```promql
kube_resourcequota{type="used"} / kube_resourcequota{type="hard"}
```

## DS-N191.2: 알림 규칙

| 알림 | 조건 | 심각도 |
|------|------|--------|
| QuotaUsageHigh | 사용률 > 80% | warning |
| QuotaUsageCritical | 사용률 > 90% | critical |
| QuotaExhausted | 사용률 == 100% | critical |

## DS-N191.3: 대시보드 패널

| 행 | 패널 | 타입 |
|----|------|------|
| 0 | 쿼터 상태 개요 | stat |
| 1 | CPU 쿼터 사용률 | gauge |
| 2 | Memory 쿼터 사용률 | gauge |
| 3 | Pod 수 쿼터 사용률 | timeseries |
| 4 | 네임스페이스별 쿼터 비교 | bargauge |
| 5 | 쿼터 사용 추세 | timeseries |
| 6 | LimitRange 설정 현황 | table |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초안 작성 | PM Lead |
