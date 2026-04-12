# MTU Design — SVC-AI-ADV-R140 Semantic Deduplication Engine

## 타입

```typescript
interface Document { id: string; text: string; createdAt: number }
interface DedupCluster { representativeId: string; memberIds: string[]; avgSimilarity: number }
interface DedupResult { clusters: DedupCluster[]; totalDuplicates: number }
```

## 메서드

- `deduplicate(docs, grade)` — 전체 파이프라인
- `tokenize(text)` — 공백 분리 + 소문자
- `ngrams(tokens, n=3)` — 3-gram Set
- `jaccard(a, b)` — Set 연산
- `cluster(docs, threshold=0.7)`
- `selectRepresentative(cluster)` — 가장 긴 텍스트 → 동률 시 가장 최신
- `getAuditLog()`

## Session Guide

- 파일: `semantic-deduplication-engine.ts`
- 알고리즘: Union-Find 대신 단순 탐욕법 (O(n²) 허용, 소규모 배치)
