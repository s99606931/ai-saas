# SVC-METRICS-R35 DESIGN: Metrics Collector

> 버전: 1.0.0 | 작성일: 2026-04-12 | 작성자: PM Lead

## 아키텍처

```
MetricsRegistry
  ├── Counter  (inc, reset, value)
  ├── Gauge    (set, inc, dec, value)
  └── Histogram (observe, buckets, sum, count)
              ↓
     exportPrometheus() → text/plain 0.0.4
```

## 라벨 처리
- 라벨 키 정렬 후 직렬화 (예: `method="GET",status="200"`)
- 라벨 조합마다 별도 값 저장 (`Map<labelKey, number>`)

## Prometheus 텍스트 포맷

```
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",status="200"} 42
```

## Session Guide
- `src/metrics.ts` → `src/index.ts` → `tests/metrics.test.ts`
- Design Anchor: `// Design Ref: SVC-METRICS-R35 DESIGN`
