# SVC-AI-ADV-R253 — 모델 공정성 평가기 Design

> 작성일: 2026-04-13 | 버전: 1.0.0

## 컴포넌트 설계

```
ModelFairnessEvaluator
├── registerModel(modelId, name, protectedAttribute, grade)
├── recordPrediction(modelId, group, predicted, actual)
├── calculateDemographicParity(modelId): GroupMetrics
├── calculateEqualOpportunity(modelId): GroupMetrics
├── evaluateDisparateImpact(modelId): FairnessReport
├── recommendMitigation(modelId): MitigationAdvice[]
└── getAuditLog(): AuditEntry[]
```

## 핵심 알고리즘

- **Demographic Parity**: P(Ŷ=1 | A=a) 그룹별 비교
- **Equal Opportunity**: P(Ŷ=1 | Y=1, A=a) 그룹별 비교
- **Disparate Impact**: min(그룹 양성률) / max(그룹 양성률) ≥ 0.8 → PASS
- **편향 등급**: ratio ≥ 0.9 → FAIR, ≥ 0.8 → BORDERLINE, < 0.8 → BIASED

## CSAP D-06 준수

- 공정성 측정·완화 권고 감사 로그
- N2SF C/S 차단
