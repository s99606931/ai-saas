# SVC-AI-ADV-R121 — Feedback Loop Optimizer (Design)

> 작성일: 2026-04-12 | 버전: 1.0.0

## Design Anchor

- **아키텍처**: Variant Registry + Feedback Aggregator + Decision Engine
- **선정 이유**: Pragmatic Balance — 통계적 근거 기반 자동 승격, 로컬 집계

## 인터페이스

```typescript
type Signal = 'thumbs-up' | 'thumbs-down' | 'report' | 'neutral'

interface Variant {
  id: string
  description: string
  status: 'active' | 'promoted' | 'demoted'
}

interface Feedback {
  variantId: string
  rating: 1 | 2 | 3 | 4 | 5
  signal: Signal
  comment?: string
  grade: DataGrade
  timestamp?: string
}

interface VariantStats {
  variantId: string
  totalSamples: number
  avgRating: number
  ciLower: number
  ciUpper: number
  thumbsUp: number
  thumbsDown: number
  reports: number
}

interface OptimizationDecision {
  promoted: string[]
  demoted: string[]
  insufficient: string[]
}

class FeedbackLoopOptimizer {
  constructor(options?: { minSamples?: number; promoteThreshold?: number; demoteThreshold?: number })
  registerVariant(v: Omit<Variant, 'status'>): void
  recordFeedback(f: Feedback): void
  getStats(variantId: string): VariantStats | undefined
  optimize(): OptimizationDecision
  getAuditLog(): readonly OptAuditEntry[]
}
```

## 통계

- avgRating = mean(rating)
- CI95 = avg ± 1.96 * std / sqrt(n)
- 승격 조건: totalSamples ≥ minSamples && ciLower > promoteThreshold
- 강등 조건: totalSamples ≥ minSamples && (ciUpper < demoteThreshold || reports > 5)

## PII 스크럽

- comment 필드 내 email/RRN/phone 자동 마스킹

## Session Guide

1. registerVariant로 실험 변형 등록
2. 사용자 응답마다 recordFeedback 호출
3. 주기적으로 optimize() 호출 → 승격/강등 결정 수신
4. 외부 프롬프트 저장소에 결정 반영 (소비자 책임)
