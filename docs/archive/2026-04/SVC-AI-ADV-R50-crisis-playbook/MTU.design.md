# SVC-AI-ADV-R50 — Speculative Decoding Router Design

> 2026-04-12 | v1.0.0

## 1. 개요
Speculative decoding은 작은 draft 모델이 K개 토큰을 미리 생성하고, 큰 target 모델이 1회 forward로 검증합니다. 채택된 토큰만 사용하므로 비용·지연을 절감합니다.

## 2. 아키텍처
```
[Query] → [Router.selectDraft]
            ↓
       [Draft Gen K tokens]
            ↓
       [Target Verify]
       (token-by-token 비교)
            ↓
       [Accept first M ≤ K]
            ↓
       [Append + 통계 갱신]
            ↓
       [acceptance rate < threshold?]
            → fallback to target only
```

## 3. 핵심 인터페이스

```typescript
export interface DraftModel {
  generate(query: string, k: number): Promise<string[]>; // K 토큰
  modelId: string;
}

export interface TargetModel {
  verify(query: string, draftTokens: string[]): Promise<{ acceptedCount: number; replacement?: string }>;
  modelId: string;
}

export interface SpecConfig {
  k: number;                // draft 토큰 수 (기본 4)
  fallbackThreshold: number; // 채택률 임계값 (기본 0.4)
  windowSize: number;       // 통계 윈도우 (기본 100)
}
```

## 4. 알고리즘

### 4.1 speculate(query)
1. draft.generate(query, k) → K 토큰
2. target.verify(query, draftTokens) → acceptedCount, replacement
3. accepted = draftTokens.slice(0, acceptedCount)
4. if acceptedCount < K, append target.replacement 토큰
5. 통계 windowsize에 acceptanceRate 기록
6. 감사 로그 추가

### 4.2 shouldFallback()
- 최근 windowSize 평균 채택률 < threshold → true
- true이면 selectDraft 시 draft 모델 비활성화

### 4.3 selectDraft(query)
- 쿼리 길이/유형으로 draft 모델 선택
- fallback 모드면 null 반환

## 5. 통계 항목
- acceptanceRate (window mean)
- estimatedCostSaving (acceptedTokens / totalDraftTokens 기반)
- totalSpeculations, totalFallbacks

## 6. 데이터 등급 (N2SF)
- query.dataGrade C/S → throw `SPEC_DATA_GRADE_BLOCKED`

## 7. 감사 로그
- action: SPEC_SPECULATE, SPEC_FALLBACK
- 필드: draftModel, targetModel, k, accepted, fallback

## 8. 변경 이력
| 버전 | 일자 | 내용 |
|---|---|---|
| 1.0.0 | 2026-04-12 | 초안 |
