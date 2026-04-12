# SVC-AI-ADV-R188 — 공공조달 분석기 (Design)

> 작성일: 2026-04-12 | 버전: 1.0.0

## 타입

```typescript
export type ProcurementMethod = 'LOWEST_PRICE' | 'QUALIFIED' | 'COMPREHENSIVE'
export interface Tender { tenderId: string; item: string; budget: number; deadline: string; method: ProcurementMethod }
export interface Award { tenderId: string; awardedPrice: number; vendor: string; awardedAt: string }
export interface AnomalyResult { tenderId: string; awardRate: number; isAnomaly: boolean; reason: string }
export interface ProcurementStats { item: string; avgAwardRate: number; count: number }
class PublicProcurementAnalyzer {
  registerTender(tender: Tender): void
  recordAward(award: Award): AnomalyResult
  getStats(): ProcurementStats[]
  getAuditLog(): AuditEntry[]
}
```

## 알고리즘
- awardRate = awardedPrice / budget
- isAnomaly: awardRate < 0.5 (덤핑) || awardRate > 1.0 (예산 초과)
- 통계: item별 awardRate 평균
