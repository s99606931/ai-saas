# SVC-AI-ADV-R68 — 설계

## 모듈
- `eval-harness-v2.ts`
  - `EvalHarnessV2` 클래스

## 핵심 타입
```typescript
type DataGrade = 'C' | 'S' | 'O';

interface EvalSample {
  id: string;
  question: string;
  groundTruth: string;    // 정답
  contexts: string[];     // retriever 결과
  answer: string;         // 시스템 응답
  grade: DataGrade;
}

interface EvalDataset {
  id: string;
  name: string;
  samples: EvalSample[];
}

interface MetricScores {
  faithfulness: number;        // answer가 contexts에 얼마나 기반했는가 (0~1)
  answerRelevance: number;     // answer가 question과 얼마나 관련 (0~1)
  contextPrecision: number;    // retrieved contexts 중 유용한 비율
  contextRecall: number;       // groundTruth 토큰 중 contexts에 포함된 비율
  similarity: number;          // answer vs groundTruth 유사도
  groundedness: number;        // answer 문장 중 contexts 근거 있는 비율
}

interface BenchReport {
  datasetId: string;
  ranAt: string;
  sampleCount: number;
  aggregate: MetricScores;     // 샘플 평균
  perSample: { id: string; scores: MetricScores }[];
  regression?: {
    baseline: MetricScores;
    deltas: MetricScores;
    regressed: boolean;
    regressedMetrics: string[];
  };
}
```

## 지표 계산 (규칙 기반, 외부 LLM 없음)
- **faithfulness**: answer 토큰 중 contexts 토큰에 포함되는 비율
- **answerRelevance**: question과 answer Jaccard 유사도
- **contextPrecision**: contexts 중 question 토큰 1개 이상 포함하는 항목 비율
- **contextRecall**: groundTruth 토큰 중 contexts 토큰 합집합에 포함되는 비율
- **similarity**: answer vs groundTruth Jaccard
- **groundedness**: answer 문장(마침표/물음표 분리) 중 각 문장 토큰 절반 이상이 contexts에 존재하는 비율

## 회귀 판정
- 사용자가 `setBaseline(datasetId, metrics)` 호출 후
- `run(datasetId)` 결과와 비교 → 임의 지표가 `threshold=0.05` 이상 하락 시 `regressed=true`

## 보안 (N2SF N-05)
- `addDataset` 호출 시 sample 중 grade가 'C'|'S'면 즉시 throw (`EVAL_GRADE_BLOCKED`)

## 감사 로그
- DATASET_REGISTER / BENCH_RUN / BASELINE_SET / REGRESSION_DETECT / GRADE_BLOCK
