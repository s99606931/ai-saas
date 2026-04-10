# MTU-N207: Garbage Collection 모니터링 -- Design

> 버전: 1.0.0 | 작성일: 2026-04-10 | 작성자: PM Lead

## Design Anchor

| 항목 | 결정 |
|------|------|
| 아키텍처 | Pragmatic Balance -- Go 런타임 내장 메트릭 활용 |
| 메트릭 소스 | go_gc_duration_seconds, go_memstats_alloc_bytes, go_memstats_heap_inuse_bytes, process_resident_memory_bytes |
| 대상 | kube-apiserver, kube-controller-manager, kube-scheduler, etcd |

## 상세 설계

### Recording Rules
```yaml
gc_perf:gc_duration_p50/p90/p99
gc_perf:gc_rate
gc_perf:heap_inuse_bytes
gc_perf:heap_alloc_rate
gc_perf:resident_memory_bytes
gc_perf:goroutines_count
```

### Alerting Rules
| 알림명 | 조건 | 심각도 |
|--------|------|--------|
| GCDurationHigh | GC p99 > 100ms | warning |
| GCRateHigh | GC > 10/s | warning |
| MemoryLeakSuspected | RSS 1시간 증가율 > 20% | warning |
| HeapAllocRateHigh | 힙 할당 급등 | warning |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초안 작성 | PM Lead |
