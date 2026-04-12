# SVC-AI-ADV-R75 — 설계

## 모듈
- `dynamic-few-shot-selector.ts`
  - `DynamicFewShotSelector` 클래스

## 핵심 타입
```typescript
type DataGrade = 'C' | 'S' | 'O';

interface FewShotExample {
  id: string;
  category: string;
  input: string;
  output: string;
  tags: string[];
  grade: DataGrade;
  createdAt: number;
}

interface SelectionOptions {
  topK: number;              // 반환 예제 수
  lambda: number;            // MMR 다양성 가중치 (0~1)
  categoryFilter?: string;
}

interface ScoredExample {
  example: FewShotExample;
  similarity: number;        // 쿼리와의 유사도
  selected: boolean;
}

interface DistributionReport {
  total: number;
  perCategory: Record<string, number>;
  biasWarning: boolean;      // max / total > 0.6
}
```

## 유사도 알고리즘
```
- tokenize(text) — 소문자 + \W 분리 + 길이 ≥ 2
- jaccard(a, b) = |A ∩ B| / |A ∪ B|
- TF 벡터 + 코사인 — 벡터는 Map<token, count>
- score = 0.5 * jaccard + 0.5 * cosine
```

## MMR 다양성
```
selected = []
while selected.length < topK:
  best = argmax_{x not in selected}(
    lambda * sim(query, x) - (1 - lambda) * max_{y in selected}(sim(x, y))
  )
  selected.push(best)
```

## 편향 탐지
```
- 선택 결과 카테고리 집계
- max(perCategory) / total > 0.6 → biasWarning = true
```

## 보안
- C/S grade example → register 시 throw `FEW_SHOT_GRADE_BLOCKED`
- 감사: REGISTER / SELECT / BIAS_WARN / GRADE_BLOCK

## API
- `register(example)`
- `registerMany(examples)`
- `select(query, options)` → ScoredExample[]
- `distribution(examples)` → DistributionReport
- `getAuditLog()`
