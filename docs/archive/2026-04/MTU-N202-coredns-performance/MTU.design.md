# MTU-N202: CoreDNS 성능 모니터링 -- Design

> 버전: 1.0.0 | 작성일: 2026-04-10 | 작성자: PM Lead

## Design Anchor

| 항목 | 결정 |
|------|------|
| 아키텍처 | Pragmatic Balance -- CoreDNS 내장 메트릭 |
| 메트릭 소스 | coredns_dns_request_duration_seconds, coredns_dns_responses_total |

## 상세 설계

### Recording Rules
```yaml
coredns_perf:latency_p50/p90/p99
coredns_perf:response_rate_by_rcode
coredns_perf:servfail_rate
coredns_perf:request_rate
coredns_perf:cache_hit_ratio
```

### Alerting Rules
| 알림명 | 조건 | 심각도 |
|--------|------|--------|
| CoreDNSLatencyHigh | p99 > 100ms | warning |
| CoreDNSServfailSpike | SERVFAIL > 5% | critical |
| CoreDNSCacheHitLow | 캐시 히트율 < 50% | warning |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초안 작성 | PM Lead |
