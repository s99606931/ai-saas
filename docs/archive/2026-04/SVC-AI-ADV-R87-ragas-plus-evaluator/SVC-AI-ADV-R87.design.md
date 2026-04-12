# SVC-AI-ADV-R87 — RAGAS++ Evaluator (Design)

> v1.0.0 | 2026-04-12

## 지표 (휴리스틱)
1. **Context Precision**: contexts 중 question 토큰과 겹치는 청크 비율
2. **Context Recall**: groundTruth 토큰이 contexts에 등장하는 비율
3. **Faithfulness**: answer 토큰 중 contexts에 존재하는 비율
4. **Answer Relevancy**: answer와 question 토큰 Jaccard

## 골든셋
```ts
export interface GoldenItem {
  id: string;
  question: string;
  groundTruth: string;
  contexts: string[];
}
```

## 회귀 탐지
- 베이스라인 평균 대비 현재 평균이 `regressionThreshold`(기본 0.05) 이상 하락 시 REGRESSION 이벤트

## Session Guide
- 구현: `ragas-plus-evaluator.ts`
- 테스트: `__tests__/ragas-plus-evaluator.test.ts`
- Plan SC: FR-R87.1~5
