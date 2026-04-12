# SVC-AI-ADV-R45 — 설계

## 모듈
- summarization-engine.ts: 단일 문서 → {전체 요약, 섹션 요약, 핵심 요약 5문장}
- multi-doc-summarizer.ts: 복수 문서 → 주제별 클러스터링 → 통합 요약 + 인용

## 계층 구조
```
L1 (Core):    5문장 이내 핵심 요약
L2 (Section): 각 섹션별 2~3문장 요약
L3 (Full):    전체 1~2 단락 요약
```

## 다중 문서 흐름
```
N개 문서 → 각각 L1 추출 (summarization-engine)
→ 주제 클러스터링 (키워드 자카드)
→ 클러스터별 통합 요약 (인용 유지)
→ 교차 요약 문서 생성 [출처: doc1, doc3]
```

## 인터페이스
```typescript
class SummarizationEngine {
  summarize(doc: string, level: 'core'|'section'|'full'): HierarchicalSummary
}
class MultiDocSummarizer {
  summarizeMany(docs: Document[]): CrossDocSummary
}
```
