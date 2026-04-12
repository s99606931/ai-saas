# SVC-AI-ADV-R268 — 설계

## 아키텍처

```
recordSample(apiId, latencyMs, success, grade, caller)
  → Map<apiId, Sample[]>
  → computeStats() → {p50, p95, p99, successRate}
  → predictNext() → EWMA(alpha=0.3) 적용 latency 예측
  → evaluateSLA(target) → violationProbability + severity
```

## 데이터 구조

```typescript
interface Sample { timestamp: string; latencyMs: number; success: boolean }
interface Stats { count: number; p50: number; p95: number; p99: number; successRate: number }
interface Prediction { nextLatency: number; violationProb: number; severity: 'OK'|'WARN'|'CRITICAL' }
```

## 보안

- C/S 등급 입력 차단 (throw BLOCKED)
- caller mask 후 감사 로그
- getAuditLog() 읽기 전용 반환

## Session Guide

1. 샘플 기록 (O등급만)
2. 통계 계산 (정렬 후 백분위)
3. EWMA 예측
4. SLA 비교 → 심각도
