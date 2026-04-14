# SVC-AI-ADV-R507 Plan — multicloud-resource-optimizer-v2.ts

## 요구사항
FR-R507.1: 클라우드 리소스 등록 (resourceId, provider, resourceType, monthlyCost)
FR-R507.2: 사용률 기록 (resourceId, utilizationPercent, dataGrade?)
FR-R507.3: 낭비 비용 계산 (getWastedCost) — monthlyCost * (1 - utilization/100)
FR-R507.4: 최적화 대상 조회 (getOptimizationTargets) — utilization < 30%
FR-R507.5: 감사 로그 조회 (getAuditLog)

## 성공 기준
SC-R507.1: N2SF N-05 C/S 등급 차단
SC-R507.2: CSAP D-06 감사 로그 append-only
