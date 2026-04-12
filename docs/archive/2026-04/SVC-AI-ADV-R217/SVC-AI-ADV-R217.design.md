# SVC-AI-ADV-R217 — API 성능 자동 최적화 Design

> 작성일: 2026-04-12 | 버전: 1.0.0

## 컴포넌트 설계

```
ApiPerformanceOptimizerAI
├── registerEndpoint(path, method, slaMs)
├── recordCall(path, method, durationMs, grade)
├── getStats(path, method): EndpointStats  // avg/p95/p99
├── detectSlaViolations(): SlaViolation[]
├── getOptimizationRecommendations(): Recommendation[]
└── getAuditLog(): AuditEntry[]
```

## 핵심 알고리즘

- **백분위 계산**: 정렬 후 인덱스 `Math.ceil(n * percentile) - 1`
- **SLA 위반**: p95 > slaMs → violation
- **최적화 권고**: 평균 > slaMs * 0.8 → 캐싱, p99 높음 → 배치 처리

## CSAP D-12 준수

- 입력 검증: path/method/duration 범위 검사
- N2SF C/S 등급 차단
