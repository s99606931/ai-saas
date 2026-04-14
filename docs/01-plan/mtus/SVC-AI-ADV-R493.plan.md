# SVC-AI-ADV-R493 Plan — public-kpi-automator-v2.ts

## 요구사항
FR-R493.1: KPI 항목 등록 (kpiId, name, targetValue, unit)
FR-R493.2: KPI 실적 기록 (kpiId, actualValue, dataGrade?)
FR-R493.3: KPI 달성률 조회 (kpiId) — actualValue/targetValue*100
FR-R493.4: 미달성 KPI 목록 조회 (달성률 < 100)
FR-R493.5: 감사 로그 조회 (getAuditLog)

## 성공 기준
SC-R493.1: N2SF N-05 C/S 등급 차단
SC-R493.2: CSAP D-06 감사 로그 append-only
SC-R493.3: CSAP D-09 PII SHA-256 마스킹
