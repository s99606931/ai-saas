# MTU-N185: HPA/VPA 오토스케일링 모니터링 — Design

> 버전: 1.0.0 | 작성일: 2026-04-10 | 작성자: PM Lead
> Plan 참조: docs/01-plan/mtus/MTU-N185-hpa-vpa-autoscaling-monitoring.plan.md

## Design Anchor

| 항목 | 결정 |
|------|------|
| 아키텍처 옵션 | Pragmatic Balance — kube-state-metrics + custom recording rules |
| 데이터 소스 | kube-state-metrics (HPA/VPA 메트릭), cadvisor (실제 사용량) |
| 알림 채널 | Alertmanager → Slack/Email (기존 채널 재사용) |
| 대시보드 | Grafana JSON Provisioning (기존 패턴) |

## DS-N185.1: HPA 스케일링 이벤트 Recording Rules

HPA 상태 변화를 추적하는 recording rule을 생성합니다.

**메트릭**:
- `hpa:scaling_events:rate5m` — 5분간 스케일링 이벤트 비율
- `hpa:current_vs_desired:ratio` — 현재 레플리카 / 목표 레플리카 비율
- `hpa:utilization_vs_target:ratio` — 현재 메트릭 / 타겟 메트릭 비율

**PromQL 기반**:
```promql
# 스케일링 이벤트 비율
changes(kube_horizontalpodautoscaler_status_current_replicas[5m])

# 현재 vs 목표 비율
kube_horizontalpodautoscaler_status_current_replicas
  / kube_horizontalpodautoscaler_spec_max_replicas
```

## DS-N185.2: HPA 스케일링 실패/지연 알림

| 알림 | 조건 | 심각도 | 대기 |
|------|------|--------|------|
| HPAScalingStuck | currentReplicas != desiredReplicas 10분 이상 | critical | 10m |
| HPAMaxReplicasReached | currentReplicas == maxReplicas 30분 이상 | warning | 30m |
| HPAScalingInsufficientMetrics | 메트릭 수집 불가 | warning | 5m |

## DS-N185.3: VPA 권고 적용률 Recording Rules

기존 MTU-N72 VPA 알림과 통합하여 적용률을 recording rule로 사전 계산합니다.

**메트릭**:
- `vpa:recommendation_applied:ratio` — VPA 권고 적용률
- `vpa:recommendation_drift:percentage` — 실제 vs 권고 차이율

## DS-N185.4: 통합 대시보드 패널 구성

| 행 | 패널 | 타입 | 메트릭 |
|----|------|------|--------|
| 0 | HPA 개요 (총/정상/경고) | stat | kube_horizontalpodautoscaler_* |
| 1 | HPA 스케일링 이벤트 타임라인 | timeseries | hpa:scaling_events:rate5m |
| 2 | HPA 현재 vs 목표 레플리카 | timeseries | current/desired replicas |
| 3 | HPA 메트릭 달성률 | gauge | hpa:utilization_vs_target:ratio |
| 4 | VPA 권고 적용률 | timeseries | vpa:recommendation_applied:ratio |
| 5 | VPA CPU/Memory 권고 드리프트 | timeseries | vpa:recommendation_drift:percentage |
| 6 | 스케일링 Flapping 감지 | timeseries | hpa:flapping:score |
| 7 | 스케일링 효율성 점수 | gauge | autoscaling:efficiency:score |

## DS-N185.5: Flapping 감지

짧은 시간(30분) 내 3회 이상 스케일 방향 변경 시 Flapping으로 판정합니다.

```promql
# Flapping 점수 (30분 내 변경 횟수)
changes(kube_horizontalpodautoscaler_status_current_replicas[30m]) > 3
```

## DS-N185.6: HPA 타겟 메트릭 달성률

```promql
# CPU 기반 HPA 타겟 달성률
kube_horizontalpodautoscaler_status_current_metrics_average_value
  / kube_horizontalpodautoscaler_spec_target_metric
```

## DS-N185.7: E2E 테스트

| TC ID | 테스트 내용 | 방법 |
|-------|-----------|------|
| TC-N185.1 | YAML 문법 유효성 | yq 파싱 |
| TC-N185.2 | PromQL 문법 유효성 | promtool check rules |
| TC-N185.3 | 필수 라벨 존재 확인 | yq 쿼리 |
| TC-N185.4 | Dashboard JSON 유효성 | jq 파싱 |
| TC-N185.5 | CSAP 라벨 매핑 확인 | grep 기반 |
| TC-N185.6 | Design Ref 주석 존재 | grep 기반 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초안 작성 | PM Lead |
