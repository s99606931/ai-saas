# MTU Design — SVC-AI-ADV-R138 AI-Powered SLA Negotiator

## 아키텍처 개요

입력(제안 SLA + 운영 이력) → 분석기 → 점수화기 → 대안 생성기 → 감사 로그

## 핵심 타입

```typescript
interface SlaProposal {
  availability: number  // 0.0~1.0
  rtoMinutes: number
  rpoMinutes: number
  responseTimeMs: number
  monthlyRevenue: number
  penaltyRate: number   // 0.0~1.0
}

interface OperationHistory {
  avgAvailability: number
  avgRtoMinutes: number
  avgRpoMinutes: number
  avgResponseTimeMs: number
  samplesCount: number
}

interface NegotiationResult {
  feasibilityScore: number       // 0~1
  expectedPenaltyPerMonth: number
  violationProbability: number
  alternatives: AlternativeClause[]
  recommendation: 'ACCEPT' | 'NEGOTIATE' | 'REJECT'
}

interface AlternativeClause {
  stance: 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE'
  availability: number
  rtoMinutes: number
  rpoMinutes: number
  rationale: string
}
```

## 주요 메서드

- `analyze(proposal, history, grade)` — 전체 파이프라인
- `computeFeasibility(proposal, history)` — 달성 가능성
- `estimatePenalty(proposal, violationProb)` — 위약금
- `generateAlternatives(proposal, history)` — 3개 옵션
- `getAuditLog()` — 감사로그 반환

## Session Guide

- 구현 파일: `platform/services/ai-service/src/lib/sla-negotiator-ai.ts`
- 테스트 파일: `__tests__/sla-negotiator-ai.test.ts`
- C/S등급 차단: `if (grade !== 'O') throw Error('BLOCKED')`

## Design Anchor

- Plan Ref: `SVC-AI-ADV-R138.plan.md`
- 의존성: 없음 (순수 계산, O등급 메타데이터만)
