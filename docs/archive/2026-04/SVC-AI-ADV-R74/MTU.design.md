# SVC-AI-ADV-R74 — 설계

## 모듈
- `contextual-memory-manager.ts`
  - `ContextualMemoryManager` 클래스

## 핵심 타입
```typescript
type DataGrade = 'C' | 'S' | 'O';

interface MemoryKey {
  agentId: string;
  userId: string;
  tenantId: string;
}

interface MemoryEntry {
  id: string;
  key: MemoryKey;
  slot: string;            // 'short-term' | 'long-term' | 'profile' | 'summary' 등
  content: string;
  priority: number;        // 1 (low) ~ 10 (high)
  ttlMs: number;
  createdAt: number;
  expiresAt: number;
  grade: DataGrade;
  accessCount: number;
  lastAccessedAt: number;
}

interface MemorySummary {
  key: MemoryKey;
  summaryText: string;
  sourceIds: string[];     // 요약 대상 entry id
  createdAt: number;
}

interface QueryOptions {
  slot?: string;
  limit?: number;
  includeExpired?: boolean;
}
```

## 정책
```
- put(entry):
  * grade 검증 (C/S → throw)
  * 동일 (key, slot) 최대 N 개 초과 시 LRU + 우선순위 기반 eviction
- get(key, options): 만료 필터링 + lastAccessedAt 갱신
- summarize(key): 해당 key 의 상위 K 개 엔트리 concat → MemorySummary
- sweep(now): 만료 제거
- 전체 용량 maxTotal 초과 시 priority asc, lastAccessedAt asc 순 eviction
```

## 용량 기본값
```
perSlotMax = 50
perKeyMax = 200
maxTotal = 10_000
defaultTtlMs = 7 * 24 * 3600 * 1000
```

## 보안
- C/S grade entry → throw `MEMORY_GRADE_BLOCKED`
- key 검증: 빈 문자열 거부
- 감사: PUT / GET / EVICT / SUMMARIZE / SWEEP / GRADE_BLOCK

## API
- `put(key, slot, content, opts)` → MemoryEntry
- `get(key, opts)` → MemoryEntry[]
- `summarize(key, topK)` → MemorySummary
- `sweep(now)` → number (제거 수)
- `stats()` → { total, perSlot, perGrade }
- `getAuditLog()`
