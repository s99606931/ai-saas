# SVC-AI-ADV-R159 — 공공 입찰 분석 AI (Design)

> 작성일: 2026-04-12 | 버전: 1.0.0

## 타입

```typescript
export enum DataGrade { C = 'C', S = 'S', O = 'O' }

export interface BidNotice {
  id: string
  title: string
  budget: number
  requirements: string[]   // 자격 요건 키워드
  deadline: string         // ISO date
  category: string
}

export interface CompanyProfile {
  capabilities: string[]   // 보유 역량 키워드
  pastBudgetRange: [number, number]
  certifications: string[]
}

export type BidStrategy = 'conservative' | 'aggressive' | 'priority'

export interface BidAnalysis {
  noticeId: string
  eligibilityScore: number  // 0~1
  eligibilityGaps: string[] // 미충족 요건
  budgetFit: boolean
  recommendedStrategy: BidStrategy
  winProbability: number    // 0~1
  recommendations: string[]
}

class PublicBidAnalyzer {
  constructor(grade: DataGrade)
  registerNotice(notice: BidNotice): void
  analyze(noticeId: string, profile: CompanyProfile): BidAnalysis
  getAuditLog(): readonly AuditEntry[]
}
```

## 알고리즘

- eligibilityScore: 충족 요건 / 전체 요건 (Jaccard: profile.capabilities ∩ notice.requirements)
- budgetFit: notice.budget 이 profile.pastBudgetRange 내
- winProbability: eligibilityScore * (budgetFit ? 1.0 : 0.5)
- strategy: eligibilityScore >= 0.8 → aggressive, >= 0.5 → conservative, else → priority (역량 강화 우선)
