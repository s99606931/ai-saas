# SVC-AI-ADV-R497 Plan — public-institution-risk-scorer-v2.ts

## 요구사항
FR-R497.1: 기관 등록 (institutionId, name, type)
FR-R497.2: 위험 요소 기록 (institutionId, riskFactor, score, dataGrade?)
FR-R497.3: 총 위험 점수 조회 (getRiskScore) — 누적 합계, max 100
FR-R497.4: 위험 등급 조회 (getRiskLevel) — >=70:high, >=40:medium, else low
FR-R497.5: 고위험 기관 목록 조회 (getHighRiskInstitutions) — riskLevel=high
FR-R497.6: 감사 로그 조회 (getAuditLog)

## 성공 기준
SC-R497.1: N2SF N-05 C/S 등급 차단
SC-R497.2: CSAP D-06 감사 로그 append-only
SC-R497.3: CSAP D-09 PII SHA-256 마스킹
