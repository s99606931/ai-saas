# SVC-AI-ADV-R54 — Multi-Tenant Embedding Cache Design

> 2026-04-12 | v1.0.0

## 1. 개요
테넌트별로 계산된 임베딩 벡터를 재사용하기 위한 2계층 캐시(전용+공유)를 제공합니다.
공유 계층은 N2SF O등급 텍스트만 진입 가능하며, 테넌트 식별자는 키에 포함되지 않아 다른 테넌트가 동일 문서를 조회하면 공유 캐시에서 즉시 반환됩니다.

## 2. 구조
```
lookup(tenantId, text, grade)
  │
  ├─ private[tenantId].get(hash) → hit이면 반환
  │
  └─ grade==='O' 이면 shared.get(hash) → hit이면 private에도 승격 저장
```

## 3. 인터페이스
```typescript
export type DataGrade = 'O' | 'C' | 'S';
export interface EmbeddingEntry {
  vector: number[];
  createdAt: number;
}
export interface CacheStats {
  privateHits: number;
  sharedHits: number;
  misses: number;
  hitRate: number;
}
```

## 4. LRU 정책
- 각 계층별 독립 LRU (Map 기반, 최근 접근 → Map 끝)
- `maxSize` 초과 시 가장 오래된 항목 제거
- 기본: 전용 10,000 엔트리, 공유 50,000 엔트리

## 5. 격리 규칙
- C/S 등급은 공유 계층에 절대 저장 금지
- 키: `sha256(text)` — 테넌트 정보 미포함
- 전용 계층은 테넌트별 Map 별도 운영

## 6. 감사
- SET_PRIVATE, SET_SHARED, HIT_PRIVATE, HIT_SHARED, MISS, BLOCK_GRADE

## 7. 변경 이력
| 1.0.0 | 2026-04-12 | 초안 |
