# SVC-AI-ADV-R62 — Retrieval Fallback Chain Design

## 아키텍처 옵션

| 옵션 | 장점 | 단점 |
|------|------|------|
| A. Parallel fan-out | 속도 | 비용 |
| **B. Sequential fallback (선택)** | 비용·품질 균형 | 최악지연 증가 |
| C. 조건부 라우터 | 최적화 | 설계 복잡 |

## 모듈 구조

```
RetrievalFallbackChain
 ├─ registerStage(stage)
 ├─ search(query, opts) → SearchResult[]
 ├─ evaluateQuality(results) → number
 ├─ restrictByGrade(grade) → RetrievalStage[]
 ├─ enforceTimeout(stage, ms)
 └─ getAuditLog()
```

## 데이터 구조

```typescript
interface RetrievalStage {
  id: string;
  kind: 'bm25'|'dense'|'web'|'llm';
  external: boolean;
  run(query: string): Promise<SearchResult[]>;
}
interface SearchResult { docId: string; score: number; source: string; snippet: string; }
interface ChainOpts { maxTotalMs: number; scoreThreshold: number; grade: 'C'|'S'|'O'; }
```

## 실행 흐름

1. 등급에 따라 외부 stage 제거 (`restrictByGrade`)
2. 순차 실행 → 품질 점수 ≥ threshold 이면 조기 종료
3. 전체 시간 `maxTotalMs` 도달 시 즉시 반환
4. 실패 stage 로그

## Design Anchor

- Plan FR-R62.1~6 전 항목 반영
- CSAP D-12/D-06, N2SF N-04/N-05 매핑
