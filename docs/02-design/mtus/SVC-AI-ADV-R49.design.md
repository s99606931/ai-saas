# SVC-AI-ADV-R49 — LLM-as-a-Judge Design

> 2026-04-12 | v1.0.0

## 1. 아키텍처 개요

```
[Generated Response] → [JudgeEngine.evaluate()]
                          ↓
                  [4축 점수 채점기]
                  ┌──────┴──────┐
              [Accuracy]  [Relevance]
              [Coherence] [Safety]
                          ↓
                  [Aggregator (가중평균)]
                          ↓
                  [Audit Logger] → audit.jsonl
```

## 2. 핵심 인터페이스

```typescript
export interface JudgmentInput {
  query: string;        // 원래 질문
  response: string;     // 평가 대상 응답
  reference?: string;   // 정답 참조 (선택)
  generatorModel: string; // 응답 생성 모델 (편향 감지용)
}

export interface JudgmentScore {
  accuracy: number;     // 0~5
  relevance: number;    // 0~5
  coherence: number;    // 0~5
  safety: number;       // 0~5
  overall: number;      // 가중평균
  rationale: string;
}

export interface JudgeFunction {
  (input: JudgmentInput, judgeModel: string): Promise<JudgmentScore>;
}
```

## 3. 알고리즘

### 3.1 단일 평가
1. judge 모델에 4축 채점 프롬프트 전달
2. 0~5점 정수 점수 + 근거 텍스트 수신
3. 가중평균 계산: `overall = 0.35*acc + 0.30*rel + 0.20*coh + 0.15*saf`

### 3.2 페어와이즈 비교
1. judge에 응답 A, B 동시 제시
2. 4가지 결과: A_wins / B_wins / tie / both_bad
3. 위치 편향 방지: 순서 swap 후 재평가, 일관성 확인

### 3.3 앙상블 (다중 judge)
1. 3개 judge 모델 (서로 다른 프로바이더)
2. 4축 각각에 대해 median 점수 채택
3. 표준편차 0.5 초과 시 disagreement 플래그

### 3.4 자기 평가 편향 감지
- `judgeModel === generatorModel` → throw `JUDGE_SELF_BIAS`
- 같은 패밀리(예: gpt-4 vs gpt-4-turbo) → 경고 플래그

## 4. 데이터 등급 (N2SF)

- 입력: 평가 query/response → O등급만 허용
- C/S등급 감지 시 `JUDGE_DATA_GRADE_BLOCKED` 예외

## 5. 감사 로깅 (CSAP D-06)

- 액션: `JUDGE_EVALUATE`, `JUDGE_COMPARE`, `JUDGE_ENSEMBLE`
- 필드: judgeId, generatorModel, judgeModel, scores, timestamp

## 6. Pragmatic Balance 선택 근거

| 옵션 | 장점 | 단점 | 채택 |
|---|---|---|---|
| 단일 judge (간단) | 빠름, 저렴 | 편향 위험 | ✗ |
| 앙상블 3 judges | 안정성 | 비용 3배 | ✓ (옵션) |
| 인간+LLM 하이브리드 | 정확 | 느림 | ✗ |

기본 단일 judge, 중요 평가는 ensemble() 메서드 명시 호출.

## 7. 변경 이력

| 버전 | 일자 | 내용 |
|---|---|---|
| 1.0.0 | 2026-04-12 | 초안 |
