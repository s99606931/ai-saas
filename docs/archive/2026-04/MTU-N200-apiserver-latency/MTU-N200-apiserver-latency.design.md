# MTU-N200: API 서버 요청 레이턴시 상세 모니터링 -- Design

> 버전: 1.0.0 | 작성일: 2026-04-10 | 작성자: PM Lead
> Plan 참조: docs/01-plan/mtus/MTU-N200-apiserver-latency.plan.md

## Design Anchor

| 항목 | 결정 |
|------|------|
| 아키텍처 | Pragmatic Balance -- kube-apiserver 내장 메트릭 |
| 메트릭 소스 | apiserver_request_duration_seconds, apiserver_request_total |

## 상세 설계

### 1. Recording Rules

```yaml
apiserver_latency:p50_by_verb -- 동사별 p50
apiserver_latency:p90_by_verb -- 동사별 p90
apiserver_latency:p99_by_verb -- 동사별 p99
apiserver_latency:p99_by_resource -- 리소스별 p99
apiserver_latency:request_rate -- 초당 요청 수
apiserver_latency:error_rate -- 에러율
```

### 2. Alerting Rules

| 알림명 | 조건 | 심각도 | for |
|--------|------|--------|-----|
| APIServerLatencyHigh | p99 > 1s | warning | 10m |
| APIServerLatencyCritical | p99 > 5s | critical | 5m |
| APIServerErrorRateHigh | 에러율 > 5% | critical | 5m |
| APIServerRequestRateSpike | 요청률 급등 | warning | 5m |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초안 작성 | PM Lead |
