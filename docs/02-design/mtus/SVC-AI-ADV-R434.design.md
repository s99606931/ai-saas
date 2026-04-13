# SVC-AI-ADV-R434 Design — Welfare Benefits Calculator v2

Plan Ref: SVC-AI-ADV-R434.plan.md

## 인터페이스
```ts
export interface Benefit {
  readonly id: string;
  readonly amount: number;
  readonly excludes: readonly string[];
}
export interface CalcResult {
  readonly selected: readonly string[];
  readonly totalAmount: number;
  readonly conflicts: readonly [string, string][];
}
```

## 알고리즘
1. excludes 양방향 정규화
2. 모든 부분집합 (N ≤ 20) 탐색 → 충돌 없는 것만 후보
3. 후보 중 amount 합 최대인 집합 선택
4. 충돌쌍 리스트 반환
