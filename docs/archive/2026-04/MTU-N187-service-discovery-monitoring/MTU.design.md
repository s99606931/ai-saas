# MTU-N187: 서비스 디스커버리 모니터링 — Design

> 버전: 1.0.0 | 작성일: 2026-04-10 | 작성자: PM Lead
> Plan 참조: docs/01-plan/mtus/MTU-N187-service-discovery-monitoring.plan.md

## Design Anchor

| 항목 | 결정 |
|------|------|
| 아키텍처 옵션 | Pragmatic Balance — kube-state-metrics + CoreDNS 메트릭 활용 |
| 데이터 소스 | kube-state-metrics (Endpoint/EndpointSlice), CoreDNS 메트릭 |
| 기존 연계 | MTU-N174 DNS 모니터링과 보완 관계 (중복 없이 확장) |
| 대시보드 | Grafana JSON Provisioning |

## DS-N187.1: Service Endpoint 준비 상태

```promql
# 서비스별 Ready Endpoint 수
kube_endpoint_address_available
# 서비스별 NotReady Endpoint 수
kube_endpoint_address_not_ready
# Endpoint 가용률
kube_endpoint_address_available
  / (kube_endpoint_address_available + kube_endpoint_address_not_ready)
```

## DS-N187.2: Endpoint 없는 서비스 감지

```promql
# Ready Endpoint가 0인 서비스 (Headless 제외)
kube_endpoint_address_available == 0
  unless on(namespace, endpoint)
  (kube_service_spec_type{type="ExternalName"})
```

## DS-N187.3: CoreDNS 캐시 히트율

```promql
# 캐시 히트율 (%)
rate(coredns_cache_hits_total[5m])
  / (rate(coredns_cache_hits_total[5m]) + rate(coredns_cache_misses_total[5m]))
```

## DS-N187.4: CoreDNS 포워드 지연

```promql
# 업스트림 포워드 레이턴시 (초)
histogram_quantile(0.99,
  rate(coredns_forward_request_duration_seconds_bucket[5m])
)
```

## DS-N187.5: 대시보드 패널 구성

| 행 | 패널 | 타입 | 메트릭 |
|----|------|------|--------|
| 0 | 서비스 디스커버리 상태 개요 | stat | 종합 |
| 1 | 서비스별 Ready/NotReady Endpoint | timeseries | endpoint 가용률 |
| 2 | Endpoint 없는 서비스 목록 | table | endpoint == 0 |
| 3 | CoreDNS 캐시 히트율 | gauge | cache hit ratio |
| 4 | CoreDNS 포워드 레이턴시 (p99) | timeseries | forward latency |
| 5 | EndpointSlice 변경 빈도 | timeseries | changes rate |
| 6 | 서비스 타입별 분포 | piechart | service types |

## DS-N187.6: Headless 서비스 DNS 레코드

```promql
# Headless 서비스의 DNS A 레코드 수 (= Ready Pod 수와 일치해야 함)
kube_endpoint_address_available{endpoint=~".*-headless"}
```

## DS-N187.7: EndpointSlice 변경 빈도

```promql
# EndpointSlice 변경 횟수 (5분 윈도우)
changes(kube_endpointslice_created[5m])
```

## DS-N187.8: E2E 테스트

| TC ID | 테스트 내용 |
|-------|-----------|
| TC-N187.1 | YAML 문법 유효성 |
| TC-N187.2 | Recording rule 최소 6개 |
| TC-N187.3 | Alert rule 최소 4개 |
| TC-N187.4 | Dashboard JSON 유효성 + 패널 최소 7개 |
| TC-N187.5 | CSAP 라벨 매핑 |
| TC-N187.6 | Design Ref 주석 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초안 작성 | PM Lead |
