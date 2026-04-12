# SVC-AI-ADV-R351 Design

## 알고리즘
- 모델별 큐 Map<modelId, Request[]>
- enqueue 시 크기 ≥ maxBatchSize → flush(size)
- tick(now): queuedAt 경과 timeoutMs 이상 → flush(timeout)
- flush: executor 콜백에 배치 전달

## 타입
```typescript
interface BatchRequest<T> { id; modelId; payload: T; grade; queuedAt; }
interface BatchFlushResult { modelId; size; flushedAt; reason; }
```
