# SVC-AI-ADV-R84 — 설계

## 모듈
- `ai-decision-explainer.ts`
  - `AIDecisionExplainer` 클래스

## 핵심 타입
```typescript
type DataGrade = 'C' | 'S' | 'O';

interface FeatureValue {
  name: string;
  value: number;
  description?: string;
}

interface DecisionInput {
  id: string;
  tenantId: string;
  label: string;           // 결정 라벨 (예: '승인', '반려')
  score: number;           // 최종 점수
  features: FeatureValue[];
  weights: Record<string, number>;  // 특징명 → 가중치
  threshold: number;       // 임계값
  grade: DataGrade;        // O만 허용
}

interface Contribution {
  feature: string;
  value: number;
  weight: number;
  contribution: number;    // value * weight
  percent: number;         // 전체 기여 대비 %
}

interface AlternativeScenario {
  feature: string;
  originalValue: number;
  flippedValue: number;
  newScore: number;
  wouldFlipLabel: boolean;
}

interface Explanation {
  decisionId: string;
  label: string;
  score: number;
  threshold: number;
  passed: boolean;
  topContributions: Contribution[];
  alternatives: AlternativeScenario[];
  narrative: string;   // 4단계 서술
}
```

## 기여도 계산
```
contribution[i] = features[i].value * weights[features[i].name]
total = sum(contribution)
percent[i] = contribution[i] / total * 100
```

## 4단계 서술 구조
```
1단계: 입력 요약 — "N개 특징 (상위 3개: A=..., B=..., C=...)"
2단계: 특징 가중 — "가장 영향을 준 특징: X (기여도 Y%)"
3단계: 판정 근거 — "최종 점수 S, 임계값 T, 결과: 라벨"
4단계: 대안 — "특징 X가 V1 → V2로 변할 경우 판정 뒤집힘"
```

## 대안 계산
- 각 특징에 대해 ±50% flip → 새 score 계산
- 라벨 뒤집히는 케이스만 반환 (최대 3개)

## API
- `explain(input, topK?)` → Explanation
- `getAuditLog()`

## 감사 이벤트
EXPLAIN_START / EXPLAIN_DONE / GRADE_BLOCKED / MASKED

## 마스킹
narrative 내 PII(email/phone/RRN) 자동 마스킹
