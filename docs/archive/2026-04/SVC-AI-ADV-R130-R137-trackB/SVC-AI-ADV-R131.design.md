# SVC-AI-ADV-R131 — 정책 효과 분석기 (Design)

> 작성일: 2026-04-12 | Plan: SVC-AI-ADV-R131.plan.md

## 1. 아키텍처

```
registerPolicy → addMetric (before/after)
      ↓
PolicyImpactAnalyzerEngine
  ├─ analyzeEffect() — 전후 차이 + Cohen's d
  ├─ generateReport() — Markdown 보고서
  └─ getAuditLog() — append-only
```

## 2. 타입 정의

```typescript
export type Phase = 'before' | 'after'
export interface PolicyRecord { policyId: string; name: string; implementedDate: string }
export interface MetricEntry { policyId: string; phase: Phase; value: number; date: string }
export interface EffectResult {
  policyId: string; meanBefore: number; meanAfter: number
  difference: number; percentChange: number; cohensD: number
  significance: 'SIGNIFICANT' | 'MARGINAL' | 'NONE'
}
```

## 3. 알고리즘

### §3.1 평균 차이: `meanAfter - meanBefore`
### §3.2 Cohen's d: `(meanAfter - meanBefore) / pooledStd`
### §3.3 유의성: |d| ≥ 0.8 → SIGNIFICANT, ≥ 0.2 → MARGINAL, else NONE

## 4. Design Anchor

- CSAP D-06: 분석 이력 감사 로그
