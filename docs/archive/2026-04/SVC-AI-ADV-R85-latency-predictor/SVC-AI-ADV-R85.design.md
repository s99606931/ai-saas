# SVC-AI-ADV-R85 — Latency Predictor (Design)

> v1.0.0 | 2026-04-12

## 구조
- Ring buffer (기본 크기 500)
- observe(ms, qps?) → 버퍼에 기록
- percentile(p) → 정렬 후 nearest-rank
- predictWithLoad(targetQps) → 기본 예측(p95) * 부하 보정 계수

## 부하 보정 공식
```
loadFactor = max(1, targetQps / avgObservedQps)
predicted = p95 * min(loadFactor ^ 1.3, 3.0)  // 상한 3배
```

## 경고
- predicted > slaThreshold → WARN 이벤트

## Session Guide
- 구현: `latency-predictor.ts`
- 테스트: `__tests__/latency-predictor.test.ts`
- Plan SC: FR-R85.1~5
