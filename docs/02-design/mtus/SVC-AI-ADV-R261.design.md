# SVC-AI-ADV-R261 Design — 공급망 위험 점수 엔진

> 작성일: 2026-04-13 | 버전: 1.0.0

## Design Anchor
- Plan Ref: SVC-AI-ADV-R261.plan.md
- Impl: `supply-chain-risk-scorer.ts`

## 점수 공식

```
score =
  min(cveCount * 3, 30) +
  min(incidentCount * 5, 25) +
  (financialStability < 50 ? 20 : 0) +
  (highRiskCountry ? 15 : 0) +
  (missingCerts ? 10 : 0)
```

## 레벨 임계값

| score | level |
|-------|-------|
| <25 | LOW |
| <50 | MEDIUM |
| <75 | HIGH |
| ≥75 | CRITICAL |

## 대체 추천

동일 category & 현재 업체보다 score 낮은 업체 → score asc 정렬 → top 3
