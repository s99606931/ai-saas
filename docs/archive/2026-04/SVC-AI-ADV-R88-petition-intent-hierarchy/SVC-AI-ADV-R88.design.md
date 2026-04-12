# SVC-AI-ADV-R88 — Petition Intent Hierarchy Classifier (Design)

> v1.0.0 | 2026-04-12

## 구조
```ts
export interface CategoryNode {
  id: string;
  label: string;
  keywords: string[];
  children?: CategoryNode[];
}

export interface ClassifyResult {
  path: string[];         // [대, 중, 소]
  labels: string[];
  confidence: number;     // 0~1
  unknown: boolean;
}
```

## 알고리즘
1. 루트 카테고리들 중 score 최고 선택
2. 해당 카테고리의 children 중 score 최고 선택
3. 그 자식 중 score 최고 선택 (최대 depth 3)
4. 마지막 노드 평균 score가 임계값(0.2) 미달 → unknown

## 점수
- 매칭 키워드 수 / keywords 길이 * level_boost (depth 깊을수록 가중치 ↑)

## Session Guide
- 구현: `petition-intent-hierarchy-classifier.ts`
- 테스트: `__tests__/petition-intent-hierarchy-classifier.test.ts`
- Plan SC: FR-R88.1~5
