# MTU Design — SVC-AI-ADV-R142 AI Model Health Monitor

## 타입

```typescript
interface InferenceMetric { modelId: string; ts: number; latencyMs: number; correct: boolean; confidence: number }
interface ModelHealth { modelId: string; accuracy: number; avgLatencyMs: number; avgConfidence: number; driftScore: number; status: 'HEALTHY'|'DEGRADED'|'CRITICAL'; sampleSize: number }
interface Baseline { accuracy: number; avgConfidence: number }
```

## 메서드

- `record(metric, grade)` — 롤링 버퍼에 추가
- `setBaseline(modelId, baseline)` — 기준값 설정
- `evaluate(modelId, windowMs)` — 헬스 계산
- `computeDriftScore(current, baseline)` — 절댓값 편차
- `getAuditLog()`
