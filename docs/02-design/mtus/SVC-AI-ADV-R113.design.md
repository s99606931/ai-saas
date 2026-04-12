# SVC-AI-ADV-R113 — Retrieval Quality Scorer Design

> 작성일: 2026-04-12 | Plan: SVC-AI-ADV-R113.plan.md

## 아키텍처

```
query + results[] → RetrievalQualityScorer
                    ├─ accuracyScore(cosine avg)
                    ├─ diversityScore(1 - pairwise dup)
                    ├─ freshnessScore(time decay)
                    └─ combinedScore(weighted)
                  → { score, breakdown, passed, audit }
```

## 타입 정의

```typescript
export enum DataGrade { C = 'C', S = 'S', O = 'O' }

export interface RetrievalResult {
  id: string
  content: string
  embedding: number[]  // 쿼리 임베딩과 동일 차원
  timestamp: number    // epoch ms
  score?: number       // retriever 원점수
}

export interface QualityWeights {
  accuracy: number
  diversity: number
  freshness: number
}

export interface QualityBreakdown {
  accuracy: number
  diversity: number
  freshness: number
}

export interface QualityReport {
  score: number            // 0~1 combined
  breakdown: QualityBreakdown
  passed: boolean
  threshold: number
  resultCount: number
}

export interface ScorerOptions {
  weights?: QualityWeights  // 기본 0.5/0.3/0.2
  threshold?: number        // 기본 0.6
  freshnessHalfLifeMs?: number  // 기본 7일
  grade?: DataGrade         // 기본 O
}

export interface AuditEntry {
  timestamp: string
  action: string
  queryHash: string
  score: number
  passed: boolean
  grade: DataGrade
}
```

## 핵심 알고리즘

- **Accuracy**: 쿼리 임베딩 ↔ 각 결과 임베딩 코사인 유사도 평균
- **Diversity**: 결과 간 pairwise 코사인 계산 → 중복도 평균 → `1 - avg`
- **Freshness**: `Math.exp(-age / halfLife)` 평균
- **Combined**: `a*wa + d*wd + f*wf` (가중치 합 1)

## 보안

- 생성자에서 C/S 등급 차단 `throw new Error`
- 쿼리는 해시만 저장(SHA-256 앞 16자)
- 감사 로그 append-only 배열

## Session Guide

1. 타입 정의 작성
2. 코사인 유사도 헬퍼 구현
3. 3개 점수 함수 구현
4. 통합 스코어러 + guard + audit
5. 테스트 10개 작성
