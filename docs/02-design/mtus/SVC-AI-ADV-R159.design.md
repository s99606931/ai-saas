# Design — SVC-AI-ADV-R159 Semantic Embedding Cache

## 아키텍처 옵션

| 옵션 | 장점 | 단점 | 선택 |
|------|------|------|------|
| 선형 스캔 + 코사인 | 단순 | N 증가 시 O(N) | ★ Pragmatic (≤1000 항목) |
| HNSW 인덱스 | 로그 스캔 | 메모리↑, 외부 의존 | - |
| IVF-PQ | 압축 | 복잡도 극↑ | - |

## 모듈 구조

```
semantic-embedding-cache.ts
├── CacheEntry { key, embedding, value, createdAt, lastAccess }
├── CacheStats { hits, misses, size }
├── SemanticEmbeddingCache
│   ├── constructor({ maxEntries, ttlMs, now })
│   ├── set(tenantId, embedding, value, grade)
│   ├── get(tenantId, embedding, threshold)
│   ├── getStats(), getAuditLog()
│   └── (private) cosine, evictLRU, evictExpired
```

## 핵심 결정

- 테넌트별 Map<string, CacheEntry[]> 로 격리
- 코사인 유사도: dot / (|a| * |b|), 벡터 길이 불일치 시 throw
- TTL + LRU 이중 만료: 조회 시 expired 먼저 제거 후 유사도 검색
- threshold 기본 0.92 (Plan에 명시)

## Session Guide

- 파일 < 300 줄, 테스트 8+

## 추적성

- FR-R159.1~FR-R159.8 → 메서드 매핑
