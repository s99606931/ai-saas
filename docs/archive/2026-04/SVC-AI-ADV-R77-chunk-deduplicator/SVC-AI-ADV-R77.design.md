# SVC-AI-ADV-R77 — 설계

## 모듈
- `retrieval-chunk-deduplicator.ts`
  - `RetrievalChunkDeduplicator` 클래스

## 핵심 타입
```typescript
type DataGrade = 'C' | 'S' | 'O';

interface RetrievalChunk {
  id: string;
  text: string;
  source: string;
  score: number;
  grade: DataGrade;
}

interface DedupOptions {
  semanticThreshold: number;  // 0~1, 기본 0.85
  normalize: boolean;         // 공백/구두점 정규화
}

interface DedupResult {
  kept: RetrievalChunk[];
  removed: { id: string; reason: 'exact' | 'semantic'; duplicateOf: string }[];
  stats: {
    input: number;
    exactDup: number;
    semanticDup: number;
    kept: number;
  };
}
```

## 알고리즘
```
1) 정규화: text.trim().toLowerCase().replace(/\s+/g,' ') (옵션 on)
2) 해시 중복: FNV-1a 32bit (빠른 결정적 해시) → 동일 해시 = exact dup
3) 의미 중복: tokenize → 토큰 Jaccard(a,b) ≥ semanticThreshold = dup
4) 대표 선정: score 높은 청크 우선, tie-break는 더 짧은 text
```

## API
- `dedup(chunks[], options)` → DedupResult
- `getAuditLog()`

## 감사 이벤트
DEDUP_EXACT / DEDUP_SEMANTIC / BLOCKED / STATS

## 보안
- C/S 등급 청크 입력 시 blocked + CHUNK_GRADE_BLOCKED (기본 정책: 유지하지 않고 제거 + 감사)
