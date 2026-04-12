# SVC-AI-ADV-R52 — Adaptive Retrieval Strategy Design

> 2026-04-12 | v1.0.0

## 1. 개요
쿼리 복잡도에 따라 BM25, dense embedding, hybrid, multi-hop 검색 전략을 자동 선택합니다.

## 2. 분류 휴리스틱

| 쿼리 유형 | 특징 | 전략 |
|---|---|---|
| 키워드/사실 | 짧음, 명사 위주, 숫자/고유명사 포함 | BM25 |
| 자연어 질문 | 의문문, 동사 포함 | dense |
| 복합/비교 | "와", "비교", "차이", "vs" | hybrid |
| 추론/연쇄 | 다중 절, "왜", "어떻게" | multi-hop |

## 3. 인터페이스
```typescript
export type RetrievalStrategy = 'bm25' | 'dense' | 'hybrid' | 'multi-hop';

export interface QueryClassification {
  strategy: RetrievalStrategy;
  confidence: number; // 0~1
  features: {
    length: number;
    hasInterrogative: boolean;
    hasComparison: boolean;
    hasReasoning: boolean;
    hasNumber: boolean;
  };
}

export interface RetrieverFn {
  (query: string, k: number): Promise<Array<{ id: string; score: number; text: string }>>;
}
```

## 4. 라우터
- 분류 confidence < 0.5 → hybrid 폴백
- 사용 가능한 retriever만 대상 (없으면 사용 가능한 것 중 우선순위)

## 5. 변경 이력
| 1.0.0 | 2026-04-12 | 초안 |
