# MTU-N198: Endpoint/EndpointSlice 가용성 모니터링 -- Design

> 버전: 1.0.0 | 작성일: 2026-04-10 | 작성자: PM Lead
> Plan 참조: docs/01-plan/mtus/MTU-N198-endpoint-availability.plan.md

## Design Anchor

| 항목 | 결정 |
|------|------|
| 아키텍처 | Pragmatic Balance -- kube-state-metrics Endpoint 메트릭 |
| 메트릭 소스 | kube_endpoint_address_available/not_ready, kube_endpointslice_* |

## 상세 설계

### 1. Recording Rules

```yaml
endpoint:ready_count_by_service -- 서비스별 Ready Endpoint 수
endpoint:not_ready_count_by_service -- 서비스별 NotReady Endpoint 수
endpoint:ready_ratio -- 서비스별 Ready 비율
endpoint:zero_endpoint_services -- Endpoint 0개 서비스 수
```

### 2. Alerting Rules

| 알림명 | 조건 | 심각도 | for |
|--------|------|--------|-----|
| EndpointZero | Ready Endpoint 0개 | critical | 2m |
| EndpointReadyRatioLow | Ready 비율 < 50% | warning | 5m |
| EndpointNotReadySpike | NotReady > 3개 | warning | 5m |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초안 작성 | PM Lead |
