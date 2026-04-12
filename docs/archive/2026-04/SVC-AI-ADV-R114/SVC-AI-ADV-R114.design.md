# SVC-AI-ADV-R114 — Agent Memory Consolidator Design

> 작성일: 2026-04-12 | Plan: SVC-AI-ADV-R114.plan.md

## 아키텍처

```
MemoryEntry[] (from multiple agents)
  → similarity cluster (threshold 0.85)
  → merge by confidence weighting
  → conflict resolution
  → ConsolidatedMemory[]
```

## 타입

```typescript
export enum DataGrade { C = 'C', S = 'S', O = 'O' }

export interface MemoryEntry {
  id: string
  agentId: string
  content: string
  keywords: string[]
  confidence: number       // 0~1
  timestamp: number        // epoch ms
  grade: DataGrade
  sources?: string[]
}

export interface ConsolidatedMemory {
  id: string
  content: string
  sourceIds: string[]
  agents: string[]
  mergedConfidence: number
  latestTimestamp: number
  grade: DataGrade
  conflictResolved: boolean
}

export interface ConsolidationStats {
  input: number
  clusters: number
  output: number
  duplicatesRemoved: number
  conflicts: number
}

export interface ConsolidatorOptions {
  similarityThreshold?: number  // 기본 0.85
  callerGrade?: DataGrade       // 호출자 등급
}
```

## 알고리즘

- 키워드 Jaccard 유사도 또는 토큰 bag-of-words 코사인
- 클러스터링: union-find
- 병합: 신뢰도 가중 평균 + 최신 타임스탬프 content 우선
- 충돌: 서로 다른 키워드가 교집합 ≤ 0.3이면 분리 유지

## 보안

- `callerGrade < entry.grade` → 차단
- C/S 등급 메모리 병합 결과는 callerGrade가 동급 이상일 때만 반환
- 감사 로그

## Session Guide

1. 타입 + 유사도 함수
2. 클러스터링
3. 병합 로직
4. 충돌 해결
5. guard + audit + test 8개
