# SVC-AI-ADV-R83 — MoE Router (Design)

> v1.0.0 | 2026-04-12

## 인터페이스
```ts
export interface Expert {
  id: string;
  domain: string;
  keywords: string[];
  costPerCall?: number;
  isDefault?: boolean;
}

export interface ExpertScore {
  expertId: string;
  score: number;
}

export interface SelectResult {
  selected: ExpertScore[];   // top-k
  totalExperts: number;
  fallback: boolean;
}
```

## 스코어링
```
score(expert, query) =
  sum(1 for keyword in expert.keywords if query.toLowerCase() includes keyword)
  / max(1, expert.keywords.length)
  * complexityBoost(query)
```

- complexityBoost: query 길이 > 50자 → 1.1, 코드 토큰(```) 포함 → 1.3

## Top-K 선택
- score > 0 인 전문가 내림차순 정렬 → 상위 k개 (기본 1)
- 전부 0 → default 전문가로 폴백
- 가중치 정규화: scores sum = 1

## Session Guide
- 구현: `moe-router.ts`
- 테스트: `__tests__/moe-router.test.ts`
- Plan SC: FR-R83.1~5
