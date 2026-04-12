# Design — SVC-AI-ADV-R162 Response Time SLA Tracker

## 아키텍처 옵션

| 옵션 | 장점 | 단점 | 선택 |
|------|------|------|------|
| 슬라이딩 윈도우 샘플 | 정확 | 메모리 O(N) | ★ Pragmatic (N=100) |
| HdrHistogram | 메모리 효율 | 외부 의존 | - |
| 고정 버킷 | 경량 | 정확도↓ | - |

## 모듈 구조

```
response-time-sla-tracker.ts
├── Sample { latencyMs, at }
├── Violation { percentile: 'p95'|'p99', observed, threshold, at }
├── Percentiles { p50, p95, p99 } | null
├── SlaConfig { p95: number, p99: number, windowSize: number }
├── ResponseTimeSlaTracker
│   ├── constructor(config, opts)
│   ├── record(latencyMs, grade)
│   ├── getPercentiles()
│   ├── getViolations(), getStats(), getAuditLog()
│   └── (private) computePercentile, checkViolations
```

## 핵심 결정

- 퍼센타일 계산: 정렬 후 인덱스 = floor((N-1) * p)
- 최소 샘플 10개 이하 시 null 반환 (통계 신뢰도 낮음)
- 위반 알림은 record 호출 시마다 즉시 검사
- 음수 latency → invalid_latency throw

## Session Guide

- 파일 < 280 줄, 테스트 9+

## 추적성

- FR-R162.1~FR-R162.8 → 메서드 매핑
